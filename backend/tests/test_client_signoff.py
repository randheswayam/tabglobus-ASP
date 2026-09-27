"""The client reviews a sign-off package in the customer app, then approves it or asks for changes."""
import pytest

from app import models as m
from app import workflow_config as wc
from tests.conftest import PNG
from tests.test_signoffs import PDF


@pytest.fixture
def sent(client, auth_headers, new_project, client_user, db):
    """Version 1 of the requirements sign-off, sent to Mr. Gokhale with two documents."""
    arch = auth_headers("architect")
    pid = new_project(start_stage="requirements_signoff", historical_confirmed_by="Parvez")["id"]
    db.add(m.ProjectMember(project_id=pid, user_id=client_user.id))
    db.commit()
    sid = client.post(f"/projects/{pid}/signoffs", headers=arch, json={
        "stage_key": "requirements_signoff", "title": "Requirements baseline v1", "summary": "4 BHK with courtyard."}).json()["id"]
    a1 = client.post(f"/signoffs/{sid}/attachments", headers=arch, files={"file": ("Baseline.pdf", PDF, "application/pdf")}).json()
    a2 = client.post(f"/signoffs/{sid}/attachments", headers=arch, files={"file": ("Sketch.png", PNG, "image/png")}).json()
    client.post(f"/signoffs/{sid}/send", headers=arch)
    return {"pid": pid, "sid": sid, "attachments": [a1["id"], a2["id"]]}


APPROVE = {"confirm": True, "signer_name": "mr. gokhale"}


def _view_all(client, client_headers, sent):
    for aid in sent["attachments"]:
        assert client.get(f"/client/signoffs/{sent['sid']}/attachments/{aid}", headers=client_headers).status_code == 200


def test_client_sees_the_package_and_the_confirmation_wording(client, client_headers, sent):
    r = client.get(f"/client/signoffs/{sent['sid']}", headers=client_headers)
    assert r.status_code == 200, r.text
    s = r.json()
    assert s["stage"] == "Client sign-off: preliminary requirements" and s["version"] == 1 and s["status"] == "sent"
    assert s["confirmation_text"] == wc.SIGNOFF_CONFIRMATION_TEXT and s["can_respond"] is True
    assert [a["viewed"] for a in s["attachments"]] == [False, False]
    assert "created_by" not in s and "fingerprint" not in s
    listing = client.get("/client/signoffs", headers=client_headers).json()
    assert [x["id"] for x in listing] == [sent["sid"]]


def test_opening_a_document_records_the_view(client, client_headers, sent, db):
    r = client.get(f"/client/signoffs/{sent['sid']}/attachments/{sent['attachments'][0]}", headers=client_headers)
    assert r.content == PDF and r.headers["content-type"] == "application/pdf"
    assert db.query(m.SignoffView).count() == 1
    s = client.get(f"/client/signoffs/{sent['sid']}", headers=client_headers).json()
    assert [a["viewed"] for a in s["attachments"]] == [True, False]


def test_approval_needs_every_document_opened(client, client_headers, sent):
    client.get(f"/client/signoffs/{sent['sid']}/attachments/{sent['attachments'][0]}", headers=client_headers)
    r = client.post(f"/client/signoffs/{sent['sid']}/approve", json=APPROVE, headers=client_headers)
    assert r.status_code == 422
    assert r.json()["detail"]["unviewed"] == ["Sketch.png"]


@pytest.mark.parametrize("body,field", [({"confirm": False, "signer_name": "Mr. Gokhale"}, "confirm"),
                                        ({"confirm": True, "signer_name": "Someone Else"}, "signer_name"),
                                        ({"confirm": True, "signer_name": " "}, "signer_name")])
def test_approval_needs_confirmation_and_the_clients_own_name(client, client_headers, sent, body, field):
    _view_all(client, client_headers, sent)
    r = client.post(f"/client/signoffs/{sent['sid']}/approve", json=body, headers=client_headers)
    assert r.status_code == 422 and field in (r.json()["detail"]["missing"] + r.json()["detail"]["invalid"])


