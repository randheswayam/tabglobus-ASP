import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from app import models as m
from app.db import engine
from app.passwords import verify_password
from app.seed import seed

STAFF = [r for r in m.Role if r != m.Role.client]

EXPECTED_TABLES = {
    "users", "projects", "project_members", "workflow_steps", "legal_approvals",
    "site_visits", "reviews", "audit_events",
}


def test_all_tables_created_on_startup(client):
    assert EXPECTED_TABLES <= set(inspect(engine).get_table_names())


def test_enum_values_match_prd():
    assert {r.value for r in m.Role} == {"architect", "team_lead", "civil_engineer", "admin", "client"}
    assert {s.value for s in m.StepStatus} == {"locked", "active", "completed"}
    assert {s.value for s in m.VisitStatus} == {"draft", "submitted", "rework", "approved"}
    assert {s.value for s in m.LegalStatus} == {"Not started", "Applied", "Approved", "Rejected"}


def test_seed_creates_one_user_per_role_with_hashed_passwords(db):
    seed(db, password="test-pass-123")
    users = db.query(m.User).all()
    assert sorted(u.role.value for u in users) == sorted(r.value for r in STAFF)  # clients come by invite
    parvez = db.query(m.User).filter_by(role=m.Role.team_lead).one()
    assert parvez.name == "Parvez"
    for u in users:
        assert u.password_hash != "test-pass-123"
        assert verify_password("test-pass-123", u.password_hash)
        assert not verify_password("wrong", u.password_hash)


def test_seed_is_idempotent(db):
    seed(db, password="x-pass-1")
    seed(db, password="x-pass-1")
    assert db.query(m.User).count() == len(STAFF)


def _project(db):
    seed(db, password="p")
    arch = db.query(m.User).filter_by(role=m.Role.architect).one()
    p = m.Project(name="Villa A", location="Pune", created_by_id=arch.id)
    db.add(p)
    db.flush()
    return p, arch


def test_project_relationships_and_json_columns(db):
    p, arch = _project(db)
    eng = db.query(m.User).filter_by(role=m.Role.civil_engineer).one()
    db.add(m.ProjectMember(project_id=p.id, user_id=eng.id))
    for i, name in enumerate(["Legal Approval", "Site Visit", "Team Lead Review"], start=1):
        db.add(m.WorkflowStep(project_id=p.id, order=i, name=name,
                              status=m.StepStatus.active if i == 1 else m.StepStatus.locked))
    db.add(m.LegalApproval(project_id=p.id))
    visit = m.SiteVisit(project_id=p.id, engineer_id=eng.id,
                        form={"weather": "Clear"}, checklist={"fdn-pcc": "Done"},
                        problems=[{"category": "Water", "problem": "Seepage or dampness"}])
    db.add(visit)
    db.commit()
    db.refresh(p)
    assert [s.order for s in p.steps] == [1, 2, 3]
    assert p.legal_approval.status == m.LegalStatus.not_started
    assert p.members[0].user_id == eng.id
    assert visit.status == m.VisitStatus.draft
    assert visit.submission_count == 0
    assert visit.checklist == {"fdn-pcc": "Done"}
    assert visit.problems[0]["problem"] == "Seepage or dampness"
    assert p.official_progress == 0


def test_workflow_step_order_unique_per_project(db):
    p, _ = _project(db)
    db.add(m.WorkflowStep(project_id=p.id, order=1, name="Legal Approval"))
    db.add(m.WorkflowStep(project_id=p.id, order=1, name="Duplicate"))
    with pytest.raises(IntegrityError):
        db.commit()


def test_audit_events_cannot_be_edited_or_deleted(db):
    p, arch = _project(db)
    ev = m.AuditEvent(project_id=p.id, actor_id=arch.id, action="project.created",
                      entity_type="project", entity_id=p.id)
    db.add(ev)
    db.commit()
    ev.action = "tampered"
    with pytest.raises(m.AuditImmutableError):
        db.commit()
    db.rollback()
    db.delete(ev)
    with pytest.raises(m.AuditImmutableError):
        db.commit()
