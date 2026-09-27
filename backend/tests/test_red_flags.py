"""Red flags stored per project: raised and cleared automatically, or cleared by Parvez with a reason."""

from datetime import UTC, datetime, timedelta

import pytest

from app import models as m
from app.services.red_flags import sync_red_flags
from tests.conftest import valid_visit


def _active(client, headers, pid):
    r = client.get(f"/projects/{pid}/red-flags", headers=headers)
    assert r.status_code == 200, r.text
    return {(f["rule"], f["key"]) for f in r.json()}


def _sync(db, pid, now):
    db.expire_all()
    sync_red_flags(db, db.get(m.Project, pid), now)
    db.commit()


@pytest.fixture
def approved_high(client, auth_headers, ready_project, evidence):
    """An approved visit with one High problem (target date 2026-10-05)."""
    evidence(ready_project["id"])
    v = client.post(
        f"/projects/{ready_project['id']}/site-visits", json=valid_visit(), headers=auth_headers("civil_engineer")
    ).json()
    client.post(f"/site-visits/{v['id']}/review", json={"decision": "approve"}, headers=auth_headers("team_lead"))
    problem = client.get(f"/projects/{ready_project['id']}/problems", headers=auth_headers("team_lead")).json()[0]
    return {"pid": ready_project["id"], "problem_id": problem["id"]}


def test_approving_a_high_problem_raises_critical_issue(client, auth_headers, approved_high):
    lead = auth_headers("team_lead")
    assert _active(client, lead, approved_high["pid"]) == {("critical_issue", f"problem-{approved_high['problem_id']}")}
    flag = client.get(f"/projects/{approved_high['pid']}/red-flags", headers=lead).json()[0]
    assert flag["label"] == "Critical issue" and flag["raised_at"].endswith("+00:00") and flag["cleared_at"] is None
    audit = client.get(f"/projects/{approved_high['pid']}", headers=lead).json()["audit"]
    raised = [e for e in audit if e["action"] == "red_flag.raised"]
    assert len(raised) == 1 and raised[0]["actor"] is None and raised[0]["detail"]["rule"] == "critical_issue"


def test_resolving_the_problem_clears_the_flag_automatically(client, auth_headers, approved_high, db):
    lead = auth_headers("team_lead")
    client.post(f"/problems/{approved_high['problem_id']}/resolve", json={"note": "Waterproofed"}, headers=lead)
    assert _active(client, lead, approved_high["pid"]) == set()
    row = db.query(m.RedFlag).one()
    assert row.clear_kind == "auto" and row.cleared_at is not None and row.condition_ended_at is not None
    audit = [e["action"] for e in client.get(f"/projects/{approved_high['pid']}", headers=lead).json()["audit"]]
    assert "red_flag.cleared" in audit


def test_time_based_rules_raise_as_the_clock_moves(client, auth_headers, approved_high, db):
    lead = auth_headers("team_lead")
    pid = approved_high["pid"]
    _sync(db, pid, datetime(2026, 10, 6, 9, tzinfo=UTC))  # target date 2026-10-05 has passed
    assert ("overdue_fix", f"problem-{approved_high['problem_id']}") in _active(client, lead, pid)
    _sync(db, pid, datetime.now(UTC) + timedelta(days=15))
    assert ("no_recent_visit", "project") in _active(client, lead, pid)


def test_legal_delay_is_raised_on_sync_and_cleared_by_approval(client, auth_headers, new_project, db):
    admin, lead = auth_headers("admin"), auth_headers("team_lead")
    p = new_project(legal_expected_date="2026-09-01")
    _sync(db, p["id"], datetime(2026, 9, 2, tzinfo=UTC))
    assert _active(client, lead, p["id"]) == {("legal_delay", "project")}
    client.patch(
        f"/projects/{p['id']}/legal",
        headers=admin,
        json={
            "status": "Applied",
            "authority_name": "PMC",
            "application_reference": "BP-9",
            "application_date": "2026-08-01",
        },
    )
    client.patch(
        f"/projects/{p['id']}/legal",
        headers=admin,
        json={"status": "Approved", "approval_date": "2026-09-03", "document_reference": "doc://bp-9"},
    )
    assert ("legal_delay", "project") not in _active(client, lead, p["id"])


