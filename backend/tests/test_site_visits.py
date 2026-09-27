import pytest

from tests.conftest import TEST_PASSWORD, valid_visit


@pytest.fixture
def submit(client, auth_headers, ready_project, evidence):
    eng = auth_headers("civil_engineer")
    evidence(ready_project["id"])  # photos for the open visit; the evidence rules have their own tests

    def _submit(body: dict, headers: dict | None = None, project_id: int | None = None):
        pid = project_id or ready_project["id"]
        return client.post(f"/projects/{pid}/site-visits", json=body, headers=headers or eng)

    _submit.project_id = ready_project["id"]
    return _submit


def _missing(r) -> list[str]:
    assert r.status_code == 422, r.text
    return r.json()["detail"]["missing"]


def _invalid(r) -> list[str]:
    assert r.status_code == 422, r.text
    return r.json()["detail"]["invalid"]


def test_valid_submission_moves_to_review(submit, client, auth_headers):
    r = submit(valid_visit())
    assert r.status_code == 201, r.text
    v = r.json()
    assert v["status"] == "submitted"
    assert v["submission_count"] == 1
    # Foundation 12.5 + Plinth 1 of 3 Done x 12.5 = 16.666 -> 16.7
    assert v["computed_progress"] == 16.7
    assert v["problems"][0]["problem"] == "Seepage or dampness"

    p = client.get(f"/projects/{submit.project_id}", headers=auth_headers("civil_engineer")).json()
    assert [s["status"] for s in p["steps"]] == ["completed", "completed", "active"]
    assert p["official_progress"] == 0  # only approval makes progress official
    assert p["latest_visit"]["status"] == "submitted"
    assert [e["action"] for e in p["audit"][-3:]] == ["site_visit.submitted", "step.completed", "step.activated"]
    assert p["audit"][-3]["detail"]["computed_progress"] == 16.7


def test_empty_submission_lists_every_missing_field(submit):
    missing = _missing(submit({}))
    assert set(missing) == {
        "visit_at",
        "location",
        "weather",
        "attendees",
        "current_stage",
        "problems",
        "summary",
        "recommended_action",
    }


def test_blank_strings_count_as_missing(submit):
    missing = _missing(submit(valid_visit(weather="  ", summary="")))
    assert set(missing) == {"weather", "summary"}


def test_location_needs_gps_or_manual(submit):
    assert "location" in _missing(submit(valid_visit(location={"gps": None, "manual": " "})))
    r = submit(valid_visit(location={"gps": None, "manual": "Plot 14, Baner"}))
    assert r.status_code == 201


def test_gps_out_of_range_is_invalid(submit):
    assert "location.gps" in _invalid(submit(valid_visit(location={"gps": {"lat": 120, "lng": 0}})))


def test_every_checklist_item_needs_a_state(submit):
    missing = _missing(submit(valid_visit(checklist={"pln-beam": "Done"})))
    assert set(missing) == {"checklist.pln-filling", "checklist.pln-dpc"}


def test_checklist_rejects_unknown_items_and_states(submit):
    body = valid_visit(checklist={"pln-beam": "Finished", "pln-filling": "Done", "pln-dpc": "Done", "fdn-pcc": "Done"})
    assert set(_invalid(submit(body))) == {"checklist.pln-beam", "checklist.fdn-pcc"}


def test_unknown_stage_is_invalid(submit):
    assert "current_stage" in _invalid(submit(valid_visit(current_stage="Roofing", checklist={})))


def test_no_issues_is_an_explicit_choice(submit):
    r = submit(valid_visit(no_issues=True, problems=[]))
    assert r.status_code == 201
    assert r.json()["no_issues"] is True


def test_no_issues_and_problems_together_is_invalid(submit):
    assert "no_issues" in _invalid(submit(valid_visit(no_issues=True)))


def test_each_problem_needs_severity_location_party_and_date(submit):
    problem = {"category": "Water", "problem": "Seepage or dampness"}
    missing = _missing(submit(valid_visit(problems=[problem])))
    assert set(missing) == {
        "problems[0].severity",
        "problems[0].location",
        "problems[0].responsible_party",
        "problems[0].target_date",
    }


