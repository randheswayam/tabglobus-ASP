"""Site visit media: the server-side draft visit, uploads, downloads and removal."""
import pytest

from tests.conftest import valid_visit


@pytest.fixture
def draft(client, auth_headers, ready_project):
    r = client.post(f"/projects/{ready_project['id']}/site-visits/draft", headers=auth_headers("civil_engineer"))
    assert r.status_code == 200, r.text
    return r.json()


# ---------- Task 5: draft visit ----------

def test_draft_is_created_once_and_reused(client, auth_headers, ready_project, draft):
    assert draft["status"] == "draft" and draft["submission_count"] == 0 and draft["media"] == []
    again = client.post(f"/projects/{ready_project['id']}/site-visits/draft", headers=auth_headers("civil_engineer")).json()
    assert again["id"] == draft["id"]


def test_draft_is_hidden_from_project_latest_visit_queue_and_history(client, auth_headers, ready_project, draft):
    p = client.get(f"/projects/{ready_project['id']}", headers=auth_headers("architect")).json()
    assert p["latest_visit"] is None
    assert client.get("/projects", headers=auth_headers("architect")).json()[0]["latest_visit_status"] is None
    assert client.get("/reviews/queue", headers=auth_headers("team_lead")).json() == []
    assert client.get(f"/projects/{ready_project['id']}/visits", headers=auth_headers("architect")).json() == []


def test_submission_fills_in_the_draft(client, auth_headers, ready_project, draft):
    r = client.post(f"/projects/{ready_project['id']}/site-visits", json=valid_visit(), headers=auth_headers("civil_engineer"))
    assert r.status_code == 201, r.text
    assert r.json()["id"] == draft["id"] and r.json()["status"] == "submitted" and r.json()["submission_count"] == 1


def test_draft_returns_the_rework_visit(client, auth_headers, ready_project):
    eng = auth_headers("civil_engineer")
    v = client.post(f"/projects/{ready_project['id']}/site-visits", json=valid_visit(), headers=eng).json()
    client.post(f"/site-visits/{v['id']}/review", json={"decision": "rework", "comment": "Add photos"},
                headers=auth_headers("team_lead"))
    d = client.post(f"/projects/{ready_project['id']}/site-visits/draft", headers=eng).json()
    assert d["id"] == v["id"] and d["status"] == "rework"


def test_draft_needs_step2_open_and_the_assigned_engineer(client, auth_headers, new_project, ready_project):
    p = new_project("Not yet approved")
    assert client.post(f"/projects/{p['id']}/site-visits/draft", headers=auth_headers("civil_engineer")).status_code == 409
    assert client.post(f"/projects/{ready_project['id']}/site-visits/draft", headers=auth_headers("team_lead")).status_code == 403
