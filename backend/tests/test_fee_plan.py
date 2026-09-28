"""The project fee plan: contract value, currency, fee basis and notes. Set by the Architect, Admin or Accounts,
audited with old and new values. No percentages are seeded here (D-05)."""

import pytest

from app.models import AuditEvent, ProjectMember

PLAN = {"contract_value": "2500000.50", "currency": "inr", "fee_basis": "Total fee", "fee_notes": "GST extra"}


def _put(client, headers, pid, body):
    return client.patch(f"/projects/{pid}/fee-plan", json=body, headers=headers)


@pytest.mark.parametrize("role", ["architect", "admin", "accounts"])
def test_allowed_roles_set_the_fee_plan(client, auth_headers, new_project, users, db, role):
    pid = new_project()["id"]
    db.add(ProjectMember(project_id=pid, user_id=users["accounts"].id))
    db.commit()
    r = _put(client, auth_headers(role), pid, PLAN)
    assert r.status_code == 200, r.text
    assert r.json() == {
        "contract_value": "2500000.50",
        "currency": "INR",
        "fee_basis": "Total fee",
        "fee_notes": "GST extra",
    }
    assert client.get(f"/projects/{pid}/fee-plan", headers=auth_headers(role)).json()["currency"] == "INR"


def test_changes_are_audited_with_old_and_new_values(client, auth_headers, new_project, db):
    pid = new_project()["id"]
    arch = auth_headers("architect")
    _put(client, arch, pid, PLAN)
    _put(client, arch, pid, {"contract_value": "2600000"})
    events = db.query(AuditEvent).filter_by(action="fee_plan.updated").order_by(AuditEvent.id).all()
    assert events[0].detail["changes"]["contract_value"] == [None, "2500000.50"]
    assert events[1].detail["changes"] == {"contract_value": ["2500000.50", "2600000.00"]}


def test_a_new_project_has_an_empty_plan_in_rupees(client, auth_headers, new_project):
    pid = new_project()["id"]
    r = client.get(f"/projects/{pid}/fee-plan", headers=auth_headers("architect"))
    assert r.json() == {"contract_value": None, "currency": "INR", "fee_basis": None, "fee_notes": None}


@pytest.mark.parametrize(
    "body",
    [
        {"contract_value": "-1"},
        {"contract_value": "abc"},
        {"currency": "RUPEE"},
        {"currency": "1NR"},
        {"contract_value": "12345678901234"},
    ],
)
def test_invalid_values_are_422(client, auth_headers, new_project, body):
    assert _put(client, auth_headers("architect"), new_project()["id"], body).status_code == 422


@pytest.mark.parametrize("role", ["civil_engineer", "team_lead"])
def test_other_roles_cannot_change_it(client, auth_headers, new_project, role):
    assert _put(client, auth_headers(role), new_project()["id"], PLAN).status_code == 403


def test_the_basis_field_carries_the_open_decision_note(client, auth_headers):
    r = client.get("/template", headers=auth_headers("architect")).json()
    assert "D-05" in r["fee_basis_help"]
