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


# ---------- completing with files (Task 24) ----------


def _view_stage(client, headers, pid, key):
    view = client.get(f"/projects/{pid}/stages", headers=headers).json()
    return next(s for p in view["phases"] for s in p["stages"] if s["key"] == key)


def test_completion_links_the_pending_files_and_the_tracker_lists_them(client, auth_headers, site_stage, db):
    eng = auth_headers("civil_engineer")
    a1 = _up(client, eng, site_stage, "predesign_site_visit", "front.jpg", JPEG, "image/jpeg").json()["id"]
    a2 = _up(client, eng, site_stage, "predesign_site_visit", "grid.dwg", DWG).json()["id"]
    before = _view_stage(client, eng, site_stage, "predesign_site_visit")
    assert [a["filename"] for a in before["attachments"]] == ["front.jpg", "grid.dwg"]
    r = client.post(
        f"/projects/{site_stage}/stages/predesign_site_visit/complete",
        json={"note": "Well found near the gate"},
        headers=eng,
    )
    assert r.status_code == 200
    s = _view_stage(client, eng, site_stage, "predesign_site_visit")
    assert s["completion_note"] == "Well found near the gate"
    assert all(a["completed_at"] for a in s["attachments"])
    assert db.get(StageAttachment, a1).completed_at and db.get(StageAttachment, a2).completed_at
    ev = db.query(AuditEvent).filter_by(action="stage.completed").order_by(AuditEvent.id.desc()).first()
    assert ev.detail["files"] == ["front.jpg", "grid.dwg"]


def test_a_note_is_still_required(client, auth_headers, site_stage):
    eng = auth_headers("civil_engineer")
    _up(client, eng, site_stage, "predesign_site_visit", "front.jpg", JPEG, "image/jpeg")
    r = client.post(f"/projects/{site_stage}/stages/predesign_site_visit/complete", json={"note": " "}, headers=eng)
    assert r.status_code == 422 and r.json()["detail"]["missing"] == ["note"]


def test_a_stage_can_require_a_file_of_a_kind(client, auth_headers, new_project, monkeypatch):
    from app import stage_config as sc

    # The rule is part of the flow a project is pinned to, so set it before the project exists.
    monkeypatch.setitem(sc.BY_KEY["predesign_site_visit"], "evidence_required", ["photo"])
    site_stage = new_project(start_stage="predesign_site_visit", historical_confirmed_by="Parvez")["id"]
    eng = auth_headers("civil_engineer")
    s = _view_stage(client, eng, site_stage, "predesign_site_visit")
    assert s["evidence_required"] == ["photo"] and s["evidence_missing"] == ["photo"]
    assert s["evidence_reason"] == "Add at least one photo before completing this stage"
    _up(client, eng, site_stage, "predesign_site_visit", "grid.dwg", DWG)  # a drawing is not a photo
    r = client.post(
        f"/projects/{site_stage}/stages/predesign_site_visit/complete", json={"note": "Visited"}, headers=eng
    )
    assert r.status_code == 422
    assert r.json()["detail"]["missing"] == ["attachments"]
    assert r.json()["detail"]["message"] == "Add at least one photo before completing this stage"
    _up(client, eng, site_stage, "predesign_site_visit", "front.jpg", JPEG, "image/jpeg")
    assert _view_stage(client, eng, site_stage, "predesign_site_visit")["evidence_missing"] == []
    ok = client.post(
        f"/projects/{site_stage}/stages/predesign_site_visit/complete", json={"note": "Visited"}, headers=eng
    )
    assert ok.status_code == 200


def test_no_stage_requires_files_by_default():
    from app import stage_config as sc

    assert all(s["evidence_required"] == [] for s in sc.STAGES)


def test_completed_files_and_note_are_immutable(client, auth_headers, site_stage, db):
    from app.models import ProjectStage, StageImmutableError

    eng = auth_headers("civil_engineer")
    aid = _up(client, eng, site_stage, "predesign_site_visit", "front.jpg", JPEG, "image/jpeg").json()["id"]
    client.post(f"/projects/{site_stage}/stages/predesign_site_visit/complete", json={"note": "Visited"}, headers=eng)
    a = db.get(StageAttachment, aid)
    a.filename = "renamed.jpg"
    with pytest.raises(StageImmutableError):
        db.flush()
    db.rollback()
    with pytest.raises(StageImmutableError):
        db.delete(db.get(StageAttachment, aid))
        db.flush()
    db.rollback()
    row = db.query(ProjectStage).filter_by(project_id=site_stage, key="predesign_site_visit").one()
    row.completion_note = "rewritten later"
    with pytest.raises(StageImmutableError):
        db.flush()
    db.rollback()


def test_client_signoff_stages_still_complete_only_by_approval(client, auth_headers, new_project):
    pid = new_project(start_stage="requirements_signoff", historical_confirmed_by="Parvez")["id"]
    r = client.post(
        f"/projects/{pid}/stages/requirements_signoff/complete", json={"note": "x"}, headers=auth_headers("architect")
    )
    assert r.status_code == 409
