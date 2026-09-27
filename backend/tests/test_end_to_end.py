"""Full v1 loop through the API: create, legal, submit, rework, resubmit, approve (plan T2 shape)."""

from tests.conftest import valid_visit, workflow_actions


def test_full_three_step_loop(client, users, auth_headers, evidence):
    architect, admin = auth_headers("architect"), auth_headers("admin")
    engineer, lead = auth_headers("civil_engineer"), auth_headers("team_lead")

    # Architect creates the project; only Legal Approval is open.
    p = client.post(
        "/projects",
        json={
            "name": "Deshmukh Residence",
            "location": "Kothrud, Pune",
            "civil_engineer_id": users["civil_engineer"].id,
            "legal_expected_date": "2026-10-31",
            "start_stage": "line_out",
            "historical_confirmed_by": "Parvez",
        },
        headers=architect,
    ).json()
    pid = p["id"]
    assert p["current_step"] == "Legal Approval"
    assert client.post(f"/projects/{pid}/site-visits", json=valid_visit(), headers=engineer).status_code == 409

    # Admin records the application, then the approval with its document.
    assert (
        client.patch(
            f"/projects/{pid}/legal",
            headers=admin,
            json={
                "status": "Applied",
                "authority_name": "Pune Municipal Corporation",
                "application_reference": "PMC/BP/2026/0200",
                "application_date": "2026-09-02",
            },
        ).status_code
        == 200
    )
    p = client.patch(
        f"/projects/{pid}/legal",
        headers=admin,
        json={"status": "Approved", "approval_date": "2026-09-22", "document_reference": "doc://pmc-0200.pdf"},
    ).json()
    assert p["current_step"] == "Site Visit"

    # Engineer photographs the site, then submits the first visit.
    evidence(pid)
    v = client.post(f"/projects/{pid}/site-visits", json=valid_visit(), headers=engineer).json()
    assert v["status"] == "submitted" and v["computed_progress"] == 16.7

    # Parvez sends it back.
    [queued] = client.get("/reviews/queue", headers=lead).json()
    assert queued["id"] == v["id"]
    r = client.post(
        f"/site-visits/{v['id']}/review",
        headers=lead,
        json={"decision": "rework", "comment": "Recheck plinth filling."},
    )
    assert r.json()["status"] == "rework"
    p = client.get(f"/projects/{pid}", headers=engineer).json()
    assert p["latest_visit"]["rework_comment"] == "Recheck plinth filling."
    assert client.get("/reviews/queue", headers=lead).json() == []

    # Engineer resubmits with filling done.
    fixed = valid_visit(checklist={"pln-beam": "Done", "pln-filling": "Done", "pln-dpc": "Not started"})
    v2 = client.post(f"/projects/{pid}/site-visits", json=fixed, headers=engineer).json()
    assert v2["id"] == v["id"] and v2["submission_count"] == 2 and v2["computed_progress"] == 20.8

    # Parvez approves; progress becomes official for everyone.
    r = client.post(f"/site-visits/{v['id']}/review", headers=lead, json={"decision": "approve"})
    assert r.json()["status"] == "approved"
    for headers in (architect, lead, engineer, admin):
        p = client.get(f"/projects/{pid}", headers=headers).json()
        assert p["official_progress"] == 20.8
        assert [s["status"] for s in p["steps"]] == ["completed", "active", "locked"]  # next visit open

    assert [e["action"] for e in p["audit"]].count("media.added") == 5  # the photos taken for the first visit
    actions = workflow_actions(p["audit"])
    assert actions == [
        "project.created",
        "legal.updated",
        "legal.updated",
        "step.completed",
        "step.activated",
        "site_visit.submitted",
        "step.completed",
        "step.activated",
        "site_visit.rework_requested",
        "step.locked",
        "step.activated",
        "site_visit.submitted",
        "step.completed",
        "step.activated",
        "site_visit.approved",
        "step.completed",
        "step.activated",
        "step.locked",
    ]