def test_approval_signs_the_version_and_completes_the_stage(client, client_headers, auth_headers, sent):
    _view_all(client, client_headers, sent)
    r = client.post(f"/client/signoffs/{sent['sid']}/approve", json=APPROVE, headers=client_headers)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "approved" and r.json()["signer_name"] == "mr. gokhale"
    staff = client.get(f"/projects/{sent['pid']}/signoffs", headers=auth_headers("architect")).json()[0]
    assert staff["method"] == "client_app" and staff["signed_by"]["name"] == "Mr. Gokhale" and staff["responded_at"]
    view = client.get(f"/projects/{sent['pid']}/stages", headers=auth_headers("architect")).json()
    s = {x["key"]: x for p in view["phases"] for x in p["stages"]}
    assert s["requirements_signoff"]["state"] == "completed" and s["requirements_signoff"]["signed_by_client"] is True
    assert s["requirements_signoff"]["completion_note"] == "Signed off by mr. gokhale in the client app (version 1)."
    assert s["predesign_site_visit"]["state"] == "active" and s["concept"]["state"] == "active"
    actions = [e["action"] for e in client.get(f"/projects/{sent['pid']}", headers=auth_headers("architect")).json()["audit"]]
    assert "signoff.approved" in actions


def test_signed_version_is_immutable(client, client_headers, sent, db):
    _view_all(client, client_headers, sent)
    client.post(f"/client/signoffs/{sent['sid']}/approve", json=APPROVE, headers=client_headers)
    assert client.post(f"/client/signoffs/{sent['sid']}/approve", json=APPROVE, headers=client_headers).status_code == 409
    assert client.post(f"/client/signoffs/{sent['sid']}/request-changes", json={"comment": "x"},
                       headers=client_headers).status_code == 409
    db.expire_all()
    req = db.get(m.SignoffRequest, sent["sid"])
    req.summary = "tampered"
    with pytest.raises(m.SignoffImmutableError):
        db.commit()


def test_change_request_then_version_two_then_approval(client, client_headers, auth_headers, sent):
    arch = auth_headers("architect")
    r = client.post(f"/client/signoffs/{sent['sid']}/request-changes", json={"comment": "  Add a guest room.  "},
                    headers=client_headers)
    assert r.status_code == 200 and r.json()["status"] == "changes_requested"
    assert r.json()["response_comment"] == "Add a guest room."
    stage = lambda: next(x for p in client.get(f"/projects/{sent['pid']}/stages", headers=arch).json()["phases"]
                         for x in p["stages"] if x["key"] == "requirements_signoff")
    assert stage()["reasons"] == ["The client asked for changes on version 1; prepare version 2"]
    v2 = client.post(f"/projects/{sent['pid']}/signoffs", headers=arch, json={
        "stage_key": "requirements_signoff", "title": "Requirements baseline v2", "summary": "Guest room added."}).json()
    assert v2["version"] == 2 and v2["supersedes_id"] == sent["sid"]
    aid = client.post(f"/signoffs/{v2['id']}/attachments", headers=arch,
                      files={"file": ("Baseline v2.pdf", PDF, "application/pdf")}).json()["id"]
    client.post(f"/signoffs/{v2['id']}/send", headers=arch)
    client.get(f"/client/signoffs/{v2['id']}/attachments/{aid}", headers=client_headers)
    assert client.post(f"/client/signoffs/{v2['id']}/approve", json=APPROVE, headers=client_headers).status_code == 200
    assert stage()["state"] == "completed"
    history = client.get(f"/projects/{sent['pid']}/signoffs", headers=arch).json()
    assert [(h["version"], h["status"]) for h in history] == [(1, "changes_requested"), (2, "approved")]


def test_change_request_needs_a_comment(client, client_headers, sent):
    r = client.post(f"/client/signoffs/{sent['sid']}/request-changes", json={"comment": " "}, headers=client_headers)
    assert r.status_code == 422 and r.json()["detail"]["missing"] == ["comment"]


def test_other_clients_and_drafts_are_hidden(client, auth_headers, sent, db):
    from app.passwords import hash_password
    from tests.conftest import TEST_PASSWORD

    db.add(m.User(name="Ms. Patil", email="patil@client.example", role=m.Role.client, password_hash=hash_password(TEST_PASSWORD)))
    db.commit()
    tok = client.post("/auth/login", json={"email": "patil@client.example", "password": TEST_PASSWORD}).json()["access_token"]
    other = {"Authorization": f"Bearer {tok}"}
    assert client.get(f"/client/signoffs/{sent['sid']}", headers=other).status_code == 404
    assert client.get(f"/client/signoffs/{sent['sid']}/attachments/{sent['attachments'][0]}", headers=other).status_code == 404
    assert client.post(f"/client/signoffs/{sent['sid']}/approve", json=APPROVE, headers=other).status_code == 404
    assert client.get("/client/signoffs", headers=other).json() == []


