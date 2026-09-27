"""In-app notifications (plan F10). Each helper adds rows to the session; the caller commits them
with the change they announce. Nobody is notified about their own action."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Notification, Project, ProjectMember, Role, User
from app.schemas import civil_engineer_of


def _send(db: Session, users, kind: str, project: Project, text: str, actor: User | None = None,
          include_invited: bool = False) -> None:
    """include_invited: also reach clients who have not activated yet, so the request is waiting at first sign-in."""
    seen = set()
    for u in users:
        if u is None or u.id in seen or (actor is not None and u.id == actor.id):
            continue
        if not u.is_active and not (include_invited and u.role == Role.client):
            continue
        seen.add(u.id)
        db.add(Notification(user_id=u.id, project_id=project.id, kind=kind, text=text))


def _team_leads(db: Session) -> list[User]:
    return list(db.scalars(select(User).where(User.role == Role.team_lead)))


def _architect(db: Session, project: Project) -> User | None:
    return db.get(User, project.created_by_id)


def _members_with_role(db: Session, project: Project, role: str) -> list[User]:
    """Queried, not read from project.members, so members added in this transaction are included."""
    return list(db.scalars(select(User).join(ProjectMember, ProjectMember.user_id == User.id)
                           .where(ProjectMember.project_id == project.id, User.role == Role(role))))


def stage_ready(db: Session, project: Project, stage: dict, actor: User | None) -> None:
    """A stage opened: tell the people who own it. Client stages are announced when a package is sent."""
    role = stage["owner_role"]
    if role == "client":
        return
    users = _team_leads(db) if role == "team_lead" else _members_with_role(db, project, role)
    _send(db, users, "stage_ready", project, f"{stage['label']} is open on {project.name}.", actor)


def update_shared(db: Session, project: Project, actor: User) -> None:
    _send(db, _members_with_role(db, project, "client"), "update_shared", project,
          f"Your architect shared a site update on {project.name}.", actor, include_invited=True)


def signoff_sent(db: Session, project: Project, stage_label: str, version: int, actor: User) -> None:
    _send(db, _members_with_role(db, project, "client"), "signoff_requested", project,
          f"Please review and sign off: {stage_label} (version {version}) on {project.name}.", actor, include_invited=True)


def signoff_answered(db: Session, project: Project, stage_label: str, version: int, client: User,
                     signer_name: str | None, comment: str | None) -> None:
    text = (f"{signer_name} signed off {stage_label} (version {version}) on {project.name}." if comment is None
            else f"{client.name} asked for changes on {stage_label} (version {version}) on {project.name}: {comment}")
    _send(db, [_architect(db, project), *_team_leads(db)], "signoff_answered", project, text, client)


def legal_approved(db: Session, project: Project, actor: User) -> None:
    _send(db, [civil_engineer_of(project)], "step_unlocked", project,
          f"Legal Approval is approved on {project.name}. Site Visit is open.", actor)


def submitted(db: Session, project: Project, engineer: User) -> None:
    _send(db, _team_leads(db), "submitted", project,
          f"{engineer.name} submitted a site visit on {project.name} for review.", engineer)


def approved(db: Session, project: Project, progress: float, actor: User) -> None:
    _send(db, [civil_engineer_of(project), _architect(db, project)], "approved", project,
          f"The site visit on {project.name} is approved. Progress {progress:g}% is now official.", actor)


def rework(db: Session, project: Project, comment: str, actor: User) -> None:
    _send(db, [civil_engineer_of(project)], "rework", project,
          f"{actor.name} sent the site visit on {project.name} back for rework: {comment}", actor)


def red_flag(db: Session, project: Project, label: str) -> None:
    _send(db, [_architect(db, project), *_team_leads(db)], "red_flag", project,
          f"Red flag on {project.name}: {label}.")
