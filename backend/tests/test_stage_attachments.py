"""Files attached when completing a stage: photos, videos, PDFs and AutoCAD drawings (DWG, DXF), checked by their
bytes, size-limited, stored privately, and downloadable by staff only."""

import pytest

from app import workflow_config as wc
from app.models import AuditEvent, StageAttachment

JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64
PDF = b"%PDF-1.7\n" + b"\x00" * 64
DWG = b"AC1032" + b"\x00" * 64
DXF = b"  0\nSECTION\n  2\nHEADER\n  0\nENDSEC\n  0\nEOF\n"


def _up(client, headers, pid, key, name, data, ctype="application/octet-stream"):
    return client.post(
        f"/projects/{pid}/stages/{key}/attachments", files={"file": (name, data, ctype)}, headers=headers
    )


@pytest.fixture
def site_stage(new_project):
    """A project whose pre-design site visit (owner: Civil Engineer) is open."""
    return new_project(start_stage="predesign_site_visit", historical_confirmed_by="Parvez")["id"]


@pytest.mark.parametrize(
    "name,data,ctype,kind,stored_type",
    [
        ("front.jpg", JPEG, "image/jpeg", "photo", "image/jpeg"),
        ("plan.png", PNG, "image/png", "photo", "image/png"),
        ("walk.mp4", MP4, "video/mp4", "video", "video/mp4"),
        ("report.pdf", PDF, "application/pdf", "document", "application/pdf"),
        ("grid.dwg", DWG, "application/octet-stream", "cad", "image/vnd.dwg"),
        ("grid.DXF", DXF, "text/plain", "cad", "image/vnd.dxf"),
    ],
)
def test_each_accepted_type(client, auth_headers, site_stage, db, name, data, ctype, kind, stored_type):
    r = _up(client, auth_headers("civil_engineer"), site_stage, "predesign_site_visit", name, data, ctype)
    assert r.status_code == 201, r.text
    out = r.json()
    assert out["kind"] == kind and out["filename"] == name and out["size"] == len(data)
    row = db.get(StageAttachment, out["id"])
    assert row.content_type == stored_type and len(row.sha256) == 64 and row.completed_at is None
    assert name not in row.storage_key  # stored under a random key
    assert db.query(AuditEvent).filter_by(action="stage.attachment_added").count() == 1


@pytest.mark.parametrize(
    "name,data,ctype",
    [
        ("fake.jpg", PDF, "image/jpeg"),  # bytes are a PDF, not a JPEG
        ("fake.dwg", PDF, "application/octet-stream"),
        ("fake.dxf", b"hello world", "text/plain"),
        ("run.exe", b"MZ\x90\x00", "application/octet-stream"),
        ("notes.txt", b"hello", "text/plain"),
    ],
)
def test_wrong_or_unknown_types_are_415(client, auth_headers, site_stage, name, data, ctype):
    r = _up(client, auth_headers("civil_engineer"), site_stage, "predesign_site_visit", name, data, ctype)
    assert r.status_code == 415


def test_too_large_is_413(client, auth_headers, site_stage, monkeypatch):
    monkeypatch.setitem(wc.MAX_STAGE_ATTACHMENT_MB, "cad", 1)
    big = DWG + b"\x00" * (1024 * 1024)
    r = _up(client, auth_headers("civil_engineer"), site_stage, "predesign_site_visit", "big.dwg", big)
    assert r.status_code == 413


def test_locked_stage_and_sign_off_stage_are_409(client, auth_headers, site_stage):
    eng, arch = auth_headers("civil_engineer"), auth_headers("architect")
    assert _up(client, eng, site_stage, "investigations", "a.jpg", JPEG, "image/jpeg").status_code == 409
    signoff = _up(client, arch, site_stage, "requirements_signoff", "a.jpg", JPEG, "image/jpeg")
    assert signoff.status_code == 409  # client sign-off stages use sign-off packages


def test_historical_stages_accept_evidence(client, auth_headers, site_stage):
    r = _up(client, auth_headers("architect"), site_stage, "baseline", "signed-baseline.pdf", PDF, "application/pdf")
    assert r.status_code == 201


def test_only_people_who_may_complete_the_stage_upload(client, auth_headers, site_stage):
    # The Architect and Team Lead may complete any ordinary stage; Accounts may not complete a site stage.
    ok = _up(client, auth_headers("team_lead"), site_stage, "predesign_site_visit", "a.jpg", JPEG, "image/jpeg")
    assert ok.status_code == 201
    assert (
        _up(client, auth_headers("admin"), site_stage, "predesign_site_visit", "a.jpg", JPEG, "image/jpeg").status_code
        == 403
    )


def test_uploader_removes_before_completion_and_nobody_after(client, auth_headers, site_stage, db):
    eng, lead = auth_headers("civil_engineer"), auth_headers("team_lead")
    aid = _up(client, eng, site_stage, "predesign_site_visit", "a.jpg", JPEG, "image/jpeg").json()["id"]
    base = f"/projects/{site_stage}/stages/predesign_site_visit/attachments"
    assert client.delete(f"{base}/{aid}", headers=lead).status_code == 403  # not the uploader
    assert client.delete(f"{base}/{aid}", headers=eng).status_code == 204
    assert db.get(StageAttachment, aid) is None
    aid = _up(client, eng, site_stage, "predesign_site_visit", "b.jpg", JPEG, "image/jpeg").json()["id"]
    r = client.post(
        f"/projects/{site_stage}/stages/predesign_site_visit/complete", json={"note": "Visited"}, headers=eng
    )
    assert r.status_code == 200
    assert client.delete(f"{base}/{aid}", headers=eng).status_code == 409


def test_staff_download_as_attachment_and_cad_never_inline(client, auth_headers, site_stage):
    eng = auth_headers("civil_engineer")
    aid = _up(client, eng, site_stage, "predesign_site_visit", "grid.dwg", DWG).json()["id"]
    r = client.get(
        f"/projects/{site_stage}/stages/predesign_site_visit/attachments/{aid}", headers=auth_headers("architect")
    )
    assert r.status_code == 200 and r.content == DWG
    assert (
        r.headers["content-disposition"].startswith("attachment;")
        and 'filename="grid.dwg"' in r.headers["content-disposition"]
    )
    assert r.headers["x-content-type-options"] == "nosniff"


def test_attachments_on_another_stage_or_project_are_404(client, auth_headers, site_stage, new_project):
    eng = auth_headers("civil_engineer")
    aid = _up(client, eng, site_stage, "predesign_site_visit", "a.jpg", JPEG, "image/jpeg").json()["id"]
    assert client.get(f"/projects/{site_stage}/stages/concept/attachments/{aid}", headers=eng).status_code == 404
    other = new_project("Other Villa")["id"]
    assert (
        client.get(f"/projects/{other}/stages/predesign_site_visit/attachments/{aid}", headers=eng).status_code == 404
    )
