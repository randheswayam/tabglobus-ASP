"""docker compose runs the whole stack: PostgreSQL, the API (migrated and seeded) and the web app.

Secrets come from .env.
"""

import re
from pathlib import Path

import pytest

yaml = pytest.importorskip("yaml")
ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def compose():
    return yaml.safe_load((ROOT / "docker-compose.yml").read_text(encoding="utf-8"))


def test_three_services(compose):
    assert {"db", "api", "web"} <= set(compose["services"])


def test_db_keeps_the_existing_volume(compose):
    db = compose["services"]["db"]
    assert db["image"] == "postgres:16"
    assert "healthcheck" in db
    assert compose["volumes"]["siteflow-db"]["name"] == "backend_siteflow-db"


def test_api_waits_for_a_healthy_db_and_has_a_health_check(compose):
    api = compose["services"]["api"]
    assert api["depends_on"]["db"]["condition"] == "service_healthy"
    assert "/health" in " ".join(api["healthcheck"]["test"])
    assert "8000:8000" in api["ports"]


def test_web_serves_www_on_8080(compose):
    web = compose["services"]["web"]
    assert "8080:80" in web["ports"]
    assert any(v.startswith("./www:") for v in web["volumes"])


def test_secrets_come_from_env(compose):
    text = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    for key in ("POSTGRES_PASSWORD", "JWT_SECRET", "SEED_PASSWORD"):
        assert re.search(rf"{key}: \$\{{{key}", text), key
    example = (ROOT / ".env.example").read_text(encoding="utf-8")
    for key in ("POSTGRES_PASSWORD", "JWT_SECRET", "SEED_PASSWORD"):
        assert f"{key}=" in example, key
    ignored = (ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
    assert ".env" in ignored


def test_dockerfile_migrates_then_serves():
    text = (ROOT / "backend/Dockerfile").read_text(encoding="utf-8")
    assert text.startswith("FROM python:3.12-slim")
    entry = (ROOT / "backend/docker-entrypoint.sh").read_text(encoding="utf-8")
    assert entry.index("alembic upgrade head") < entry.index("app.seed") < entry.index("uvicorn")


def test_old_backend_compose_file_is_gone():
    assert not (ROOT / "backend/docker-compose.yml").exists()
