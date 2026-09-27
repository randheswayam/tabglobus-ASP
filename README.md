# SiteFlow MVP: web console and Android field app

SiteFlow by TAN GLOBUS AI, for residential projects. One codebase runs as the web console and, through Capacitor, as the Android field app. At phone width it switches to the mobile layout with bottom tabs and a full-screen site visit form.

The app talks to the FastAPI backend in `backend/` (see [backend/README.md](backend/README.md)). To run both locally: `backend/.venv/Scripts/python run_local.py`, then open http://localhost:8080/index.html.

## Run the whole stack with Docker

1. Copy `.env.example` to `.env` and fill in `POSTGRES_PASSWORD`, `JWT_SECRET` and, for the first start, `SEED_PASSWORD`. `.env` is git-ignored.
2. Run `docker compose up --build`. This starts three services:
   - `db`: PostgreSQL 16 on port 5432. It uses the same `backend_siteflow-db` volume as the earlier database-only setup, so existing local data is kept.
   - `api`: the FastAPI backend on port 8000. It runs `alembic upgrade head`, creates any missing seed users with `SEED_PASSWORD`, then serves; its health check is `/health`.
   - `web`: nginx serving `www/` on port 8080.
3. Open http://localhost:8080/index.html. Rebuild the web app with `backend/.venv/Scripts/python web-src/build.py` after changing `web-src/`.

`docker compose down` stops the stack; `docker compose down -v` also deletes the database and media volumes.

## What it does

| Area | What the app does |
|---|---|
| Workflow | Three steps per residential project: Legal Approval, then Site Visit, then Team Lead Review. Each approval reopens Site Visit for the next visit. |
| Legal Approval | The Admin records the authority, reference, dates and approval document. Approved unlocks the site visit. |
| Site visit | Mandatory form with the stage checklist, the prepopulated problem list, photos and optional video. A High or Critical problem needs its own photo. The draft is kept on the device. |
| Progress | Derived from the stage checklist and weights, and official only after Parvez approves. |
| Review | Parvez approves, or sends the visit back with a comment. Approved problems become open items until someone resolves them. |
| Dashboard | All Projects, Needs Architect Attention, Major Problems and Review Queue, with filters and red flags. |
| Notifications and audit | In-app notifications for step changes, reviews and red flags. Every change is recorded in the audit trail. |

A client demo that runs entirely in the browser on sample data is built to `demo/SiteFlow-Demo.html` by `web-src/build.py`.

## Connecting the Android debug build to the API

Debug builds reach a development API over plain http: `http://10.0.2.2:8000` from the emulator, which is the host machine's `run_local.py`. To use another server, such as a laptop on the office Wi-Fi, set it in the sign-in screen's Server field, or open the app with `?api=http://<address>:8000`.

This works because of two debug-only settings:
- `android/app/src/debug/res/xml/network_security_config.xml` permits cleartext traffic.
- `MainActivity` allows mixed content when the build is debuggable. The app itself is served from `https://localhost`.

Release builds keep the Android defaults, so they need an https API.

## Build the APK

### Option A: GitHub Actions (no local setup)

1. Create a new GitHub repository and push this folder to the `main` branch.
2. Open the repository's **Actions** tab. The "Build Android APK" workflow runs on every push (or run it manually with "Run workflow").
3. When it finishes, download **SiteFlow-debug-apk** from the run's Artifacts section, unzip it and copy `app-debug.apk` to the phone.
4. On the phone, allow "Install unknown apps" for your file manager or browser, then open the APK.

### Option B: Android Studio

Requirements: Node.js 20 or newer, Android Studio (Ladybug or newer) with JDK 21 and Android SDK 35.

```
npm install
npx cap sync android
npx cap open android
```

In Android Studio: wait for Gradle sync, connect a phone with USB debugging (or start an emulator), press Run. For an APK file: Build → Build App Bundle(s) / APK(s) → Build APK(s).

### Option C: Command line

```
npm install
npm run apk
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

## Editing the app

The app source is `web-src/app.html` (layout and styles), `web-src/api.js` (the API client), `web-src/app.js` (views and events) and `web-src/demo-api.js` (the in-browser API for the client demo). After editing, run:

```
python3 web-src/build.py
npx cap sync android
```

## Android permissions

Camera (site photos and video), fine and coarse location (GPS capture), microphone (voice notes), media read (attach from gallery). Android asks for each the first time it is used.

## Suggested next phases

- **Build**: backend API and PostgreSQL per the architecture overview, sign-in with roles, file storage for photos and documents, real email and push delivery, offline sync queue.
- **Deploy**: signed release build, Play Store internal testing track, hosted web console.
- **Evaluate**: pilot on live projects with one studio, measure submission completeness and review turnaround.
- **Maintain**: template versioning governance, Phase 2 AI features (auto-summary of site notes, missing-information detection, WhatsApp capture, delay risk alerts).
