"""Creating a project: one path for the New project form and the bulk import, so both get the same members,
workflow steps, Legal Approval record, stages (historical when onboarded mid-way) and audit."""

from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import template_config as tc
from app.models import LegalApproval, Project, ProjectMember, Role, StepStatus, User, WorkflowStep
from app.modules.projects.clients import ClientIn, SiteIn, resolve_client, resolve_site
from app.modules.workflow import versions
from app.services import audit, stages


def create_project(
    db: Session,
    architect: User,
    *,
    name: str,
    location: str,
    engineer: User,
    legal_expected_date: date | None = None,
    start_stage: str | None = None,
    historical_confirmed_by: str | None = None,
    client: ClientIn | None = None,
    site: SiteIn | None = None,
    actor: User | None = None,
    audit_extra: dict | None = None,
) -> Project:
    """The caller has validated the inputs and commits. architect becomes the project's Project Architect;
    actor (default: the architect) is who did it, for example the Admin running an import."""
    actor = actor or architect
    project = Project(
        name=name,
        location=location,
        created_by_id=architect.id,
        client=resolve_client(db, client, actor),
        site=resolve_site(db, site),
    )
    db.add(project)
    db.flush()

    admins = db.scalars(select(User).where(User.role == Role.admin, User.is_active.is_(True))).all()
    for member_id in {architect.id, engineer.id, *(a.id for a in admins)}:
        db.add(ProjectMember(project_id=project.id, user_id=member_id))

    now = datetime.now(UTC)
    for order, step_name in enumerate(tc.WORKFLOW_STEPS, start=1):
        first = order == 1
        db.add(
            WorkflowStep(
                project_id=project.id,
                order=order,
                name=step_name,
                status=StepStatus.active if first else StepStatus.locked,
                activated_at=now if first else None,
            )
        )
    db.add(LegalApproval(project_id=project.id, expected_date=legal_expected_date))
    audit.record(
        db,
        actor,
        "project.created",
        project_id=project.id,
        entity_type="project",
        entity_id=project.id,
        detail={
            "civil_engineer_id": engineer.id,
            "start_stage": start_stage,
            "historical_confirmed_by": historical_confirmed_by,
            **(audit_extra or {}),
        },
    )
    project.flow_version = versions.current_version(db)
    stages.create_stages(db, project, start_stage, historical_confirmed_by)
    stages.release(db, project, actor)
    return project
