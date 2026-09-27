"""The backend passes ruff (rules in backend/pyproject.toml). Skipped when the dev tools are not installed."""

import shutil
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
pytest.importorskip("ruff")


@pytest.mark.parametrize("args", [["check", "."], ["format", "--check", "."]])
def test_ruff(args):
    exe = shutil.which("ruff") or sys.executable
    cmd = [exe, *args] if exe != sys.executable else [exe, "-m", "ruff", *args]
    r = subprocess.run(cmd, cwd=BACKEND, capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
