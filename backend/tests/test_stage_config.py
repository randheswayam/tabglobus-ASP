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
    pre = [s["key"] for s in sc.STAGES if s["number"] is None and s["phase"] == 2]
    assert pre == ["predesign_site_visit", "investigations", "concept", "tentative_elevations"]
    assert len(sc.STAGES) == 24  # 18 numbered (8A and 8B), 4 pre-design activities, and the 80% fee gate


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
        "Finishing",
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
        None: ["payment"],  # the 80% fee gate before the finishing package
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


ICONS = {
    "folder",
    "people",
    "document",
    "check_badge",
    "hard_hat",
    "magnifier",
    "pencil",
    "drafting",
    "ruler",
    "people_check",
    "gear",
    "house",
    "frame",
    "pipes",
    "building",
    "card",
    "sheet",
    "surveyor",
    "clipboard",
    "city",
    "sofa",
    "key",
}


def test_every_phase_and_stage_has_a_known_icon():
    assert all(p["icon"] in ICONS for p in sc.PHASES)
    assert all(s["icon"] in ICONS for s in sc.STAGES), [s["key"] for s in sc.STAGES if s.get("icon") not in ICONS]
    by = {s["key"]: s["icon"] for s in sc.STAGES}
    assert by["setup"] == "folder" and by["handover_signoff"] == "key" and by["line_out"] == "surveyor"


def test_the_web_icon_set_draws_every_icon():
    from pathlib import Path

    js = (Path(__file__).resolve().parents[2] / "web-src" / "icons.js").read_text(encoding="utf-8")
    for name in ICONS:
        assert f"{name}:" in js, name


def test_finishing_package_and_its_80_percent_fee_gate():
    from app import workflow_config as wc

    gate = sc.BY_KEY["finishing_fee_gate"]
    assert gate["label"] == f"{wc.FINISHING_FEE_PERCENT}% fee gate" == "80% fee gate"
    assert gate["phase"] == 9 and gate["owner_role"] == "accounts" and gate["workstream"] == "Both"
    assert gate["predecessors"] == ["civil_completion"] and gate["gates"] == ["payment"]
    assert gate["icon"] == "card" and gate["detail"] == "80% of fees collected before the finishing package"
    finishing = sc.BY_KEY["interiors_signoff"]
    assert finishing["label"] == "Client sign-off: finishing package (tile and material selection)"
    assert finishing["detail"] == "Finishing package: material, tile and fixture selection approvals"
    assert finishing["predecessors"] == ["finishing_fee_gate"]
    assert next(p for p in sc.PHASES if p["number"] == 9)["name"] == "Finishing"
    assert sc.BY_KEY["payment_gate"]["label"] == f"{wc.UPFRONT_FEE_PERCENT}% upfront gate" == "50% upfront gate"
    keys = [s["key"] for s in sc.STAGES]
    assert keys.index("civil_completion") < keys.index("finishing_fee_gate") < keys.index("interiors_signoff")


def test_every_stage_maps_to_a_prd_stage_and_every_prd_stage_is_covered():
    """PRD v3.2 numbers the flow Stage 0 to 15; the diagram numbers it 1 to 18 (R-09)."""
    assert all(isinstance(s["prd_stage"], int) and 0 <= s["prd_stage"] <= 15 for s in sc.STAGES)
    assert {s["prd_stage"] for s in sc.STAGES} == set(range(16))
    assert set(sc.PRD_STAGE) == set(sc.BY_KEY)
    by = {s["key"]: s["prd_stage"] for s in sc.STAGES}
    assert (by["setup"], by["requirements_signoff"], by["line_out"], by["handover_signoff"]) == (0, 2, 11, 15)


def test_prd_stages_follow_the_flow_order():
    numbers = [s["prd_stage"] for s in sc.STAGES]
    assert numbers == sorted(numbers)


def test_the_tracker_shows_the_prd_stage(client, auth_headers, new_project):
    pid = new_project()["id"]
    body = client.get(f"/projects/{pid}/stages", headers=auth_headers("architect")).json()
    got = {s["key"]: s["prd_stage"] for p in body["phases"] for s in p["stages"]}
    assert got["line_out"] == 11 and got["setup"] == 0
