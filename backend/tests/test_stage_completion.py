"""Completing stages: owners finish ordinary stages with a note; gate stages only open when the gate is met."""

import pytest

from tests.conftest import valid_visit


def _complete(client, headers, pid, key, note="Done and checked."):
    return client.post(f"/projects/{pid}/stages/{key}/complete", json={"note": note}, headers=headers)


def _state(client, headers, pid, key):
    view = client.get(f"/projects/{pid}/stages", headers=headers).json()
    return next(s for p in view["phases"] for s in p["stages"] if s["key"] == key)


def test_owner_completes_a_stage_and_the_next_one_opens(client, auth_headers, new_project):
    arch = auth_headers("architect")
    pid = new_project()["id"]
    r = _complete(client, arch, pid, "setup", "  Team assigned; timeline agreed.  ")
    assert r.status_code == 200, r.text
    setup = _state(client, arch, pid, "setup")
    assert setup["state"] == "completed" and setup["completion_note"] == "Team assigned; timeline agreed."
    assert setup["completed_by"]["name"] == "Meera Joshi" and setup["completed_at"].endswith("+00:00")
    assert _state(client, arch, pid, "discovery")["state"] == "active"
    actions = [e["action"] for e in client.get(f"/projects/{pid}", headers=arch).json()["audit"]]
    assert actions[-2:] == ["stage.completed", "stage.activated"]


def test_completion_needs_a_note(client, auth_headers, new_project):
    r = _complete(client, auth_headers("architect"), new_project()["id"], "setup", "  ")
    assert r.status_code == 422 and r.json()["detail"]["missing"] == ["note"]


def test_locked_and_completed_stages_cannot_be_completed(client, auth_headers, new_project):
    arch = auth_headers("architect")
    pid = new_project()["id"]
    r = _complete(client, arch, pid, "baseline")
    assert r.status_code == 409 and r.json()["detail"]["reasons"] == ["Waiting for: Client discovery meetings"]
    _complete(client, arch, pid, "setup")
    assert _complete(client, arch, pid, "setup").status_code == 409


def test_client_signoff_stages_complete_only_by_client_approval(client, auth_headers, new_project):
    arch = auth_headers("architect")
    pid = new_project(start_stage="requirements_signoff", historical_confirmed_by="Parvez")["id"]
    r = _complete(client, arch, pid, "requirements_signoff")
    assert r.status_code == 409
    assert r.json()["detail"]["message"] == "This stage completes when the client approves the sign-off package"


def test_line_out_is_blocked_until_legal_approval(client, auth_headers, new_project):
    eng = auth_headers("civil_engineer")
    pid = new_project(start_stage="line_out", historical_confirmed_by="Parvez")["id"]
    r = _complete(client, eng, pid, "line_out")
    assert r.status_code == 409 and r.json()["detail"]["reasons"] == ["Legal Approval is Not started, not Approved"]


def test_civil_completion_is_blocked_by_open_major_problems(client, auth_headers, ready_project, evidence, db):
    from app import models as m

    eng, lead = auth_headers("civil_engineer"), auth_headers("team_lead")
    pid = ready_project["id"]
    evidence(pid)
    v = client.post(f"/projects/{pid}/site-visits", json=valid_visit(), headers=eng).json()
    client.post(f"/site-visits/{v['id']}/review", json={"decision": "approve"}, headers=lead)
    rows = {r.key: r for r in db.query(m.ProjectStage).filter_by(project_id=pid)}
    for key in ("line_out", "construction"):
        rows[key].status = m.StageStatus.completed
    rows["civil_completion"].status = m.StageStatus.active
    db.commit()
    # The checklist placeholder (S12) is passed by an exception, so only the major-problems gate is left.
    ex = client.post(
        f"/projects/{pid}/stages/civil_completion/exceptions",
        json={"gate": "checklist", "reason": "Civil checklist signed on paper"},
        headers=lead,
    )
    assert ex.status_code == 201
    r = _complete(client, lead, pid, "civil_completion")
    assert r.status_code == 409 and r.json()["detail"]["reasons"] == ["1 open High or Critical problem"]
    problem = client.get(f"/projects/{pid}/problems", headers=lead).json()[0]
    client.post(f"/problems/{problem['id']}/resolve", json={"note": "Fixed"}, headers=lead)
    assert _complete(client, lead, pid, "civil_completion").status_code == 200
    # Civil completion opens the 80% fee gate (a payment placeholder), and the finishing sign-off waits for it.
    assert _state(client, lead, pid, "finishing_fee_gate")["state"] == "blocked"
    assert _state(client, lead, pid, "interiors_signoff")["state"] == "locked"


