from datetime import timedelta

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app import models as m
from app.auth import create_access_token, decode_access_token
from app.deps import require_role, visible_projects
from app.modules.identity.sessions import open_session
from tests.conftest import TEST_PASSWORD

# ---------- POST /auth/login ----------


def test_login_returns_jwt_and_user(client, users):
    r = client.post("/auth/login", json={"email": users["team_lead"].email, "password": TEST_PASSWORD})
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"].count(".") == 2
    assert body["user"] == {
        "id": users["team_lead"].id,
        "name": "Parvez",
        "email": "parvez@siteflow.local",
        "role": "team_lead",
        "principal": True,
    }


def test_login_email_is_case_insensitive(client, users):
    r = client.post("/auth/login", json={"email": "PARVEZ@SiteFlow.local", "password": TEST_PASSWORD})
    assert r.status_code == 200


@pytest.mark.parametrize(
    "email,password",
    [
        ("parvez@siteflow.local", "wrong-password"),
        ("nobody@siteflow.local", TEST_PASSWORD),
    ],
)
def test_login_rejects_bad_credentials_with_same_message(client, users, email, password):
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 401
    assert r.json()["detail"] == "Incorrect email or password"


def test_login_rejects_inactive_user(client, users, db):
    u = db.get(m.User, users["admin"].id)
    u.is_active = False
    db.commit()
    r = client.post("/auth/login", json={"email": u.email, "password": TEST_PASSWORD})
    assert r.status_code == 401


# ---------- GET /auth/me ----------


def test_me_returns_current_user_and_role(client, auth_headers):
    r = client.get("/auth/me", headers=auth_headers("civil_engineer"))
    assert r.status_code == 200
    assert r.json()["role"] == "civil_engineer"
    assert r.json()["email"] == "engineer@siteflow.local"


def test_me_without_token_is_401(client):
    assert client.get("/auth/me").status_code == 401


def test_me_with_tampered_token_is_401(client, auth_headers):
    token = auth_headers("architect")["Authorization"]
    r = client.get("/auth/me", headers={"Authorization": token[:-3] + "abc"})
    assert r.status_code == 401


def test_me_with_expired_token_is_401(client, users, db):
    access, _ = open_session(db, users["architect"], "pytest")
    db.commit()
    sid = decode_access_token(access).session_id
    token = create_access_token(users["architect"].id, sid, expires_in=timedelta(seconds=-1))
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_me_for_deactivated_user_is_401(client, users, auth_headers, db):
    headers = auth_headers("admin")
    u = db.get(m.User, users["admin"].id)
    u.is_active = False
    db.commit()
    assert client.get("/auth/me", headers=headers).status_code == 401


# ---------- require_role ----------


@pytest.fixture
def role_client(users):
    from app.main import app as real_app

    probe = FastAPI()
    probe.dependency_overrides = real_app.dependency_overrides

    @probe.get("/leads-only")
    def leads_only(user: m.User = Depends(require_role(m.Role.team_lead, m.Role.architect))):
        return {"role": user.role.value}

    return TestClient(probe)


@pytest.mark.parametrize(
    "role,expected",
    [
        ("team_lead", 200),
        ("architect", 200),
        ("civil_engineer", 403),
        ("admin", 403),
    ],
)
def test_require_role(role_client, users, role, expected, db):
    token, _ = open_session(db, users[role], "pytest")
    db.commit()
    r = role_client.get("/leads-only", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == expected


def test_require_role_without_token_is_401(role_client):
    assert role_client.get("/leads-only").status_code == 401


# ---------- visible_projects ----------


@pytest.fixture
def two_projects(db, users):
    a = m.Project(name="Villa A", location="Pune", created_by_id=users["architect"].id)
    b = m.Project(name="Villa B", location="Nashik", created_by_id=users["architect"].id)
    db.add_all([a, b])
    db.flush()
    db.add(m.ProjectMember(project_id=a.id, user_id=users["civil_engineer"].id))
    db.commit()
    return a, b


@pytest.mark.parametrize(
    "role,expected",
    [
        ("architect", {"Villa A", "Villa B"}),
        ("team_lead", {"Villa A", "Villa B"}),
        ("civil_engineer", {"Villa A"}),
        ("admin", set()),
    ],
)
def test_visible_projects(db, users, two_projects, role, expected):
    names = {p.name for p in db.scalars(visible_projects(users[role]))}
    assert names == expected
