"""Updates the Architect chooses to share with the client: a note and selected photos from an approved visit."""

import pytest

from app import models as m
from tests.conftest import JPEG, valid_visit


@pytest.fixture
def approved_visit(client, auth_headers, ready_project, client_user, evidence, upload, db):
    pid = ready_project["id"]
    db.add(m.ProjectMember(project_id=pid, user_id=client_user.id))
    db.commit()
    visit = evidence(pid)
    extra = upload(visit["id"], data=JPEG, content_type="image/jpeg").json()
    eng, lead = auth_headers("civil_engineer"), auth_headers("team_lead")
    v = client.post(f"/projects/{pid}/site-visits", json=valid_visit(), headers=eng).json()
    client.post(f"/site-visits/{v['id']}/review", json={"decision": "approve"}, headers=lead)
    full = client.get(f"/site-visits/{v['id']}", headers=lead).json()
    return {
        "pid": pid,
        "vid": v["id"],
        "photos": [x["id"] for x in full["media"] if x["kind"] == "photo"],
        "extra": extra["id"],
    }


def _share(client, headers, vid, **body):
    return client.post(f"/site-visits/{vid}/share", json=body, headers=headers)


def test_architect_shares_a_note_and_chosen_photos(client, auth_headers, client_headers, approved_visit):
    photos = approved_visit["photos"][:2]
    r = _share(
        client,
        auth_headers("architect"),
        approved_visit["vid"],
        note="  Plinth beam is cast; filling is under way.  ",
        media_ids=photos,
    )
    assert r.status_code == 201, r.text
    assert r.json()["note"] == "Plinth beam is cast; filling is under way."
    d = client.get(f"/client/projects/{approved_visit['pid']}", headers=client_headers).json()
    [u] = d["shared_updates"]
    assert u["note"] == "Plinth beam is cast; filling is under way." and [p["id"] for p in u["photos"]] == photos
    assert u["shared_at"].endswith("+00:00") and u["stage"] == "Plinth"
    notes = client.get("/notifications", headers=client_headers).json()["items"]
    assert notes[0]["kind"] == "update_shared" and "Villa A" in notes[0]["text"]
    ev = [
        e["action"]
        for e in client.get(f"/projects/{approved_visit['pid']}", headers=auth_headers("architect")).json()["audit"]
    ]
    assert "update.shared" in ev


def test_client_downloads_only_shared_photos(client, auth_headers, client_headers, approved_visit):
    shared, unshared = approved_visit["photos"][0], approved_visit["photos"][1]
    uid = _share(client, auth_headers("team_lead"), approved_visit["vid"], note="Update", media_ids=[shared]).json()[
        "id"
    ]
    ok = client.get(f"/client/updates/{uid}/media/{shared}", headers=client_headers)
    assert ok.status_code == 200 and ok.headers["x-content-type-options"] == "nosniff"
    assert client.get(f"/client/updates/{uid}/media/{unshared}", headers=client_headers).status_code == 404
    assert (
        client.get(f"/media/{shared}", headers=client_headers).status_code == 403
    )  # the staff media route stays closed


def test_unshared_visits_stay_invisible(client, client_headers, approved_visit):
    d = client.get(f"/client/projects/{approved_visit['pid']}", headers=client_headers).json()
    assert d["shared_updates"] == []


def test_share_rules(client, auth_headers, approved_visit, ready_project, evidence):
    arch = auth_headers("architect")
    assert _share(client, arch, approved_visit["vid"], note=" ", media_ids=[]).status_code == 422
    assert _share(client, arch, approved_visit["vid"], note="x", media_ids=[999999]).status_code == 422
    for role in ("civil_engineer", "admin"):
        assert _share(client, auth_headers(role), approved_visit["vid"], note="x", media_ids=[]).status_code == 403
    evidence(ready_project["id"])  # a new draft visit that is not approved
    draft = client.post(
        f"/projects/{ready_project['id']}/site-visits/draft", headers=auth_headers("civil_engineer")
    ).json()
    assert _share(client, arch, draft["id"], note="x", media_ids=[]).status_code == 409


def test_other_clients_cannot_see_the_update(client, auth_headers, approved_visit, db):
    from app.passwords import hash_password
    from tests.conftest import TEST_PASSWORD

    uid = _share(
        client, auth_headers("architect"), approved_visit["vid"], note="Update", media_ids=approved_visit["photos"][:1]
    ).json()["id"]
    db.add(
        m.User(
            name="Ms. Other",
            email="other@client.example",
            role=m.Role.client,
            password_hash=hash_password(TEST_PASSWORD),
        )
    )
    db.commit()
    tok = client.post("/auth/login", json={"email": "other@client.example", "password": TEST_PASSWORD}).json()[
        "access_token"
    ]
    r = client.get(
        f"/client/updates/{uid}/media/{approved_visit['photos'][0]}", headers={"Authorization": f"Bearer {tok}"}
    )
    assert r.status_code == 404


def test_staff_list_shared_updates(client, auth_headers, approved_visit):
    _share(client, auth_headers("architect"), approved_visit["vid"], note="First update", media_ids=[])
    rows = client.get(f"/projects/{approved_visit['pid']}/shared-updates", headers=auth_headers("team_lead")).json()
    assert [r["note"] for r in rows] == ["First update"] and rows[0]["shared_by"]["name"] == "Meera Joshi"
