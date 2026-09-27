import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("PASSWORD_HASH_ITERATIONS", "1000")

from app import models  # noqa: E402,F401  (registers tables)
from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


TEST_PASSWORD = "correct-horse-battery"


@pytest.fixture
def users(db):
    """One seeded user per role, keyed by role value."""
    from app.seed import seed

    return {u.role.value: u for u in seed(db, password=TEST_PASSWORD)}


@pytest.fixture
def auth_headers(client, users):
    """auth_headers("architect") -> Authorization header for that seeded user."""

    def _headers(role: str) -> dict:
        r = client.post("/auth/login", json={"email": users[role].email, "password": TEST_PASSWORD})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    return _headers


@pytest.fixture
def new_project(client, users, auth_headers):
    """new_project(name=...) -> JSON of a project created through the API by the architect."""

    def _create(name: str = "Villa A", **overrides) -> dict:
        body = {"name": name, "location": "Baner, Pune",
                "civil_engineer_id": users["civil_engineer"].id,
                "legal_expected_date": "2026-11-30", **overrides}
        r = client.post("/projects", json=body, headers=auth_headers("architect"))
        assert r.status_code == 201, r.text
        return r.json()

    return _create
