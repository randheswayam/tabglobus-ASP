"""Run the real SiteFlow v1 locally: FastAPI backend on port 8000 and the web app on port 8080.

    backend/.venv/Scripts/python run_local.py        (Windows)
    backend/.venv/bin/python run_local.py            (macOS, Linux)

Data is kept in backend/local.db (SQLite) unless DATABASE_URL is set, e.g. to the docker-compose
PostgreSQL. Set API_HOST=0.0.0.0 to reach the API from a phone on the same network. On first run the users are created with one shared password: SEED_PASSWORD if set,
otherwise a random one that is printed once. Delete backend/local.db to start over. Stop with Ctrl+C.
"""
import functools
import json
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
API_PORT = int(os.environ.get("API_PORT", "8000"))
API_HOST = os.environ.get("API_HOST", "127.0.0.1")  # 0.0.0.0 lets a phone on the same Wi-Fi reach the API
WEB_PORT = int(os.environ.get("WEB_PORT", "8080"))
if WEB_PORT != 8080 and "CORS_ORIGINS" not in os.environ:
    # Allow the chosen web port as well as the Android app's origins.
    os.environ["CORS_ORIGINS"] = json.dumps([f"http://localhost:{WEB_PORT}", f"http://127.0.0.1:{WEB_PORT}",
                                             "capacitor://localhost", "https://localhost", "http://localhost"])

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

    print("\nSiteFlow is running")
    api_param = "" if API_PORT == 8000 else f"?api=http://localhost:{API_PORT}"
    print(f"  App:  http://localhost:{WEB_PORT}/index.html{api_param}")
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
    uvicorn.run(app, host=API_HOST, port=API_PORT, log_level="warning")


if __name__ == "__main__":
    main()
