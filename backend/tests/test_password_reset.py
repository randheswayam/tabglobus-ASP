"""Password reset stub: an Admin issues a one-time token (hashed at rest, with a TTL); POST /auth/reset sets the new
password and signs the user out everywhere. Nothing is emailed yet."""

from datetime import UTC, datetime, timedelta

import pytest

from app import workflow_config as wc
from app.models import AuditEvent, PasswordReset, UserSession

NEW = "a-brand-new-pass"


def _issue(client, auth_headers, uid):
    r = client.post(f"/admin/users/{uid}/password-reset", headers=auth_headers("admin"))
    assert r.status_code == 201, r.text
    return r.json()


def _login(client, email, password):
    return client.post("/auth/login", json={"email": email, "password": password})


def test_admin_issues_a_token_and_the_user_sets_a_new_password(client, auth_headers, users, db):
    eng = users["civil_engineer"]
    issued = _issue(client, auth_headers, eng.id)
    assert len(issued["token"]) >= 32 and issued["expires_at"]
    row = db.query(PasswordReset).one()
    assert row.token_hash != issued["token"] and issued["token"] not in row.token_hash

    r = client.post("/auth/reset", json={"token": issued["token"], "password": NEW})
    assert r.status_code == 204, r.text
    assert _login(client, eng.email, NEW).status_code == 200
    actions = [a.action for a in db.query(AuditEvent).order_by(AuditEvent.id)]
    assert "user.password_reset_issued" in actions and "user.password_reset" in actions


def test_the_reset_ends_every_session(client, auth_headers, users, db):
    eng = users["civil_engineer"]
    h = auth_headers("civil_engineer")
    assert client.get("/auth/me", headers=h).status_code == 200
    issued = _issue(client, auth_headers, eng.id)
    client.post("/auth/reset", json={"token": issued["token"], "password": NEW})
    assert client.get("/auth/me", headers=h).status_code == 401
    db.expire_all()
    live = db.query(UserSession).filter_by(user_id=eng.id, revoked_at=None).count()
    assert live == 0


def test_a_token_works_once(client, auth_headers, users):
    issued = _issue(client, auth_headers, users["architect"].id)
    assert client.post("/auth/reset", json={"token": issued["token"], "password": NEW}).status_code == 204
    r = client.post("/auth/reset", json={"token": issued["token"], "password": "another-new-pass"})
    assert r.status_code == 400


def test_an_expired_token_is_refused(client, auth_headers, users, db):
    issued = _issue(client, auth_headers, users["architect"].id)
    row = db.query(PasswordReset).one()
    row.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db.commit()
    assert client.post("/auth/reset", json={"token": issued["token"], "password": NEW}).status_code == 400


def test_the_ttl_comes_from_config(client, auth_headers, users, monkeypatch):
    monkeypatch.setattr(wc, "PASSWORD_RESET_TTL_HOURS", 2)
    issued = _issue(client, auth_headers, users["architect"].id)
    left = datetime.fromisoformat(issued["expires_at"]) - datetime.now(UTC)
    assert timedelta(hours=1, minutes=59) < left <= timedelta(hours=2)


def test_a_new_token_replaces_the_old_one(client, auth_headers, users):
    first = _issue(client, auth_headers, users["architect"].id)
    second = _issue(client, auth_headers, users["architect"].id)
    assert client.post("/auth/reset", json={"token": first["token"], "password": NEW}).status_code == 400
    assert client.post("/auth/reset", json={"token": second["token"], "password": NEW}).status_code == 204


def test_short_password_and_unknown_token(client, auth_headers, users):
    issued = _issue(client, auth_headers, users["architect"].id)
    assert client.post("/auth/reset", json={"token": issued["token"], "password": "short"}).status_code == 422
    assert client.post("/auth/reset", json={"token": "not-a-real-token", "password": NEW}).status_code == 400
    # The short attempt didn't use the token up.
    assert client.post("/auth/reset", json={"token": issued["token"], "password": NEW}).status_code == 204


@pytest.mark.parametrize("role", ["architect", "team_lead", "accounts"])
def test_only_an_admin_issues(client, auth_headers, users, role):
    r = client.post(f"/admin/users/{users['civil_engineer'].id}/password-reset", headers=auth_headers(role))
    assert r.status_code == 403


def test_not_for_clients_or_inactive_users(client, auth_headers, users, client_user):
    admin = auth_headers("admin")
    assert client.post(f"/admin/users/{client_user.id}/password-reset", headers=admin).status_code == 409
    client.patch(f"/admin/users/{users['accounts'].id}", json={"active": False}, headers=admin)
    assert client.post(f"/admin/users/{users['accounts'].id}/password-reset", headers=admin).status_code == 409
    assert client.post("/admin/users/99999/password-reset", headers=admin).status_code == 404
