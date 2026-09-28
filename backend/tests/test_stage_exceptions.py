"""Placeholder gates block the stages whose checks SiteFlow doesn't have yet; a recorded, audited exception with a
reason (Admin or Team Lead) clears exactly that gate on that stage."""

import pytest

from app import stage_config as sc
from app.models import AuditEvent, StageException, StageImmutableError
from app.modules.workflow.gates import PLACEHOLDER_GATES

ONBOARD = {"historical_confirmed_by": "Parvez"}


def _stage(client, headers, pid, key):
    view = client.get(f"/projects/{pid}/stages", headers=headers).json()
    return next(s for p in view["phases"] for s in p["stages"] if s["key"] == key)


def _exception(client, headers, pid, key, gate, reason="Receipt checked by Accounts on 28 Sept."):
    return client.post(
        f"/projects/{pid}/stages/{key}/exceptions", json={"gate": gate, "reason": reason}, headers=headers
    )


def test_placeholder_gates_sit_on_the_right_stages():
    gates = {s["key"]: s["gates"] for s in sc.STAGES}
    assert gates["payment_gate"] == ["payment"]
    assert gates["grid_freeze"] == ["finding_disposition"]
    assert gates["mep"] == ["issue_closure"]
    assert gates["detailed_drawings"] == ["document_status"]
    assert gates["civil_completion"] == ["no_open_major_problems", "checklist"]
    assert set(PLACEHOLDER_GATES) == {"payment", "finding_disposition", "issue_closure", "document_status", "checklist"}


def test_a_placeholder_gate_blocks_with_a_plain_reason(client, auth_headers, new_project):
    arch = auth_headers("architect")
    pid = new_project(start_stage="payment_gate", **ONBOARD)["id"]
    s = _stage(client, arch, pid, "payment_gate")
    assert s["state"] == "blocked"
    assert s["reasons"] == [
        "The payment check is not built in SiteFlow yet. An Admin or Team Lead can record an exception with a reason."
    ]
    assert s["open_exceptions"] == ["payment"]
    r = client.post(f"/projects/{pid}/stages/payment_gate/complete", json={"note": "Paid"}, headers=arch)
    assert r.status_code == 409


@pytest.mark.parametrize("role", ["admin", "team_lead"])
def test_admin_or_team_lead_records_an_exception_and_the_stage_can_complete(
    client, auth_headers, new_project, role, users, db
):
    pid = new_project(start_stage="payment_gate", **ONBOARD)["id"]
    r = _exception(client, auth_headers(role), pid, "payment_gate", "payment")
    assert r.status_code == 201, r.text
    s = _stage(client, auth_headers("architect"), pid, "payment_gate")
    assert s["state"] == "active" and s["open_exceptions"] == []
    (ex,) = s["exceptions"]
    assert ex["gate"] == "payment" and ex["reason"] == "Receipt checked by Accounts on 28 Sept."
    assert ex["by"]["name"] == users[role].name and ex["at"]
    ev = db.query(AuditEvent).filter_by(action="stage.exception_recorded").one()
    assert ev.detail == {
        "stage": "50% upfront gate",
        "key": "payment_gate",
        "gate": "payment",
        "reason": "Receipt checked by Accounts on 28 Sept.",
    }
    done = client.post(
        f"/projects/{pid}/stages/payment_gate/complete",
        json={"note": "50% received"},
        headers=auth_headers("architect"),
    )
    assert done.status_code == 200


def test_an_exception_clears_only_its_own_gate(client, auth_headers, new_project):
    lead = auth_headers("team_lead")
    pid = new_project(start_stage="civil_completion", **ONBOARD)["id"]
    assert _exception(client, lead, pid, "civil_completion", "checklist").status_code == 201
    s = _stage(client, lead, pid, "civil_completion")
    assert s["state"] == "active"  # no open major problems, and the checklist gate has its exception
    # The real gate on the same stage can't be excepted.
    assert _exception(client, lead, pid, "civil_completion", "no_open_major_problems").status_code == 422


@pytest.mark.parametrize(
    "body,expected",
    [
        ({"gate": "payment", "reason": "  "}, 422),  # a reason is required
        ({"gate": "checklist", "reason": "x"}, 422),  # not a gate of this stage
        ({"gate": "teleport", "reason": "x"}, 422),
    ],
)
def test_exception_rules(client, auth_headers, new_project, body, expected):
    pid = new_project(start_stage="payment_gate", **ONBOARD)["id"]
    r = client.post(f"/projects/{pid}/stages/payment_gate/exceptions", json=body, headers=auth_headers("admin"))
    assert r.status_code == expected


def test_one_exception_per_gate_and_none_on_finished_stages(client, auth_headers, new_project):
    admin = auth_headers("admin")
    pid = new_project(start_stage="payment_gate", **ONBOARD)["id"]
    assert _exception(client, admin, pid, "payment_gate", "payment").status_code == 201
    assert _exception(client, admin, pid, "payment_gate", "payment").status_code == 409
    # grid_freeze is historical on this project: nothing to except.
    assert _exception(client, admin, pid, "grid_freeze", "finding_disposition").status_code == 409


@pytest.mark.parametrize("role", ["architect", "civil_engineer", "accounts"])
def test_other_roles_cannot_record_exceptions(client, auth_headers, new_project, role, users, db):
    pid = new_project(start_stage="payment_gate", **ONBOARD)["id"]
    from app.models import ProjectMember

    db.add(ProjectMember(project_id=pid, user_id=users["accounts"].id))
    db.commit()
    assert _exception(client, auth_headers(role), pid, "payment_gate", "payment").status_code == 403


def test_exceptions_are_immutable(client, auth_headers, new_project, db):
    pid = new_project(start_stage="payment_gate", **ONBOARD)["id"]
    _exception(client, auth_headers("admin"), pid, "payment_gate", "payment")
    ex = db.query(StageException).one()
    ex.reason = "changed later"
    with pytest.raises(StageImmutableError):
        db.flush()
    db.rollback()
    with pytest.raises(StageImmutableError):
        db.delete(db.query(StageException).one())
        db.flush()
    db.rollback()


def test_clients_never_see_exceptions(client, auth_headers, new_project):
    pid = new_project(start_stage="payment_gate", **ONBOARD)["id"]
    _exception(client, auth_headers("admin"), pid, "payment_gate", "payment")
    inv = client.post(
        f"/projects/{pid}/client-invite",
        json={"name": "Asha", "email": "asha@example.com"},
        headers=auth_headers("architect"),
    ).json()
    tok = client.post(
        "/auth/activate", json={"email": "asha@example.com", "code": inv["code"], "password": "a-long-password"}
    ).json()
    body = client.get(f"/client/projects/{pid}", headers={"Authorization": f"Bearer {tok['access_token']}"}).text
    assert "exception" not in body.lower() and "Receipt checked" not in body
