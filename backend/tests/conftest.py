import os
import tempfile

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("PASSWORD_HASH_ITERATIONS", "1000")
os.environ.setdefault("AUTO_MIGRATE", "false")
os.environ.setdefault("MEDIA_DIR", tempfile.mkdtemp(prefix="siteflow-test-media-"))

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


@pytest.fixture
def ready_project(client, auth_headers, new_project):
    """A project with Legal Approval approved, so Step 2 (Site Visit) is active."""
    p = new_project()
    admin = auth_headers("admin")
    for body in ({"status": "Applied", "authority_name": "PMC", "application_reference": "BP-1",
                  "application_date": "2026-09-01"},
                 {"status": "Approved", "approval_date": "2026-09-20", "document_reference": "doc://approval-1"}):
        r = client.patch(f"/projects/{p['id']}/legal", json=body, headers=admin)
        assert r.status_code == 200, r.text
    return r.json()


def valid_visit(**overrides) -> dict:
    """A complete site visit payload at the Plinth stage with one problem."""
    body = {
        "visit_at": "2026-09-27T10:30:00+05:30",
        "location": {"gps": {"lat": 18.5590, "lng": 73.7868}, "manual": None},
        "weather": "Clear",
        "attendees": "Farhan Shaikh, site contractor",
        "current_stage": "Plinth",
        "checklist": {"pln-beam": "Done", "pln-filling": "In progress", "pln-dpc": "Not started"},
        "no_issues": False,
        "problems": [{
            "category": "Water", "problem": "Seepage or dampness", "other_text": None,
            "severity": "High", "location": "North-east corner", "responsible_party": "Contractor",
            "target_date": "2026-10-05",
        }],
        "summary": "Plinth beam cast; filling under way.",
        "recommended_action": "Fix seepage before DPC.",
    }
    body.update(overrides)
    return body


# Smallest byte strings that pass the server's file-signature checks.
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64


@pytest.fixture
def upload(client, auth_headers):
    """upload(visit_id, kind="photo", data=PNG, content_type="image/png", **form) -> response."""

    def _upload(visit_id, kind="photo", data=PNG, content_type="image/png", headers=None, **form):
        files = {"file": ("site.bin", data, content_type)}
        fields = {"kind": kind, **{k: str(v) for k, v in form.items()}}
        return client.post(f"/site-visits/{visit_id}/media", files=files, data=fields,
                           headers=headers or auth_headers("civil_engineer"))

    return _upload


@pytest.fixture
def evidence(client, auth_headers, upload):
    """evidence(project_id, problem_refs=(0,)) tops up the open visit with the photos a submission needs:
    MIN_PHOTOS in total, including one tagged to each listed problem (valid_visit's High problem is 0)."""
    from app import template_config as tc

    def _evidence(project_id: int, problem_refs=(0,)) -> dict:
        eng = auth_headers("civil_engineer")
        visit = client.post(f"/projects/{project_id}/site-visits/draft", headers=eng)
        assert visit.status_code == 200, visit.text
        visit = visit.json()
        photos = [m for m in visit["media"] if m["kind"] == "photo"]
        have_refs = {m["problem_ref"] for m in photos}
        for ref in problem_refs:
            if ref not in have_refs:
                assert upload(visit["id"], problem_ref=ref).status_code == 201
                photos.append({"problem_ref": ref})
        for _ in range(tc.MIN_PHOTOS - len(photos)):
            assert upload(visit["id"]).status_code == 201
        return visit

    return _evidence


def workflow_actions(audit: list[dict]) -> list[str]:
    """Audit actions without media and red flag events, for tests about the order of workflow steps."""
    return [e["action"] for e in audit if not e["action"].startswith(("media.", "red_flag."))]
