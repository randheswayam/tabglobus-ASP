"""Bulk import of in-progress projects (PRD 7.19, FR-27): a preview validates every row and writes nothing."""

import pytest

from app.models import Project

HEADER = (
    "project_name,location,client_name,client_email,site_address,current_stage,"
    "civil_engineer_email,confirmed_by,legal_expected_date"
)


def _csv(*rows: str) -> bytes:
    return ("\n".join([HEADER, *rows]) + "\n").encode()


def _preview(client, headers, data: bytes, name="projects.csv", content_type="text/csv"):
    return client.post("/admin/import/projects/preview", files={"file": (name, data, content_type)}, headers=headers)


GOOD = (
    "Sathe House,Pashan Pune,Sathe family,sathe@example.com,Survey 12 Pashan,grid,"
    "engineer@siteflow.local,Parvez,2026-12-01"
)
NEW = "Mane Villa,Wakad Pune,,,,,engineer@siteflow.local,,"


def test_template_lists_the_columns(client, auth_headers):
    r = client.get("/admin/import/projects/template", headers=auth_headers("admin"))
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    assert r.text.splitlines()[0] == HEADER


def test_preview_reports_good_rows_and_writes_nothing(client, auth_headers, db):
    r = _preview(client, auth_headers("admin"), _csv(GOOD, NEW))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["counts"] == {"rows": 2, "ok": 2, "errors": 0}
    first = body["rows"][0]
    assert first["row"] == 2 and first["ok"] is True and first["errors"] == []
    assert first["values"]["project_name"] == "Sathe House" and first["values"]["current_stage"] == "grid"
    assert body["rows"][1]["values"]["current_stage"] == ""  # blank: a new project from Project setup
    assert db.query(Project).count() == 0


@pytest.mark.parametrize(
    "row,error",
    [
        ("Villa,Pune,,,,roofing,engineer@siteflow.local,Parvez,", "current_stage 'roofing' is not a stage"),
        ("Villa,Pune,,,,grid,nobody@example.com,Parvez,", "civil_engineer_email is not an active Civil Engineer"),
        ("Villa,Pune,,,,grid,architect@siteflow.local,Parvez,", "civil_engineer_email is not an active Civil Engineer"),
        (",Pune,,,,,engineer@siteflow.local,,", "project_name is required"),
        ("Villa,,,,,,engineer@siteflow.local,,", "location is required"),
        ("Villa,Pune,,,,grid,engineer@siteflow.local,,", "confirmed_by is required when current_stage is set"),
        ("Villa,Pune,,,,setup,engineer@siteflow.local,Parvez,", "current_stage 'setup' is the first stage"),
        ("Villa,Pune,,bad-email,,,engineer@siteflow.local,,", "client_email is not an email address"),
        ("Villa,Pune,,,,,engineer@siteflow.local,,31-12-2026", "legal_expected_date must be YYYY-MM-DD"),
        ("=HYPERLINK(1),Pune,,,,,engineer@siteflow.local,,", "project_name starts with = + - or @"),
        ("Villa,@Pune,,,,,engineer@siteflow.local,,", "location starts with = + - or @"),
    ],
)
def test_row_errors(client, auth_headers, row, error):
    body = _preview(client, auth_headers("admin"), _csv(row)).json()
    assert body["counts"]["errors"] == 1
    assert any(error in e for e in body["rows"][0]["errors"]), body["rows"][0]["errors"]


def test_duplicate_names_in_the_file_and_in_siteflow(client, auth_headers, new_project):
    new_project("Existing Villa")
    body = _preview(
        client,
        auth_headers("admin"),
        _csv(NEW, NEW.replace("Mane Villa", "mane villa"), NEW.replace("Mane Villa", "Existing Villa")),
    ).json()
    assert body["rows"][0]["ok"] is True
    assert "project_name repeats row 2" in body["rows"][1]["errors"]
    assert "a project named 'Existing Villa' already exists" in body["rows"][2]["errors"]


def test_file_level_checks(client, auth_headers):
    admin = auth_headers("admin")
    assert _preview(client, admin, b"name,place\nVilla,Pune\n").status_code == 422  # wrong header
    assert _preview(client, admin, _csv(*[NEW.replace("Mane", f"M{i}") for i in range(501)])).status_code == 422
    assert _preview(client, admin, b"x" * (1024 * 1024 + 1)).status_code == 413
    assert _preview(client, admin, b"\x89PNG\r\n\x1a\n", name="p.png", content_type="image/png").status_code == 415
    assert _preview(client, admin, b"\xff\xfe\x00bad").status_code == 422  # not UTF-8 text
    assert _preview(client, admin, HEADER.encode() + b"\n").json()["counts"]["rows"] == 0


def test_a_utf8_bom_from_excel_is_accepted(client, auth_headers):
    r = _preview(client, auth_headers("admin"), b"\xef\xbb\xbf" + _csv(NEW))
    assert r.status_code == 200 and r.json()["counts"]["ok"] == 1


@pytest.mark.parametrize("role", ["architect", "team_lead", "accounts"])
def test_only_admins_import(client, auth_headers, role):
    assert _preview(client, auth_headers(role), _csv(NEW)).status_code == 403
    assert client.get("/admin/import/projects/template", headers=auth_headers(role)).status_code == 403
