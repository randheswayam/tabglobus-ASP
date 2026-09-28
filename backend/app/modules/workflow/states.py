"""The activity state machine of PRD v3.2 section 6.3, as a pure function. Nothing stores these states yet:
ProjectStage still keeps locked, active, completed or historical, and wiring this in is S05 (see docs/PROGRESS.md).

    Not Started -> Ready -> In Progress -> Submitted -> Under Review -> Approved / Rework / Rejected -> Completed
    plus Blocked, On Hold, Cancelled and Superseded.

A completed or approved item is immutable: a correction supersedes it with a new revision. Rework and Reject need
a comment. Cancelled and Superseded are final.

Today's stored stage statuses map onto these states (from_stored):

    stored       engine state   activity state
    locked       locked         Not Started
    active       active         In Progress   (open for work; nothing blocks it)
    active       blocked        Blocked       (a gate, such as a sign-off or payment, still blocks it)
    completed    completed      Completed
    historical   historical     Completed     (before SiteFlow; never a system sign-off, PRD 7.19)
"""

from enum import StrEnum


class State(StrEnum):
    not_started = "Not Started"
    ready = "Ready"
    in_progress = "In Progress"
    submitted = "Submitted"
    under_review = "Under Review"
    approved = "Approved"
    rework = "Rework"
    rejected = "Rejected"
    completed = "Completed"
    blocked = "Blocked"
    on_hold = "On Hold"
    cancelled = "Cancelled"
    superseded = "Superseded"


class Action(StrEnum):
    make_ready = "make_ready"  # prerequisites met
    start = "start"
    submit = "submit"
    begin_review = "begin_review"
    approve = "approve"
    request_rework = "request_rework"
    reject = "reject"
    complete = "complete"
    block = "block"
    unblock = "unblock"
    hold = "hold"
    resume = "resume"
    cancel = "cancel"
    supersede = "supersede"


class IllegalTransition(ValueError):
    pass


class CommentRequired(ValueError):
    pass


S, A = State, Action
FINAL = frozenset({S.cancelled, S.superseded})
# Hold and cancel apply to every open state; completed, approved and rejected are closed.
OPEN = frozenset({S.not_started, S.ready, S.in_progress, S.submitted, S.under_review, S.rework, S.blocked})

TRANSITIONS: dict[tuple[State, Action], State] = {
    (S.not_started, A.make_ready): S.ready,
    (S.not_started, A.block): S.blocked,
    (S.ready, A.start): S.in_progress,
    (S.ready, A.block): S.blocked,
    (S.in_progress, A.submit): S.submitted,
    (S.in_progress, A.complete): S.completed,  # an activity with no review step
    (S.in_progress, A.block): S.blocked,
    (S.submitted, A.begin_review): S.under_review,
    (S.under_review, A.approve): S.approved,
    (S.under_review, A.request_rework): S.rework,
    (S.under_review, A.reject): S.rejected,
    (S.rework, A.start): S.in_progress,
    (S.approved, A.complete): S.completed,
    (S.blocked, A.unblock): S.ready,
    (S.on_hold, A.resume): S.ready,
    (S.on_hold, A.cancel): S.cancelled,
    (S.approved, A.supersede): S.superseded,
    (S.completed, A.supersede): S.superseded,
    (S.rejected, A.supersede): S.superseded,
    **{(s, A.hold): S.on_hold for s in OPEN},
    **{(s, A.cancel): S.cancelled for s in OPEN},
}

NEEDS_COMMENT = frozenset({A.request_rework, A.reject})


def allowed(state: State) -> list[Action]:
    return [a for (s, a) in TRANSITIONS if s == state]


def transition(state: State | str, action: Action | str, comment: str | None = None) -> State:
    """The state after the action, or IllegalTransition. Rework and Reject raise CommentRequired without one."""
    state, action = State(state), Action(action)
    nxt = TRANSITIONS.get((state, action))
    if nxt is None:
        raise IllegalTransition(f"Can't {action.value.replace('_', ' ')} an activity that is {state.value}")
    if action in NEEDS_COMMENT and not (comment or "").strip():
        raise CommentRequired(f"{action.value.replace('_', ' ').capitalize()} needs a comment")
    return nxt


def from_stored(stored: str, engine_state: str | None = None) -> State:
    """Today's ProjectStage.status (and the stage engine's view of an active stage) as an activity state."""
    if stored == "locked":
        return S.not_started
    if stored in ("completed", "historical"):
        return S.completed
    if stored == "active":
        return S.blocked if engine_state == "blocked" else S.in_progress
    raise ValueError(f"Unknown stored stage status: {stored}")
