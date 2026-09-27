from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, get_visible_project
from app.models import Project, User
from app.services import stages

router = APIRouter(tags=["stages"])


@router.get("/projects/{project_id}/stages")
def project_stages(project: Project = Depends(get_visible_project), db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)) -> dict:
    return stages.project_view(db, project, user)
