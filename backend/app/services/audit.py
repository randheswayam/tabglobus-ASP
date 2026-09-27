import enum
from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditEvent, User

# Never written to the audit log, even when a caller passes them as changes.
SECRET_FIELDS = frozenset({"password_hash", "refresh_hash", "previous_hash", "code_hash", "token_hash"})


def _json(v: Any) -> Any:
    if isinstance(v, enum.Enum):
        return v.value
    if isinstance(v, datetime | date):
        return v.isoformat()
    return v


def diff(obj: Any, new_values: dict[str, Any]) -> dict[str, list]:
    """{field: [old, new]} for the fields whose value would change, as JSON-friendly values."""
    out = {}
    for field, new in new_values.items():
        old = getattr(obj, field, None)
        if _json(old) != _json(new):
            out[field] = [_json(old), _json(new)]
    return out


def record(
    db: Session,
    actor: User | None,
    action: str,
    *,
    project_id: int | None,
    entity_type: str,
    entity_id: int | None,
    detail: dict | None = None,
    changes: dict[str, list] | None = None,
) -> AuditEvent:
    """Append an audit event to the session; the caller commits it with the change it describes.
    actor is None for events SiteFlow records by itself (automatic red flags). changes holds
    {field: [old, new]}; secret fields are dropped."""
    detail = dict(detail or {})
    if changes:
        kept = {k: v for k, v in changes.items() if k not in SECRET_FIELDS}
        if kept:
            detail["changes"] = kept
    ev = AuditEvent(
        project_id=project_id,
        actor_id=actor.id if actor else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        detail=detail,
    )
    db.add(ev)
    return ev
