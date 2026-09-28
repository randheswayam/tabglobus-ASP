"""Workflow health per stage for the dashboard callout: done (green), waiting (yellow), delayed (red), upcoming
(grey). Delayed comes from open red flags mapped to their stage, or an optional per-stage day limit."""

from datetime import UTC, datetime, timedelta

import pytest

from app import stage_config as sc
from app import workflow_config as wc
from app.modules.workflow.health import FLAG_STAGE, stage_health

NOW = datetime(2026, 9, 28, 10, 0, tzinfo=UTC)


def _view(**states):
    """Engine view: every stage upcoming unless given, e.g. setup=("completed", [])."""
    out = {s["key"]: {"state": "locked", "reasons": ["Waiting for: x"]} for s in sc.STAGES}
    for k, (state, reasons) in states.items():
        out[k] = {"state": state, "reasons": reasons}
    return out


def _by_key(result):
    return {s["key"]: s for p in result["phases"] for s in p["stages"]}


def test_each_colour_from_the_engine_state():
    view = _view(
        setup=("completed", []),
        discovery=("historical", []),
        baseline=("active", []),
        requirements_signoff=("blocked", ["Sign-off package not sent to the client yet"]),
    )
    r = _by_key(stage_health(view, started={}, flags=[], signoff_stages={}, now=NOW))
    assert r["setup"]["health"] == "done" and r["discovery"]["health"] == "done"
    assert r["baseline"] == {**r["baseline"], "health": "waiting", "reason": "In progress"}
    assert r["requirements_signoff"]["health"] == "waiting"
    assert r["requirements_signoff"]["reason"] == "Sign-off package not sent to the client yet"
    assert r["grid"]["health"] == "upcoming" and r["grid"]["reason"] is None
    assert r["discovery"]["reason"] == "Completed before SiteFlow"


def test_counts_and_phase_structure():
    view = _view(setup=("completed", []), discovery=("active", []))
    result = stage_health(view, started={}, flags=[], signoff_stages={}, now=NOW)
    assert [p["number"] for p in result["phases"]] == [p["number"] for p in sc.PHASES]
    assert result["counts"] == {"done": 1, "waiting": 1, "delayed": 0, "upcoming": len(sc.STAGES) - 2}


@pytest.mark.parametrize(
    "rule,key,stage",
    [
        ("legal_delay", "project", "line_out"),
        ("critical_issue", "problem-4", "construction"),
        ("overdue_fix", "problem-4", "construction"),
        ("review_overdue", "visit-9", "construction"),
        ("repeated_rework", "visit-9", "construction"),
        ("no_recent_visit", "project", "construction"),
    ],
)
def test_flags_map_to_their_stage(rule, key, stage):
    view = _view(line_out=("completed", []), construction=("active", []))
    if stage == "line_out":
        view = _view()  # line-out not started yet: a Legal delay still marks it
    r = _by_key(stage_health(view, started={}, flags=[(rule, key)], signoff_stages={}, now=NOW))
    assert r[stage]["health"] == "delayed"
    assert r[stage]["reason"] == wc.RED_FLAG_RULES[rule]["label"]


def test_client_decision_overdue_marks_the_sign_off_stage_it_names():
    view = _view(design_freeze_signoff=("blocked", ["Waiting for client sign-off on version 1, sent 20 Sept 2026"]))
    r = _by_key(
        stage_health(
            view,
            started={},
            flags=[("client_decision_overdue", "signoff-7")],
            signoff_stages={7: "design_freeze_signoff"},
            now=NOW,
        )
    )
    assert r["design_freeze_signoff"]["health"] == "delayed"
    assert r["design_freeze_signoff"]["reason"] == "Client decision overdue"


def test_a_flag_does_not_turn_a_finished_stage_red():
    view = _view(line_out=("historical", []), construction=("active", []))
    r = _by_key(stage_health(view, started={}, flags=[("legal_delay", "project")], signoff_stages={}, now=NOW))
    assert r["line_out"]["health"] == "done"


def test_the_day_limit_is_off_by_default():
    assert wc.STAGE_DELAYED_AFTER_DAYS == {}
    view = _view(baseline=("active", []))
    r = _by_key(
        stage_health(view, started={"baseline": NOW - timedelta(days=400)}, flags=[], signoff_stages={}, now=NOW)
    )
    assert r["baseline"]["health"] == "waiting"


