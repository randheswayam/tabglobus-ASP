"""The Architect's dashboard (plan section 5): four panels and filters, scoped by project visibility."""

import pytest

from tests.conftest import valid_visit

# Onboarded at Site line-out, so the site-visit loop is open (v3 construction gate).
IN_CONSTRUCTION = {"start_stage": "line_out", "historical_confirmed_by": "Parvez"}

CRITICAL = {
    **valid_visit()["problems"][0],
    "category": "Structural",
    "problem": "Honeycombing in concrete",
    "severity": "Critical",
    "location": "Column C4",
    "target_date": "2026-11-30",
}


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
        client.patch(
            f"/projects/{pid}/legal",
            headers=admin,
            json={
                "status": "Applied",
                "authority_name": "PMC",
                "application_reference": f"BP-{pid}",
                "application_date": "2026-09-01",
            },
        )
        client.patch(
            f"/projects/{pid}/legal",
            headers=admin,
            json={"status": "Approved", "approval_date": "2026-09-20", "document_reference": f"doc://bp-{pid}"},
        )

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

    other = m.User(
        name="Sana Kulkarni",
        email="sana@siteflow.local",
        role=m.Role.civil_engineer,
        password_hash=hash_password(TEST_PASSWORD),
    )
    db.add(other)
    db.commit()

    a = new_project("Aundh Villa", location="Aundh, Pune", **IN_CONSTRUCTION)
    approve_legal(a["id"])
    approve(submit(a["id"])["id"])

    b = new_project("Baner Heights", location="Baner, Pune", legal_expected_date="2026-09-01")

    c = new_project("Kothrud House", location="Kothrud, Pune", **IN_CONSTRUCTION)
    approve_legal(c["id"])
    submit(
        c["id"],
        current_stage="Superstructure",
        checklist={"sup-columns": "Done", "sup-beams": "Done", "sup-slab": "Not started", "sup-curing": "Not started"},
        problems=[CRITICAL],
    )

    d = new_project("Deccan Row House", location="Deccan, Pune", civil_engineer_id=other.id, **IN_CONSTRUCTION)
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


# ---------- Task 12: filters ----------

ALL = {"Aundh Villa", "Baner Heights", "Kothrud House", "Deccan Row House"}


@pytest.mark.parametrize(
    "params,expected",
    [
        ({"q": "VILLA"}, {"Aundh Villa"}),
        ({"location": "kothrud"}, {"Kothrud House"}),
        ({"step": "Legal Approval"}, {"Baner Heights"}),
        ({"step": "Site Visit"}, {"Aundh Villa", "Deccan Row House"}),
        ({"step": "Team Lead Review"}, {"Kothrud House"}),
        ({"red_flag": "true"}, {"Aundh Villa", "Baner Heights"}),
        ({"red_flag": "false"}, {"Kothrud House", "Deccan Row House"}),
        ({"severity": "High"}, {"Aundh Villa"}),
        ({"severity": "Critical"}, set()),  # Kothrud's Critical problem is not approved yet, so it is not an open item
        ({"category": "Water"}, {"Aundh Villa"}),
        ({"progress_min": "10"}, {"Aundh Villa"}),
        ({"progress_max": "10"}, {"Baner Heights", "Kothrud House", "Deccan Row House"}),
        ({"progress_min": "0", "progress_max": "100"}, ALL),
        ({"visit_to": "2026-09-01"}, set()),
        ({"red_flag": "true", "location": "baner"}, {"Baner Heights"}),
    ],
)
def test_filters_narrow_all_projects(client, auth_headers, portfolio, params, expected):
    assert {p["name"] for p in _dash(client, auth_headers("architect"), **params)["all_projects"]} == expected


def test_engineer_filter(client, auth_headers, portfolio):
    rows = _dash(client, auth_headers("architect"), engineer_id=portfolio["other_engineer"].id)["all_projects"]
    assert [p["name"] for p in rows] == ["Deccan Row House"]


def test_visit_date_range_uses_the_last_approved_visit(client, auth_headers, portfolio):
    from datetime import date, timedelta

    today = date.today().isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    assert {p["name"] for p in _dash(client, auth_headers("architect"), visit_from=today)["all_projects"]} == {
        "Aundh Villa"
    }
    assert _dash(client, auth_headers("architect"), visit_from=tomorrow)["all_projects"] == []


