"""Field-level rules: the fee plan appears only for the roles allowed by FIELD_RULES, in every response."""

import pytest

from app.models import ProjectMember, Role
from app.modules.identity.fields import FIELD_RULES, visible_fields

STAFF = [r.value for r in Role if r != Role.client]
ALLOWED = set(FIELD_RULES["fee_plan"])


def test_default_matrix():
    assert ALLOWED == {"admin", "accounts", "team_lead", "architect"}


def test_visible_fields_removes_denied_keys():
    class U:
        role = Role.civil_engineer

    assert visible_fields(U(), {"name": "Villa", "fee_plan": {"currency": "INR"}}) == {"name": "Villa"}
    U.role = Role.accounts
    assert "fee_plan" in visible_fields(U(), {"name": "Villa", "fee_plan": {}})


@pytest.fixture
def priced_project(client, auth_headers, new_project, users, db):
    pid = new_project()["id"]
    for role in STAFF:  # every staff role can see the project; only some may see its fee plan
        if not db.query(ProjectMember).filter_by(project_id=pid, user_id=users[role].id).count():
            db.add(ProjectMember(project_id=pid, user_id=users[role].id))
    db.commit()
    r = client.patch(f"/projects/{pid}/fee-plan", json={"contract_value": "1250000"}, headers=auth_headers("architect"))
    assert r.status_code == 200
    return pid


@pytest.mark.parametrize("role", STAFF)
def test_fee_plan_appears_only_for_allowed_roles(client, auth_headers, priced_project, role):
    h = auth_headers(role)
    allowed = role in ALLOWED
    detail = client.get(f"/projects/{priced_project}", headers=h).json()
    assert ("fee_plan" in detail) is allowed, role
    listed = next(p for p in client.get("/projects", headers=h).json() if p["id"] == priced_project)
    assert ("fee_plan" in listed) is allowed, role
    if allowed:
        assert detail["fee_plan"]["contract_value"] == "1250000.00"
    fee = client.get(f"/projects/{priced_project}/fee-plan", headers=h)
    assert fee.status_code == (200 if allowed else 403), role


@pytest.mark.parametrize("role", ["architect", "team_lead"])
def test_dashboard_rows_carry_the_fee_plan_for_allowed_roles(client, auth_headers, priced_project, role):
    rows = client.get("/dashboard", headers=auth_headers(role)).json()["all_projects"]
    row = next(r for r in rows if r["id"] == priced_project)
    assert row["fee_plan"]["contract_value"] == "1250000.00"


def test_denied_roles_never_see_fee_keys_anywhere(client, auth_headers, priced_project):
    h = auth_headers("civil_engineer")
    detail = client.get(f"/projects/{priced_project}", headers=h)
    listed = client.get("/projects", headers=h)
    for r in (detail, listed):
        assert "contract_value" not in r.text and "1250000" not in r.text
    assert "fee_plan" not in detail.json() and all("fee_plan" not in p for p in listed.json())
    # The audit trail still shows that the fee plan changed, without the values.
    entry = next(e for e in detail.json()["audit"] if e["action"] == "fee_plan.updated")
    assert entry["detail"] == {}


def test_team_lead_reads_but_cannot_change_the_fee_plan(client, auth_headers, priced_project):
    r = client.patch(
        f"/projects/{priced_project}/fee-plan", json={"contract_value": "1"}, headers=auth_headers("team_lead")
    )
    assert r.status_code == 403


def test_the_client_app_never_carries_fee_keys(client, auth_headers, priced_project):
    inv = client.post(
        f"/projects/{priced_project}/client-invite",
        json={"name": "Asha", "email": "asha@example.com"},
        headers=auth_headers("architect"),
    ).json()
    tok = client.post(
        "/auth/activate", json={"email": "asha@example.com", "code": inv["code"], "password": "a-long-password"}
    ).json()
    h = {"Authorization": f"Bearer {tok['access_token']}"}
    for path in ("/client/projects", f"/client/projects/{priced_project}"):
        body = client.get(path, headers=h).text
        assert "fee_plan" not in body and "1250000" not in body
