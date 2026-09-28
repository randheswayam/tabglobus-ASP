from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user, get_visible_project, require_role, require_staff, visible_projects
from app.models import Project, Role, User
from app.modules.identity.fields import visible_fields
from app.modules.projects import service as project_service
from app.modules.workflow.health import project_health
from app.schemas import ProjectIn, project_detail, project_summary, visit_history_row

router = APIRouter(tags=["projects"], dependencies=[Depends(require_staff)])


@router.post("/projects", status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectIn, db: Session = Depends(get_db), user: User = Depends(require_role(Role.architect))
) -> dict:
    engineer = db.get(User, body.civil_engineer_id)
    if engineer is None or engineer.role != Role.civil_engineer or not engineer.is_active:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "civil_engineer_id must be an active Civil Engineer")

    project = project_service.create_project(
        db,
        user,
        name=body.name,
        location=body.location,
        engineer=engineer,
        legal_expected_date=body.legal_expected_date,
        start_stage=body.start_stage,
        historical_confirmed_by=body.historical_confirmed_by,
        client=body.client,
        site=body.site,
    )
    db.commit()
    db.refresh(project)
    return project_detail(db, project, user)


@router.get("/projects")
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    return [
        visible_fields(user, {**project_summary(p), "workflow": project_health(db, p)})
        for p in db.scalars(visible_projects(user))
    ]


@router.get("/projects/{project_id}")
def get_project(
    project: Project = Depends(get_visible_project),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    return project_detail(db, project, user)


@router.get("/projects/{project_id}/visits")
def list_visits(project: Project = Depends(get_visible_project)) -> list[dict]:
    """Every submitted visit on the project, newest first. Drafts are not history."""
    return [visit_history_row(v) for v in reversed(project.site_visits) if v.status.value != "draft"]


@router.get("/users")
def list_users(
    role: Role | None = None, db: Session = Depends(get_db), _: User = Depends(require_role(Role.architect))
) -> list[dict]:
    stmt = select(User).where(User.is_active.is_(True)).order_by(User.id)
    if role is not None:
        stmt = stmt.where(User.role == role)
    return [{"id": u.id, "name": u.name, "role": u.role.value} for u in db.scalars(stmt)]
