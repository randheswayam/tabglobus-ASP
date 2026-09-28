"""Workflow health per stage, for the dashboard callout and icons. Rule-based and explainable: every stage gets
a health and a plain reason.

  done      completed, or historical (before SiteFlow)             green
  waiting   open (active or blocked): the engine's first reason   yellow
  delayed   an open red flag applies to it, or it has been open    red
            longer than STAGE_DELAYED_AFTER_DAYS[stage] (off by default)
  upcoming  not open yet                                           grey

This is an early version of the V4 traffic lights (PRD V4 6.2); V04 builds on the same rules (R-12)."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import stage_config as sc
from app import workflow_config as wc
from app.clock import business_date
from app.models import Project, RedFlag, SignoffRequest
from app.services import stages

# Which stage each red flag rule delays. client_decision_overdue names its sign-off: key signoff-<id>.
FLAG_STAGE = {
    "legal_delay": "line_out",
    "critical_issue": "construction",
    "overdue_fix": "construction",
    "review_overdue": "construction",
    "repeated_rework": "construction",
    "no_recent_visit": "construction",
}


def phase_health(items: list[dict]) -> str:
    """The worst of the phase's stages; a phase partly done with nothing open is still in progress."""
    kinds = {i["health"] for i in items}
    if "delayed" in kinds:
        return "delayed"
    if "waiting" in kinds:
        return "waiting"
    if kinds == {"done"}:
        return "done"
    if kinds == {"upcoming"}:
        return "upcoming"
    return "waiting"


def _aware(t: datetime) -> datetime:
    return t.replace(tzinfo=UTC) if t.tzinfo is None else t


def stage_health(
    view: dict[str, dict],
    *,
    started: dict[str, datetime],
    flags: list[tuple[str, str]],
    signoff_stages: dict[int, str],
    now: datetime,
) -> dict:
    """view: the stage engine's {key: {state, reasons}}; flags: open (rule, key) pairs."""
    flagged: dict[str, str] = {}
    for rule, key in flags:
        stage = FLAG_STAGE.get(rule)
        if rule == "client_decision_overdue" and key.startswith("signoff-"):
            stage = signoff_stages.get(int(key.split("-", 1)[1]))
        if stage and stage not in flagged:
            flagged[stage] = wc.RED_FLAG_RULES[rule]["label"]

    counts = {"done": 0, "waiting": 0, "delayed": 0, "upcoming": 0}

    def one(s: dict) -> dict:
        key, state = s["key"], view[s["key"]]["state"]
        reasons = view[s["key"]]["reasons"]
        if state in stages.DONE:
            health, reason = "done", "Completed before SiteFlow" if state == "historical" else "Completed"
        elif key in flagged:
            health, reason = "delayed", flagged[key]
        elif state in ("active", "blocked"):
            health, reason = "waiting", reasons[0] if reasons else "In progress"
            limit = wc.STAGE_DELAYED_AFTER_DAYS.get(key)
            if limit is not None and key in started:
                days = (business_date(now) - business_date(_aware(started[key]))).days
                if days > limit:
                    health, reason = "delayed", f"Open for {days} days (limit {limit})"
        else:
            health, reason = "upcoming", None
        counts[health] += 1
        return {
            "key": key,
            "number": s["number"],
            "label": s["label"],
            "icon": s["icon"],
            "health": health,
            "reason": reason,
        }

    phases = []
    for p in sc.PHASES:
        items = [one(s) for s in sc.STAGES if s["phase"] == p["number"]]
        phases.append(
            {
                "number": p["number"],
                "name": p["name"],
                "icon": p["icon"],
                "health": phase_health(items),
                "stages": items,
            }
        )
    return {"phases": phases, "counts": counts}


def project_health(db: Session, project: Project, now: datetime | None = None) -> dict | None:
    rows = stages.stage_rows(db, project)
    if not rows:
        return None
    view = stages.evaluate(
        {k: r.status.value for k, r in rows.items()},
        stages.facts(db, project, stages.signoff_facts(db, project)),
    )
    open_flags = db.execute(
        select(RedFlag.rule, RedFlag.key).where(RedFlag.project_id == project.id, RedFlag.cleared_at.is_(None))
    ).all()
    signoff_stages = dict(
        db.execute(
            select(SignoffRequest.id, SignoffRequest.stage_key).where(SignoffRequest.project_id == project.id)
        ).all()
    )
    return stage_health(
        view,
        started={k: r.started_at for k, r in rows.items() if r.started_at},
        flags=[(rule, key) for rule, key in open_flags],
        signoff_stages=signoff_stages,
        now=now or datetime.now(UTC),
    )
