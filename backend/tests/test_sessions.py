"""Sessions: login and activation open a session, refresh tokens rotate, and reuse or revocation ends access."""

from datetime import UTC, datetime, timedelta

from app.auth import decode_access_token
from app.models import UserSession
from tests.conftest import TEST_PASSWORD


def _login(client, users, role="architect", ua="pytest-agent"):
    r = client.post(
        "/auth/login",
        json={"email": users[role].email, "password": TEST_PASSWORD},
        headers={"User-Agent": ua},
    )
    assert r.status_code == 200, r.text
    return r.json()


def _bearer(tok):
    return {"Authorization": f"Bearer {tok['access_token']}"}


def test_login_opens_a_session_and_returns_a_refresh_token(client, users, db):
    tok = _login(client, users)
    assert tok["refresh_token"] and tok["access_token"]
    claims = decode_access_token(tok["access_token"])
    assert claims.user_id == users["architect"].id and claims.session_id
    s = db.get(UserSession, claims.session_id)
    assert s.user_id == users["architect"].id and s.revoked_at is None and s.user_agent == "pytest-agent"
    # Only a hash of the refresh token is stored.
    assert tok["refresh_token"] not in (s.refresh_hash, s.previous_hash)
    assert len(s.refresh_hash) == 64
    assert client.get("/auth/me", headers=_bearer(tok)).status_code == 200


def test_refresh_rotates_and_the_new_pair_works(client, users):
    tok = _login(client, users)
    r = client.post("/auth/refresh", json={"refresh_token": tok["refresh_token"]})
    assert r.status_code == 200, r.text
    new = r.json()
    assert new["refresh_token"] != tok["refresh_token"]
    assert decode_access_token(new["access_token"]).session_id == decode_access_token(tok["access_token"]).session_id
    assert client.get("/auth/me", headers=_bearer(new)).status_code == 200
    assert new["user"]["email"] == users["architect"].email


def test_reusing_an_old_refresh_token_revokes_the_session(client, users, db):
    tok = _login(client, users)
    new = client.post("/auth/refresh", json={"refresh_token": tok["refresh_token"]}).json()
    r = client.post("/auth/refresh", json={"refresh_token": tok["refresh_token"]})
    assert r.status_code == 401
    # The whole session is gone: the latest pair stops working too.
    assert client.get("/auth/me", headers=_bearer(new)).status_code == 401
    assert client.post("/auth/refresh", json={"refresh_token": new["refresh_token"]}).status_code == 401
    sid = decode_access_token(tok["access_token"]).session_id
    assert db.get(UserSession, sid).revoked_at is not None


def test_unknown_or_expired_refresh_token_is_refused(client, users, db):
    assert client.post("/auth/refresh", json={"refresh_token": "not-a-token"}).status_code == 401
    tok = _login(client, users)
    s = db.get(UserSession, decode_access_token(tok["access_token"]).session_id)
    s.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db.commit()
    assert client.post("/auth/refresh", json={"refresh_token": tok["refresh_token"]}).status_code == 401


def test_revoked_or_missing_session_ends_access(client, users, db):
    tok = _login(client, users)
    s = db.get(UserSession, decode_access_token(tok["access_token"]).session_id)
    s.revoked_at = datetime.now(UTC)
    db.commit()
    assert client.get("/auth/me", headers=_bearer(tok)).status_code == 401


def test_refresh_for_a_deactivated_user_is_refused(client, users, db):
    tok = _login(client, users)
    users["architect"].is_active = False
    db.commit()
    assert client.post("/auth/refresh", json={"refresh_token": tok["refresh_token"]}).status_code == 401


def test_activation_opens_a_session(client, auth_headers, new_project):
    pid = new_project()["id"]
    inv = client.post(
        f"/projects/{pid}/client-invite",
        json={"name": "Asha Kale", "email": "asha@example.com"},
        headers=auth_headers("architect"),
    ).json()
    r = client.post(
        "/auth/activate", json={"email": "asha@example.com", "code": inv["code"], "password": "a-long-password"}
    )
    assert r.status_code == 200, r.text
    assert r.json()["refresh_token"]
    assert decode_access_token(r.json()["access_token"]).session_id