def test_the_day_limit_when_configured(monkeypatch):
    monkeypatch.setitem(wc.STAGE_DELAYED_AFTER_DAYS, "baseline", 10)
    view = _view(baseline=("active", []))
    late = stage_health(view, started={"baseline": NOW - timedelta(days=12)}, flags=[], signoff_stages={}, now=NOW)
    assert _by_key(late)["baseline"]["health"] == "delayed"
    assert _by_key(late)["baseline"]["reason"] == "Open for 12 days (limit 10)"
    early = stage_health(view, started={"baseline": NOW - timedelta(days=3)}, flags=[], signoff_stages={}, now=NOW)
    assert _by_key(early)["baseline"]["health"] == "waiting"


def test_every_red_flag_rule_has_a_stage():
    assert set(wc.RED_FLAG_RULES) <= set(FLAG_STAGE) | {"client_decision_overdue"}


# ---------- dashboard rows ----------


def test_dashboard_rows_carry_the_workflow(client, auth_headers, new_project):
    pid = new_project(start_stage="design_freeze_signoff", historical_confirmed_by="Parvez")["id"]
    rows = client.get("/dashboard", headers=auth_headers("architect")).json()["all_projects"]
    wf = next(r for r in rows if r["id"] == pid)["workflow"]
    stages = {s["key"]: s for p in wf["phases"] for s in p["stages"]}
    assert stages["setup"]["health"] == "done"
    assert stages["design_freeze_signoff"]["health"] == "waiting"
    assert stages["design_freeze_signoff"]["reason"] == "Sign-off package not sent to the client yet"
    assert wf["counts"]["done"] == 15 and wf["counts"]["waiting"] == 1
    assert set(stages["setup"]) == {"key", "number", "label", "icon", "health", "reason"}


def test_dashboard_marks_a_critical_problem_red(client, auth_headers, ready_project, evidence):
    from tests.conftest import valid_visit

    eng, lead = auth_headers("civil_engineer"), auth_headers("team_lead")
    pid = ready_project["id"]
    evidence(pid)
    v = client.post(f"/projects/{pid}/site-visits", json=valid_visit(), headers=eng).json()
    client.post(f"/site-visits/{v['id']}/review", json={"decision": "approve"}, headers=lead)
    rows = client.get("/dashboard", headers=lead).json()["all_projects"]
    stages = {s["key"]: s for p in next(r for r in rows if r["id"] == pid)["workflow"]["phases"] for s in p["stages"]}
    assert stages["construction"]["health"] == "delayed"
    assert stages["construction"]["reason"] in {"Critical issue", "Overdue fix"}


@pytest.mark.parametrize(
    "states,expected",
    [
        (
            {
                "setup": "completed",
                "discovery": "completed",
                "baseline": "historical",
                "requirements_signoff": "completed",
            },
            "done",
        ),
        ({"setup": "completed", "discovery": "active"}, "waiting"),
        ({"setup": "completed"}, "waiting"),  # partly done, nothing open: still in progress
        ({}, "upcoming"),
    ],
)
def test_phase_health_is_the_worst_of_its_stages(states, expected):
    view = _view(**{k: (v, []) for k, v in states.items()})
    phase1 = stage_health(view, started={}, flags=[], signoff_stages={}, now=NOW)["phases"][0]
    assert phase1["health"] == expected and phase1["icon"] == "folder"


def test_a_delayed_stage_makes_its_phase_delayed():
    view = _view(line_out=("active", []))
    phases = stage_health(view, started={}, flags=[("legal_delay", "project")], signoff_stages={}, now=NOW)["phases"]
    assert next(p for p in phases if p["number"] == 7)["health"] == "delayed"


def test_project_list_carries_the_workflow_for_the_icons(client, auth_headers, new_project):
    pid = new_project(start_stage="design_freeze_signoff", historical_confirmed_by="Parvez")["id"]
    row = next(p for p in client.get("/projects", headers=auth_headers("architect")).json() if p["id"] == pid)
    healths = [p["health"] for p in row["workflow"]["phases"]]
    assert healths[:4] == ["done"] * 4 and healths[4] == "waiting" and healths[5:] == ["upcoming"] * 5
