"""Stage engine: which stages open, which are blocked and why. Pure functions over plain state."""

from app import stage_config as sc
from app.services.stages import GateFacts, evaluate, to_release

KEYS = [s["key"] for s in sc.STAGES]


def statuses(done_until: str | None = None, historical_until: str | None = None, active=()) -> dict[str, str]:
    """Stages before `done_until` completed (or before `historical_until` historical), others locked, plus `active`."""
    out = {}
    for k in KEYS:
        out[k] = "locked"
    if historical_until:
        for k in KEYS[: KEYS.index(historical_until)]:
            out[k] = "historical"
    if done_until:
        for k in KEYS[: KEYS.index(done_until)]:
            out[k] = "completed"
    for k in active:
        out[k] = "active"
    return out


FACTS = GateFacts(legal_status="Approved", open_major_problems=0, signoffs={})


def test_new_project_releases_only_setup():
    s = statuses()
    assert to_release(s) == ["setup"]


def test_requirements_signoff_opens_both_pre_design_branches_together():
    s = statuses(done_until="predesign_site_visit")  # stages 1 to 4 completed
    assert to_release(s) == ["predesign_site_visit", "concept"]


def test_grid_waits_for_both_branches_and_mep_waits_for_8a_and_8b():
    s = statuses(done_until="concept")  # site branch done up to investigations, studio not started
    s["concept"] = "completed"
    s["tentative_elevations"] = "active"
    assert "grid" not in to_release(s)
    s = statuses(done_until="architectural_package")
    assert to_release(s) == ["architectural_package", "structural_package"]
    s["architectural_package"] = "completed"
    s["structural_package"] = "active"
    assert "mep" not in to_release(s)
    s["structural_package"] = "completed"
    assert to_release(s) == ["mep"]


def test_historical_stages_count_as_done():
    s = statuses(historical_until="line_out")
    assert to_release(s) == ["line_out"]


def test_locked_stage_names_what_it_waits_for():
    s = statuses(done_until="architectural_package", active=["architectural_package", "structural_package"])
    view = evaluate(s, FACTS)
    assert view["mep"]["state"] == "locked"
    assert view["mep"]["reasons"] == ["Waiting for: Architectural package, Structural package"]
    assert view["architectural_package"] == {"state": "active", "reasons": []}


def test_client_signoff_stage_is_blocked_with_the_request_state():
    s = statuses(done_until="requirements_signoff", active=["requirements_signoff"])
    assert evaluate(s, FACTS)["requirements_signoff"] == {
        "state": "blocked",
        "reasons": ["Sign-off package not sent to the client yet"],
    }
    sent = GateFacts(
        "Approved",
        0,
        {"requirements_signoff": {"status": "sent", "version": 2, "sent_at": "2026-09-24T10:00:00+00:00"}},
    )
    assert evaluate(s, sent)["requirements_signoff"]["reasons"] == [
        "Waiting for client sign-off on version 2, sent 24 Sep 2026"
    ]
    changes = GateFacts(
        "Approved", 0, {"requirements_signoff": {"status": "changes_requested", "version": 1, "sent_at": None}}
    )
    assert evaluate(s, changes)["requirements_signoff"]["reasons"] == [
        "The client asked for changes on version 1; prepare version 2"
    ]


def test_line_out_needs_legal_approval():
    s = statuses(historical_until="line_out", active=["line_out"])
    view = evaluate(s, GateFacts("Applied", 0, {}))
    assert view["line_out"] == {"state": "blocked", "reasons": ["Legal Approval is Applied, not Approved"]}
    assert evaluate(s, FACTS)["line_out"]["state"] == "active"


def test_civil_completion_needs_no_open_major_problems():
    s = statuses(historical_until="civil_completion", active=["civil_completion"])
    checked = {("civil_completion", "checklist")}  # the placeholder checklist gate passed by an exception
    assert evaluate(s, GateFacts("Approved", 2, {}, exceptions=checked))["civil_completion"]["reasons"] == [
        "2 open High or Critical problems"
    ]
    assert evaluate(s, GateFacts("Approved", 1, {}, exceptions=checked))["civil_completion"]["reasons"] == [
        "1 open High or Critical problem"
    ]
    passed = GateFacts("Approved", 0, {}, exceptions={("civil_completion", "checklist")})
    assert evaluate(s, passed)["civil_completion"]["state"] == "active"


def test_completed_and_historical_are_reported_as_such():
    s = statuses(historical_until="line_out", done_until=None)
    view = evaluate(s, FACTS)
    assert view["setup"] == {"state": "historical", "reasons": []}
    s["setup"] = "completed"
    assert evaluate(s, FACTS)["setup"] == {"state": "completed", "reasons": []}
