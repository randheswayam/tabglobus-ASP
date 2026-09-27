import pytest

from app import models as m


def test_architect_creates_project_from_template(client, users, auth_headers, new_project, db):
    p = new_project()
    assert p["name"] == "Villa A"
    assert p["location"] == "Baner, Pune"
    assert p["template"] == {"id": "residential", "version": 1}
    assert [(s["order"], s["name"], s["status"]) for s in p["steps"]] == [
        (1, "Legal Approval", "active"),
        (2, "Site Visit", "locked"),
        (3, "Team Lead Review", "locked"),
    ]
    assert p["current_step"] == "Legal Approval"
    assert p["legal_approval"]["status"] == "Not started"
    assert p["legal_approval"]["expected_date"] == "2026-11-30"
    assert p["official_progress"] == 0
    assert p["latest_visit"] is None
    assert p["civil_engineer"]["id"] == users["civil_engineer"].id


def test_members_are_creator_engineer_and_admins(new_project, users, db):
    p = new_project()
    member_ids = {pm.user_id for pm in db.query(m.ProjectMember).filter_by(project_id=p["id"])}
    assert member_ids == {users["architect"].id, users["civil_engineer"].id, users["admin"].id}


def test_create_writes_audit_event(new_project, users):
    p = new_project()
    assert [e["action"] for e in p["audit"]] == ["project.created", "stage.activated"]
    ev = p["audit"][0]
    assert ev["action"] == "project.created"
    assert ev["actor"] == "Meera Joshi"
    assert ev["at"]


@pytest.mark.parametrize("role", ["civil_engineer", "team_lead", "admin"])
def test_only_architect_can_create(client, users, auth_headers, role):
    body = {"name": "X", "location": "Y", "civil_engineer_id": users["civil_engineer"].id}
    r = client.post("/projects", json=body, headers=auth_headers(role))
    assert r.status_code == 403


def test_create_rejects_non_engineer_assignee(client, users, auth_headers):
    body = {"name": "X", "location": "Y", "civil_engineer_id": users["admin"].id}
    r = client.post("/projects", json=body, headers=auth_headers("architect"))
    assert r.status_code == 422


@pytest.mark.parametrize("field", ["name", "location"])
def test_create_requires_non_blank_name_and_location(client, users, auth_headers, field):
    body = {"name": "X", "location": "Y", "civil_engineer_id": users["civil_engineer"].id, field: "  "}
    r = client.post("/projects", json=body, headers=auth_headers("architect"))
    assert r.status_code == 422


def test_list_and_detail_respect_visibility(client, db, users, auth_headers, new_project):
    mine = new_project("Villa A")
    # A project the engineer is not a member of.
    other_eng = m.User(name="Other Eng", email="other@siteflow.local", role=m.Role.civil_engineer,
                       password_hash="x")
    db.add(other_eng)
    db.commit()
    theirs = new_project("Villa B", civil_engineer_id=other_eng.id)

    eng = auth_headers("civil_engineer")
    names = [p["name"] for p in client.get("/projects", headers=eng).json()]
    assert names == ["Villa A"]
    assert client.get(f"/projects/{mine['id']}", headers=eng).status_code == 200
    assert client.get(f"/projects/{theirs['id']}", headers=eng).status_code == 404

    for role in ("architect", "team_lead"):
        names = [p["name"] for p in client.get("/projects", headers=auth_headers(role)).json()]
        assert names == ["Villa A", "Villa B"]


def test_list_item_summary_fields(client, auth_headers, new_project):
    new_project()
    item = client.get("/projects", headers=auth_headers("team_lead")).json()[0]
    assert set(item) >= {"id", "name", "location", "current_step", "official_progress",
                         "latest_visit_status", "civil_engineer"}
    assert item["current_step"] == "Legal Approval"
    assert item["latest_visit_status"] is None


def test_detail_of_missing_project_is_404(client, auth_headers):
    assert client.get("/projects/9999", headers=auth_headers("architect")).status_code == 404


def test_list_engineers_for_assignment(client, auth_headers, users):
    r = client.get("/users", params={"role": "civil_engineer"}, headers=auth_headers("architect"))
    assert r.status_code == 200
    assert [u["id"] for u in r.json()] == [users["civil_engineer"].id]
    assert client.get("/users", headers=auth_headers("civil_engineer")).status_code == 403


def test_timestamps_are_serialized_as_utc(new_project):
    # SQLite hands back naive datetimes; the API must still say they are UTC so clients show local time correctly.
    at = new_project()["audit"][0]["at"]
    assert at.endswith("+00:00"), at
