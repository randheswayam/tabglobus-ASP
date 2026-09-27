import pytest

from app import template_config as tc
from app.services.progress import derive_progress

# Small config with uneven weights so the hand calculation is unambiguous.
CFG = [
    {"name": "A", "weight": 20, "checklist": [{"id": "a1"}, {"id": "a2"}]},
    {"name": "B", "weight": 30, "checklist": [{"id": "b1"}, {"id": "b2"}, {"id": "b3"}, {"id": "b4"}]},
    {"name": "C", "weight": 50, "checklist": [{"id": "c1"}]},
]


def _all(stage_name: str, state: str, cfg=tc.STAGES) -> dict:
    stage = next(s for s in cfg if s["name"] == stage_name)
    return {i["id"]: state for i in stage["checklist"]}


def test_all_done_at_handover_is_100():
    assert derive_progress("Handover", _all("Handover", "Done")) == 100.0


def test_nothing_done_at_foundation_is_0():
    assert derive_progress("Foundation", _all("Foundation", "Not started")) == 0.0


def test_mid_stage_matches_hand_calculation():
    # A complete (20) + B at 2 of 4 Done (30 × 0.5 = 15) + C not reached (0) = 35.0
    states = {"b1": "Done", "b2": "Done", "b3": "In progress", "b4": "Not started"}
    assert derive_progress("B", states, CFG) == 35.0


def test_in_progress_items_do_not_count_as_done():
    assert derive_progress("C", {"c1": "In progress"}, CFG) == 50.0


def test_first_stage_partial():
    assert derive_progress("A", {"a1": "Done", "a2": "Not started"}, CFG) == 10.0


def test_rounds_half_up_to_one_decimal_with_real_template():
    # Plastering is stage 5 of 8 at 12.5 each: 4 × 12.5 = 50, plus 1 of 2 Done = 6.25 → 56.25 → 56.3
    states = {"pls-internal": "Done", "pls-external": "Not started"}
    assert derive_progress("Plastering", states) == 56.3


def test_missing_items_count_as_not_done():
    assert derive_progress("B", {"b1": "Done"}, CFG) == 27.5


def test_unknown_stage_raises():
    with pytest.raises(ValueError, match="stage"):
        derive_progress("Roofing", {}, CFG)


def test_unknown_item_raises():
    with pytest.raises(ValueError, match="z9"):
        derive_progress("A", {"a1": "Done", "z9": "Done"}, CFG)


def test_item_from_another_stage_raises():
    with pytest.raises(ValueError, match="b1"):
        derive_progress("A", {"b1": "Done"}, CFG)


def test_invalid_state_raises():
    with pytest.raises(ValueError, match="state"):
        derive_progress("A", {"a1": "Finished"}, CFG)


def test_weights_must_sum_to_100():
    bad = [{"name": "A", "weight": 60, "checklist": [{"id": "a1"}]}]
    with pytest.raises(ValueError, match="100"):
        derive_progress("A", {"a1": "Done"}, bad)
