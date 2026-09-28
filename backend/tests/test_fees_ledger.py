"""Interim fee ledger: client fees due and received, recorded by Accounts or the principal architect, append-only,
readable only by them. Replaced by the V12 fee module."""

import pytest

from app.models import AuditEvent, FeeEntry, ProjectMember, StageImmutableError


@pytest.fixture
def pid(new_project, users, db):
    p = new_project()["id"]
    db.add(ProjectMember(project_id=p, user_id=users["accounts"].id))
    db.commit()
    return p


def _post(client, headers, pid, **body):
    base = {"kind": "due", "amount": "1250000", "date": "2026-09-28"}
    return client.post(f"/projects/{pid}/fees", json={**base, **body}, headers=headers)


def test_accounts_records_due_and_received_and_totals_add_up(client, auth_headers, pid, db):
    acc = auth_headers("accounts")
    assert _post(client, acc, pid, note="50% upfront, invoice 12").status_code == 201
    r = _post(client, acc, pid, kind="received", amount="500000", reference="NEFT 4471")
    assert r.status_code == 201
    assert r.json()["recorded_by"]["name"] == "Vikram Mehta"
    body = client.get(f"/projects/{pid}/fees", headers=acc).json()
    assert body["totals"] == {
        "due": "1250000.00",
        "received": "500000.00",
        "outstanding": "750000.00",
        "currency": "INR",
    }
    assert [e["kind"] for e in body["entries"]] == ["due", "received"]
    assert db.query(AuditEvent).filter_by(action="fee.recorded").count() == 2


def test_the_principal_records_and_reads(client, auth_headers, pid):
    lead = auth_headers("team_lead")  # Parvez, the principal architect
    assert _post(client, lead, pid).status_code == 201
    assert client.get(f"/projects/{pid}/fees", headers=lead).status_code == 200


def test_a_correction_is_a_negative_entry_with_a_reason(client, auth_headers, pid):
    acc = auth_headers("accounts")
    _post(client, acc, pid, kind="received", amount="500000", reference="NEFT 4471")
    assert _post(client, acc, pid, kind="received", amount="-500000", reference="NEFT 4471").status_code == 422
    r = _post(client, acc, pid, kind="received", amount="-500000", reference="NEFT 4471", note="Bounced; reversed")
    assert r.status_code == 201
    totals = client.get(f"/projects/{pid}/fees", headers=acc).json()["totals"]
    assert totals["received"] == "0.00"


@pytest.mark.parametrize(
    "body",
    [
        {"amount": "0"},
        {"amount": "abc"},
        {"kind": "refund"},
        {"kind": "received"},  # a received entry needs a reference
        {"date": "28-09-2026"},
    ],
)
def test_invalid_entries_are_422(client, auth_headers, pid, body):
    assert _post(client, auth_headers("accounts"), pid, **body).status_code == 422


def test_entries_are_never_edited(client, auth_headers, pid, db):
    _post(client, auth_headers("accounts"), pid)
    e = db.query(FeeEntry).one()
    e.amount = 1
    with pytest.raises(StageImmutableError):
        db.flush()
    db.rollback()
    with pytest.raises(StageImmutableError):
        db.delete(db.query(FeeEntry).one())
        db.flush()
    db.rollback()


@pytest.mark.parametrize("role", ["architect", "admin", "civil_engineer"])
def test_everyone_else_is_refused(client, auth_headers, pid, role):
    h = auth_headers(role)
    assert client.get(f"/projects/{pid}/fees", headers=h).status_code == 403
    assert _post(client, h, pid).status_code == 403


def test_fee_totals_never_appear_in_other_responses(client, auth_headers, pid):
    _post(client, auth_headers("accounts"), pid, amount="987654")
    for role in ("architect", "civil_engineer", "accounts", "team_lead"):
        h = auth_headers(role)
        for path in (f"/projects/{pid}", "/projects", "/dashboard"):
            r = client.get(path, headers=h)
            if r.status_code == 200:
                assert "987654" not in r.text and "outstanding" not in r.text, (role, path)
