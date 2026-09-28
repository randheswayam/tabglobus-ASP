"""The principal architect's overview: completion, client fees, major milestones and major issues per project,
with portfolio totals. Only the principal (Parvez) may read it."""

from datetime import UTC, date, datetime, timedelta

import pytest

from app import stage_config as sc
from app import workflow_config as wc
from app.models import Problem, ProblemStatus, ProjectStage, SiteVisit, StageStatus, VisitStatus

URL = "/principal/overview"


def _overview(client, auth_headers):
    r = client.get(URL, headers=auth_headers("team_lead"))
    assert r.status_code == 200, r.text
    return r.json()


def _row(body, pid):
    return next(p for p in body["projects"] if p["id"] == pid)


def _problem(db, users, pid, *, severity="High", created_days_ago=3, target_in_days=5, **extra):
    visit = SiteVisit(
        project_id=pid,
        engineer_id=users["civil_engineer"].id,
        status=VisitStatus.approved,
        form={"recommended_action": "Re-cast the lintel before plastering"},
    )
    db.add(visit)
    db.flush()
    p = Problem(
        project_id=pid,
        site_visit_id=visit.id,
        index=0,
        category="Structural",
        problem="Crack in lintel",
        severity=severity,
        location="First floor, east bedroom",
        responsible_party="Contractor",
        target_date=date.today() + timedelta(days=target_in_days),
        created_at=datetime.now(UTC) - timedelta(days=created_days_ago),
        **extra,
    )
    db.add(p)
    db.commit()
    return p


def test_completion_counts_done_stages_and_keeps_construction_progress_apart(client, auth_headers, ready_project):
    row = _row(_overview(client, auth_headers), ready_project["id"])
    before_line_out = [s["key"] for s in sc.STAGES].index("line_out")
    assert row["completion"]["stages_done"] == before_line_out
    assert row["completion"]["stages_total"] == len(sc.STAGES)
    assert row["completion"]["percent"] == round(100 * before_line_out / len(sc.STAGES), 1)
    assert row["completion"]["construction_progress"] == 0.0


def test_completion_weights_apply_when_set(client, auth_headers, ready_project, monkeypatch):
    monkeypatch.setattr(wc, "OVERALL_COMPLETION_WEIGHTS", {"construction": 76})  # 23 others weigh 1 each
    row = _row(_overview(client, auth_headers), ready_project["id"])
    assert row["completion"]["percent"] == round(100 * 18 / 99, 1)


def test_fee_totals_per_project_and_portfolio(client, auth_headers, new_project):
    lead = auth_headers("team_lead")
    a, b = new_project("Villa A")["id"], new_project("Villa B")["id"]
    for pid, due, received in ((a, "1250000", "500000"), (b, "400000", "400000")):
        client.post(f"/projects/{pid}/fees", json={"kind": "due", "amount": due, "date": "2026-09-01"}, headers=lead)
        client.post(
            f"/projects/{pid}/fees",
            json={"kind": "received", "amount": received, "date": "2026-09-10", "reference": "NEFT"},
            headers=lead,
        )
    body = _overview(client, auth_headers)
    assert _row(body, a)["fees"] == {
        "due": "1250000.00",
        "received": "500000.00",
        "outstanding": "750000.00",
        "currency": "INR",
    }
    assert body["portfolio"]["fees"] == [
        {"currency": "INR", "due": "1650000.00", "received": "900000.00", "outstanding": "750000.00"}
    ]
    assert body["portfolio"]["projects"] == 2


def test_milestones_follow_the_config_with_state_date_and_who(client, auth_headers, new_project, users, db):
    pid = new_project()["id"]
    row = db.query(ProjectStage).filter_by(project_id=pid, key="setup").one()
    row.status, row.completed_at, row.completed_by_id = StageStatus.completed, datetime.now(UTC), users["team_lead"].id
    db.commit()
    got = _row(_overview(client, auth_headers), pid)["milestones"]
    assert [m["key"] for m in got] == [s["key"] for s in sc.STAGES if s["key"] in wc.MAJOR_MILESTONES]
    first = got[0]
    assert first["key"] == "requirements_signoff"
    assert first["health"] in ("waiting", "upcoming") and first["completed_at"] is None
    for m in got:
        assert set(m) >= {"key", "number", "label", "icon", "health", "reason", "completed_at", "completed_by"}


