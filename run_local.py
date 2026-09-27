"""Run the real SiteFlow v1 locally: FastAPI backend on port 8000 and the web app on port 8080.

    backend/.venv/Scripts/python run_local.py        (Windows)
    backend/.venv/bin/python run_local.py            (macOS, Linux)

Data is kept in backend/local.db (SQLite) unless DATABASE_URL is set, e.g. to the docker-compose
PostgreSQL. On first run the four users are created with one shared password: SEED_PASSWORD if set,
otherwise a random one that is printed once. Delete backend/local.db to start over. Stop with Ctrl+C.
"""
import functools
import http.server
import os
import secrets
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
WWW = ROOT / "www"
API_PORT, WEB_PORT = 8000, 8080

os.environ.setdefault("DATABASE_URL", f"sqlite+pysqlite:///{(BACKEND / 'local.db').as_posix()}")
if "JWT_SECRET" not in os.environ:
    os.environ["JWT_SECRET"] = secrets.token_urlsafe(32)  # fresh per run: everyone signs in again after a restart
sys.path.insert(0, str(BACKEND))

import uvicorn  # noqa: E402

from app.db import SessionLocal, migrate  # noqa: E402
from app.models import User  # noqa: E402
from app.seed import SEED_USERS, seed  # noqa: E402


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args) -> None:  # keep the console for the startup banner and errors
        pass


def main() -> None:
    sys.stdout.reconfigure(line_buffering=True)
    subprocess.run([sys.executable, str(ROOT / "web-src" / "build.py")], check=True)

    migrate()
    with SessionLocal() as db:
        first_run = db.query(User).count() == 0
        password = (os.environ.get("SEED_PASSWORD") or secrets.token_urlsafe(9)) if first_run else None
        if first_run:
            seed(db, password)

    handler = functools.partial(QuietHandler, directory=str(WWW))
    web = http.server.ThreadingHTTPServer(("127.0.0.1", WEB_PORT), handler)
    threading.Thread(target=web.serve_forever, daemon=True).start()

    print("\nSiteFlow v1 is running")
    print(f"  App:  http://localhost:{WEB_PORT}/index.html")
    print(f"  API:  http://localhost:{API_PORT}/docs")
    print(f"  Data: {os.environ['DATABASE_URL']}")
    print("  Sign in as:")
    for u in SEED_USERS:
        print(f"    {u['role'].value:15} {u['email']}")
    if password:
        print(f"  Password: {password}" + ("  (shown on first run only; set SEED_PASSWORD to choose one)" if first_run and not os.environ.get("SEED_PASSWORD") else ""))
    else:
        print("  Password: the one printed on the first run. To start over, stop the app and delete backend/local.db.")
    print("  Stop with Ctrl+C\n")

    from app.main import app
    uvicorn.run(app, host="127.0.0.1", port=API_PORT, log_level="warning")


if __name__ == "__main__":
    main()