def test_problem_must_come_from_config_list(submit):
    base = valid_visit()["problems"][0]
    bad = [{**base, "category": "Roofing"}, {**base, "problem": "Termites"}, {**base, "severity": "Severe"}]
    invalid = _invalid(submit(valid_visit(problems=bad)))
    assert set(invalid) == {"problems[0].category", "problems[1].problem", "problems[2].severity"}


def test_other_problem_needs_free_text(submit):
    base = valid_visit()["problems"][0]
    other = {**base, "category": "Other", "problem": None, "other_text": ""}
    assert "problems[0].other_text" in _missing(submit(valid_visit(problems=[other])))
    other["other_text"] = "Neighbouring wall leaning onto site"
    assert submit(valid_visit(problems=[other])).status_code == 201


@pytest.mark.parametrize("role", ["architect", "team_lead", "admin"])
def test_only_civil_engineer_can_submit(submit, auth_headers, role):
    assert submit(valid_visit(), headers=auth_headers(role)).status_code == 403


def test_unassigned_engineer_gets_404(submit, client, db):
    from app import models as m
    from app.passwords import hash_password

    db.add(
        m.User(
            name="Other Eng",
            email="other@siteflow.local",
            role=m.Role.civil_engineer,
            password_hash=hash_password(TEST_PASSWORD),
        )
    )
    db.commit()
    token = client.post("/auth/login", json={"email": "other@siteflow.local", "password": TEST_PASSWORD}).json()
    r = submit(valid_visit(), headers={"Authorization": f"Bearer {token['access_token']}"})
    assert r.status_code == 404


def test_step2_must_be_active(client, auth_headers, new_project):
    p = new_project()  # Legal Approval not done yet
    r = client.post(f"/projects/{p['id']}/site-visits", json=valid_visit(), headers=auth_headers("civil_engineer"))
    assert r.status_code == 409


def test_cannot_submit_twice_while_waiting_for_review(submit):
    assert submit(valid_visit()).status_code == 201
    assert submit(valid_visit()).status_code == 409


def test_resubmitting_a_rework_visit_increments_count(submit, db):
    from app import models as m
    from app.services import workflow

    first = submit(valid_visit()).json()
    # Simulate Parvez's rework decision (the review endpoint arrives in Task 8).
    visit = db.get(m.SiteVisit, first["id"])
    project = db.get(m.Project, visit.project_id)
    lead = db.query(m.User).filter_by(role=m.Role.team_lead).one()
    visit.status = m.VisitStatus.rework
    workflow.lock(db, project, workflow.REVIEW, lead)
    workflow.activate(db, project, workflow.SITE_VISIT, lead)
    db.commit()

    r = submit(valid_visit(checklist={"pln-beam": "Done", "pln-filling": "Done", "pln-dpc": "Not started"}))
    assert r.status_code == 201, r.text
    again = r.json()
    assert len(again["media"]) == 5  # the rework visit keeps its photos
    assert again["id"] == first["id"]
    assert again["submission_count"] == 2
    assert again["computed_progress"] == 20.8  # 12.5 + 2/3 x 12.5 = 20.83


def test_get_visit_returns_full_submission(submit, client, auth_headers):
    v = submit(valid_visit()).json()
    for role in ("team_lead", "civil_engineer", "architect"):
        r = client.get(f"/site-visits/{v['id']}", headers=auth_headers(role))
        assert r.status_code == 200
        body = r.json()
        assert body["form"]["weather"] == "Clear"
        assert body["checklist"]["pln-beam"] == "Done"
        assert body["current_stage"] == "Plinth"
        assert body["engineer"]["name"] == "Farhan Shaikh"
        assert body["project"]["id"] == submit.project_id
    assert client.get("/site-visits/9999", headers=auth_headers("team_lead")).status_code == 404


# ---------- evidence rules (v2) ----------