def test_filters_apply_to_every_panel(client, auth_headers, portfolio):
    d = _dash(client, auth_headers("team_lead"), location="aundh")
    assert [p["name"] for p in d["needs_attention"]] == ["Aundh Villa"]
    assert [p["project"]["name"] for p in d["major_problems"]] == ["Aundh Villa"]
    assert d["review_queue"] == []
    assert _dash(client, auth_headers("team_lead"), category="Structural")["major_problems"] == []


@pytest.mark.parametrize(
    "params",
    [
        {"step": "Roofing"},
        {"severity": "Severe"},
        {"category": "Termites"},
        {"progress_min": "120"},
        {"progress_min": "50", "progress_max": "10"},
        {"visit_from": "yesterday"},
        {"red_flag": "maybe"},
        {"visit_from": "2026-10-10", "visit_to": "2026-10-01"},
    ],
)
def test_invalid_filters_are_422(client, auth_headers, portfolio, params):
    assert client.get("/dashboard", params=params, headers=auth_headers("architect")).status_code == 422


# ---------- v3: phase, client and waiting for client ----------

from app import models as m  # noqa: E402
from tests.test_signoffs import PDF  # noqa: E402


@pytest.fixture
def waiting(client, auth_headers, new_project, client_user, db):
    """Stage 4 package sent to Mr. Gokhale three days ago, on 'Shinde Bungalow'."""
    from datetime import UTC, datetime, timedelta

    arch = auth_headers("architect")
    pid = new_project(
        "Shinde Bungalow", location="Wakad, Pune", start_stage="requirements_signoff", historical_confirmed_by="Parvez"
    )["id"]
    db.add(m.ProjectMember(project_id=pid, user_id=client_user.id))
    db.commit()
    sid = client.post(
        f"/projects/{pid}/signoffs",
        headers=arch,
        json={"stage_key": "requirements_signoff", "title": "Baseline", "summary": "Scope"},
    ).json()["id"]
    client.post(f"/signoffs/{sid}/attachments", headers=arch, files={"file": ("B.pdf", PDF, "application/pdf")})
    client.post(f"/signoffs/{sid}/send", headers=arch)
    req = db.get(m.SignoffRequest, sid)
    req.sent_at = datetime.now(UTC) - timedelta(days=3)
    db.commit()
    return pid


def test_rows_show_phase_stage_and_client(client, auth_headers, portfolio, waiting):
    rows = {r["name"]: r for r in _dash(client, auth_headers("architect"))["all_projects"]}
    s = rows["Shinde Bungalow"]
    assert s["phase"] == {"number": 1, "name": "Initiation and requirements", "icon": "folder"}
    assert s["current_stages"] == ["Client sign-off: preliminary requirements"]
    assert s["stage_progress"]["done"] == 3 and s["client"] == "Mr. Gokhale"
    assert s["waiting_for_client"]["stage"] == "Client sign-off: preliminary requirements"
    assert s["waiting_for_client"]["version"] == 1 and s["waiting_for_client"]["days_waiting"] == 3
    a = rows["Aundh Villa"]
    assert a["phase"]["name"] == "Construction execution" and a["client"] is None and a["waiting_for_client"] is None


def test_waiting_for_client_panel_and_filters(client, auth_headers, portfolio, waiting):
    d = _dash(client, auth_headers("team_lead"))
    assert [r["name"] for r in d["waiting_for_client"]] == ["Shinde Bungalow"]
    assert {r["name"] for r in _dash(client, auth_headers("team_lead"), client_pending="true")["all_projects"]} == {
        "Shinde Bungalow"
    }
    assert "Shinde Bungalow" not in {
        r["name"] for r in _dash(client, auth_headers("team_lead"), client_pending="false")["all_projects"]
    }
    assert {r["name"] for r in _dash(client, auth_headers("team_lead"), phase="1")["all_projects"]} == {
        "Shinde Bungalow",
        "Baner Heights",
    }


@pytest.mark.parametrize("params", [{"phase": "0"}, {"phase": "11"}, {"phase": "two"}, {"client_pending": "maybe"}])
def test_invalid_v3_filters(client, auth_headers, portfolio, params):
    assert client.get("/dashboard", params=params, headers=auth_headers("architect")).status_code == 422
