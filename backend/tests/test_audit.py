"""Audit events carry before-and-after values of what changed, and never secrets."""

from datetime import date
from types import SimpleNamespace

from app.models import AuditEvent, LegalStatus
from app.services import audit


def test_diff_lists_only_changed_fields_as_json_values():
    obj = SimpleNamespace(status=LegalStatus.applied, authority_name="PMC", application_date=date(2026, 9, 1))
    changes = audit.diff(
        obj,
        {"status": LegalStatus.approved, "authority_name": "PMC", "application_date": date(2026, 9, 2)},
    )
    assert changes == {"status": ["Applied", "Approved"], "application_date": ["2026-09-01", "2026-09-02"]}


def test_record_stores_changes_and_drops_secret_fields(db, users):
    ev = audit.record(
        db,
        users["admin"],
        "user.updated",
        project_id=None,
        entity_type="user",
        entity_id=users["architect"].id,
        changes={
            "role": ["architect", "team_lead"],
            "password_hash": ["old-hash", "new-hash"],
            "refresh_hash": ["a", "b"],
            "code_hash": ["c", "d"],
        },
    )
    db.commit()
    assert db.get(AuditEvent, ev.id).detail == {"changes": {"role": ["architect", "team_lead"]}}


def test_record_without_changes_keeps_the_old_shape(db, users):
    ev = audit.record(db, users["admin"], "x.done", project_id=None, entity_type="x", entity_id=None, detail={"a": 1})
    assert ev.detail == {"a": 1}


def test_legal_update_records_old_and_new_values(client, auth_headers, new_project):
    pid = new_project()["id"]
    admin = auth_headers("admin")
    r = client.patch(
        f"/projects/{pid}/legal",
        json={
            "status": "Applied",
            "authority_name": "Pune Municipal Corporation",
            "application_reference": "PMC/BP/2026/0142",
            "application_date": "2026-09-01",
        },
        headers=admin,
    )
    assert r.status_code == 200, r.text
    ev = next(e for e in r.json()["audit"] if e["action"] == "legal.updated")
    assert ev["detail"]["from"] == "Not started" and ev["detail"]["to"] == "Applied"
    assert ev["detail"]["changes"]["status"] == ["Not started", "Applied"]
    assert ev["detail"]["changes"]["authority_name"] == [None, "Pune Municipal Corporation"]
    assert ev["detail"]["changes"]["application_date"] == [None, "2026-09-01"]
