"""Site visit media: the server-side draft visit, uploads, downloads and removal."""
import pytest

from tests.conftest import valid_visit


@pytest.fixture
def draft(client, auth_headers, ready_project):
    r = client.post(f"/projects/{ready_project['id']}/site-visits/draft", headers=auth_headers("civil_engineer"))
    assert r.status_code == 200, r.text
    return r.json()


# ---------- Task 5: draft visit ----------

def test_draft_is_created_once_and_reused(client, auth_headers, ready_project, draft):
    assert draft["status"] == "draft" and draft["submission_count"] == 0 and draft["media"] == []
    again = client.post(f"/projects/{ready_project['id']}/site-visits/draft", headers=auth_headers("civil_engineer")).json()
    assert again["id"] == draft["id"]


def test_draft_is_hidden_from_project_latest_visit_queue_and_history(client, auth_headers, ready_project, draft):
    p = client.get(f"/projects/{ready_project['id']}", headers=auth_headers("architect")).json()
    assert p["latest_visit"] is None
    assert client.get("/projects", headers=auth_headers("architect")).json()[0]["latest_visit_status"] is None
    assert client.get("/reviews/queue", headers=auth_headers("team_lead")).json() == []
    assert client.get(f"/projects/{ready_project['id']}/visits", headers=auth_headers("architect")).json() == []


def test_submission_fills_in_the_draft(client, auth_headers, ready_project, draft, evidence):
    evidence(ready_project["id"])
    r = client.post(f"/projects/{ready_project['id']}/site-visits", json=valid_visit(), headers=auth_headers("civil_engineer"))
    assert r.status_code == 201, r.text
    assert r.json()["id"] == draft["id"] and r.json()["status"] == "submitted" and r.json()["submission_count"] == 1


def test_draft_returns_the_rework_visit(client, auth_headers, ready_project, evidence):
    eng = auth_headers("civil_engineer")
    evidence(ready_project["id"])
    v = client.post(f"/projects/{ready_project['id']}/site-visits", json=valid_visit(), headers=eng).json()
    client.post(f"/site-visits/{v['id']}/review", json={"decision": "rework", "comment": "Add photos"},
                headers=auth_headers("team_lead"))
    d = client.post(f"/projects/{ready_project['id']}/site-visits/draft", headers=eng).json()
    assert d["id"] == v["id"] and d["status"] == "rework"


def test_draft_needs_step2_open_and_the_assigned_engineer(client, auth_headers, new_project, ready_project):
    p = new_project("Not yet approved")
    assert client.post(f"/projects/{p['id']}/site-visits/draft", headers=auth_headers("civil_engineer")).status_code == 409
    assert client.post(f"/projects/{ready_project['id']}/site-visits/draft", headers=auth_headers("team_lead")).status_code == 403


# ---------- Task 6: upload ----------

from tests.conftest import JPEG, MP4, PNG  # noqa: E402


def test_upload_photo_with_capture_metadata(upload, draft, users):
    r = upload(draft["id"], captured_at="2026-09-27T10:31:00+05:30", lat="18.559", lng="73.7868", problem_ref="0")
    assert r.status_code == 201, r.text
    m = r.json()
    assert m["kind"] == "photo" and m["content_type"] == "image/png" and m["size"] == len(PNG)
    assert m["captured_at"] == "2026-09-27T05:01:00+00:00"
    assert (m["lat"], m["lng"], m["problem_ref"]) == (18.559, 73.7868, 0)
    assert m["uploader"]["id"] == users["civil_engineer"].id


def test_upload_video_and_server_time_default(upload, draft):
    r = upload(draft["id"], kind="video", data=MP4, content_type="video/mp4")
    assert r.status_code == 201, r.text
    assert r.json()["kind"] == "video" and r.json()["captured_at"].endswith("+00:00")


def test_stored_under_random_key_not_the_filename(upload, draft, db):
    from app import models as m

    upload(draft["id"], data=JPEG, content_type="image/jpeg")
    row = db.query(m.Media).one()
    assert row.storage_key.startswith(f"visits/{draft['id']}/") and row.storage_key.endswith(".jpg")
    assert "site" not in row.storage_key
    assert len(row.sha256) == 64


@pytest.mark.parametrize("kind,data,ctype", [
    ("photo", PNG, "image/gif"),        # type not allowed
    ("photo", MP4, "video/mp4"),        # video sent as a photo
    ("video", PNG, "image/png"),        # photo sent as a video
    ("photo", b"not an image at all", "image/png"),  # header says PNG, bytes don't
])
def test_wrong_type_is_415(upload, draft, kind, data, ctype):
    assert upload(draft["id"], kind=kind, data=data, content_type=ctype).status_code == 415


