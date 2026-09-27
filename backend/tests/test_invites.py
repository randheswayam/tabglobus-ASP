"""Inviting a client: the Architect gets a one-time code to share; the client sets a password with it."""
from datetime import datetime, timedelta, timezone

import pytest

from app import models as m
from app import workflow_config as wc

INVITE = {"name": "Mr. Gokhale", "email": "Gokhale@Client.example"}
NEW_PASSWORD = "house-on-baner-14"


def _invite(client, auth_headers, pid, body=INVITE, role="architect"):
    return client.post(f"/projects/{pid}/client-invite", json=body, headers=auth_headers(role))


def _activate(client, code, email="gokhale@client.example", password=NEW_PASSWORD):
    return client.post("/auth/activate", json={"email": email, "code": code, "password": password})


def test_architect_invites_a_client_and_gets_a_one_time_code(client, auth_headers, new_project, db):
    pid = new_project()["id"]
    r = _invite(client, auth_headers, pid)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["client"] == {"id": body["client"]["id"], "name": "Mr. Gokhale", "email": "gokhale@client.example",
                              "status": "invited"}
    assert len(body["code"]) == 8 and body["code"].isalnum() and body["expires_at"].endswith("+00:00")
    user = db.get(m.User, body["client"]["id"])
    assert user.role == m.Role.client and user.is_active is False
    invite = db.query(m.ClientInvite).one()
    assert invite.code_hash != body["code"] and body["code"] not in invite.code_hash  # only a hash is stored
    clients = client.get(f"/projects/{pid}/clients", headers=auth_headers("architect")).json()
    assert [c["status"] for c in clients] == ["invited"]
    audit = [e["action"] for e in client.get(f"/projects/{pid}", headers=auth_headers("architect")).json()["audit"]]
    assert "client.invited" in audit


def test_client_activates_and_signs_in(client, auth_headers, new_project):
    pid = new_project()["id"]
    code = _invite(client, auth_headers, pid).json()["code"]
    assert client.post("/auth/login", json={"email": INVITE["email"], "password": NEW_PASSWORD}).status_code == 401
    r = _activate(client, code.lower())  # codes are not case-sensitive
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "client" and r.json()["access_token"]
    assert client.post("/auth/login", json={"email": INVITE["email"], "password": NEW_PASSWORD}).status_code == 200
    assert _activate(client, code).status_code == 400  # a code works once
    clients = client.get(f"/projects/{pid}/clients", headers=auth_headers("architect")).json()
    assert clients[0]["status"] == "active"


def test_wrong_codes_lock_the_invite(client, auth_headers, new_project):
    code = _invite(client, auth_headers, new_project()["id"]).json()["code"]
    for _ in range(wc.INVITE_MAX_ATTEMPTS):
        r = _activate(client, "WRONG123")
        assert r.status_code == 400
    r = _activate(client, code)
    assert r.status_code == 400
    assert r.json()["detail"] == "This invite code is not valid. Ask your architect for a new one."


def test_expired_code_is_refused(client, auth_headers, new_project, db):
    code = _invite(client, auth_headers, new_project()["id"]).json()["code"]
    inv = db.query(m.ClientInvite).one()
    inv.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()
    assert _activate(client, code).status_code == 400


def test_reinvite_replaces_the_old_code(client, auth_headers, new_project):
    pid = new_project()["id"]
    first = _invite(client, auth_headers, pid).json()["code"]
    second = _invite(client, auth_headers, pid).json()["code"]
    assert first != second
    assert _activate(client, first).status_code == 400
    assert _activate(client, second).status_code == 200


def test_active_client_is_added_to_another_project_without_a_code(client, auth_headers, new_project):
    code = _invite(client, auth_headers, new_project("Villa A")["id"]).json()["code"]
    _activate(client, code)
    r = _invite(client, auth_headers, new_project("Villa B")["id"])
    assert r.status_code == 201 and r.json()["code"] is None and r.json()["client"]["status"] == "active"


def test_team_member_email_cannot_become_a_client(client, auth_headers, new_project):
    r = _invite(client, auth_headers, new_project()["id"], {"name": "Parvez", "email": "parvez@siteflow.local"})
    assert r.status_code == 409


@pytest.mark.parametrize("body", [{"name": " ", "email": "a@b.example"}, {"name": "A", "email": "not-an-email"}])
def test_invite_validation(client, auth_headers, new_project, body):
    assert _invite(client, auth_headers, new_project()["id"], body).status_code == 422


@pytest.mark.parametrize("role", ["team_lead", "civil_engineer", "admin"])
def test_only_the_architect_invites(client, auth_headers, new_project, role):
    assert _invite(client, auth_headers, new_project()["id"], role=role).status_code == 403


def test_short_password_is_refused(client, auth_headers, new_project):
    code = _invite(client, auth_headers, new_project()["id"]).json()["code"]
    assert _activate(client, code, password="short").status_code == 422
    assert _activate(client, code).status_code == 200  # a validation error does not burn the code
