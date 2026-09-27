"""The six red flag rules (plan section 5.3), evaluated on plain in-memory state with a fixed clock."""
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.services.red_flags import RULES, ProblemState, ProjectState, VisitState, evaluate_flags

NOW = datetime(2026, 10, 15, 12, 0, tzinfo=timezone.utc)
CFG = SimpleNamespace(REVIEW_SLA_HOURS=48, VISIT_INTERVAL_DAYS=14, REWORK_LIMIT=2, CLIENT_SIGNOFF_SLA_DAYS=7)


def state(**kw) -> ProjectState:
    base = dict(legal_status="Approved", legal_expected_date=date(2026, 9, 30), legal_approved_at=NOW - timedelta(days=3),
                site_visit_open=True, last_approved_visit_at=None, visits=[], problems=[])
    return ProjectState(**{**base, **kw})


def flags(s: ProjectState) -> set[tuple[str, str]]:
    return evaluate_flags(s, NOW, CFG)


def test_healthy_project_has_no_flags():
    assert flags(state()) == set()


@pytest.mark.parametrize("severity,raised", [("Critical", True), ("High", True), ("Medium", False), ("Low", False)])
def test_critical_issue_for_open_high_or_critical_problems(severity, raised):
    s = state(problems=[ProblemState(id=7, severity=severity, target_date=date(2026, 10, 30), open=True)])
    assert (("critical_issue", "problem-7") in flags(s)) is raised


def test_resolved_problems_raise_nothing():
    s = state(problems=[ProblemState(id=7, severity="Critical", target_date=date(2026, 10, 1), open=False)])
    assert flags(s) == set()


def test_legal_delay_when_not_approved_past_expected_date():
    assert ("legal_delay", "project") in flags(state(legal_status="Applied", legal_expected_date=date(2026, 10, 14)))
    assert ("legal_delay", "project") in flags(state(legal_status="Rejected", legal_expected_date=date(2026, 10, 14)))
    assert flags(state(legal_status="Applied", legal_expected_date=date(2026, 10, 15))) == set()  # due today is not late
    assert flags(state(legal_status="Applied", legal_expected_date=None)) == set()
    assert flags(state(legal_status="Approved", legal_expected_date=date(2026, 9, 1))) == set()


def test_review_overdue_after_the_sla():
    late = VisitState(id=3, status="submitted", submitted_at=NOW - timedelta(hours=49), rework_count=0)
    on_time = VisitState(id=4, status="submitted", submitted_at=NOW - timedelta(hours=47), rework_count=0)
    assert flags(state(visits=[late], site_visit_open=False)) == {("review_overdue", "visit-3")}
    assert flags(state(visits=[on_time], site_visit_open=False)) == set()


def test_repeated_rework_at_the_limit():
    twice = VisitState(id=5, status="rework", submitted_at=NOW - timedelta(hours=1), rework_count=2)
    once = VisitState(id=6, status="rework", submitted_at=NOW - timedelta(hours=1), rework_count=1)
    approved = VisitState(id=8, status="approved", submitted_at=NOW - timedelta(days=1), rework_count=3)
    assert ("repeated_rework", "visit-5") in flags(state(visits=[twice]))
    assert ("repeated_rework", "visit-6") not in flags(state(visits=[once]))
    assert ("repeated_rework", "visit-8") not in flags(state(visits=[approved]))  # the visit is closed


def test_no_recent_visit_counts_from_last_approval_or_legal_approval():
    assert ("no_recent_visit", "project") in flags(state(legal_approved_at=NOW - timedelta(days=15)))
    assert flags(state(legal_approved_at=NOW - timedelta(days=13))) == set()
    assert ("no_recent_visit", "project") in flags(state(legal_approved_at=NOW - timedelta(days=90),
                                                         last_approved_visit_at=NOW - timedelta(days=15)))
    assert flags(state(legal_approved_at=NOW - timedelta(days=90), last_approved_visit_at=NOW - timedelta(days=2))) == set()
    # Only while a site visit is due: not before Legal Approval, not while waiting for review.
    assert flags(state(legal_approved_at=NOW - timedelta(days=30), site_visit_open=False)) == set()


def test_overdue_fix_after_target_date():
    s = state(problems=[ProblemState(id=9, severity="Low", target_date=date(2026, 10, 14), open=True),
                        ProblemState(id=10, severity="Low", target_date=date(2026, 10, 15), open=True)])
    assert flags(s) == {("overdue_fix", "problem-9")}


def test_one_problem_can_raise_two_rules():
    s = state(problems=[ProblemState(id=11, severity="Critical", target_date=date(2026, 10, 1), open=True)])
    assert flags(s) == {("critical_issue", "problem-11"), ("overdue_fix", "problem-11")}


def test_every_rule_has_a_label_and_rank():
    assert set(RULES) == {"critical_issue", "legal_delay", "review_overdue", "repeated_rework", "no_recent_visit", "overdue_fix",
                          "client_decision_overdue"}
    assert all(r["label"] and isinstance(r["rank"], int) for r in RULES.values())
    assert RULES["critical_issue"]["rank"] > RULES["no_recent_visit"]["rank"]


def test_dates_use_the_office_timezone_not_utc():
    """Just after midnight in Pune it is still the previous day in UTC; 'overdue' must follow Pune's date."""
    just_after_midnight_ist = datetime(2026, 10, 14, 19, 0, tzinfo=timezone.utc)  # 15 Oct 00:30 in Asia/Kolkata
    s = state(problems=[ProblemState(id=12, severity="Low", target_date=date(2026, 10, 14), open=True)])
    assert evaluate_flags(s, just_after_midnight_ist, CFG) == {("overdue_fix", "problem-12")}


def test_client_decision_overdue_after_the_sla():
    late = state(site_visit_open=False, pending_signoffs=[(21, NOW - timedelta(days=8))])
    on_time = state(site_visit_open=False, pending_signoffs=[(22, NOW - timedelta(days=6))])
    assert flags(late) == {("client_decision_overdue", "signoff-21")}
    assert flags(on_time) == set()
    assert RULES["client_decision_overdue"] == {"label": "Client decision overdue", "rank": 4}
