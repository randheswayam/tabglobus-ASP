import pytest

from tests.conftest import valid_visit

OTHER = {"category": "Other", "problem": None, "other_text": "Neighbouring wall leaning onto site", "severity": "Low",
         "location": "West boundary", "responsible_party": "Owner", "target_date": "2026-10-20"}


@pytest.fixture
def approved(client, auth_headers, ready_project, evidence):
    """Approve one visit with a High seepage problem and an Other problem."""
    evidence(ready_project["id"])
    base = valid_visit()["problems"][0]
    r = client.post(f"/projects/{ready_project['id']}/site-visits", headers=auth_headers("civil_engineer"),
                    json=valid_visit(problems=[base, OTHER]))
    assert r.status_code == 201, r.text
    vid = r.json()["id"]
    r = client.post(f"/site-visits/{vid}/review", json={"decision": "approve"}, headers=auth_headers("team_lead"))
    assert r.status_code == 200, r.text
    return {"project_id": ready_project["id"], "visit_id": vid}


def _problems(client, headers, pid, status=None):
    r = client.get(f"/projects/{pid}/problems", params={"status": status} if status else None, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_approval_turns_reported_problems_into_open_items(client, auth_headers, approved):
    items = _problems(client, auth_headers("architect"), approved["project_id"])
    assert [(p["category"], p["problem"], p["severity"], p["status"]) for p in items] == [
        ("Water", "Seepage or dampness", "High", "open"),
        ("Other", "Neighbouring wall leaning onto site", "Low", "open"),
    ]
    first = items[0]
    assert first["location"] == "North-east corner" and first["responsible_party"] == "Contractor"
    assert first["target_date"] == "2026-10-05" and first["visit_id"] == approved["visit_id"]
    assert first["index"] == 0 and first["project"]["id"] == approved["project_id"]


def test_rework_and_submission_do_not_create_problems(client, auth_headers, ready_project, evidence):
    evidence(ready_project["id"])
    r = client.post(f"/projects/{ready_project['id']}/site-visits", json=valid_visit(), headers=auth_headers("civil_engineer"))
    client.post(f"/site-visits/{r.json()['id']}/review", json={"decision": "rework", "comment": "More detail"},
                headers=auth_headers("team_lead"))
    assert _problems(client, auth_headers("team_lead"), ready_project["id"]) == []


def test_no_issues_visit_creates_no_problems(client, auth_headers, ready_project, evidence):
    evidence(ready_project["id"], problem_refs=())
    r = client.post(f"/projects/{ready_project['id']}/site-visits", json=valid_visit(no_issues=True, problems=[]),
                    headers=auth_headers("civil_engineer"))
    client.post(f"/site-visits/{r.json()['id']}/review", json={"decision": "approve"}, headers=auth_headers("team_lead"))
    assert _problems(client, auth_headers("team_lead"), ready_project["id"]) == []


@pytest.mark.parametrize("role", ["civil_engineer", "team_lead"])
def test_engineer_or_team_lead_resolves_with_a_note(client, auth_headers, approved, role):
    headers = auth_headers(role)
    pid = approved["project_id"]
    problem = _problems(client, headers, pid)[0]
    r = client.post(f"/problems/{problem['id']}/resolve", json={"note": "  Waterproofing redone and tested.  "}, headers=headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "resolved"
    assert body["resolution_note"] == "Waterproofing redone and tested."
    assert body["resolved_at"].endswith("+00:00") and body["resolved_by"]["role"] == role

    assert [p["id"] for p in _problems(client, headers, pid, "resolved")] == [problem["id"]]
    assert len(_problems(client, headers, pid, "open")) == 1
    audit = client.get(f"/projects/{pid}", headers=headers).json()["audit"]
    assert audit[-1]["action"] == "problem.resolved" and audit[-1]["detail"]["problem_id"] == problem["id"]


def test_resolve_needs_a_note(client, auth_headers, approved):
    pid = _problems(client, auth_headers("team_lead"), approved["project_id"])[0]["id"]
    r = client.post(f"/problems/{pid}/resolve", json={"note": "  "}, headers=auth_headers("team_lead"))
    assert r.status_code == 422 and r.json()["detail"]["missing"] == ["note"]


def test_resolving_twice_is_409(client, auth_headers, approved):
    lead = auth_headers("team_lead")
    pid = _problems(client, lead, approved["project_id"])[0]["id"]
    assert client.post(f"/problems/{pid}/resolve", json={"note": "Fixed"}, headers=lead).status_code == 200
    assert client.post(f"/problems/{pid}/resolve", json={"note": "Again"}, headers=lead).status_code == 409


@pytest.mark.parametrize("role", ["architect", "admin"])
def test_other_roles_cannot_resolve(client, auth_headers, approved, role):
    pid = _problems(client, auth_headers("team_lead"), approved["project_id"])[0]["id"]
    assert client.post(f"/problems/{pid}/resolve", json={"note": "x"}, headers=auth_headers(role)).status_code == 403


def test_invisible_or_missing_problem_is_404(client, db, auth_headers, approved):
    from app import models as m

    eng = db.query(m.User).filter_by(role=m.Role.civil_engineer).one()
    db.query(m.ProjectMember).filter_by(project_id=approved["project_id"], user_id=eng.id).delete()
    db.commit()
    lead = auth_headers("team_lead")
    pid = _problems(client, lead, approved["project_id"])[0]["id"]
    assert client.post(f"/problems/{pid}/resolve", json={"note": "x"}, headers=auth_headers("civil_engineer")).status_code == 404
    assert client.get(f"/projects/{approved['project_id']}/problems", headers=auth_headers("civil_engineer")).status_code == 404
    assert client.post("/problems/9999/resolve", json={"note": "x"}, headers=lead).status_code == 404


def test_invalid_status_filter_is_422(client, auth_headers, approved):
    r = client.get(f"/projects/{approved['project_id']}/problems", params={"status": "maybe"}, headers=auth_headers("team_lead"))
    assert r.status_code == 422
