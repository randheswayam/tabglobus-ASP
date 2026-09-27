"""The stage engine for the residential flow (stage_config.STAGES).

Pure functions decide which stages open and why a stage is blocked; the database helpers below apply
that to a project. Stored statuses are locked, active, completed and historical. The engine reports
two more views of an active stage: blocked (a gate is unmet, with reasons) or active (work can finish).
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import stage_config as sc
from app.models import LegalStatus, Problem, ProblemStatus, Project, ProjectStage, StageStatus, User
from app.services import audit

DONE = ("completed", "historical")


@dataclass
class GateFacts:
    legal_status: str
    open_major_problems: int
    # stage key -> the latest sign-off request for it: {"status", "version", "sent_at"}
    signoffs: dict = field(default_factory=dict)


def to_release(statuses: dict[str, str], config=sc.STAGES) -> list[str]:
    """Locked stages whose predecessors are all done, in flow order. Parallel branches release together."""
    return [s["key"] for s in config
            if statuses[s["key"]] == "locked" and all(statuses[p] in DONE for p in s["predecessors"])]


def _date(iso: str | None) -> str:
    return datetime.fromisoformat(iso).strftime("%d %b %Y").lstrip("0") if iso else ""


def gate_reasons(stage: dict, facts: GateFacts) -> list[str]:
    gate = stage["gate"]
    if gate == "legal_approval" and facts.legal_status != "Approved":
        return [f"Legal Approval is {facts.legal_status}, not Approved"]
    if gate == "no_open_major_problems" and facts.open_major_problems:
        n = facts.open_major_problems
        return [f"{n} open High or Critical problem{'s' if n != 1 else ''}"]
    if gate == "client_signoff":
        req = facts.signoffs.get(stage["key"])
        if req is None or req["status"] == "draft":
            return ["Sign-off package not sent to the client yet"]
        if req["status"] == "sent":
            return [f"Waiting for client sign-off on version {req['version']}, sent {_date(req['sent_at'])}"]
        if req["status"] == "changes_requested":
            return [f"The client asked for changes on version {req['version']}; prepare version {req['version'] + 1}"]
    return []


def evaluate(statuses: dict[str, str], facts: GateFacts, config=sc.STAGES) -> dict[str, dict]:
    """For every stage: {"state": locked | active | blocked | completed | historical, "reasons": [...]}."""
    labels = {s["key"]: s["label"] for s in config}
    out = {}
    for s in config:
        stored = statuses[s["key"]]
        if stored in DONE:
            out[s["key"]] = {"state": stored, "reasons": []}
        elif stored == "locked":
            waiting = [labels[p] for p in s["predecessors"] if statuses[p] not in DONE]
            out[s["key"]] = {"state": "locked", "reasons": [f"Waiting for: {', '.join(waiting)}"] if waiting else []}
        else:
            reasons = gate_reasons(s, facts)
            out[s["key"]] = {"state": "blocked" if reasons else "active", "reasons": reasons}
    return out


# ---------- database helpers ----------

def create_stages(db: Session, project: Project, start_stage: str | None = None,
                  confirmed_by: str | None = None, note: str | None = None) -> None:
    """All stages for a new project. With start_stage, earlier stages are historical (PRD 7.19)."""
    cut = [s["key"] for s in sc.STAGES].index(start_stage) if start_stage else 0
    for i, s in enumerate(sc.STAGES):
        row = ProjectStage(project_id=project.id, key=s["key"], status=StageStatus.locked)
        if i < cut:
            row.status = StageStatus.historical
            row.historical_confirmed_by = confirmed_by
            row.historical_note = note or "Completed before SiteFlow."
        db.add(row)
    db.flush()


def stage_rows(db: Session, project: Project) -> dict[str, ProjectStage]:
    rows = db.scalars(select(ProjectStage).where(ProjectStage.project_id == project.id)).all()
    return {r.key: r for r in rows}


def facts(db: Session, project: Project, signoffs: dict | None = None) -> GateFacts:
    la = project.legal_approval
    major = db.scalar(select(func.count()).select_from(Problem).where(
        Problem.project_id == project.id, Problem.status == ProblemStatus.open,
        Problem.severity.in_(("High", "Critical"))))
    return GateFacts(legal_status=la.status.value if la else LegalStatus.not_started.value,
                     open_major_problems=major or 0, signoffs=signoffs or {})


def release(db: Session, project: Project, actor: User | None) -> list[str]:
    """Activate every stage whose predecessors are done; audit each one. Returns the keys activated."""
    rows = stage_rows(db, project)
    opened = to_release({k: r.status.value for k, r in rows.items()})
    now = datetime.now(timezone.utc)
    for key in opened:
        rows[key].status, rows[key].started_at = StageStatus.active, now
        audit.record(db, actor, "stage.activated", project_id=project.id, entity_type="project_stage",
                     entity_id=rows[key].id, detail={"stage": sc.BY_KEY[key]["label"], "key": key})
    db.flush()
    return opened
