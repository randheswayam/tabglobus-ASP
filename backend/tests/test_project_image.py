"""A project image (a render or screenshot of the 3D model) with a square thumbnail, shown beside the project name."""

import io

import pytest
from PIL import Image

from app import workflow_config as wc
from app.models import AuditEvent, Project


def _png(w=640, h=360, color=(40, 110, 120)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, "PNG")
    return buf.getvalue()


def _put(client, headers, pid, data, name="render.png", ctype="image/png"):
    return client.put(f"/projects/{pid}/image", files={"file": (name, data, ctype)}, headers=headers)


def test_upload_makes_a_square_thumbnail_and_rows_carry_it(client, auth_headers, new_project, db):
    pid = new_project()["id"]
    arch = auth_headers("architect")
    r = _put(client, arch, pid, _png())
    assert r.status_code == 200, r.text
    assert r.json()["thumb_url"] == f"/projects/{pid}/image?size=thumb" and r.json()["updated_at"]
    p = db.get(Project, pid)
    assert len(p.image_sha256) == 64 and p.image_key and p.image_thumb_key
    thumb = client.get(f"/projects/{pid}/image?size=thumb", headers=arch)
    assert thumb.status_code == 200 and thumb.headers["content-type"] == "image/jpeg"
    assert Image.open(io.BytesIO(thumb.content)).size == (96, 96)
    full = client.get(f"/projects/{pid}/image", headers=arch)
    assert full.headers["content-type"] == "image/png" and Image.open(io.BytesIO(full.content)).size == (640, 360)
    assert full.headers["x-content-type-options"] == "nosniff"
    row = next(x for x in client.get("/projects", headers=arch).json() if x["id"] == pid)
    assert row["image"]["thumb_url"] == f"/projects/{pid}/image?size=thumb"
    dash = next(x for x in client.get("/dashboard", headers=arch).json()["all_projects"] if x["id"] == pid)
    assert dash["image"]["thumb_url"].endswith("size=thumb")
    assert db.query(AuditEvent).filter_by(action="project.image_set").count() == 1


def test_a_project_without_an_image(client, auth_headers, new_project):
    pid = new_project()["id"]
    arch = auth_headers("architect")
    row = next(x for x in client.get("/projects", headers=arch).json() if x["id"] == pid)
    assert row["image"] is None
    assert client.get(f"/projects/{pid}/image", headers=arch).status_code == 404


def test_replace_and_remove(client, auth_headers, new_project, db):
    pid = new_project()["id"]
    admin = auth_headers("admin")
    _put(client, admin, pid, _png(color=(200, 0, 0)))
    first = db.get(Project, pid).image_sha256
    _put(client, admin, pid, _png(color=(0, 200, 0)))
    db.expire_all()
    assert db.get(Project, pid).image_sha256 != first
    assert client.delete(f"/projects/{pid}/image", headers=admin).status_code == 204
    db.expire_all()
    assert db.get(Project, pid).image_key is None
    assert client.get(f"/projects/{pid}/image", headers=admin).status_code == 404
    assert db.query(AuditEvent).filter_by(action="project.image_removed").count() == 1


@pytest.mark.parametrize(
    "data,name,ctype,expected",
    [
        (b"%PDF-1.4 not an image", "render.png", "image/png", 415),
        (b"GIF89a....", "render.gif", "image/gif", 415),
        (b"\x89PNG\r\n\x1a\n" + b"\x00" * 40, "broken.png", "image/png", 415),  # right header, not a real image
    ],
)
def test_type_and_signature_checks(client, auth_headers, new_project, data, name, ctype, expected):
    assert _put(client, auth_headers("architect"), new_project()["id"], data, name, ctype).status_code == expected


def test_too_large_is_413(client, auth_headers, new_project, monkeypatch):
    monkeypatch.setattr(wc, "MAX_PROJECT_IMAGE_MB", 0)
    assert _put(client, auth_headers("architect"), new_project()["id"], _png()).status_code == 413


@pytest.mark.parametrize("role", ["civil_engineer", "team_lead", "accounts"])
def test_only_the_architect_or_admin_sets_it(client, auth_headers, new_project, role):
    pid = new_project()["id"]
    assert _put(client, auth_headers(role), pid, _png()).status_code == 403


def test_only_people_who_can_see_the_project_see_the_image(client, auth_headers, new_project):
    pid = new_project()["id"]
    _put(client, auth_headers("architect"), pid, _png())
    assert client.get(f"/projects/{pid}/image", headers=auth_headers("civil_engineer")).status_code == 200
    assert client.get(f"/projects/{pid}/image", headers=auth_headers("accounts")).status_code == 404


def test_the_browser_may_send_put_for_the_image(client):
    r = client.options(
        "/projects/1/image",
        headers={"Origin": "http://localhost:8080", "Access-Control-Request-Method": "PUT"},
    )
    assert r.status_code == 200 and "PUT" in r.headers["access-control-allow-methods"]
