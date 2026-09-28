"""The 18-stage residential flow from the workflow diagram (docs/reference/workflow-diagram.jpeg)."""

from app import stage_config as sc
from app.models import Role
from app.modules.workflow.gates import registered


def by_key():
    return {s["key"]: s for s in sc.STAGES}


def test_eighteen_numbered_stages_and_four_pre_design_activities():
    numbered = [s["number"] for s in sc.STAGES if s["number"]]
    assert numbered == [
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8A",
        "8B",
        "9",
        "10",
        "11",
        "12",
        "13",
        "14",
        "15",
        "16",
        "17",
        "18",
    ]
    pre = [s["key"] for s in sc.STAGES if s["number"] is None]
    assert pre == ["predesign_site_visit", "investigations", "concept", "tentative_elevations"]
    assert len(sc.STAGES) == 23


def test_phases_follow_the_diagram():
    assert [p["name"] for p in sc.PHASES] == [
        "Initiation and requirements",
        "Parallel pre-design",
        "Structural design",
        "Design development and coordination",
        "Client approval and commercial gate",
        "Detailed drawings",
        "Construction execution",
        "Civil completion",
        "Interiors",
        "Handover",
    ]
    order = [s["phase"] for s in sc.STAGES]
    assert order == sorted(order)
    assert {s["phase"] for s in sc.STAGES} == set(range(1, 11))


def test_every_stage_is_well_formed():
    keys = set(by_key())
    assert len(keys) == len(sc.STAGES)
    for s in sc.STAGES:
        assert s["label"] and s["workstream"] in ("Studio", "Site", "Both")
        assert s["owner_role"] in {r.value for r in Role}
        assert isinstance(s["gates"], list) and "gate" not in s
        assert set(s["gates"]) <= set(registered()), s["key"]
        assert set(s["predecessors"]) <= keys, s["key"]


def test_one_start_no_cycles_no_orphans():
    stages = by_key()
    starts = [k for k, s in stages.items() if not s["predecessors"]]
    assert starts == ["setup"]
    # Every stage is reachable from the start, and following predecessors never loops.
    successors = {k: [x for x, s in stages.items() if k in s["predecessors"]] for k in stages}
    seen, todo = set(), ["setup"]
    while todo:
        k = todo.pop()
        if k not in seen:
            seen.add(k)
            todo += successors[k]
    assert seen == set(stages)
    state = {}

    def visit(k):
        assert state.get(k) != "visiting", f"cycle at {k}"
        if state.get(k) == "done":
            return
        state[k] = "visiting"
        for p in stages[k]["predecessors"]:
            visit(p)
        state[k] = "done"

    for k in stages:
        visit(k)
    assert sc.STAGES[-1]["key"] == "handover_signoff"


def test_parallel_branches_match_the_diagram():
    s = by_key()
    assert s["predesign_site_visit"]["predecessors"] == ["requirements_signoff"]
    assert s["concept"]["predecessors"] == ["requirements_signoff"]
    assert s["predesign_site_visit"]["workstream"] == "Site" and s["concept"]["workstream"] == "Studio"
    assert sorted(s["grid"]["predecessors"]) == ["investigations", "tentative_elevations"]
    assert s["architectural_package"]["predecessors"] == ["structural_design"]
    assert s["structural_package"]["predecessors"] == ["structural_design"]
    assert sorted(s["mep"]["predecessors"]) == ["architectural_package", "structural_package"]


def test_gates_sit_on_the_right_stages():
    gates = {s["number"]: s["gates"] for s in sc.STAGES if s["gates"]}
    assert gates == {
        "4": ["client_signoff"],
        "6": ["finding_disposition"],
        "9": ["issue_closure"],
        "11": ["client_signoff"],
        "12": ["payment"],
        "13": ["document_status"],
        "14": ["legal_approval"],
        "16": ["no_open_major_problems", "checklist"],
        "17": ["client_signoff"],
        "18": ["client_signoff"],
    }
    assert sc.SIGNOFF_STAGES == [
        "requirements_signoff",
        "design_freeze_signoff",
        "interiors_signoff",
        "handover_signoff",
    ]
    assert all(by_key()[k]["owner_role"] == "client" for k in sc.SIGNOFF_STAGES)
    assert sc.CONSTRUCTION_START == "line_out"


def test_client_facing_text_has_no_planning_markers():
    """Labels and details are shown in the client app."""
    for s in sc.STAGES:
        for text in (s["label"], s["detail"]):
            assert "TBD" not in text and "D-0" not in text, s["key"]


def test_stage_owners_use_the_prd_roles():
    owners = {s["key"]: s["owner_role"] for s in sc.STAGES}
    assert owners["structural_design"] == "structural_consultant"
    assert owners["structural_package"] == "structural_consultant"
    assert owners["mep"] == "mep_consultant"
    assert owners["payment_gate"] == "accounts"
    assert owners["grid_freeze"] == "team_lead"
    from app.models import Role

    assert set(owners.values()) <= {r.value for r in Role}


def test_signoff_stages_are_derived_from_the_gates():
    assert sc.SIGNOFF_STAGES == [s["key"] for s in sc.STAGES if "client_signoff" in s["gates"]]
    assert sc.SIGNOFF_STAGES == [
        "requirements_signoff",
        "design_freeze_signoff",
        "interiors_signoff",
        "handover_signoff",
    ]
