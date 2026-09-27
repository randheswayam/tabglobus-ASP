import pytest

from tests.conftest import workflow_actions

APPLIED = {"status": "Applied", "authority_name": "Pune Municipal Corporation",
           "application_reference": "PMC/BP/2026/0142", "application_date": "2026-09-01"}
APPROVED = {"status": "Approved", "approval_date": "2026-09-20",
            "document_reference": "https://files.example/pmc-approval-0142.pdf"}


@pytest.fixture
def legal(client, auth_headers, new_project):
    p = new_project()
    admin = auth_headers("admin")

    def _patch(body: dict, headers: dict | None = None):
        return client.patch(f"/projects/{p['id']}/legal", json=body, headers=headers or admin)

    _patch.project_id = p["id"]
    return _patch


def _steps(project: dict) -> list[str]:
    return [s["status"] for s in project["steps"]]


def test_admin_applies_then_approves_and_step2_unlocks(legal):
    r = legal(APPLIED)
    assert r.status_code == 200, r.text
    assert r.json()["legal_approval"]["status"] == "Applied"
    assert _steps(r.json()) == ["active", "locked", "locked"]

    r = legal(APPROVED)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["legal_approval"]["status"] == "Approved"
    assert p["legal_approval"]["document_reference"].endswith("0142.pdf")
    assert p["legal_approval"]["authority_name"] == "Pune Municipal Corporation"
    assert _steps(p) == ["completed", "active", "locked"]
    assert p["current_step"] == "Site Visit"


def test_each_change_writes_audit_events(legal):
    legal(APPLIED)
    p = legal(APPROVED).json()
    assert workflow_actions(p["audit"]) == ["project.created", "legal.updated", "legal.updated",
                                            "step.completed", "step.activated"]
    approved = [e for e in p["audit"] if e["action"] == "legal.updated"][1]
    assert approved["detail"]["from"] == "Applied"
    assert approved["detail"]["to"] == "Approved"
    assert approved["actor"] == "Office Coordinator"


def test_cannot_skip_applied(legal):
    r = legal({**APPLIED, **APPROVED})
    assert r.status_code == 409
    assert "Not started" in r.json()["detail"] and "Approved" in r.json()["detail"]


@pytest.mark.parametrize("missing", ["document_reference", "approval_date"])
def test_approved_requires_document_and_approval_date(legal, missing):
    legal(APPLIED)
    body = {k: v for k, v in APPROVED.items() if k != missing}
    r = legal(body)
    assert r.status_code == 422
    assert missing in r.json()["detail"]["missing"]


def test_approved_rejects_blank_document(legal):
    legal(APPLIED)
    r = legal({**APPROVED, "document_reference": "   "})
    assert r.status_code == 422
    assert "document_reference" in r.json()["detail"]["missing"]


def test_applied_requires_application_details(legal):
    r = legal({"status": "Applied"})
    assert r.status_code == 422
    assert set(r.json()["detail"]["missing"]) == {"authority_name", "application_reference", "application_date"}


def test_approval_date_cannot_precede_application(legal):
    legal(APPLIED)
    r = legal({**APPROVED, "approval_date": "2026-08-01"})
    assert r.status_code == 422


def test_rejected_is_final_and_keeps_step2_locked(legal):
    legal(APPLIED)
    p = legal({"status": "Rejected"}).json()
    assert p["legal_approval"]["status"] == "Rejected"
    assert _steps(p) == ["active", "locked", "locked"]
    assert legal({"status": "Applied"}).status_code == 409


def test_approved_record_is_locked(legal):
    legal(APPLIED)
    legal(APPROVED)
    assert legal({"authority_name": "Changed"}).status_code == 409


def test_fields_can_be_saved_without_status_change(legal):
    r = legal({"authority_name": "PMC"})
    assert r.status_code == 200
    assert r.json()["legal_approval"]["status"] == "Not started"
    assert r.json()["legal_approval"]["authority_name"] == "PMC"


@pytest.mark.parametrize("role", ["architect", "team_lead", "civil_engineer"])
def test_only_admin_can_update(legal, auth_headers, role):
    assert legal(APPLIED, headers=auth_headers(role)).status_code == 403


def test_admin_not_member_gets_404(client, db, auth_headers, legal):
    from app import models as m
    db.query(m.ProjectMember).filter_by(project_id=legal.project_id).filter(
        m.ProjectMember.user_id == db.query(m.User).filter_by(role=m.Role.admin).one().id).delete()
    db.commit()
    assert legal(APPLIED).status_code == 404
