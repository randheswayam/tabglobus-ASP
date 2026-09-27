"""Gate evaluators are registered by type; a stage's reasons are the reasons of all its gates, in order."""

import pytest

from app.modules.workflow import gates
from app.services.stages import GateFacts

OPEN = GateFacts(legal_status="Approved", open_major_problems=0, signoffs={})


def _stage(*gate_types, key="x"):
    return {"key": key, "gates": list(gate_types)}


def test_the_v3_gates_are_registered():
    assert {"client_signoff", "legal_approval", "no_open_major_problems"} <= set(gates.registered())


def test_reasons_of_each_gate_keep_their_wording():
    facts = GateFacts(legal_status="Applied", open_major_problems=2, signoffs={})
    assert gates.reasons(_stage("legal_approval"), facts) == ["Legal Approval is Applied, not Approved"]
    assert gates.reasons(_stage("no_open_major_problems"), facts) == ["2 open High or Critical problems"]
    assert gates.reasons(_stage("client_signoff"), facts) == ["Sign-off package not sent to the client yet"]


def test_a_stage_with_several_gates_lists_every_unmet_one_in_order():
    facts = GateFacts(legal_status="Applied", open_major_problems=1, signoffs={})
    stage = _stage("no_open_major_problems", "legal_approval")
    assert gates.reasons(stage, facts) == ["1 open High or Critical problem", "Legal Approval is Applied, not Approved"]
    assert gates.reasons(stage, OPEN) == []


def test_a_stage_without_gates_has_no_reasons():
    assert gates.reasons(_stage(), OPEN) == []


def test_unknown_gate_type_is_an_error():
    with pytest.raises(KeyError, match="no evaluator registered for gate 'teleport'"):
        gates.reasons(_stage("teleport"), OPEN)


def test_a_gate_type_can_be_registered_once():
    @gates.register("test_only_gate")
    def _always(stage, facts):
        return ["Always blocked"]

    try:
        assert gates.reasons(_stage("test_only_gate"), OPEN) == ["Always blocked"]
        with pytest.raises(ValueError):
            gates.register("test_only_gate")(_always)
    finally:
        gates.unregister("test_only_gate")