def test_milestones_before_the_start_stage_are_done(client, auth_headers, ready_project):
    got = {m["key"]: m for m in _row(_overview(client, auth_headers), ready_project["id"])["milestones"]}
    assert got["requirements_signoff"]["health"] == "done"
    assert got["requirements_signoff"]["reason"] == "Completed before SiteFlow"
    assert got["line_out"]["health"] == "waiting" and got["line_out"]["reason"]
    assert got["handover_signoff"]["health"] == "upcoming"


def test_a_completed_milestone_names_who_and_when(client, auth_headers, new_project, users, db):
    pid = new_project()["id"]
    when = datetime(2026, 9, 20, 10, 0, tzinfo=UTC)
    row = db.query(ProjectStage).filter_by(project_id=pid, key="requirements_signoff").one()
    row.status, row.completed_at, row.completed_by_id = StageStatus.completed, when, users["team_lead"].id
    db.commit()
    got = {m["key"]: m for m in _row(_overview(client, auth_headers), pid)["milestones"]}
    m = got["requirements_signoff"]
    assert m["health"] == "done" and m["completed_at"].startswith("2026-09-20")
    assert m["completed_by"]["name"] == "Parvez"


def test_open_major_issues_carry_the_action_and_overdue_flag(client, auth_headers, ready_project, users, db):
    pid = ready_project["id"]
    _problem(db, users, pid, severity="Critical", created_days_ago=10, target_in_days=-2)
    _problem(db, users, pid, severity="High")
    _problem(db, users, pid, severity="Medium")  # not major
    body = _overview(client, auth_headers)
    issues = _row(body, pid)["issues"]["open"]
    assert [i["severity"] for i in issues] == ["Critical", "High"]
    crit = issues[0]
    assert crit["recommended_action"] == "Re-cast the lintel before plastering"
    assert crit["overdue"] is True and crit["days_open"] >= 9
    assert crit["location"] == "First floor, east bedroom" and crit["responsible_party"] == "Contractor"
    assert issues[1]["overdue"] is False
    assert body["portfolio"]["open_major_issues"] == 2


def test_recently_resolved_issues_show_the_resolution(client, auth_headers, ready_project, users, db):
    pid = ready_project["id"]
    now = datetime.now(UTC)
    _problem(
        db,
        users,
        pid,
        status=ProblemStatus.resolved,
        resolved_at=now - timedelta(days=2),
        resolved_by_id=users["civil_engineer"].id,
        resolution_note="Lintel re-cast and cured",
    )
    _problem(
        db,
        users,
        pid,
        status=ProblemStatus.resolved,
        resolved_at=now - timedelta(days=wc.RESOLVED_ISSUES_DAYS + 5),
        resolution_note="Old fix",
    )
    resolved = _row(_overview(client, auth_headers), pid)["issues"]["resolved"]
    assert [i["resolution_note"] for i in resolved] == ["Lintel re-cast and cured"]
    assert resolved[0]["resolved_by"]["name"]


def test_portfolio_counts_waiting_milestones_and_average(client, auth_headers, ready_project, new_project):
    new_project("Villa B")
    body = _overview(client, auth_headers)
    rows = body["projects"]
    waiting = sum(1 for r in rows for m in r["milestones"] if m["health"] in ("waiting", "delayed"))
    assert body["portfolio"]["milestones_waiting"] == waiting >= 1
    assert body["portfolio"]["average_completion"] == round(sum(r["completion"]["percent"] for r in rows) / 2, 1)


def test_an_empty_portfolio(client, auth_headers):
    body = _overview(client, auth_headers)
    assert body["projects"] == []
    assert body["portfolio"]["average_completion"] is None and body["portfolio"]["fees"] == []


@pytest.mark.parametrize(
    "role",
    ["architect", "admin", "civil_engineer", "accounts", "structural_consultant", "office_coordinator"],
)
def test_everyone_but_the_principal_is_refused(client, auth_headers, role):
    assert client.get(URL, headers=auth_headers(role)).status_code == 403


def test_a_client_and_an_anonymous_caller_are_refused(client, client_headers):
    assert client.get(URL, headers=client_headers).status_code == 403
    assert client.get(URL).status_code == 401