def test_drafts_never_reach_the_client(client, client_headers, auth_headers, new_project, client_user, db):
    pid = new_project(start_stage="requirements_signoff", historical_confirmed_by="Parvez")["id"]
    db.add(m.ProjectMember(project_id=pid, user_id=client_user.id))
    db.commit()
    sid = client.post(f"/projects/{pid}/signoffs", headers=auth_headers("architect"), json={
        "stage_key": "requirements_signoff", "title": "Draft", "summary": "Not ready"}).json()["id"]
    assert client.get(f"/client/signoffs/{sid}", headers=client_headers).status_code == 404


@pytest.mark.parametrize("role", ["architect", "team_lead"])
def test_staff_cannot_sign_on_the_clients_behalf(client, auth_headers, sent, role):
    r = client.post(f"/client/signoffs/{sent['sid']}/approve", json=APPROVE, headers=auth_headers(role))
    assert r.status_code == 403


# ---------- notifications and the overdue flag (Task 13) ----------

def test_sending_notifies_the_client_and_answers_notify_the_studio(client, client_headers, auth_headers, sent):
    notes = client.get("/notifications", headers=client_headers).json()["items"]
    assert notes[0]["kind"] == "signoff_requested"
    assert notes[0]["text"] == "Please review and sign off: Client sign-off: preliminary requirements (version 1) on Villa A."
    _view_all(client, client_headers, sent)
    client.post(f"/client/signoffs/{sent['sid']}/approve", json=APPROVE, headers=client_headers)
    for role in ("architect", "team_lead"):
        texts = [n["text"] for n in client.get("/notifications", headers=auth_headers(role)).json()["items"]]
        assert "mr. gokhale signed off Client sign-off: preliminary requirements (version 1) on Villa A." in texts


def test_change_request_notifies_the_studio_with_the_comment(client, client_headers, auth_headers, sent):
    client.post(f"/client/signoffs/{sent['sid']}/request-changes", json={"comment": "Add a guest room."}, headers=client_headers)
    texts = [n["text"] for n in client.get("/notifications", headers=auth_headers("architect")).json()["items"]]
    assert any("asked for changes" in t and "Add a guest room." in t for t in texts)


def test_invited_client_still_gets_the_request(client, auth_headers, new_project):
    arch = auth_headers("architect")
    pid = new_project(start_stage="requirements_signoff", historical_confirmed_by="Parvez")["id"]
    code = client.post(f"/projects/{pid}/client-invite", headers=arch, json={"name": "Ms. Rao", "email": "rao@client.example"}).json()["code"]
    sid = client.post(f"/projects/{pid}/signoffs", headers=arch, json={
        "stage_key": "requirements_signoff", "title": "Baseline", "summary": "Scope"}).json()["id"]
    client.post(f"/signoffs/{sid}/attachments", headers=arch, files={"file": ("B.pdf", PDF, "application/pdf")})
    client.post(f"/signoffs/{sid}/send", headers=arch)
    tok = client.post("/auth/activate", json={"email": "rao@client.example", "code": code, "password": "courtyard-house-1"}).json()
    notes = client.get("/notifications", headers={"Authorization": f"Bearer {tok['access_token']}"}).json()["items"]
    assert [n["kind"] for n in notes] == ["signoff_requested"]


def test_overdue_client_decision_raises_and_clears(client, client_headers, auth_headers, sent, db):
    from datetime import datetime, timedelta, timezone

    from app.services.red_flags import sync_red_flags

    project = db.get(m.Project, sent["pid"])
    sync_red_flags(db, project, datetime.now(timezone.utc) + timedelta(days=8))
    db.commit()
    lead = auth_headers("team_lead")
    flags = {f["rule"] for f in client.get(f"/projects/{sent['pid']}/red-flags", headers=lead).json()}
    assert "client_decision_overdue" in flags
    _view_all(client, client_headers, sent)
    client.post(f"/client/signoffs/{sent['sid']}/approve", json=APPROVE, headers=client_headers)
    flags = {f["rule"] for f in client.get(f"/projects/{sent['pid']}/red-flags", headers=lead).json()}
    assert "client_decision_overdue" not in flags
