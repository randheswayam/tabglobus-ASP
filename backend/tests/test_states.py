"""The PRD 6.3 activity state machine: every legal move, a sample of illegal ones, comments, and the mapping from
today's stored stage statuses."""

import pytest

from app.modules.workflow.states import (
    FINAL,
    TRANSITIONS,
    Action,
    CommentRequired,
    IllegalTransition,
    State,
    allowed,
    from_stored,
    transition,
)


@pytest.mark.parametrize(("start", "action", "end"), [(s, a, e) for (s, a), e in TRANSITIONS.items()])
def test_every_legal_transition(start, action, end):
    assert transition(start, action, comment="Reason given") == end


def test_the_happy_path():
    s = State.not_started
    for a in ("make_ready", "start", "submit", "begin_review", "approve", "complete"):
        s = transition(s, a)
    assert s == State.completed


def test_rework_loops_back_to_work():
    s = transition(State.under_review, Action.request_rework, comment="Dimensions missing on sheet 3")
    assert s == State.rework
    assert transition(s, Action.start) == State.in_progress


@pytest.mark.parametrize(
    ("start", "action"),
    [
        (State.not_started, Action.start),
        (State.ready, Action.submit),
        (State.in_progress, Action.approve),
        (State.submitted, Action.approve),  # review has to begin first
        (State.approved, Action.request_rework),  # approved is immutable
        (State.completed, Action.start),
        (State.completed, Action.hold),
        (State.rejected, Action.complete),
        (State.cancelled, Action.resume),
        (State.superseded, Action.start),
        (State.on_hold, Action.submit),
        (State.blocked, Action.start),
    ],
)
def test_illegal_transitions_raise(start, action):
    with pytest.raises(IllegalTransition):
        transition(start, action, comment="x")


@pytest.mark.parametrize("action", [Action.request_rework, Action.reject])
@pytest.mark.parametrize("comment", [None, "", "   "])
def test_rework_and_reject_need_a_comment(action, comment):
    with pytest.raises(CommentRequired):
        transition(State.under_review, action, comment=comment)


def test_final_states_have_no_way_out():
    for s in FINAL:
        assert allowed(s) == []


def test_every_state_is_reachable():
    reached = {State.not_started} | set(TRANSITIONS.values())
    assert reached == set(State)


def test_strings_are_accepted_and_bad_names_rejected():
    assert transition("Ready", "start") == State.in_progress
    with pytest.raises(ValueError):
        transition("Pending", "start")


@pytest.mark.parametrize(
    ("stored", "engine", "state"),
    [
        ("locked", "locked", State.not_started),
        ("active", "active", State.in_progress),
        ("active", "blocked", State.blocked),
        ("completed", "completed", State.completed),
        ("historical", "historical", State.completed),
    ],
)
def test_stored_statuses_map_to_activity_states(stored, engine, state):
    assert from_stored(stored, engine) == state


def test_an_unknown_stored_status_raises():
    with pytest.raises(ValueError):
        from_stored("archived")
