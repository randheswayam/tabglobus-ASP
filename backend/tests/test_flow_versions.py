"""Flow versions: each project is pinned to a snapshot of stage_config, so a later edit to the flow changes new
projects only. Running projects keep the flow they started with."""

import copy

import pytest

from app import stage_config as sc
from app.models import FlowVersion, Project, ProjectStage
from app.modules.workflow import versions


@pytest.fixture
def edited_flow(monkeypatch):
    """stage_config after an edit: stage 7 renamed, and a warranty visit added after handover."""

    def _apply():
        stages = copy.deepcopy(sc.STAGES)
        for s in stages:
            if s["key"] == "concept":
                s["label"] = "Concept design (revised)"
        extra = copy.deepcopy(stages[-1])
        extra.update(
            key="warranty_visit",
            number="19",
            label="Warranty visit",
            predecessors=["handover_signoff"],
            gates=[],
            owner_role="architect",
            evidence_required=[],
        )
        stages.append(extra)
        monkeypatch.setattr(sc, "STAGES", stages)
        monkeypatch.setattr(sc, "BY_KEY", {s["key"]: s for s in stages})

    return _apply


def _tracker(client, auth_headers, pid):
    r = client.get(f"/projects/{pid}/stages", headers=auth_headers("architect"))
    assert r.status_code == 200, r.text
    return {s["key"]: s for p in r.json()["phases"] for s in p["stages"]}


def test_a_new_project_pins_the_current_version(new_project, db):
    pid = new_project()["id"]
    p = db.get(Project, pid)
    assert p.flow_version is not None and p.flow_version.number == 1
    assert [s["key"] for s in p.flow_version.snapshot["stages"]] == [s["key"] for s in sc.STAGES]


def test_the_same_config_reuses_the_version(new_project, db):
    new_project("A"), new_project("B")
    assert db.query(FlowVersion).count() == 1


def test_an_edit_makes_a_new_version_and_running_projects_keep_the_old_flow(
    client, auth_headers, new_project, db, edited_flow
):
    old = new_project("Running Villa")["id"]
    edited_flow()
    new = new_project("New Villa")["id"]
    assert db.query(FlowVersion).count() == 2
    assert db.get(Project, new).flow_version.number == 2

    before, after = _tracker(client, auth_headers, old), _tracker(client, auth_headers, new)
    assert before["concept"]["label"] != "Concept design (revised)"
    assert "warranty_visit" not in before
    assert after["concept"]["label"] == "Concept design (revised)"
    assert after["warranty_visit"]["state"] == "locked"
    assert db.query(ProjectStage).filter_by(project_id=old).count() == len(before)
    assert db.query(ProjectStage).filter_by(project_id=new, key="warranty_visit").count() == 1


def test_running_projects_still_work_everywhere_after_an_edit(client, auth_headers, ready_project, edited_flow):
    pid = ready_project["id"]
    edited_flow()
    for role, path in (
        ("architect", "/dashboard"),
        ("architect", f"/projects/{pid}"),
        ("architect", "/projects"),
        ("team_lead", "/principal/overview"),
    ):
        r = client.get(path, headers=auth_headers(role))
        assert r.status_code == 200, (path, r.text)
    summary = client.get(f"/projects/{pid}", headers=auth_headers("architect")).json()
    assert summary["stage_progress"]["total"] == 24


def test_completing_a_stage_uses_the_pinned_flow(client, auth_headers, new_project, edited_flow):
    pid = new_project()["id"]
    edited_flow()
    r = client.post(
        f"/projects/{pid}/stages/setup/complete", json={"note": "Folder made"}, headers=auth_headers("architect")
    )
    assert r.status_code == 200, r.text
    assert "warranty_visit" not in _tracker(client, auth_headers, pid)


def test_flow_for_falls_back_to_the_config_for_an_unpinned_project(db):
    flow = versions.flow_for(Project(name="x", location="y"))
    assert flow.version is None and flow.stages is sc.STAGES and flow.by_key["setup"]["key"] == "setup"


def test_the_snapshot_is_json_and_detached_from_the_config(new_project, db):
    pid = new_project()["id"]
    snap = db.get(Project, pid).flow_version.snapshot
    assert snap["stages"] is not sc.STAGES and snap["phases"][0]["number"] == 1
