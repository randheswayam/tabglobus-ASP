"""In-app notifications: who hears about what (plan F10)."""
from tests.conftest import valid_visit


def _inbox(client, headers):
    r = client.get("/notifications", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _kinds(client, headers):
    return [n["kind"] for n in _inbox(client, headers)["items"]]


def test_legal_approval_tells_the_engineer_the_visit_is_open(client, auth_headers, ready_project):
    inbox = _inbox(client, auth_headers("civil_engineer"))
    assert inbox["unread"] == 1
    n = inbox["items"][0]
    assert n["kind"] == "step_unlocked" and "Site Visit is open" in n["text"] and "Villa A" in n["text"]
    assert n["project"]["id"] == ready_project["id"] and n["read_at"] is None and n["created_at"].endswith("+00:00")
    assert _kinds(client, auth_headers("team_lead")) == []


def test_submission_tells_the_team_lead(client, auth_headers, ready_project, evidence):
    evidence(ready_project["id"])
    client.post(f"/projects/{ready_project['id']}/site-visits", json=valid_visit(), headers=auth_headers("civil_engineer"))
    items = _inbox(client, auth_headers("team_lead"))["items"]
    assert items[0]["kind"] == "submitted" and "Farhan Shaikh" in items[0]["text"]


def test_approval_tells_engineer_and_architect_and_flags_reach_architect_and_team_lead(client, auth_headers, ready_project, evidence):
    evidence(ready_project["id"])
    v = client.post(f"/projects/{ready_project['id']}/site-visits", json=valid_visit(), headers=auth_headers("civil_engineer")).json()
    client.post(f"/site-visits/{v['id']}/review", json={"decision": "approve"}, headers=auth_headers("team_lead"))
    assert "approved" in _kinds(client, auth_headers("civil_engineer"))
    arch = _kinds(client, auth_headers("architect"))
    assert "approved" in arch and "red_flag" in arch  # valid_visit's High problem raises Critical issue
    lead = _inbox(client, auth_headers("team_lead"))["items"]
    flag = next(n for n in lead if n["kind"] == "red_flag")
    assert "Critical issue" in flag["text"]
    assert "approved" not in [n["kind"] for n in lead]  # Parvez approved it; he is not told about his own action


def test_rework_tells_the_engineer_with_the_comment(client, auth_headers, ready_project, evidence):
    evidence(ready_project["id"])
    v = client.post(f"/projects/{ready_project['id']}/site-visits", json=valid_visit(), headers=auth_headers("civil_engineer")).json()
    client.post(f"/site-visits/{v['id']}/review", json={"decision": "rework", "comment": "Photograph the DPC edge."},
                headers=auth_headers("team_lead"))
    n = _inbox(client, auth_headers("civil_engineer"))["items"][0]
    assert n["kind"] == "rework" and "Photograph the DPC edge." in n["text"]


def test_mark_read_and_read_all_only_touch_own_notifications(client, auth_headers, ready_project, evidence):
    eng, lead = auth_headers("civil_engineer"), auth_headers("team_lead")
    evidence(ready_project["id"])
    v = client.post(f"/projects/{ready_project['id']}/site-visits", json=valid_visit(), headers=eng).json()
    client.post(f"/site-visits/{v['id']}/review", json={"decision": "rework", "comment": "Again"}, headers=lead)
    mine = _inbox(client, eng)
    assert mine["unread"] == 2
    first = mine["items"][0]["id"]
    assert client.post(f"/notifications/{first}/read", headers=lead).status_code == 404  # not Parvez's
    r = client.post(f"/notifications/{first}/read", headers=eng)
    assert r.status_code == 200 and r.json()["read_at"]
    assert _inbox(client, eng)["unread"] == 1
    assert client.post("/notifications/read-all", headers=eng).json() == {"unread": 0}
    assert _inbox(client, eng)["unread"] == 0
    assert _inbox(client, lead)["unread"] == 1  # Parvez's submission notice is untouched
    assert client.post("/notifications/9999/read", headers=eng).status_code == 404


def test_notifications_need_sign_in(client):
    assert client.get("/notifications").status_code == 401
