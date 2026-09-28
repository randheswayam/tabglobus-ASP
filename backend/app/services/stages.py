"""The stage engine for the residential flow (stage_config.STAGES).

Pure functions decide which stages open and why a stage is blocked; the database helpers below apply
that to a project. Stored statuses are locked, active, completed and historical. The engine reports
two more views of an active stage: blocked (a gate is unmet, with reasons) or active (work can finish).
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import stage_config as sc
from app import workflow_config as wc
from app.models import (
    LegalStatus,
    Problem,
    ProblemStatus,
    Project,
    ProjectStage,
    StageAttachment,
    StageException,
    StageStatus,
    User,
)
from app.modules.workflow import events, gates, versions
from app.schemas import iso_utc, user_brief

# notify subscribes to stage events on import; importing it here keeps that true wherever stages is used.
from app.services import audit, notify  # noqa: F401
from app.services.signoffs import latest_by_stage

DONE = ("completed", "historical")


@dataclass
class GateFacts:
    legal_status: str
    open_major_problems: int
    # stage key -> the latest sign-off request for it: {"status", "version", "sent_at"}
    signoffs: dict = field(default_factory=dict)
    # (stage key, gate) pairs passed by a recorded exception
    exceptions: set = field(default_factory=set)


def to_release(statuses: dict[str, str], config=sc.STAGES) -> list[str]:
    """Locked stages whose predecessors are all done, in flow order. Parallel branches release together."""
    return [
        s["key"]
        for s in config
        if statuses[s["key"]] == "locked" and all(statuses[p] in DONE for p in s["predecessors"])
    ]


def gate_reasons(stage: dict, facts: GateFacts) -> list[str]:
    return gates.reasons(stage, facts)


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


def create_stages(
    db: Session,
    project: Project,
    start_stage: str | None = None,
    confirmed_by: str | None = None,
    note: str | None = None,
) -> None:
    """All stages for a new project. With start_stage, earlier stages are historical (PRD 7.19)."""
    flow = versions.flow_for(project)
    cut = [s["key"] for s in flow.stages].index(start_stage) if start_stage else 0
    for i, s in enumerate(flow.stages):
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
    major = db.scalar(
        select(func.count())
        .select_from(Problem)
        .where(
            Problem.project_id == project.id,
            Problem.status == ProblemStatus.open,
            Problem.severity.in_(("High", "Critical")),
        )
    )
    passed = db.execute(
        select(StageException.stage_key, StageException.gate).where(StageException.project_id == project.id)
    ).all()
    return GateFacts(
        legal_status=la.status.value if la else LegalStatus.not_started.value,
        open_major_problems=major or 0,
        signoffs=signoffs or {},
        exceptions={(k, g) for k, g in passed},
    )


HISTORICAL_LABEL = "Historical — completed before SiteFlow"
STAFF_COMPLETERS = ("architect", "team_lead")


def can_complete(user: User, stage: dict, state: str) -> bool:
    """Owners (and the Architect or Team Lead) finish active stages; client sign-off stages finish only by approval."""
    if state != "active" or sc.is_signoff(stage):
        return False
    return user.role.value == stage["owner_role"] or user.role.value in STAFF_COMPLETERS


def can_attach(user: User, stage: dict, status: StageStatus) -> bool:
    """Who may add files: the stage owner, Architect or Team Lead, while the stage is open or as historical evidence."""
    may = user.role.value == stage["owner_role"] or user.role.value in STAFF_COMPLETERS
    return may and not sc.is_signoff(stage) and status in (StageStatus.active, StageStatus.historical)


def signoff_facts(db: Session, project: Project) -> dict:
    """Latest sign-off request per stage, for the client_signoff gate."""
    return latest_by_stage(db, project)


def project_view(db: Session, project: Project, user: User) -> dict:
    """The tracker: phases with their stages, each with state, reasons and what the caller may do."""
    flow = versions.flow_for(project)
    rows = stage_rows(db, project)
    signoffs = signoff_facts(db, project)
    gate_facts = facts(db, project, signoffs)
    view = evaluate({k: r.status.value for k, r in rows.items()}, gate_facts, flow.stages)
    files: dict[str, list[StageAttachment]] = {}
    for a in db.scalars(
        select(StageAttachment).where(StageAttachment.project_id == project.id).order_by(StageAttachment.id)
    ):
        files.setdefault(a.stage_key, []).append(a)
    recorded = {}
    for ex in db.scalars(select(StageException).where(StageException.project_id == project.id)):
        recorded.setdefault(ex.stage_key, []).append(
            {"gate": ex.gate, "reason": ex.reason, "by": user_brief(ex.by), "at": iso_utc(ex.created_at)}
        )

    def stage_out(s):
        r, v = rows[s["key"]], view[s["key"]]
        req = signoffs.get(s["key"])
        return {
            "key": s["key"],
            "number": s["number"],
            "label": s["label"],
            "detail": s["detail"],
            # traceability, not flow behaviour: flows pinned before the map existed read it from the config
            "prd_stage": s.get("prd_stage", sc.PRD_STAGE.get(s["key"])),
            "workstream": s["workstream"],
            "owner_role": s["owner_role"],
            "gates": s["gates"],
            "state": v["state"],
            "reasons": v["reasons"],
            "can_complete": can_complete(user, s, v["state"]),
            "started_at": iso_utc(r.started_at),
            "completed_at": iso_utc(r.completed_at),
            "completed_by": user_brief(r.completed_by),
            "completion_note": r.completion_note,
            "historical": {
                "label": HISTORICAL_LABEL,
                "confirmed_by": r.historical_confirmed_by,
                "note": r.historical_note,
            }
            if r.status == StageStatus.historical
            else None,
            "signed_by_client": bool(req and req["status"] == "approved" and r.status == StageStatus.completed),
            "exceptions": recorded.get(s["key"], []),
            # placeholder gates still waiting for an exception, while the stage is open
            "open_exceptions": [
                g for g in s["gates"] if g in gates.PLACEHOLDER_GATES and (s["key"], g) not in gate_facts.exceptions
            ]
            if v["state"] in ("active", "blocked")
            else [],
            "can_record_exception": user.role.value in wc.EXCEPTION_ROLES,
            "attachments": [attachment_out(a) for a in files.get(s["key"], [])],
            "can_attach": can_attach(user, s, r.status),
            "evidence_required": s["evidence_required"],
            "evidence_missing": evidence_missing(s, files.get(s["key"], [])) if r.status == StageStatus.active else [],
            "evidence_reason": evidence_reason(evidence_missing(s, files.get(s["key"], [])))
            if r.status == StageStatus.active
            else None,
        }

    done = sum(1 for v in view.values() if v["state"] in DONE)
    return {
        "phases": [
            {**p, "stages": [stage_out(s) for s in flow.stages if s["phase"] == p["number"]]} for p in flow.phases
        ],
        "current_stages": [s["label"] for s in flow.stages if view[s["key"]]["state"] in ("active", "blocked")],
        "stage_progress": {"done": done, "total": len(flow.stages)},
        "flow_version": flow.version,
    }


def release(db: Session, project: Project, actor: User | None) -> list[str]:
    """Activate every stage whose predecessors are done; audit each one. Returns the keys activated."""
    flow = versions.flow_for(project)
    rows = stage_rows(db, project)
    opened = to_release({k: r.status.value for k, r in rows.items()}, flow.stages)
    now = datetime.now(UTC)
    for key in opened:
        rows[key].status, rows[key].started_at = StageStatus.active, now
        audit.record(
            db,
            actor,
            "stage.activated",
            project_id=project.id,
            entity_type="project_stage",
            entity_id=rows[key].id,
            detail={"stage": flow.by_key[key]["label"], "key": key},
        )
        events.publish(db, "stage.activated", project=project, stage=flow.by_key[key], actor=actor)
    db.flush()
    return opened


def attachment_out(a: StageAttachment) -> dict:
    return {
        "id": a.id,
        "kind": a.kind,
        "filename": a.filename,
        "content_type": a.content_type,
        "size": a.size,
        "uploaded_by": user_brief(a.uploaded_by),
        "uploaded_at": iso_utc(a.uploaded_at),
        "completed_at": iso_utc(a.completed_at),
    }


KIND_NAMES = {"photo": "photo", "video": "video", "document": "document (PDF)", "cad": "AutoCAD drawing"}


def pending_attachments(db: Session, project: Project, key: str) -> list[StageAttachment]:
    return list(
        db.scalars(
            select(StageAttachment)
            .where(
                StageAttachment.project_id == project.id,
                StageAttachment.stage_key == key,
                StageAttachment.completed_at.is_(None),
            )
            .order_by(StageAttachment.id)
        )
    )


def evidence_missing(stage: dict, files: list[StageAttachment]) -> list[str]:
    """The required kinds of file not yet attached to this stage."""
    have = {a.kind for a in files}
    return [k for k in stage.get("evidence_required", []) if k not in have]


def evidence_reason(missing: list[str]) -> str | None:
    if not missing:
        return None
    return "Add at least one " + " and one ".join(KIND_NAMES[k] for k in missing) + " before completing this stage"


def construction_started(db: Session, project: Project) -> bool:
    """The v2 site-visit loop runs in phase 7 onward: Site line-out has started (or is done)."""
    row = stage_rows(db, project).get(sc.CONSTRUCTION_START)
    return row is not None and row.status in (StageStatus.active, StageStatus.completed, StageStatus.historical)


def visit_approved(db: Session, project: Project, actor: User) -> None:
    """The first approved construction visit shows line-out was done: complete it, which opens stage 15."""
    row = stage_rows(db, project).get(sc.CONSTRUCTION_START)
    if row is not None and row.status == StageStatus.active:
        complete(db, project, sc.CONSTRUCTION_START, actor, "Completed when the first construction visit was approved.")


def complete(db: Session, project: Project, key: str, actor: User | None, note: str | None) -> list[str]:
    """Mark a stage completed, audit it and release its successors. The caller has checked the rules."""
    stage = versions.flow_for(project).by_key[key]
    row = stage_rows(db, project)[key]
    now = datetime.now(UTC)
    row.status, row.completed_at = StageStatus.completed, now
    row.completed_by_id, row.completion_note = (actor.id if actor else None), note
    files = pending_attachments(db, project, key)
    for a in files:
        a.completed_at = now
    audit.record(
        db,
        actor,
        "stage.completed",
        project_id=project.id,
        entity_type="project_stage",
        entity_id=row.id,
        detail={"stage": stage["label"], "key": key, "note": note, "files": [a.filename for a in files]},
    )
    db.flush()
    events.publish(db, "stage.completed", project=project, stage=stage, actor=actor)
    return release(db, project, actor)
