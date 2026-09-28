"""Field-level rules (PRD v3.2 5.1, CLAUDE.md): which roles may see commercial fields. Applied where responses are
built, so a denied role never receives the keys, whatever the screen shows."""

from app.models import Role, User

# TBD_PARVEZ: who may see a project's fee plan. Clients never do (client_view builds its own allow-list).
FIELD_RULES: dict[str, list[str]] = {
    "fee_plan": ["admin", "accounts", "team_lead", "architect"],
}

# Audit entries whose details carry commercial values; denied roles see the event but not its values.
COMMERCIAL_AUDIT: dict[str, str] = {"fee_plan.": "fee_plan"}


def can_see(user: User, field: str) -> bool:
    return user.role != Role.client and user.role.value in FIELD_RULES.get(field, [])


def visible_fields(user: User, data: dict) -> dict:
    """data without the ruled fields this user may not see."""
    return {k: v for k, v in data.items() if k not in FIELD_RULES or can_see(user, k)}


def redact_audit(user: User, entries: list[dict]) -> list[dict]:
    out = []
    for e in entries:
        field = next((f for prefix, f in COMMERCIAL_AUDIT.items() if e["action"].startswith(prefix)), None)
        out.append({**e, "detail": {}} if field and not can_see(user, field) else e)
    return out
