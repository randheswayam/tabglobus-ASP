"""In-process domain events: synchronous, in the caller's transaction, handlers in registration order."""

import pytest

from app.models import Project, ProjectStage, StageStatus
from app.modules.workflow import events
from app.services import stages


@pytest.fixture
def recorded():
    seen = []

    def one(db, **payload):
        seen.append(("one", payload["stage"]["key"]))

    def two(db, **payload):
        seen.append(("two", payload["stage"]["key"]))

    events.subscribe("stage.completed", one)
    events.subscribe("stage.completed", two)
    yield seen
    events.unsubscribe("stage.completed", one)
    events.unsubscribe("stage.completed", two)


def test_handlers_run_in_registration_order(recorded, db):
    events.publish(db, "stage.completed", project=None, stage={"key": "setup"}, actor=None)
    assert recorded == [("one", "setup"), ("two", "setup")]


def test_publishing_an_event_nobody_listens_to_is_fine(db):
    events.publish(db, "nobody.listens", x=1)


def test_completing_a_stage_publishes_completed_then_activated(client, auth_headers, new_project, db):
    seen = []

    def on_any(kind):
        return lambda db, **p: seen.append((kind, p["stage"]["key"]))

    done, opened = on_any("completed"), on_any("activated")
    events.subscribe("stage.completed", done)
    events.subscribe("stage.activated", opened)
    try:
        pid = new_project()["id"]
        seen.clear()
        client.post(f"/projects/{pid}/stages/setup/complete", json={"note": "ok"}, headers=auth_headers("architect"))
        assert seen == [("completed", "setup"), ("activated", "discovery")]
    finally:
        events.unsubscribe("stage.completed", done)
        events.unsubscribe("stage.activated", opened)


def test_a_failing_handler_rolls_back_the_whole_change(new_project, users, db):
    pid = new_project()["id"]

    def boom(db, **payload):
        raise RuntimeError("handler failed")

    events.subscribe("stage.completed", boom)
    try:
        with pytest.raises(RuntimeError):
            stages.complete(db, db.get(Project, pid), "setup", users["architect"], "note")
        db.rollback()
    finally:
        events.unsubscribe("stage.completed", boom)
    row = db.query(ProjectStage).filter_by(project_id=pid, key="setup").one()
    assert row.status == StageStatus.active and row.completion_note is None


def test_stage_ready_notification_comes_from_a_subscriber():
    import inspect

    from app.services import notify

    assert notify.on_stage_activated in events.subscribers("stage.activated")
    assert "notify.stage_ready" not in inspect.getsource(stages)