def test_too_large_is_413(upload, draft, monkeypatch):
    from app import workflow_config as wc

    monkeypatch.setattr(wc, "MAX_PHOTO_MB", 1)
    big = PNG + b"\x00" * (1024 * 1024)
    assert upload(draft["id"], data=big).status_code == 413


@pytest.mark.parametrize("form", [{"kind": "audio"}, {"problem_ref": "-1"}, {"lat": "95", "lng": "0"}, {"lat": "18.5"}])
def test_invalid_fields_are_422(upload, draft, form):
    kind = form.pop("kind", "photo")
    assert upload(draft["id"], kind=kind, **form).status_code == 422


@pytest.mark.parametrize("role", ["architect", "team_lead", "admin"])
def test_only_the_engineer_uploads(upload, draft, auth_headers, role):
    assert upload(draft["id"], headers=auth_headers(role)).status_code == 403


def test_missing_visit_is_404(upload):
    assert upload(9999).status_code == 404


def test_submitted_visit_is_409(upload, draft, client, auth_headers, ready_project, evidence):
    evidence(ready_project["id"])
    client.post(f"/projects/{ready_project['id']}/site-visits", json=valid_visit(), headers=auth_headers("civil_engineer"))
    assert upload(draft["id"]).status_code == 409


# ---------- Task 7: download, listing, removal ----------

def test_download_returns_the_file_to_anyone_who_can_see_the_project(upload, draft, client, auth_headers):
    mid = upload(draft["id"], data=JPEG, content_type="image/jpeg").json()["id"]
    for role in ("civil_engineer", "team_lead", "architect", "admin"):
        r = client.get(f"/media/{mid}", headers=auth_headers(role))
        assert r.status_code == 200
        assert r.content == JPEG
        assert r.headers["content-type"] == "image/jpeg"
        assert r.headers["x-content-type-options"] == "nosniff"
        assert "private" in r.headers["cache-control"]


def test_download_needs_sign_in_and_visibility(upload, draft, client, db, auth_headers):
    from app import models as m

    mid = upload(draft["id"]).json()["id"]
    assert client.get(f"/media/{mid}").status_code == 401
    admin = db.query(m.User).filter_by(role=m.Role.admin).one()
    db.query(m.ProjectMember).filter_by(user_id=admin.id).delete()
    db.commit()
    assert client.get(f"/media/{mid}", headers=auth_headers("admin")).status_code == 404
    assert client.get("/media/9999", headers=auth_headers("team_lead")).status_code == 404


def test_visit_lists_its_media(upload, draft, client, auth_headers):
    upload(draft["id"], problem_ref="0")
    upload(draft["id"], kind="video", data=MP4, content_type="video/mp4")
    v = client.get(f"/site-visits/{draft['id']}", headers=auth_headers("civil_engineer")).json()
    assert [(x["kind"], x["problem_ref"]) for x in v["media"]] == [("photo", 0), ("video", None)]
    assert set(v["media"][0]) >= {"id", "kind", "problem_ref", "captured_at", "lat", "lng", "uploader", "size"}


def test_uploader_removes_media_while_the_visit_is_open(upload, draft, client, auth_headers, db):
    from app import models as m
    from app.services.storage import get_storage

    mid = upload(draft["id"]).json()["id"]
    key = db.get(m.Media, mid).storage_key
    r = client.delete(f"/media/{mid}", headers=auth_headers("civil_engineer"))
    assert r.status_code == 204
    db.expire_all()
    assert db.get(m.Media, mid) is None
    with pytest.raises(FileNotFoundError):
        get_storage().open(key)


def test_upload_and_removal_are_audited(upload, draft, client, auth_headers, ready_project):
    mid = upload(draft["id"]).json()["id"]
    client.delete(f"/media/{mid}", headers=auth_headers("civil_engineer"))
    actions = [e["action"] for e in client.get(f"/projects/{ready_project['id']}", headers=auth_headers("architect")).json()["audit"]]
    assert actions[-2:] == ["media.added", "media.removed"]


def test_cannot_remove_after_submission_or_as_someone_else(upload, draft, client, auth_headers, ready_project, evidence):
    mid = upload(draft["id"]).json()["id"]
    evidence(ready_project["id"])
    assert client.delete(f"/media/{mid}", headers=auth_headers("team_lead")).status_code == 403
    client.post(f"/projects/{ready_project['id']}/site-visits", json=valid_visit(), headers=auth_headers("civil_engineer"))
    assert client.delete(f"/media/{mid}", headers=auth_headers("civil_engineer")).status_code == 409
