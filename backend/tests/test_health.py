from app import template_config as tc


def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_cors_allows_web_and_capacitor_origins(client):
    for origin in ("http://localhost:5173", "capacitor://localhost", "http://localhost"):
        r = client.options(
            "/health",
            headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
        )
        assert r.headers.get("access-control-allow-origin") == origin


def test_residential_template_stages_and_weights():
    names = [s["name"] for s in tc.STAGES]
    assert names == [
        "Foundation",
        "Plinth",
        "Superstructure",
        "Masonry",
        "Plastering",
        "Services",
        "Finishes",
        "Handover",
    ]
    assert sum(s["weight"] for s in tc.STAGES) == 100
    for s in tc.STAGES:
        assert s["checklist"], f"{s['name']} has no checklist items"
        ids = [i["id"] for i in s["checklist"]]
        assert len(ids) == len(set(ids))


def test_problem_list_and_min_photos():
    assert set(tc.PROBLEMS) == {"Structural", "Quality", "Water", "Site", "Safety", "Other"}
    assert "Honeycombing in concrete" in tc.PROBLEMS["Structural"]
    assert tc.SEVERITIES == ["Low", "Medium", "High", "Critical"]
    assert isinstance(tc.MIN_PHOTOS, int) and tc.MIN_PHOTOS > 0
