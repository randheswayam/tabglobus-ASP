from sqlalchemy.orm import Session

from app.models import AuditEvent, User


def record(
    db: Session,
    actor: User | None,
    action: str,
    *,
    project_id: int | None,
    entity_type: str,
    entity_id: int | None,
    detail: dict | None = None,
) -> AuditEvent:
    """Append an audit event to the session; the caller commits it with the change it describes.
    actor is None for events SiteFlow records by itself (automatic red flags)."""
    ev = AuditEvent(
        project_id=project_id,
        actor_id=actor.id if actor else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        detail=detail or {},
    )
    db.add(ev)
    return ev
