"""The principal architect: a designation on a staff user (Parvez), set only by an Admin; principal-only views
check it with require_principal."""

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app import models as m
from app.deps import require_principal
from app.models import AuditEvent


@pytest.fixture
def probe(users):
    from app.main import app as real_app

    api = FastAPI()
    api.dependency_overrides = real_app.dependency_overrides

    @api.get("/principal-only")
    def only(user: m.User = Depends(require_principal)):
        return {"name": user.name}

    return TestClient(api)


def test_the_seed_marks_parvez_as_principal(users):
    assert users["team_lead"].name == "Parvez" and users["team_lead"].is_principal is True
    assert [u.role.value for u in users.values() if u.is_principal] == ["team_lead"]


def test_only_the_principal_passes(probe, auth_headers, users):
    assert probe.get("/principal-only", headers=auth_headers("team_lead")).json() == {"name": "Parvez"}
    for role in users:
        if role != "team_lead":
            assert probe.get("/principal-only", headers=auth_headers(role)).status_code == 403, role
    assert probe.get("/principal-only").status_code == 401


def test_a_client_is_refused(probe, client_headers):
    assert probe.get("/principal-only", headers=client_headers).status_code == 403


def test_admin_sets_and_clears_the_designation(client, auth_headers, users, db):
    admin = auth_headers("admin")
    uid = users["architect"].id
    r = client.patch(f"/admin/users/{uid}", json={"principal": True}, headers=admin)
    assert r.status_code == 200 and r.json()["principal"] is True
    assert db.query(AuditEvent).filter_by(action="user.updated").all()[-1].detail["changes"] == {
        "is_principal": [False, True]
    }
    r = client.patch(f"/admin/users/{uid}", json={"principal": False}, headers=admin)
    assert r.json()["principal"] is False
    listed = {u["email"]: u for u in client.get("/admin/users", headers=admin).json()}
    assert listed["parvez@siteflow.local"]["principal"] is True


def test_only_an_active_staff_user_can_be_principal(client, auth_headers, users, new_project):
    admin = auth_headers("admin")
    client.patch(f"/admin/users/{users['accounts'].id}", json={"active": False}, headers=admin)
    r = client.patch(f"/admin/users/{users['accounts'].id}", json={"principal": True}, headers=admin)
    assert r.status_code == 409
    pid = new_project()["id"]
    inv = client.post(
        f"/projects/{pid}/client-invite",
        json={"name": "Asha", "email": "asha@example.com"},
        headers=auth_headers("architect"),
    ).json()
    assert (
        client.patch(f"/admin/users/{inv['client']['id']}", json={"principal": True}, headers=admin).status_code == 409
    )


@pytest.mark.parametrize("role", ["architect", "team_lead", "accounts"])
def test_only_admins_set_it(client, auth_headers, users, role):
    r = client.patch(f"/admin/users/{users['architect'].id}", json={"principal": True}, headers=auth_headers(role))
    assert r.status_code == 403


def test_me_says_whether_the_user_is_principal(client, auth_headers):
    assert client.get("/auth/me", headers=auth_headers("team_lead")).json()["principal"] is True
    assert client.get("/auth/me", headers=auth_headers("architect")).json()["principal"] is False
