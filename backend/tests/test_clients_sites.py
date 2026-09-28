"""Clients (with contacts) and Sites as their own records, linked to projects (PRD 7.2 and section 16)."""

import pytest

from app.models import Client, ClientContact, Site

NEW_CLIENT = {
    "name": "Gokhale family",
    "type": "individual",
    "notes": "Prefers calls after 6 pm",
    "contacts": [
        {"name": "Anil Gokhale", "email": "anil@example.com", "phone": "+91 98220 11111", "is_signatory": True},
        {"name": "Sunita Gokhale", "phone": "+91 98220 22222"},
    ],
}
NEW_SITE = {"address": "Plot 14, Baner Road", "city": "Pune", "lat": 18.559, "lng": 73.786}


def test_project_with_a_new_client_and_site(client, auth_headers, new_project, db):
    p = new_project(client=NEW_CLIENT, site=NEW_SITE)
    assert p["client"]["name"] == "Gokhale family" and p["client"]["type"] == "individual"
    assert [c["name"] for c in p["client"]["contacts"]] == ["Anil Gokhale", "Sunita Gokhale"]
    assert p["client"]["contacts"][0]["is_signatory"] is True
    assert p["site"] == {
        "id": p["site"]["id"],
        "address": "Plot 14, Baner Road",
        "city": "Pune",
        "lat": 18.559,
        "lng": 73.786,
    }
    assert db.query(Client).count() == 1 and db.query(ClientContact).count() == 2 and db.query(Site).count() == 1
    again = client.get(f"/projects/{p['id']}", headers=auth_headers("architect")).json()
    assert again["client"]["id"] == p["client"]["id"] and again["site"]["city"] == "Pune"


def test_project_linked_to_existing_client_and_site(client, auth_headers, new_project):
    first = new_project(client=NEW_CLIENT, site=NEW_SITE)
    second = new_project("Gokhale farmhouse", client={"id": first["client"]["id"]}, site={"id": first["site"]["id"]})
    assert second["client"]["id"] == first["client"]["id"] and second["site"]["id"] == first["site"]["id"]


def test_client_and_site_are_optional(new_project):
    p = new_project()
    assert p["client"] is None and p["site"] is None


@pytest.mark.parametrize(
    "extra",
    [
        {"client": {"id": 9999}},
        {"site": {"id": 9999}},
        {"client": {"name": "  "}},
        {"client": {"name": "X", "contacts": [{"name": "Y", "email": "not-an-email"}]}},
        {"site": {"address": "Somewhere", "lat": 95, "lng": 73.8}},
        {"site": {"address": " "}},
    ],
)
def test_invalid_client_or_site_is_422(client, auth_headers, users, extra):
    body = {"name": "Villa X", "location": "Pune", "civil_engineer_id": users["civil_engineer"].id, **extra}
    assert client.post("/projects", json=body, headers=auth_headers("architect")).status_code == 422


def test_staff_list_and_create_clients(client, auth_headers):
    r = client.post("/clients", json=NEW_CLIENT, headers=auth_headers("architect"))
    assert r.status_code == 201, r.text
    listed = client.get("/clients", headers=auth_headers("team_lead")).json()
    assert [c["name"] for c in listed] == ["Gokhale family"]
    assert listed[0]["contacts"][0]["phone"] == "+91 98220 11111"


@pytest.mark.parametrize("role,expected", [("admin", 201), ("civil_engineer", 403), ("accounts", 403)])
def test_who_creates_clients(client, auth_headers, role, expected):
    assert client.post("/clients", json={"name": "Patil"}, headers=auth_headers(role)).status_code == expected


def test_client_app_never_shows_contacts_or_phone_numbers(client, auth_headers, new_project):
    p = new_project(client=NEW_CLIENT, site=NEW_SITE)
    inv = client.post(
        f"/projects/{p['id']}/client-invite",
        json={"name": "Anil Gokhale", "email": "anil.app@example.com"},
        headers=auth_headers("architect"),
    ).json()
    tok = client.post(
        "/auth/activate", json={"email": "anil.app@example.com", "code": inv["code"], "password": "a-long-password"}
    ).json()
    body = client.get(f"/client/projects/{p['id']}", headers={"Authorization": f"Bearer {tok['access_token']}"}).text
    assert "98220" not in body and "Prefers calls" not in body
