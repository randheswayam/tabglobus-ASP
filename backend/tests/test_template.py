from app import template_config as tc


def test_template_serves_form_config(client, auth_headers):
    r = client.get("/template", headers=auth_headers("civil_engineer"))
    assert r.status_code == 200
    t = r.json()
    assert t["id"] == "residential" and t["version"] == 1
    assert [s["name"] for s in t["stages"]] == [s["name"] for s in tc.STAGES]
    assert t["stages"][1]["checklist"][0] == {"id": "pln-beam", "label": "Plinth beam cast"}
    assert t["checklist_states"] == ["Done", "In progress", "Not started"]
    assert t["problems"]["Water"][0] == "Seepage or dampness"
    assert t["problems"]["Other"] == []
    assert t["severities"] == ["Low", "Medium", "High", "Critical"]
    assert t["min_photos"] == tc.MIN_PHOTOS


def test_template_requires_sign_in(client):
    assert client.get("/template").status_code == 401


def test_template_serves_the_stage_flow_for_onboarding(client, auth_headers):
    from app import stage_config as sc

    t = client.get("/template", headers=auth_headers("architect")).json()
    assert [p["name"] for p in t["phases"]] == [p["name"] for p in sc.PHASES]
    assert [s["key"] for s in t["flow"]] == [s["key"] for s in sc.STAGES]
    assert t["flow"][7] == {"key": "tentative_elevations", "number": None, "label": "Tentative elevations", "phase": 2}
