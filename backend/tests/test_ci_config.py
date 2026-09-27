"""The CI workflow runs every backend gate: lint, tests on SQLite and on PostgreSQL 16, semgrep and pip-audit."""

from pathlib import Path

import pytest

yaml = pytest.importorskip("yaml")
ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def ci():
    return yaml.safe_load((ROOT / ".github/workflows/ci.yml").read_text(encoding="utf-8"))


def _run(job):
    return "\n".join(step.get("run", "") for step in job["steps"])


def test_runs_on_push_and_pull_request(ci):
    triggers = ci[True] if True in ci else ci["on"]  # YAML 1.1 reads the key `on` as True
    assert "push" in triggers and "pull_request" in triggers


def test_backend_lint(ci):
    run = _run(ci["jobs"]["backend-lint"])
    assert "ruff check" in run and "ruff format --check" in run


def test_pytest_on_sqlite(ci):
    job = ci["jobs"]["backend-tests-sqlite"]
    assert "pytest" in _run(job)
    assert "TEST_DATABASE_URL" not in str(job.get("env", {}))


def test_pytest_on_postgres(ci):
    job = ci["jobs"]["backend-tests-postgres"]
    assert job["services"]["postgres"]["image"] == "postgres:16"
    assert job["env"]["TEST_DATABASE_URL"].startswith("postgresql+psycopg://")
    assert "pytest" in _run(job)


def test_scans_use_the_local_rulesets(ci):
    run = _run(ci["jobs"]["backend-scans"])
    for ruleset in ("p/python", "p/fastapi", "p/secrets", "p/jwt", "p/sql-injection"):
        assert f"--config {ruleset}" in run, ruleset
    assert "--error" in run
    assert "pip-audit -r requirements.txt" in run


def test_every_job_pins_python_312(ci):
    for name, job in ci["jobs"].items():
        if name.startswith("backend"):
            setup = [s for s in job["steps"] if "setup-python" in s.get("uses", "")]
            assert setup and setup[0]["with"]["python-version"] == "3.12", name
