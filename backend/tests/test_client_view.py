"""What a client sees of their own project. Every key in the response must be on the allow-list."""
import json

import pytest

from app import models as m
from app import stage_config as sc
from tests.conftest import valid_visit
from tests.test_signoffs import PDF

ALLOWED_KEYS = {
    # project card and detail
    "id", "name", "location", "phase", "number", "current_stages", "stage_progress", "done", "total",
    "official_progress", "waiting_for_you", "phases", "stages", "key", "label", "detail", "workstream", "state",
    "started_at", "completed_at", "historical", "is_signoff", "signed", "by", "at", "version", "signoffs",
    "shared_updates",
    # sign-off summaries (same shape as /client/signoffs)
    "project", "stage_key", "stage", "status", "title", "summary", "sent_at", "responded_at", "response_comment",
    "signer_name", "confirmation_text", "can_respond", "attachments", "filename", "content_type", "size",
    "uploaded_at", "viewed",
}
FORBIDDEN_TEXT = ["audit", "rework", "red_flag", "Critical issue", "problem", "Seepage", "completion_note",
                  "confirmed_by", "siteflow.local", "reasons", "legal"]


def _keys(obj, out=None):
    out = set() if out is None else out
    if isinstance(obj, dict):
        for k, v in obj.items():
            out.add(k)
            _keys(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _keys(v, out)
    return out


@pytest.fixture
def my_project(client, auth_headers, ready_project, client_user, evidence, db):
    """A project in construction with a rework, an approved visit with a High problem (so a red flag and an
    open problem exist internally), and the client as a member."""
    pid = ready_project["id"]
    db.add(m.ProjectMember(project_id=pid, user_id=client_user.id))
    db.commit()
    eng, lead = auth_headers("civil_engineer"), auth_headers("team_lead")
    evidence(pid)
    v = client.post(f"/projects/{pid}/site-visits", json=valid_visit(), headers=eng).json()
    client.post(f"/site-visits/{v['id']}/review", json={"decision": "rework", "comment": "Internal: redo photos"}, headers=lead)
    client.post(f"/projects/{pid}/site-visits", json=valid_visit(), headers=eng)
    client.post(f"/site-visits/{v['id']}/review", json={"decision": "approve"}, headers=lead)
    return pid


def test_client_lists_only_their_projects(client, client_headers, my_project, new_project):
    new_project("Someone else's villa")
    rows = client.get("/client/projects", headers=client_headers).json()
    assert [r["id"] for r in rows] == [my_project]
    card = rows[0]
    assert card["name"] == "Villa A" and card["official_progress"] == 16.7
    assert card["phase"]["name"] == "Construction execution" and card["current_stages"] == ["Construction quality stages"]
    assert card["waiting_for_you"] == 0


def test_project_detail_shows_the_phase_timeline(client, client_headers, my_project):
    d = client.get(f"/client/projects/{my_project}", headers=client_headers).json()
    assert [p["name"] for p in d["phases"]] == [p["name"] for p in sc.PHASES]
    stages = {s["key"]: s for p in d["phases"] for s in p["stages"]}
    assert stages["setup"]["state"] == "historical" and stages["setup"]["historical"] == "Completed before SiteFlow"
    assert stages["line_out"]["state"] == "completed" and stages["construction"]["state"] == "in_progress"
    assert stages["handover_signoff"]["state"] == "upcoming" and stages["handover_signoff"]["is_signoff"] is True
    assert stages["requirements_signoff"]["signed"] is None  # historical, never shown as signed by the client


def test_nothing_internal_reaches_the_client(client, client_headers, my_project):
    for path in ("/client/projects", f"/client/projects/{my_project}"):
        body = client.get(path, headers=client_headers).json()
        assert _keys(body) <= ALLOWED_KEYS, _keys(body) - ALLOWED_KEYS
        text = json.dumps(body)
        for word in FORBIDDEN_TEXT:
            assert word not in text, f"{word!r} leaked through {path}"


def test_signed_milestone_shows_who_signed(client, client_headers, auth_headers, new_project, client_user, db):
    arch = auth_headers("architect")
    pid = new_project(start_stage="requirements_signoff", historical_confirmed_by="Parvez")["id"]
    db.add(m.ProjectMember(project_id=pid, user_id=client_user.id))
    db.commit()
    sid = client.post(f"/projects/{pid}/signoffs", headers=arch, json={
        "stage_key": "requirements_signoff", "title": "Baseline", "summary": "Scope"}).json()["id"]
    aid = client.post(f"/signoffs/{sid}/attachments", headers=arch, files={"file": ("B.pdf", PDF, "application/pdf")}).json()["id"]
    client.post(f"/signoffs/{sid}/send", headers=arch)
    card = client.get("/client/projects", headers=client_headers).json()[0]
    assert card["waiting_for_you"] == 1
    client.get(f"/client/signoffs/{sid}/attachments/{aid}", headers=client_headers)
    client.post(f"/client/signoffs/{sid}/approve", json={"confirm": True, "signer_name": "Mr. Gokhale"}, headers=client_headers)
    d = client.get(f"/client/projects/{pid}", headers=client_headers).json()
    signed = next(s for p in d["phases"] for s in p["stages"] if s["key"] == "requirements_signoff")["signed"]
    assert signed["by"] == "Mr. Gokhale" and signed["version"] == 1 and signed["at"].endswith("+00:00")
    assert [s["status"] for s in d["signoffs"]] == ["approved"]
    assert _keys(d) <= ALLOWED_KEYS


def test_other_projects_are_404(client, client_headers, new_project):
    pid = new_project("Not mine")["id"]
    assert client.get(f"/client/projects/{pid}", headers=client_headers).status_code == 404


def test_staff_cannot_use_the_client_api(client, auth_headers, my_project):
    assert client.get("/client/projects", headers=auth_headers("architect")).status_code == 403
