"""Admin API: users (create, role, active) and project memberships. Admin only, audited, with guard rails."""

import pytest

from app.models import AuditEvent, ProjectMember


def _audit(db, action):
    return [e.detail for e in db.query(AuditEvent).filter_by(action=action).order_by(AuditEvent.id)]


def test_admin_lists_users(client, auth_headers, users):
    r = client.get("/admin/users", headers=auth_headers("admin"))
    assert r.status_code == 200
    by_email = {u["email"]: u for u in r.json()}
    assert by_email["parvez@siteflow.local"]["role"] == "team_lead"
    assert set(by_email["parvez@siteflow.local"]) == {"id", "name", "email", "role", "active"}


def test_admin_creates_a_staff_user_with_a_one_time_password(client, auth_headers, db):
    r = client.post(
        "/admin/users",
        json={"name": "Rohan Kulkarni", "email": " Rohan@Example.com ", "role": "structural_consultant"},
        headers=auth_headers("admin"),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["user"]["email"] == "rohan@example.com" and body["user"]["role"] == "structural_consultant"
    assert len(body["temporary_password"]) >= 12
    login = client.post("/auth/login", json={"email": "rohan@example.com", "password": body["temporary_password"]})
    assert login.status_code == 200
    (detail,) = _audit(db, "user.created")
    assert detail["changes"]["role"] == [None, "structural_consultant"]
    assert body["temporary_password"] not in str(detail)


@pytest.mark.parametrize(
    "body,expected",
    [
        ({"name": "X", "email": "architect@siteflow.local", "role": "accounts"}, 409),  # email in use
        ({"name": "X", "email": "x@example.com", "role": "client"}, 422),  # clients come by invite
        ({"name": " ", "email": "x@example.com", "role": "accounts"}, 422),
        ({"name": "X", "email": "not-an-email", "role": "accounts"}, 422),
        ({"name": "X", "email": "x@example.com", "role": "overlord"}, 422),
    ],
)
def test_create_rules(client, auth_headers, body, expected):
    assert client.post("/admin/users", json=body, headers=auth_headers("admin")).status_code == expected


def test_admin_changes_a_role_and_deactivation_ends_sessions(client, auth_headers, users, db):
    eng_headers = auth_headers("civil_engineer")
    admin = auth_headers("admin")
    uid = users["civil_engineer"].id
    r = client.patch(f"/admin/users/{uid}", json={"role": "mep_consultant"}, headers=admin)
    assert r.status_code == 200 and r.json()["role"] == "mep_consultant"
    assert _audit(db, "user.updated")[-1]["changes"] == {"role": ["civil_engineer", "mep_consultant"]}
    r = client.patch(f"/admin/users/{uid}", json={"active": False}, headers=admin)
    assert r.status_code == 200 and r.json()["active"] is False
    assert _audit(db, "user.updated")[-1]["changes"] == {"is_active": [True, False]}
    assert client.get("/auth/me", headers=eng_headers).status_code == 401


@pytest.mark.parametrize("body", [{"role": "accounts"}, {"active": False}])
def test_admin_cannot_change_their_own_role_or_deactivate_themselves(client, auth_headers, users, body):
    r = client.patch(f"/admin/users/{users['admin'].id}", json=body, headers=auth_headers("admin"))
    assert r.status_code == 409


def test_client_accounts_are_not_managed_here(client, auth_headers, new_project, db):
    pid = new_project()["id"]
    inv = client.post(
        f"/projects/{pid}/client-invite",
        json={"name": "Asha", "email": "asha@example.com"},
        headers=auth_headers("architect"),
    ).json()
    r = client.patch(f"/admin/users/{inv['client']['id']}", json={"role": "accounts"}, headers=auth_headers("admin"))
    assert r.status_code == 409


def test_unknown_user_is_404(client, auth_headers):
    assert client.patch("/admin/users/9999", json={"active": False}, headers=auth_headers("admin")).status_code == 404


@pytest.mark.parametrize("role", ["architect", "team_lead", "accounts", "civil_engineer"])
def test_only_admins(client, auth_headers, role, users):
    h = auth_headers(role)
    assert client.get("/admin/users", headers=h).status_code == 403
    assert (
        client.post("/admin/users", json={"name": "X", "email": "x@e.com", "role": "accounts"}, headers=h).status_code
        == 403
    )
    assert client.patch(f"/admin/users/{users['architect'].id}", json={"active": False}, headers=h).status_code == 403


def test_admin_adds_and_removes_a_project_member(client, auth_headers, new_project, users, db):
    pid = new_project()["id"]
    admin = auth_headers("admin")
    scon = users["structural_consultant"]
    r = client.post(f"/projects/{pid}/members/{scon.id}", headers=admin)
    assert r.status_code == 201
    assert client.post(f"/projects/{pid}/members/{scon.id}", headers=admin).status_code == 409  # already a member
    projects = client.get("/projects", headers=auth_headers("structural_consultant")).json()
    assert [p["id"] for p in projects] == [pid]
    assert _audit(db, "member.added")[-1]["user"] == "Rahul Deshpande"
    r = client.delete(f"/projects/{pid}/members/{scon.id}", headers=admin)
    assert r.status_code == 204
    assert db.query(ProjectMember).filter_by(project_id=pid, user_id=scon.id).count() == 0
    assert _audit(db, "member.removed")[-1]["user"] == "Rahul Deshpande"


def test_membership_guard_rails(client, auth_headers, new_project, users):
    pid = new_project()["id"]
    admin = auth_headers("admin")
    # The project's architect and assigned civil engineer stay: removing them would break the workflow.
    assert client.delete(f"/projects/{pid}/members/{users['architect'].id}", headers=admin).status_code == 409
    assert client.delete(f"/projects/{pid}/members/{users['civil_engineer'].id}", headers=admin).status_code == 409
    assert client.delete(f"/projects/{pid}/members/{users['accounts'].id}", headers=admin).status_code == 404
    assert client.post(f"/projects/9999/members/{users['accounts'].id}", headers=admin).status_code == 404
    assert client.post(f"/projects/{pid}/members/9999", headers=admin).status_code == 404
    assert (
        client.post(f"/projects/{pid}/members/{users['accounts'].id}", headers=auth_headers("architect")).status_code
        == 403
    )
