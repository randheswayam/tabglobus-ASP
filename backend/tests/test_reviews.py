import pytest

from tests.conftest import valid_visit


@pytest.fixture
def submitted(client, auth_headers, ready_project):
    r = client.post(f"/projects/{ready_project['id']}/site-visits", json=valid_visit(),
                    headers=auth_headers("civil_engineer"))
    assert r.status_code == 201, r.text
    return r.json()


def _review(client, headers, visit_id, **body):
    return client.post(f"/site-visits/{visit_id}/review", json=body, headers=headers)


def _project(client, headers, pid):
    return client.get(f"/projects/{pid}", headers=headers).json()


def test_queue_lists_submitted_visits_with_time_waiting(client, auth_headers, submitted):
    r = client.get("/reviews/queue", headers=auth_headers("team_lead"))
    assert r.status_code == 200
    [item] = r.json()
    assert item["id"] == submitted["id"]
    assert item["project"]["name"] == "Villa A"
    assert item["engineer"]["name"] == "Farhan Shaikh"
    assert item["submission_count"] == 1
    assert item["computed_progress"] == 16.7
    assert item["waiting_minutes"] >= 0


@pytest.mark.parametrize("role", ["architect", "civil_engineer", "admin"])
def test_queue_is_team_lead_only(client, auth_headers, role):
    assert client.get("/reviews/queue", headers=auth_headers(role)).status_code == 403


def test_approve_makes_progress_official(client, auth_headers, submitted):
    lead = auth_headers("team_lead")
    r = _review(client, lead, submitted["id"], decision="approve")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "approved"
    assert r.json()["reviews"][0]["reviewer"]["name"] == "Parvez"

    p = _project(client, lead, submitted["project"]["id"])
    assert p["official_progress"] == 16.7
    assert [s["status"] for s in p["steps"]] == ["completed", "active", "locked"]
    assert p["current_step"] == "Site Visit"  # the next visit opens (recurring visits, v2)
    assert [e["action"] for e in p["audit"][-4:]] == ["site_visit.approved", "step.completed", "step.activated", "step.locked"]
    assert client.get("/reviews/queue", headers=lead).json() == []


def test_rework_returns_visit_to_engineer_with_comment(client, auth_headers, submitted):
    lead = auth_headers("team_lead")
    r = _review(client, lead, submitted["id"], decision="rework", comment="  Add photo of the seepage.  ")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "rework"

    eng = auth_headers("civil_engineer")
    p = _project(client, eng, submitted["project"]["id"])
    assert [s["status"] for s in p["steps"]] == ["completed", "active", "locked"]
    assert p["current_step"] == "Site Visit"
    assert p["official_progress"] == 0
    assert p["latest_visit"]["status"] == "rework"
    assert p["latest_visit"]["rework_comment"] == "Add photo of the seepage."
    assert [e["action"] for e in p["audit"][-3:]] == ["site_visit.rework_requested", "step.locked", "step.activated"]

    v = client.get(f"/site-visits/{submitted['id']}", headers=eng).json()
    assert v["reviews"][-1] == {**v["reviews"][-1], "decision": "rework", "comment": "Add photo of the seepage."}


@pytest.mark.parametrize("comment", [None, "", "   "])
def test_rework_requires_comment(client, auth_headers, submitted, comment):
    body = {"decision": "rework"} if comment is None else {"decision": "rework", "comment": comment}
    r = _review(client, auth_headers("team_lead"), submitted["id"], **body)
    assert r.status_code == 422
    assert r.json()["detail"]["missing"] == ["comment"]


def test_unknown_decision_is_422(client, auth_headers, submitted):
    assert _review(client, auth_headers("team_lead"), submitted["id"], decision="maybe").status_code == 422


@pytest.mark.parametrize("role", ["architect", "civil_engineer", "admin"])
def test_only_team_lead_reviews(client, auth_headers, submitted, role):
    assert _review(client, auth_headers(role), submitted["id"], decision="approve").status_code == 403


def test_cannot_review_twice(client, auth_headers, submitted):
    lead = auth_headers("team_lead")
    assert _review(client, lead, submitted["id"], decision="approve").status_code == 200
    assert _review(client, lead, submitted["id"], decision="rework", comment="late").status_code == 409


def test_review_of_missing_visit_is_404(client, auth_headers):
    assert _review(client, auth_headers("team_lead"), 9999, decision="approve").status_code == 404


def test_queue_and_review_timestamps_are_utc(client, auth_headers, submitted):
    lead = auth_headers("team_lead")
    [item] = client.get("/reviews/queue", headers=lead).json()
    assert item["submitted_at"].endswith("+00:00")
    v = _review(client, lead, submitted["id"], decision="rework", comment="x").json()
    assert v["submitted_at"].endswith("+00:00")
    assert v["reviews"][0]["at"].endswith("+00:00")
