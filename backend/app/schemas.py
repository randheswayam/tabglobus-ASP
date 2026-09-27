from datetime import date, datetime, timezone

from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditEvent, Project, Role, SiteVisit, StepStatus, User


def _not_blank(v: str) -> str:
    v = v.strip()
    if not v:
        raise ValueError("must not be blank")
    return v


class ProjectIn(BaseModel):
    name: str
    location: str
    civil_engineer_id: int
    legal_expected_date: date | None = None

    _strip = field_validator("name", "location")(_not_blank)


# ---------- serializers ----------

def iso_utc(t: datetime | None) -> str | None:
    """ISO 8601 with an explicit UTC offset. SQLite returns naive datetimes; they are stored as UTC."""
    if t is None:
        return None
    return (t.replace(tzinfo=timezone.utc) if t.tzinfo is None else t.astimezone(timezone.utc)).isoformat()


def user_brief(u: User | None) -> dict | None:
    return None if u is None else {"id": u.id, "name": u.name, "role": u.role.value}


def civil_engineer_of(project: Project) -> User | None:
    return next((pm.user for pm in project.members if pm.user.role == Role.civil_engineer), None)


def current_step_name(project: Project) -> str | None:
    active = next((s for s in project.steps if s.status == StepStatus.active), None)
    return active.name if active else None


def latest_visit(project: Project) -> SiteVisit | None:
    return project.site_visits[-1] if project.site_visits else None


def approved_at(v: SiteVisit) -> str | None:
    approve = next((r for r in reversed(v.reviews) if r.decision.value == "approve"), None)
    return iso_utc(approve.created_at) if approve else None


def visit_history_row(v: SiteVisit) -> dict:
    return {
        "id": v.id,
        "status": v.status.value,
        "current_stage": v.current_stage,
        "computed_progress": v.computed_progress,
        "submission_count": v.submission_count,
        "submitted_at": iso_utc(v.submitted_at),
        "approved_at": approved_at(v),
        "engineer": user_brief(v.engineer),
    }


def visit_numbers(project: Project) -> tuple[int, int | None]:
    """(approved visits, number of the visit now in progress). No visit is in progress before Legal Approval."""
    approved = sum(1 for v in project.site_visits if v.status.value == "approved")
    legal_done = project.steps and project.steps[0].status == StepStatus.completed
    return approved, (approved + 1 if legal_done else None)


def visit_brief(v: SiteVisit | None) -> dict | None:
    if v is None:
        return None
    rework = next((r for r in reversed(v.reviews) if r.decision.value == "rework"), None)
    return {
        "id": v.id,
        "status": v.status.value,
        "submission_count": v.submission_count,
        "computed_progress": v.computed_progress,
        "submitted_at": iso_utc(v.submitted_at),
        "rework_comment": rework.comment if rework and v.status.value == "rework" else None,
    }


def visit_out(v: SiteVisit) -> dict:
    """Full submission for the engineer and the review screen."""
    return {
        **visit_brief(v),
        "project": {"id": v.project.id, "name": v.project.name, "location": v.project.location},
        "engineer": user_brief(v.engineer),
        "current_stage": v.current_stage,
        "form": v.form,
        "checklist": v.checklist,
        "no_issues": v.no_issues,
        "problems": v.problems,
        "reviews": [{"decision": r.decision.value, "comment": r.comment, "reviewer": user_brief(r.reviewer),
                     "at": iso_utc(r.created_at)} for r in v.reviews],
    }


def legal_out(project: Project) -> dict | None:
    la = project.legal_approval
    if la is None:
        return None
    iso = lambda d: d.isoformat() if d else None  # noqa: E731
    return {
        "status": la.status.value,
        "authority_name": la.authority_name,
        "application_reference": la.application_reference,
        "application_date": iso(la.application_date),
        "approval_date": iso(la.approval_date),
        "expected_date": iso(la.expected_date),
        "document_reference": la.document_reference,
    }


def project_summary(project: Project) -> dict:
    v = latest_visit(project)
    return {
        "id": project.id,
        "name": project.name,
        "location": project.location,
        "current_step": current_step_name(project),
        "official_progress": project.official_progress,
        "latest_visit_status": v.status.value if v else None,
        "civil_engineer": user_brief(civil_engineer_of(project)),
    }


def project_detail(db: Session, project: Project) -> dict:
    events = db.scalars(select(AuditEvent).where(AuditEvent.project_id == project.id)
                        .order_by(AuditEvent.id)).all()
    actors = {u.id: u.name for u in db.scalars(select(User).where(User.id.in_({e.actor_id for e in events})))}
    return {
        **project_summary(project),
        "template": {"id": project.template_id, "version": project.template_version},
        "steps": [{"order": s.order, "name": s.name, "status": s.status.value} for s in project.steps],
        "legal_approval": legal_out(project),
        "latest_visit": visit_brief(latest_visit(project)),
        "approved_visits": visit_numbers(project)[0],
        "visit_number": visit_numbers(project)[1],
        "audit": [{"action": e.action, "actor": actors.get(e.actor_id), "at": iso_utc(e.created_at),
                   "detail": e.detail} for e in events],
    }
