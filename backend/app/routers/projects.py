from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import template_config as tc
from app.db import get_db
from app.deps import get_current_user, get_visible_project, require_role, visible_projects
from app.models import LegalApproval, Project, ProjectMember, Role, StepStatus, User, WorkflowStep
from app.schemas import ProjectIn, project_detail, project_summary, visit_history_row
from app.services import audit

router = APIRouter(tags=["projects"])


@router.post("/projects", status_code=status.HTTP_201_CREATED)
def create_project(body: ProjectIn, db: Session = Depends(get_db),
                   user: User = Depends(require_role(Role.architect))) -> dict:
    engineer = db.get(User, body.civil_engineer_id)
    if engineer is None or engineer.role != Role.civil_engineer or not engineer.is_active:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "civil_engineer_id must be an active Civil Engineer")

    project = Project(name=body.name, location=body.location, created_by_id=user.id)
    db.add(project)
    db.flush()

    admins = db.scalars(select(User).where(User.role == Role.admin, User.is_active.is_(True))).all()
    for member_id in {user.id, engineer.id, *(a.id for a in admins)}:
        db.add(ProjectMember(project_id=project.id, user_id=member_id))

    now = datetime.now(timezone.utc)
    for order, name in enumerate(tc.WORKFLOW_STEPS, start=1):
        first = order == 1
        db.add(WorkflowStep(project_id=project.id, order=order, name=name,
                            status=StepStatus.active if first else StepStatus.locked,
                            activated_at=now if first else None))
    db.add(LegalApproval(project_id=project.id, expected_date=body.legal_expected_date))
    audit.record(db, user, "project.created", project_id=project.id, entity_type="project",
                 entity_id=project.id, detail={"civil_engineer_id": engineer.id})
    db.commit()
    db.refresh(project)
    return project_detail(db, project)


@router.get("/projects")
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    return [project_summary(p) for p in db.scalars(visible_projects(user))]


@router.get("/projects/{project_id}")
def get_project(project: Project = Depends(get_visible_project), db: Session = Depends(get_db)) -> dict:
    return project_detail(db, project)


@router.get("/projects/{project_id}/visits")
def list_visits(project: Project = Depends(get_visible_project)) -> list[dict]:
    """Every submitted visit on the project, newest first. Drafts are not history."""
    return [visit_history_row(v) for v in reversed(project.site_visits) if v.status.value != "draft"]


@router.get("/users")
def list_users(role: Role | None = None, db: Session = Depends(get_db),
               _: User = Depends(require_role(Role.architect))) -> list[dict]:
    stmt = select(User).where(User.is_active.is_(True)).order_by(User.id)
    if role is not None:
        stmt = stmt.where(User.role == role)
    return [{"id": u.id, "name": u.name, "role": u.role.value} for u in db.scalars(stmt)]
