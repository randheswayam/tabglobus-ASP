"""Sign-off packages the Architect prepares for the client at the four milestones."""
import pytest

from app import models as m
from tests.conftest import PNG

PDF = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"


@pytest.fixture
def at_signoff(client, auth_headers, new_project, client_user, db):
    """A project waiting at stage 4 (requirements sign-off), with a client member."""
    p = new_project(start_stage="requirements_signoff", historical_confirmed_by="Parvez")
    db.add(m.ProjectMember(project_id=p["id"], user_id=client_user.id))
    db.commit()
    return p["id"]


def _create(client, auth_headers, pid, stage_key="requirements_signoff", role="architect"):
    return client.post(f"/projects/{pid}/signoffs", headers=auth_headers(role),
                       json={"stage_key": stage_key, "title": "Requirements baseline v1",
                             "summary": "4 BHK, home office, courtyard; budget band as discussed."})


def _attach(client, auth_headers, sid, data=PDF, ctype="application/pdf", name="Requirements baseline.pdf"):
    return client.post(f"/signoffs/{sid}/attachments", headers=auth_headers("architect"),
                       files={"file": (name, data, ctype)})


def test_architect_prepares_and_sends_a_package(client, auth_headers, at_signoff):
    arch = auth_headers("architect")
    r = _create(client, auth_headers, at_signoff)
    assert r.status_code == 201, r.text
    s = r.json()
    assert (s["status"], s["version"], s["stage_key"]) == ("draft", 1, "requirements_signoff")
    a = _attach(client, auth_headers, s["id"])
    assert a.status_code == 201, a.text
    assert a.json()["filename"] == "Requirements baseline.pdf" and a.json()["content_type"] == "application/pdf"
    assert _attach(client, auth_headers, s["id"], PNG, "image/png", "../../site plan.png").json()["filename"] == "site plan.png"
    sent = client.post(f"/signoffs/{s['id']}/send", headers=arch)
    assert sent.status_code == 200 and sent.json()["status"] == "sent" and sent.json()["sent_at"].endswith("+00:00")
    history = client.get(f"/projects/{at_signoff}/signoffs", headers=arch).json()
    assert [(h["version"], h["status"], len(h["attachments"])) for h in history] == [(1, "sent", 2)]
    actions = [e["action"] for e in client.get(f"/projects/{at_signoff}", headers=arch).json()["audit"]]
    assert {"signoff.created", "signoff.attachment_added", "signoff.sent"} <= set(actions)


def test_stage_reason_follows_the_package(client, auth_headers, at_signoff):
    arch = auth_headers("architect")

    def reason():
        view = client.get(f"/projects/{at_signoff}/stages", headers=arch).json()
        return next(s for p in view["phases"] for s in p["stages"] if s["key"] == "requirements_signoff")["reasons"]

    assert reason() == ["Sign-off package not sent to the client yet"]
    sid = _create(client, auth_headers, at_signoff).json()["id"]
    _attach(client, auth_headers, sid)
    client.post(f"/signoffs/{sid}/send", headers=arch)
    assert reason()[0].startswith("Waiting for client sign-off on version 1, sent ")


def test_draft_can_be_edited_and_attachments_removed(client, auth_headers, at_signoff):
    arch = auth_headers("architect")
    sid = _create(client, auth_headers, at_signoff).json()["id"]
    r = client.patch(f"/signoffs/{sid}", headers=arch, json={"title": "Requirements baseline (final)"})
    assert r.json()["title"] == "Requirements baseline (final)"
    aid = _attach(client, auth_headers, sid).json()["id"]
    assert client.delete(f"/signoffs/{sid}/attachments/{aid}", headers=arch).status_code == 204
    assert client.get(f"/projects/{at_signoff}/signoffs", headers=arch).json()[0]["attachments"] == []


def test_sending_needs_an_attachment_and_a_client(client, auth_headers, new_project, at_signoff, db):
    arch = auth_headers("architect")
    sid = _create(client, auth_headers, at_signoff).json()["id"]
    r = client.post(f"/signoffs/{sid}/send", headers=arch)
    assert r.status_code == 422 and r.json()["detail"]["missing"] == ["attachments"]
    lonely = new_project("No client", start_stage="requirements_signoff", historical_confirmed_by="Parvez")["id"]
    sid2 = _create(client, auth_headers, lonely).json()["id"]
    _attach(client, auth_headers, sid2)
    r = client.post(f"/signoffs/{sid2}/send", headers=arch)
    assert r.status_code == 422 and r.json()["detail"]["missing"] == ["client"]


def test_sent_package_is_frozen(client, auth_headers, at_signoff):
    arch = auth_headers("architect")
    sid = _create(client, auth_headers, at_signoff).json()["id"]
    aid = _attach(client, auth_headers, sid).json()["id"]
    client.post(f"/signoffs/{sid}/send", headers=arch)
    assert client.patch(f"/signoffs/{sid}", headers=arch, json={"title": "x"}).status_code == 409
    assert _attach(client, auth_headers, sid).status_code == 409
    assert client.delete(f"/signoffs/{sid}/attachments/{aid}", headers=arch).status_code == 409
    assert client.post(f"/signoffs/{sid}/send", headers=arch).status_code == 409


def test_one_open_package_per_stage(client, auth_headers, at_signoff):
    assert _create(client, auth_headers, at_signoff).status_code == 201
    assert _create(client, auth_headers, at_signoff).status_code == 409


def test_packages_only_for_active_client_signoff_stages(client, auth_headers, at_signoff):
    assert _create(client, auth_headers, at_signoff, stage_key="design_freeze_signoff").status_code == 409  # locked
    assert _create(client, auth_headers, at_signoff, stage_key="baseline").status_code == 422  # not a sign-off stage


@pytest.mark.parametrize("data,ctype", [(b"MZ\x90\x00 not a pdf", "application/pdf"), (PDF, "application/zip")])
def test_attachment_type_is_checked(client, auth_headers, at_signoff, data, ctype):
    sid = _create(client, auth_headers, at_signoff).json()["id"]
    assert _attach(client, auth_headers, sid, data, ctype).status_code == 415


@pytest.mark.parametrize("role", ["team_lead", "civil_engineer", "admin"])
def test_only_the_architect_prepares_packages(client, auth_headers, at_signoff, role):
    assert _create(client, auth_headers, at_signoff, role=role).status_code == 403


def test_staff_can_download_attachments(client, auth_headers, at_signoff):
    sid = _create(client, auth_headers, at_signoff).json()["id"]
    aid = _attach(client, auth_headers, sid).json()["id"]
    r = client.get(f"/signoffs/{sid}/attachments/{aid}", headers=auth_headers("team_lead"))
    assert r.status_code == 200 and r.content == PDF and r.headers["content-type"] == "application/pdf"
