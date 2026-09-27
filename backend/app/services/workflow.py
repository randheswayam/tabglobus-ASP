"""Step transitions for the three-step workflow. Each change is audited; the caller commits."""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models import Project, StepStatus, User, WorkflowStep
from app.services import audit

LEGAL, SITE_VISIT, REVIEW = 1, 2, 3


def step(project: Project, order: int) -> WorkflowStep:
    return next(s for s in project.steps if s.order == order)


def is_active(project: Project, order: int) -> bool:
    return step(project, order).status == StepStatus.active


def _set(db: Session, project: Project, order: int, new: StepStatus, actor: User, action: str) -> None:
    s = step(project, order)
    if s.status == new:
        return
    now = datetime.now(UTC)
    s.status = new
    if new == StepStatus.active:
        s.activated_at, s.completed_at = now, None
    elif new == StepStatus.completed:
        s.completed_at = now
    audit.record(
        db, actor, action, project_id=project.id, entity_type="workflow_step", entity_id=s.id, detail={"step": s.name}
    )


def activate(db: Session, project: Project, order: int, actor: User) -> None:
    _set(db, project, order, StepStatus.active, actor, "step.activated")


def complete(db: Session, project: Project, order: int, actor: User) -> None:
    _set(db, project, order, StepStatus.completed, actor, "step.completed")


def lock(db: Session, project: Project, order: int, actor: User) -> None:
    _set(db, project, order, StepStatus.locked, actor, "step.locked")
