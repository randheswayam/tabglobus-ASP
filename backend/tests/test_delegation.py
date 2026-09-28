"""Approval delegation: a Team Lead lends site-visit review to another staff user for a date range. The delegate may
review only while the range is active (business timezone) and never beyond the delegator's authority."""

from datetime import UTC, date, datetime, timedelta

import pytest

from app.clock import business_date
from app.models import AuditEvent
from tests.conftest import valid_visit


def _today() -> date:
    return business_date(datetime.now(UTC))


def _delegate(
    client, auth_headers, users, *, role="team_lead", to="architect", start=0, end=3, reason="Parvez on leave"
):
    return client.post(
        "/delegations",
        json={
            "delegate_id": users[to].id,
            "start_date": (_today() + timedelta(days=start)).isoformat(),
            "end_date": (_today() + timedelta(days=end)).isoformat(),
            "reason": reason,
        },
        headers=auth_headers(role),
    )


@pytest.fixture
def submitted(client, auth_headers, ready_project, evidence):
    pid = ready_project["id"]
    evidence(pid)
    r = client.post(f"/projects/{pid}/site-visits", json=valid_visit(), headers=auth_headers("civil_engineer"))
    assert r.status_code in (200, 201), r.text
    return r.json()["id"]


def _review(client, auth_headers, vid, role="architect"):
    return client.post(f"/site-visits/{vid}/review", json={"decision": "approve"}, headers=auth_headers(role))


def test_an_active_delegate_reviews_and_the_audit_names_both(client, auth_headers, users, submitted, db):
    r = _delegate(client, auth_headers, users)
    assert r.status_code == 201, r.text
    assert r.json()["delegate"]["name"] == users["architect"].name
    assert r.json()["delegator"]["name"] == "Parvez"
    assert db.query(AuditEvent).filter_by(action="delegation.created").count() == 1

    assert _review(client, auth_headers, submitted).status_code == 200
    ev = db.query(AuditEvent).filter_by(action="site_visit.approved").one()
    assert ev.actor_id == users["architect"].id
    assert ev.detail["on_behalf_of"]["name"] == "Parvez"
    assert ev.detail["delegation_id"] == r.json()["id"]


def test_the_delegate_sees_the_review_queue_while_active(client, auth_headers, users, submitted):
    assert client.get("/reviews/queue", headers=auth_headers("architect")).status_code == 403
    _delegate(client, auth_headers, users)
    q = client.get("/reviews/queue", headers=auth_headers("architect"))
    assert q.status_code == 200 and [v["id"] for v in q.json()] == [submitted]


def test_without_a_delegation_the_architect_cannot_review(client, auth_headers, submitted):
    assert _review(client, auth_headers, submitted).status_code == 403


def test_an_expired_delegation_is_refused(client, auth_headers, users, submitted):
    assert _delegate(client, auth_headers, users, start=-5, end=-1).status_code == 201
    assert _review(client, auth_headers, submitted).status_code == 403


def test_a_future_delegation_is_not_yet_active(client, auth_headers, users, submitted):
    assert _delegate(client, auth_headers, users, start=2, end=4).status_code == 201
    assert _review(client, auth_headers, submitted).status_code == 403


def test_the_end_date_is_inclusive(client, auth_headers, users, submitted):
    _delegate(client, auth_headers, users, start=-3, end=0)
    assert _review(client, auth_headers, submitted).status_code == 200


@pytest.mark.parametrize("role", ["civil_engineer", "architect", "admin", "accounts"])
def test_nobody_can_delegate_authority_they_lack(client, auth_headers, users, role):
    to = "team_lead" if role != "team_lead" else "architect"
    assert _delegate(client, auth_headers, users, role=role, to=to).status_code == 403


def test_a_delegation_ends_if_the_delegator_loses_the_authority(client, auth_headers, users, submitted):
    _delegate(client, auth_headers, users)
    client.patch(f"/admin/users/{users['team_lead'].id}", json={"role": "architect"}, headers=auth_headers("admin"))
    assert _review(client, auth_headers, submitted).status_code == 403


@pytest.mark.parametrize(
    "change",
    [
        {"reason": "  "},
        {"start": 3, "end": 1},
        {"end": 400},  # longer than DELEGATION_MAX_DAYS
    ],
)
def test_invalid_delegations_are_422(client, auth_headers, users, change):
    assert _delegate(client, auth_headers, users, **change).status_code == 422


def test_not_to_yourself_a_client_or_an_inactive_user(client, auth_headers, users, client_user):
    lead = auth_headers("team_lead")
    today = _today().isoformat()
    body = {"start_date": today, "end_date": today, "reason": "Leave"}
    assert (
        client.post("/delegations", json={**body, "delegate_id": users["team_lead"].id}, headers=lead).status_code
        == 422
    )
    assert client.post("/delegations", json={**body, "delegate_id": client_user.id}, headers=lead).status_code == 422
    client.patch(f"/admin/users/{users['accounts'].id}", json={"active": False}, headers=auth_headers("admin"))
    assert (
        client.post("/delegations", json={**body, "delegate_id": users["accounts"].id}, headers=lead).status_code == 422
    )
    assert client.post("/delegations", json={**body, "delegate_id": 99999}, headers=lead).status_code == 422


def test_both_people_list_the_delegation(client, auth_headers, users):
    _delegate(client, auth_headers, users)
    for role in ("team_lead", "architect"):
        got = client.get("/delegations", headers=auth_headers(role)).json()
        assert len(got) == 1 and got[0]["scope"] == "site_visit_review" and got[0]["active"] is True
    assert client.get("/delegations", headers=auth_headers("civil_engineer")).json() == []