def test_parvez_clears_a_flag_with_a_reason(client, auth_headers, approved_high, db):
    lead = auth_headers("team_lead")
    fid = client.get(f"/projects/{approved_high['pid']}/red-flags", headers=lead).json()[0]["id"]
    r = client.post(
        f"/red-flags/{fid}/clear", json={"reason": "  Contractor fixing this week; checked on call.  "}, headers=lead
    )
    assert r.status_code == 200, r.text
    assert (
        r.json()["clear_kind"] == "manual"
        and r.json()["clear_reason"] == "Contractor fixing this week; checked on call."
    )
    assert r.json()["cleared_by"]["name"] == "Parvez"
    assert _active(client, lead, approved_high["pid"]) == set()
    audit = client.get(f"/projects/{approved_high['pid']}", headers=lead).json()["audit"]
    assert audit[-1]["action"] == "red_flag.cleared_manually" and audit[-1]["actor"] == "Parvez"
    assert audit[-1]["detail"]["reason"] == "Contractor fixing this week; checked on call."


def test_manual_clear_holds_while_the_rule_keeps_holding(client, auth_headers, approved_high, db):
    lead = auth_headers("team_lead")
    pid = approved_high["pid"]
    fid = client.get(f"/projects/{pid}/red-flags", headers=lead).json()[0]["id"]
    client.post(f"/red-flags/{fid}/clear", json={"reason": "Known"}, headers=lead)
    _sync(db, pid, datetime.now(UTC))
    _sync(db, pid, datetime.now(UTC))
    assert ("critical_issue", f"problem-{approved_high['problem_id']}") not in _active(client, lead, pid)
    assert db.query(m.RedFlag).filter_by(rule="critical_issue").count() == 1


def test_manual_clear_rearms_after_the_rule_stops_and_starts_again(client, auth_headers, new_project, db):
    lead = auth_headers("team_lead")
    p = new_project(legal_expected_date="2026-09-01")
    _sync(db, p["id"], datetime(2026, 9, 2, tzinfo=UTC))
    fid = client.get(f"/projects/{p['id']}/red-flags", headers=lead).json()[0]["id"]
    client.post(f"/red-flags/{fid}/clear", json={"reason": "Authority on strike"}, headers=lead)
    # The expected date is moved out (the rule stops), then passes again (the rule holds again).
    la = db.query(m.LegalApproval).filter_by(project_id=p["id"]).one()
    la.expected_date = datetime(2026, 12, 1).date()
    db.commit()
    _sync(db, p["id"], datetime(2026, 9, 3, tzinfo=UTC))
    assert _active(client, lead, p["id"]) == set()
    _sync(db, p["id"], datetime(2026, 12, 2, tzinfo=UTC))
    assert _active(client, lead, p["id"]) == {("legal_delay", "project")}


def test_clear_needs_a_reason_team_lead_and_an_active_flag(client, auth_headers, approved_high):
    lead = auth_headers("team_lead")
    fid = client.get(f"/projects/{approved_high['pid']}/red-flags", headers=lead).json()[0]["id"]
    assert client.post(f"/red-flags/{fid}/clear", json={"reason": " "}, headers=lead).status_code == 422
    for role in ("architect", "civil_engineer", "admin"):
        assert (
            client.post(f"/red-flags/{fid}/clear", json={"reason": "x"}, headers=auth_headers(role)).status_code == 403
        )
    assert client.post(f"/red-flags/{fid}/clear", json={"reason": "ok"}, headers=lead).status_code == 200
    assert client.post(f"/red-flags/{fid}/clear", json={"reason": "again"}, headers=lead).status_code == 409
    assert client.post("/red-flags/9999/clear", json={"reason": "x"}, headers=lead).status_code == 404


def test_repeated_rework_after_two_send_backs(client, auth_headers, ready_project, evidence):
    eng, lead = auth_headers("civil_engineer"), auth_headers("team_lead")
    pid = ready_project["id"]
    evidence(pid)
    for _ in range(2):
        v = client.post(f"/projects/{pid}/site-visits", json=valid_visit(), headers=eng).json()
        client.post(f"/site-visits/{v['id']}/review", json={"decision": "rework", "comment": "Redo"}, headers=lead)
    assert ("repeated_rework", f"visit-{v['id']}") in _active(client, lead, pid)
