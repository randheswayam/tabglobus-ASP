"""Stage tracker API: every project runs the 18-stage flow; in-progress projects join mid-way (PRD 7.19)."""

import pytest

from app import stage_config as sc


def _stages(client, headers, pid):
    r = client.get(f"/projects/{pid}/stages", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _flat(view):
    return {s["key"]: s for p in view["phases"] for s in p["stages"]}


def test_new_project_starts_at_project_setup(client, auth_headers, new_project):
    p = new_project()
    view = _stages(client, auth_headers("architect"), p["id"])
    assert [ph["name"] for ph in view["phases"]][:2] == ["Initiation and requirements", "Parallel pre-design"]
    stages = _flat(view)
    assert len(stages) == len(sc.STAGES)
    assert stages["setup"]["state"] == "active" and stages["setup"]["can_complete"] is True
    assert stages["discovery"]["state"] == "locked" and stages["discovery"]["reasons"] == ["Waiting for: Project setup"]
    assert view["current_stages"] == ["Project setup"]
    assert view["stage_progress"] == {"done": 0, "total": len(sc.STAGES)}
    assert p["phase"] == {"number": 1, "name": "Initiation and requirements", "icon": "folder"}
    assert p["current_stages"] == ["Project setup"]
    audit = [e["action"] for e in p["audit"]]
    assert "stage.activated" in audit


def test_stage_fields_describe_owner_gate_and_workstream(client, auth_headers, new_project):
    s = _flat(_stages(client, auth_headers("architect"), new_project()["id"]))
    assert (
        s["requirements_signoff"]["gates"] == ["client_signoff"] and s["requirements_signoff"]["owner_role"] == "client"
    )
    assert s["predesign_site_visit"]["workstream"] == "Site" and s["predesign_site_visit"]["number"] is None
    assert s["architectural_package"]["number"] == "8A"


def test_onboarding_mid_way_marks_earlier_stages_historical(client, auth_headers, new_project):
    p = new_project(start_stage="structural_design", historical_confirmed_by="Parvez")
    view = _stages(client, auth_headers("architect"), p["id"])
    s = _flat(view)
    assert s["grid_freeze"]["state"] == "historical"
    assert s["grid_freeze"]["historical"] == {
        "label": "Historical — completed before SiteFlow",
        "confirmed_by": "Parvez",
        "note": "Completed before SiteFlow.",
    }
    assert s["requirements_signoff"]["state"] == "historical"
    assert s["requirements_signoff"]["signed_by_client"] is False  # never shown as a client sign-off
    assert s["structural_design"]["state"] == "active" and s["structural_design"]["historical"] is None
    assert view["current_stages"] == ["Structural design package"]
    assert view["stage_progress"]["done"] == [k["key"] for k in sc.STAGES].index("structural_design")
    assert p["phase"]["number"] == 3


@pytest.mark.parametrize(
    "body,field",
    [
        ({"start_stage": "roofing", "historical_confirmed_by": "Parvez"}, "start_stage"),
        ({"start_stage": "grid"}, "historical_confirmed_by"),
        ({"start_stage": "grid", "historical_confirmed_by": "  "}, "historical_confirmed_by"),
    ],
)
def test_onboarding_validation(client, auth_headers, users, body, field):
    r = client.post(
        "/projects",
        headers=auth_headers("architect"),
        json={"name": "X", "location": "Y", "civil_engineer_id": users["civil_engineer"].id, **body},
    )
    assert r.status_code == 422 and field in r.text


def test_list_summary_has_phase_and_current_stages(client, auth_headers, new_project):
    new_project()
    item = client.get("/projects", headers=auth_headers("architect")).json()[0]
    assert item["phase"]["number"] == 1 and item["current_stages"] == ["Project setup"]
    assert item["stage_progress"]["done"] == 0


def test_can_complete_follows_the_caller_role(client, auth_headers, new_project):
    pid = new_project(start_stage="predesign_site_visit", historical_confirmed_by="Parvez")["id"]
    eng = _flat(_stages(client, auth_headers("civil_engineer"), pid))
    admin = _flat(_stages(client, auth_headers("admin"), pid))
    assert eng["predesign_site_visit"]["can_complete"] is True and eng["concept"]["can_complete"] is False
    assert admin["predesign_site_visit"]["can_complete"] is False


def test_stages_respect_visibility(client, db, auth_headers, new_project):
    from app import models as m

    pid = new_project()["id"]
    admin = db.query(m.User).filter_by(role=m.Role.admin).one()
    db.query(m.ProjectMember).filter_by(project_id=pid, user_id=admin.id).delete()
    db.commit()
    assert client.get(f"/projects/{pid}/stages", headers=auth_headers("admin")).status_code == 404
