from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import stage_config as sc
from app.db import get_db
from app.deps import get_current_user, get_visible_project, require_staff
from app.models import Project, User
from app.services import stages

router = APIRouter(tags=["stages"], dependencies=[Depends(require_staff)])


@router.get("/projects/{project_id}/stages")
def project_stages(project: Project = Depends(get_visible_project), db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)) -> dict:
    return stages.project_view(db, project, user)


class CompleteIn(BaseModel):
    note: str | None = None


@router.post("/projects/{project_id}/stages/{key}/complete")
def complete_stage(key: str, body: CompleteIn, project: Project = Depends(get_visible_project),
                   db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    stage = sc.BY_KEY.get(key)
    if stage is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stage not found")
    rows = stages.stage_rows(db, project)
    view = stages.evaluate({k: r.status.value for k, r in rows.items()},
                           stages.facts(db, project, stages.signoff_facts(db, project)))[key]
    if stage["gate"] == "client_signoff":
        raise HTTPException(status.HTTP_409_CONFLICT, {
            "message": "This stage completes when the client approves the sign-off package", "reasons": view["reasons"]})
    if user.role.value != stage["owner_role"] and user.role.value not in stages.STAFF_COMPLETERS:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role cannot complete this stage")
    if view["state"] != "active":
        message = {"completed": "This stage is already completed", "historical": "This stage is already completed"}.get(
            view["state"], "This stage cannot be completed yet")
        raise HTTPException(status.HTTP_409_CONFLICT, {"message": message, "reasons": view["reasons"]})
    note = (body.note or "").strip()
    if not note:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY,
                            {"message": "Add a note on what was completed", "missing": ["note"]})
    stages.complete(db, project, key, user, note)
    db.commit()
    db.refresh(project)
    return stages.project_view(db, project, user)
