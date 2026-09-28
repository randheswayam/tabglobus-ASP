"""Recording an exception: an Admin or Team Lead (EXCEPTION_ROLES) passes a placeholder gate on one stage,
with a reason. The exception is audited, published as an event, and can't be changed or removed."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import stage_config as sc
from app import workflow_config as wc
from app.db import get_db
from app.deps import get_current_user, get_visible_project, require_staff
from app.models import Project, StageException, User
from app.modules.workflow import events
from app.modules.workflow.gates import PLACEHOLDER_GATES
from app.services import audit, stages

router = APIRouter(tags=["stages"], dependencies=[Depends(require_staff)])


class ExceptionIn(BaseModel):
    gate: str
    reason: str | None = None


@router.post("/projects/{project_id}/stages/{key}/exceptions", status_code=status.HTTP_201_CREATED)
def record_exception(
    key: str,
    body: ExceptionIn,
    project: Project = Depends(get_visible_project),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    stage = sc.BY_KEY.get(key)
    if stage is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stage not found")
    if user.role.value not in wc.EXCEPTION_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role cannot record exceptions")
    if body.gate not in stage["gates"] or body.gate not in PLACEHOLDER_GATES:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            {"message": "Exceptions can be recorded only for this stage's placeholder checks", "invalid": ["gate"]},
        )
    reason = (body.reason or "").strip()
    if not reason:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, {"message": "Give a reason for the exception", "missing": ["reason"]}
        )
    row = stages.stage_rows(db, project)[key]
    if row.status.value in stages.DONE:
        raise HTTPException(status.HTTP_409_CONFLICT, "This stage is already completed")
    exists = db.scalars(
        select(StageException).where(
            StageException.project_id == project.id, StageException.stage_key == key, StageException.gate == body.gate
        )
    ).first()
    if exists is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "An exception is already recorded for this check")
    ex = StageException(project_id=project.id, stage_key=key, gate=body.gate, reason=reason, by_id=user.id)
    db.add(ex)
    db.flush()
    audit.record(
        db,
        user,
        "stage.exception_recorded",
        project_id=project.id,
        entity_type="stage_exception",
        entity_id=ex.id,
        detail={"stage": stage["label"], "key": key, "gate": body.gate, "reason": reason},
    )
    events.publish(db, "stage.exception_recorded", project=project, stage=stage, gate=body.gate, actor=user)
    db.commit()
    db.refresh(project)
    return stages.project_view(db, project, user)
