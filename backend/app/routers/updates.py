"""Sharing a site update with the client: the Architect or Team Lead picks the note and the photos."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_visible_project, require_role, require_staff, visible_projects
from app.models import MediaKind, Project, Role, SharedUpdate, SharedUpdatePhoto, SiteVisit, User, VisitStatus
from app.schemas import iso_utc, user_brief
from app.services import audit, notify

router = APIRouter(tags=["shared updates"], dependencies=[Depends(require_staff)])


class ShareIn(BaseModel):
    note: str | None = None
    media_ids: list[int] = []


def _out(u: SharedUpdate) -> dict:
    return {
        "id": u.id,
        "visit_id": u.site_visit_id,
        "note": u.note,
        "shared_at": iso_utc(u.created_at),
        "shared_by": user_brief(u.shared_by),
        "photo_ids": [p.media_id for p in u.photos],
    }


@router.post("/site-visits/{visit_id}/share", status_code=status.HTTP_201_CREATED)
def share_update(
    visit_id: int,
    body: ShareIn,
    user: User = Depends(require_role(Role.architect, Role.team_lead)),
    db: Session = Depends(get_db),
) -> dict:
    visit = db.get(SiteVisit, visit_id)
    if visit is None or db.scalars(visible_projects(user).where(Project.id == visit.project_id)).first() is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Site visit not found")
    if visit.status != VisitStatus.approved:
        raise HTTPException(status.HTTP_409_CONFLICT, "Only approved visits can be shared with the client")
    note = (body.note or "").strip()
    photos = {m.id: m for m in visit.media if m.kind == MediaKind.photo}
    missing = [] if note else ["note"]
    invalid = [f"media_ids.{i}" for i in body.media_ids if i not in photos]
    if missing or invalid:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            {"message": "Write a note, and pick photos from this visit only", "missing": missing, "invalid": invalid},
        )
    update = SharedUpdate(project_id=visit.project_id, site_visit_id=visit.id, note=note, shared_by_id=user.id)
    update.photos = [SharedUpdatePhoto(media_id=i) for i in dict.fromkeys(body.media_ids)]
    db.add(update)
    db.flush()
    audit.record(
        db,
        user,
        "update.shared",
        project_id=visit.project_id,
        entity_type="shared_update",
        entity_id=update.id,
        detail={"visit_id": visit.id, "photos": len(update.photos)},
    )
    notify.update_shared(db, visit.project, user)
    db.commit()
    db.refresh(update)
    return _out(update)


@router.get("/projects/{project_id}/shared-updates")
def list_shared(project: Project = Depends(get_visible_project), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(
        select(SharedUpdate).where(SharedUpdate.project_id == project.id).order_by(SharedUpdate.id.desc())
    )
    return [_out(u) for u in rows]
