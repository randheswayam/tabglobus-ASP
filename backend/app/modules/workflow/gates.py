"""Gate evaluators. Each gate type registers one function (stage, facts) -> [reasons]; an empty list means the
gate is met. A stage lists its gate types in stage_config; its reasons are all unmet gates' reasons, in order.
New gate types register here and never add checks to the UI or endpoints (CLAUDE.md)."""

from collections.abc import Callable
from datetime import datetime

Evaluator = Callable[[dict, object], list[str]]
_REGISTRY: dict[str, Evaluator] = {}


def register(gate_type: str) -> Callable[[Evaluator], Evaluator]:
    def deco(fn: Evaluator) -> Evaluator:
        if gate_type in _REGISTRY:
            raise ValueError(f"gate {gate_type!r} is already registered")
        _REGISTRY[gate_type] = fn
        return fn

    return deco


def unregister(gate_type: str) -> None:
    _REGISTRY.pop(gate_type, None)


def registered() -> list[str]:
    return list(_REGISTRY)


def reasons(stage: dict, facts) -> list[str]:
    out = []
    for gate_type in stage["gates"]:
        if gate_type not in _REGISTRY:
            raise KeyError(f"no evaluator registered for gate {gate_type!r}")
        out += _REGISTRY[gate_type](stage, facts)
    return out


def _date(iso: str | None) -> str:
    return datetime.fromisoformat(iso).strftime("%d %b %Y").lstrip("0") if iso else ""


@register("legal_approval")
def _legal(stage: dict, facts) -> list[str]:
    if facts.legal_status != "Approved":
        return [f"Legal Approval is {facts.legal_status}, not Approved"]
    return []


@register("no_open_major_problems")
def _major_problems(stage: dict, facts) -> list[str]:
    n = facts.open_major_problems
    return [f"{n} open High or Critical problem{'s' if n != 1 else ''}"] if n else []


@register("client_signoff")
def _client_signoff(stage: dict, facts) -> list[str]:
    req = facts.signoffs.get(stage["key"])
    if req is None or req["status"] == "draft":
        return ["Sign-off package not sent to the client yet"]
    if req["status"] == "sent":
        return [f"Waiting for client sign-off on version {req['version']}, sent {_date(req['sent_at'])}"]
    if req["status"] == "changes_requested":
        return [f"The client asked for changes on version {req['version']}; prepare version {req['version'] + 1}"]
    return []
