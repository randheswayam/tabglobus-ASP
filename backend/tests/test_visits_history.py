"""Recurring site visits: approval reopens Site Visit for the next one, with a history."""
from tests.conftest import valid_visit, workflow_actions


def _submit(client, headers, pid, evidence, **kw):
    evidence(pid)
    r = client.post(f"/projects/{pid}/site-visits", json=valid_visit(**kw), headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _approve(client, headers, vid):
    r = client.post(f"/site-visits/{vid}/review", json={"decision": "approve"}, headers=headers)
    assert r.status_code == 200, r.text


def test_approval_reopens_site_visit_for_the_next_visit(client, auth_headers, ready_project, evidence):
    eng, lead = auth_headers("civil_engineer"), auth_headers("team_lead")
    pid = ready_project["id"]
    v1 = _submit(client, eng, pid, evidence)
    _approve(client, lead, v1["id"])

    p = client.get(f"/projects/{pid}", headers=eng).json()
    assert [s["status"] for s in p["steps"]] == ["completed", "active", "locked"]
    assert p["current_step"] == "Site Visit"
    assert p["official_progress"] == 16.7
    assert p["approved_visits"] == 1 and p["visit_number"] == 2
    assert workflow_actions(p["audit"])[-4:] == ["site_visit.approved", "step.completed", "step.activated", "step.locked"]

    # The second visit is a new record with its own submission count.
    later = {"pln-beam": "Done", "pln-filling": "Done", "pln-dpc": "Done"}
    v2 = _submit(client, eng, pid, evidence, checklist=later)
    assert v2["id"] != v1["id"] and v2["submission_count"] == 1
    p = client.get(f"/projects/{pid}", headers=eng).json()
    assert p["official_progress"] == 16.7  # still the last approved visit until v2 is approved
    assert p["latest_visit"]["id"] == v2["id"]

    _approve(client, lead, v2["id"])
    p = client.get(f"/projects/{pid}", headers=eng).json()
    assert p["official_progress"] == 25.0
    assert p["approved_visits"] == 2 and p["visit_number"] == 3


def test_visit_number_before_legal_approval(client, auth_headers, new_project):
    p = new_project()
    assert p["visit_number"] is None and p["approved_visits"] == 0


def test_visit_history_lists_visits_newest_first(client, auth_headers, ready_project, evidence):
    eng, lead = auth_headers("civil_engineer"), auth_headers("team_lead")
    pid = ready_project["id"]
    v1 = _submit(client, eng, pid, evidence)
    _approve(client, lead, v1["id"])
    v2 = _submit(client, eng, pid, evidence, checklist={"pln-beam": "Done", "pln-filling": "Done", "pln-dpc": "Done"})

    r = client.get(f"/projects/{pid}/visits", headers=auth_headers("architect"))
    assert r.status_code == 200
    rows = r.json()
    assert [(v["id"], v["status"]) for v in rows] == [(v2["id"], "submitted"), (v1["id"], "approved")]
    assert rows[1]["computed_progress"] == 16.7
    assert rows[1]["current_stage"] == "Plinth"
    assert rows[1]["approved_at"] and rows[1]["approved_at"].endswith("+00:00")
    assert rows[0]["approved_at"] is None
    assert rows[1]["engineer"]["name"] == "Farhan Shaikh"


def test_visit_history_respects_visibility(client, db, auth_headers, ready_project):
    from app import models as m

    admin_id = db.query(m.User).filter_by(role=m.Role.admin).one().id
    db.query(m.ProjectMember).filter_by(project_id=ready_project["id"], user_id=admin_id).delete()
    db.commit()
    assert client.get(f"/projects/{ready_project['id']}/visits", headers=auth_headers("admin")).status_code == 404
