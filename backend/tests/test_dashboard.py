"""The Architect's dashboard (plan section 5): four panels and filters, scoped by project visibility."""
import pytest

from tests.conftest import valid_visit

CRITICAL = {**valid_visit()["problems"][0], "category": "Structural", "problem": "Honeycombing in concrete",
            "severity": "Critical", "location": "Column C4", "target_date": "2026-11-30"}


@pytest.fixture
def portfolio(client, users, auth_headers, new_project, evidence, db):
    """Four projects in different states:
    A Plinth, approved with a High problem (Critical issue flag)
    B Legal Approval overdue (Legal delay flag)
    C Superstructure visit submitted, waiting for Parvez
    D approved, no issues, healthy
    """
    from app import models as m

    admin, eng, lead = auth_headers("admin"), auth_headers("civil_engineer"), auth_headers("team_lead")

    def approve_legal(pid):
        client.patch(f"/projects/{pid}/legal", headers=admin, json={"status": "Applied", "authority_name": "PMC",
                     "application_reference": f"BP-{pid}", "application_date": "2026-09-01"})
        client.patch(f"/projects/{pid}/legal", headers=admin, json={"status": "Approved", "approval_date": "2026-09-20",
                     "document_reference": f"doc://bp-{pid}"})

    def submit(pid, refs=(0,), **kw):
        evidence(pid, problem_refs=refs)
        r = client.post(f"/projects/{pid}/site-visits", json=valid_visit(**kw), headers=eng)
        assert r.status_code == 201, r.text
        return r.json()

    def approve(vid):
        assert client.post(f"/site-visits/{vid}/review", json={"decision": "approve"}, headers=lead).status_code == 200

    # A second engineer, so the engineer filter has something to tell apart.
    from app.passwords import hash_password
    from tests.conftest import TEST_PASSWORD
    other = m.User(name="Sana Kulkarni", email="sana@siteflow.local", role=m.Role.civil_engineer,
                   password_hash=hash_password(TEST_PASSWORD))
    db.add(other)
    db.commit()

    a = new_project("Aundh Villa", location="Aundh, Pune")
    approve_legal(a["id"])
    approve(submit(a["id"])["id"])

    b = new_project("Baner Heights", location="Baner, Pune", legal_expected_date="2026-09-01")

    c = new_project("Kothrud House", location="Kothrud, Pune")
    approve_legal(c["id"])
    submit(c["id"], current_stage="Superstructure",
           checklist={"sup-columns": "Done", "sup-beams": "Done", "sup-slab": "Not started", "sup-curing": "Not started"},
           problems=[CRITICAL])

    d = new_project("Deccan Row House", location="Deccan, Pune", civil_engineer_id=other.id)
    approve_legal(d["id"])
    return {"A": a["id"], "B": b["id"], "C": c["id"], "D": d["id"], "other_engineer": other}


def _dash(client, headers, **params):
    r = client.get("/dashboard", params=params, headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_all_projects_panel(client, auth_headers, portfolio):
    rows = {p["name"]: p for p in _dash(client, auth_headers("architect"))["all_projects"]}
    assert set(rows) == {"Aundh Villa", "Baner Heights", "Kothrud House", "Deccan Row House"}
    a = rows["Aundh Villa"]
    assert a["current_step"] == "Site Visit" and a["official_progress"] == 16.7
    assert a["open_problems"] == 1 and a["red_flags"] == 1 and a["flag_labels"] == ["Critical issue"]
    assert a["last_visit_at"].endswith("+00:00")
    assert rows["Kothrud House"]["current_step"] == "Team Lead Review" and rows["Kothrud House"]["open_problems"] == 0
    assert rows["Deccan Row House"]["red_flags"] == 0 and rows["Deccan Row House"]["last_visit_at"] is None
    assert rows["Deccan Row House"]["civil_engineer"]["name"] == "Sana Kulkarni"


def test_needs_attention_sorted_by_severity(client, auth_headers, portfolio):
    attention = _dash(client, auth_headers("architect"))["needs_attention"]
    assert [p["name"] for p in attention] == ["Aundh Villa", "Baner Heights"]  # Critical issue ranks above Legal delay
    assert attention[0]["flags"][0]["label"] == "Critical issue"
    assert attention[1]["flags"][0]["rule"] == "legal_delay"


def test_major_problems_are_open_high_and_critical(client, auth_headers, portfolio):
    problems = _dash(client, auth_headers("architect"))["major_problems"]
    assert [(p["project"]["name"], p["severity"]) for p in problems] == [("Aundh Villa", "High")]
    assert problems[0]["responsible_party"] == "Contractor"
    assert isinstance(problems[0]["photo_id"], int)  # the photo tagged to the problem


def test_review_queue_panel(client, auth_headers, portfolio):
    queue = _dash(client, auth_headers("team_lead"))["review_queue"]
    assert [v["project"]["name"] for v in queue] == ["Kothrud House"]
    assert queue[0]["waiting_minutes"] >= 0


def test_engineer_sees_only_their_projects(client, auth_headers, portfolio):
    names = {p["name"] for p in _dash(client, auth_headers("civil_engineer"))["all_projects"]}
    assert names == {"Aundh Villa", "Baner Heights", "Kothrud House"}


def test_dashboard_needs_sign_in(client):
    assert client.get("/dashboard").status_code == 401