@pytest.mark.parametrize(
    "role,key,expected",
    [
        ("civil_engineer", "setup", 403),  # the Architect's stage
        ("admin", "setup", 403),
        ("team_lead", "setup", 200),  # Team Lead may complete staff stages
    ],
)
def test_roles_that_may_complete(client, auth_headers, new_project, role, key, expected):
    assert _complete(client, auth_headers(role), new_project()["id"], key).status_code == expected


def test_site_engineer_completes_site_stages_and_is_notified_when_they_open(client, auth_headers, new_project):
    eng = auth_headers("civil_engineer")
    pid = new_project(start_stage="predesign_site_visit", historical_confirmed_by="Parvez")["id"]
    notes = client.get("/notifications", headers=eng).json()["items"]
    assert any("Pre-design site visit" in n["text"] for n in notes)
    assert _complete(client, eng, pid, "predesign_site_visit").status_code == 200
    assert _state(client, eng, pid, "investigations")["state"] == "active"


def test_unknown_stage_is_404(client, auth_headers, new_project):
    assert _complete(client, auth_headers("architect"), new_project()["id"], "roofing").status_code == 404


def _add_member(db, pid, user):
    from app.models import ProjectMember

    db.add(ProjectMember(project_id=pid, user_id=user.id))
    db.commit()


def test_structural_consultant_member_completes_structural_design(client, auth_headers, new_project, users, db):
    pid = new_project(start_stage="structural_design", historical_confirmed_by="Parvez")["id"]
    _add_member(db, pid, users["structural_consultant"])
    scon = auth_headers("structural_consultant")
    assert _complete(client, auth_headers("civil_engineer"), pid, "structural_design").status_code == 403
    assert _complete(client, scon, pid, "structural_design").status_code == 200
    assert _state(client, scon, pid, "structural_package")["state"] == "active"
    assert _state(client, scon, pid, "structural_package")["can_complete"] is True


def test_consultant_who_is_not_a_member_cannot_see_the_project(client, auth_headers, new_project):
    pid = new_project(start_stage="structural_design", historical_confirmed_by="Parvez")["id"]
    assert _complete(client, auth_headers("structural_consultant"), pid, "structural_design").status_code == 404


def test_accounts_member_completes_the_payment_gate(client, auth_headers, new_project, users, db):
    acc = auth_headers("accounts")
    pid = new_project(start_stage="payment_gate", historical_confirmed_by="Parvez")["id"]
    _add_member(db, pid, users["accounts"])
    assert _state(client, acc, pid, "payment_gate")["state"] == "blocked"  # the payment placeholder (S10)
    ex = client.post(
        f"/projects/{pid}/stages/payment_gate/exceptions",
        json={"gate": "payment", "reason": "50% received, bank reference 4471"},
        headers=auth_headers("admin"),
    )
    assert ex.status_code == 201
    assert _state(client, acc, pid, "payment_gate")["can_complete"] is True
    assert _complete(client, acc, pid, "payment_gate").status_code == 200
    # Detailed drawings opens, and waits on its own placeholder (the drawing status check, S06).
    assert _state(client, acc, pid, "detailed_drawings")["state"] == "blocked"


def test_stage_ready_reaches_the_member_with_the_owner_role(client, auth_headers, new_project, users, db):
    pid = new_project(start_stage="structural_design", historical_confirmed_by="Parvez")["id"]
    _add_member(db, pid, users["mep_consultant"])
    arch = auth_headers("architect")
    _complete(client, arch, pid, "structural_design")
    _complete(client, arch, pid, "architectural_package")
    _complete(client, arch, pid, "structural_package")
    notes = client.get("/notifications", headers=auth_headers("mep_consultant")).json()["items"]
    assert any("MEP and coordination is open" in n["text"] for n in notes)
