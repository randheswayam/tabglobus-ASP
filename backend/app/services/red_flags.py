"""Red flags (plan section 5.3): which projects need the Architect's attention, and why.

evaluate_flags() is a pure function over plain state, so every rule is testable with a fixed clock.
Thresholds come from workflow_config (placeholders pending Parvez, D4 and D5)."""
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from app import workflow_config as wc

# rank orders the "Needs Architect Attention" list: higher first.
RULES = {
    "critical_issue": {"label": "Critical issue", "rank": 5},
    "overdue_fix": {"label": "Overdue fix", "rank": 4},
    "review_overdue": {"label": "Review overdue", "rank": 3},
    "repeated_rework": {"label": "Repeated rework", "rank": 3},
    "legal_delay": {"label": "Legal delay", "rank": 2},
    "no_recent_visit": {"label": "No recent visit", "rank": 1},
}


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
    today = now.date()

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