@pytest.fixture
def bare(client, auth_headers, ready_project):
    """Submit with no photos arranged in advance."""

    def _post(body):
        return client.post(
            f"/projects/{ready_project['id']}/site-visits", json=body, headers=auth_headers("civil_engineer")
        )

    return _post


def test_minimum_photo_count_is_required(bare, upload, client, auth_headers, ready_project):
    assert "photos" in _missing(bare(valid_visit(no_issues=True, problems=[])))
    d = client.post(f"/projects/{ready_project['id']}/site-visits/draft", headers=auth_headers("civil_engineer")).json()
    for _ in range(4):
        upload(d["id"])
    assert "photos" in _missing(bare(valid_visit(no_issues=True, problems=[])))
    upload(d["id"])
    assert bare(valid_visit(no_issues=True, problems=[])).status_code == 201


def test_videos_do_not_count_toward_the_photo_minimum(bare, upload, client, auth_headers, ready_project):
    from tests.conftest import MP4

    d = client.post(f"/projects/{ready_project['id']}/site-visits/draft", headers=auth_headers("civil_engineer")).json()
    for _ in range(4):
        upload(d["id"])
    upload(d["id"], kind="video", data=MP4, content_type="video/mp4")
    assert "photos" in _missing(bare(valid_visit(no_issues=True, problems=[])))


def test_high_and_critical_problems_need_their_own_photo(bare, evidence, ready_project):
    base = valid_visit()["problems"][0]
    problems = [base, {**base, "severity": "Critical"}, {**base, "severity": "Low"}]
    evidence(ready_project["id"], problem_refs=())  # five photos, none tagged to a problem
    missing = _missing(bare(valid_visit(problems=problems)))
    assert "problems[0].photo" in missing and "problems[1].photo" in missing
    assert "problems[2].photo" not in missing and "photos" not in missing
    evidence(ready_project["id"], problem_refs=(0, 1))
    assert bare(valid_visit(problems=problems)).status_code == 201


def test_template_exposes_media_limits(client, auth_headers):
    t = client.get("/template", headers=auth_headers("civil_engineer")).json()
    assert (t["min_photos"], t["max_photo_mb"], t["max_video_mb"]) == (5, 10, 100)


# ---------- construction-stage gate (v3) ----------


def _approve_legal(client, auth_headers, pid):
    admin = auth_headers("admin")
    client.patch(
        f"/projects/{pid}/legal",
        headers=admin,
        json={
            "status": "Applied",
            "authority_name": "PMC",
            "application_reference": "BP-7",
            "application_date": "2026-09-01",
        },
    )
    client.patch(
        f"/projects/{pid}/legal",
        headers=admin,
        json={"status": "Approved", "approval_date": "2026-09-20", "document_reference": "doc://bp-7"},
    )


def test_site_visits_wait_for_the_construction_stages(client, auth_headers, new_project):
    p = new_project(start_stage="grid", historical_confirmed_by="Parvez")  # still in structural design
    _approve_legal(client, auth_headers, p["id"])
    eng = auth_headers("civil_engineer")
    r = client.post(f"/projects/{p['id']}/site-visits/draft", headers=eng)
    assert r.status_code == 409
    assert "Site line-out" in r.json()["detail"]
    assert client.post(f"/projects/{p['id']}/site-visits", json=valid_visit(), headers=eng).status_code == 409


def test_first_approved_visit_completes_line_out_and_opens_construction(client, auth_headers, ready_project, evidence):
    eng, lead = auth_headers("civil_engineer"), auth_headers("team_lead")
    pid = ready_project["id"]
    evidence(pid)
    v = client.post(f"/projects/{pid}/site-visits", json=valid_visit(), headers=eng).json()
    client.post(f"/site-visits/{v['id']}/review", json={"decision": "approve"}, headers=lead)
    view = client.get(f"/projects/{pid}/stages", headers=lead).json()
    s = {x["key"]: x for p in view["phases"] for x in p["stages"]}
    assert s["line_out"]["state"] == "completed"
    assert s["line_out"]["completion_note"] == "Completed when the first construction visit was approved."
    assert s["construction"]["state"] == "active"
