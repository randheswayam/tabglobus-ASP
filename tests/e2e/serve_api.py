"""Start the SiteFlow API for Playwright on a fresh, seeded SQLite database.

Run from Code/: backend/.venv/Scripts/python tests/e2e/serve_api.py
"""
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / ".data"
DATA.mkdir(exist_ok=True)
DB = DATA / "e2e.db"
if DB.exists():
    DB.unlink()

os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{DB.as_posix()}"
os.environ["PASSWORD_HASH_ITERATIONS"] = "1000"
os.environ.setdefault("JWT_SECRET", "e2e-only-secret-not-for-production-use")
os.environ["CORS_ORIGINS"] = '["http://localhost:8090"]'
sys.path.insert(0, str(HERE.parents[1] / "backend"))

import uvicorn  # noqa: E402

from app.db import SessionLocal, migrate  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402

migrate()
with SessionLocal() as db:
    seed(db, password=os.environ.get("SEED_PASSWORD", "e2e-pass-123"))

uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("API_PORT", "8001")), log_level="warning")
