"""Red flags (plan section 5.3): which projects need the Architect's attention, and why.

evaluate_flags() is a pure function over plain state, so every rule is testable with a fixed clock.
Thresholds come from workflow_config (placeholders pending Parvez, D4 and D5)."""
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select

from app import workflow_config as wc
from app.clock import business_date
from app.models import Problem, ProblemStatus, RedFlag, Review, ReviewDecision, SiteVisit, StepStatus
from app.schemas import iso_utc, user_brief
from app.services import audit, notify

RULES = wc.RED_FLAG_RULES


@dataclass
class ProblemState:
    id: int
    severity: str
    target_date: date
    open: bool = True


@dataclass
class VisitState:
    id: int
    status: str  # draft | submitted | rework | approved
    submitted_at: datetime | None
    rework_count: int


@dataclass
class ProjectState:
    legal_status: str
    legal_expected_date: date | None
    legal_approved_at: datetime | None
    site_visit_open: bool  # Step 2 is active, so a visit is due
    last_approved_visit_at: datetime | None
    visits: list[VisitState] = field(default_factory=list)
    problems: list[ProblemState] = field(default_factory=list)


def evaluate_flags(s: ProjectState, now: datetime, cfg=wc) -> set[tuple[str, str]]:
    """The (rule, key) pairs that hold right now. Keys: problem-<id>, visit-<id> or project."""
    out: set[tuple[str, str]] = set()
    today = business_date(now)

    for p in s.problems:
        if not p.open:
            continue
        if p.severity in ("High", "Critical"):
            out.add(("critical_issue", f"problem-{p.id}"))
        if p.target_date < today:
            out.add(("overdue_fix", f"problem-{p.id}"))

    if s.legal_status != "Approved" and s.legal_expected_date and today > s.legal_expected_date:
        out.add(("legal_delay", "project"))

    for v in s.visits:
        if v.status == "submitted" and v.submitted_at and now - v.submitted_at > timedelta(hours=cfg.REVIEW_SLA_HOURS):
            out.add(("review_overdue", f"visit-{v.id}"))
        if v.status != "approved" and v.rework_count >= cfg.REWORK_LIMIT:
            out.add(("repeated_rework", f"visit-{v.id}"))

    since = s.last_approved_visit_at or s.legal_approved_at
    if s.site_visit_open and since and now - since > timedelta(days=cfg.VISIT_INTERVAL_DAYS):
        out.add(("no_recent_visit", "project"))

    return out


# ---------- persistence ----------

def _utc(t: datetime | None) -> datetime | None:
    return None if t is None else (t.replace(tzinfo=timezone.utc) if t.tzinfo is None else t)


def project_state(db, project) -> ProjectState:
    """Read what the rules need from the database. Queries, not relationships, so rows added in this
    transaction are seen (the caller flushes first)."""
    steps = {s.order: s for s in project.steps}
    visits = db.scalars(select(SiteVisit).where(SiteVisit.project_id == project.id).order_by(SiteVisit.id)).all()
    reviews = db.execute(select(Review.site_visit_id, Review.decision, func.max(Review.created_at), func.count())
                         .join(SiteVisit).where(SiteVisit.project_id == project.id)
                         .group_by(Review.site_visit_id, Review.decision)).all()
    reworks = {vid: n for vid, d, _, n in reviews if d == ReviewDecision.rework}
    approvals = [_utc(t) for _, d, t, _ in reviews if d == ReviewDecision.approve]
    problems = db.scalars(select(Problem).where(Problem.project_id == project.id)).all()
    la = project.legal_approval
    return ProjectState(
        legal_status=la.status.value if la else "Not started",
        legal_expected_date=la.expected_date if la else None,
        legal_approved_at=_utc(steps[1].completed_at) if steps[1].status == StepStatus.completed else None,
        site_visit_open=steps[2].status == StepStatus.active,
        last_approved_visit_at=max(approvals) if approvals else None,
        visits=[VisitState(id=v.id, status=v.status.value, submitted_at=_utc(v.submitted_at),
                           rework_count=reworks.get(v.id, 0)) for v in visits],
        problems=[ProblemState(id=p.id, severity=p.severity, target_date=p.target_date,
                               open=p.status == ProblemStatus.open) for p in problems],
    )


def sync_red_flags(db, project, now: datetime) -> None:
    """Raise flags whose rule now holds; clear automatically those whose rule no longer holds.
    Adds to the session; the caller commits with the change that triggered it."""
    db.flush()
    holding = evaluate_flags(project_state(db, project), now)
    latest: dict[tuple[str, str], RedFlag] = {}
    for f in db.scalars(select(RedFlag).where(RedFlag.project_id == project.id).order_by(RedFlag.id)):
        latest[(f.rule, f.key)] = f

    def log(action, f, **detail):
        audit.record(db, None, action, project_id=project.id, entity_type="red_flag", entity_id=f.id,
                     detail={"rule": f.rule, "key": f.key, "label": RULES[f.rule]["label"], **detail})

    for rule, key in sorted(holding):
        f = latest.get((rule, key))
        if f is None or f.condition_ended_at is not None:  # new, or a cleared flag whose rule had stopped
            f = RedFlag(project_id=project.id, rule=rule, key=key, raised_at=now)
            db.add(f)
            db.flush()
            log("red_flag.raised", f)
            notify.red_flag(db, project, RULES[rule]["label"])
    for (rule, key), f in latest.items():
        if (rule, key) in holding or f.condition_ended_at is not None:
            continue
        f.condition_ended_at = now
        if f.cleared_at is None:
            f.cleared_at, f.clear_kind = now, "auto"
            log("red_flag.cleared", f)


def flag_out(f) -> dict:
    return {"id": f.id, "project_id": f.project_id, "rule": f.rule, "label": RULES[f.rule]["label"],
            "rank": RULES[f.rule]["rank"], "key": f.key, "raised_at": iso_utc(f.raised_at),
            "cleared_at": iso_utc(f.cleared_at), "clear_kind": f.clear_kind, "clear_reason": f.clear_reason,
            "cleared_by": user_brief(f.cleared_by)}
