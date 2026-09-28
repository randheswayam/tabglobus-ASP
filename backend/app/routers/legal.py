from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_visible_project, require_role, require_staff
from app.models import LegalStatus, Project, Role, User
from app.schemas import project_detail
from app.services import audit, notify, red_flags, workflow

router = APIRouter(tags=["legal"], dependencies=[Depends(require_staff)])

# Not started → Applied → Approved or Rejected (plan section 4, Step 1). Approved and Rejected are final.
_NEXT = {
    LegalStatus.not_started: {LegalStatus.applied},
    LegalStatus.applied: {LegalStatus.approved, LegalStatus.rejected},
}
_REQUIRED = {
    LegalStatus.applied: ["authority_name", "application_reference", "application_date"],
    LegalStatus.approved: [
        "authority_name",
        "application_reference",
        "application_date",
        "approval_date",
        "document_reference",
    ],
}
_FIELDS = ["authority_name", "application_reference", "application_date", "approval_date", "document_reference"]


class LegalIn(BaseModel):
    status: LegalStatus | None = None
    authority_name: str | None = None
    application_reference: str | None = None
    application_date: date | None = None
    approval_date: date | None = None
    document_reference: str | None = None


def _unprocessable(message: str, missing: list[str] | None = None) -> HTTPException:
    return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, {"message": message, "missing": missing or []})


@router.patch("/projects/{project_id}/legal")
def update_legal(
    body: LegalIn,
    user: User = Depends(require_role(Role.admin)),
    project: Project = Depends(get_visible_project),
    db: Session = Depends(get_db),
) -> dict:
    la = project.legal_approval
    current = la.status
    target = body.status or current
    if current not in _NEXT:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Legal Approval is {current.value} and can no longer change")
    if target != current and target not in _NEXT[current]:
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"Cannot move Legal Approval from {current.value} to {target.value}"
        )

    changes = body.model_dump(exclude_unset=True, exclude={"status"})
    for k, v in changes.items():
        if isinstance(v, str):
            changes[k] = v.strip() or None
    merged = {f: changes.get(f, getattr(la, f)) for f in _FIELDS}

    missing = [f for f in _REQUIRED.get(target, []) if merged[f] in (None, "")]
    if missing:
        raise _unprocessable(f"{target.value} needs every required field", missing)
    if merged["approval_date"] and merged["application_date"] and merged["approval_date"] < merged["application_date"]:
        raise _unprocessable("approval_date cannot be before application_date")

    before_after = audit.diff(la, {"status": target, **changes})
    for f, v in changes.items():
        setattr(la, f, v)
    la.status = target
    audit.record(
        db,
        user,
        "legal.updated",
        project_id=project.id,
        entity_type="legal_approval",
        entity_id=la.id,
        detail={"from": current.value, "to": target.value, "fields": sorted(changes)},
        changes=before_after,
    )

    if target == LegalStatus.approved:
        workflow.complete(db, project, workflow.LEGAL, user)
        workflow.activate(db, project, workflow.SITE_VISIT, user)
        notify.legal_approved(db, project, user)

    red_flags.sync_red_flags(db, project, datetime.now(UTC))
    db.commit()
    db.refresh(project)
    return project_detail(db, project, user)
