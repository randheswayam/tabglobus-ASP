# Sprint v2 — Tasks

## Status: In Progress

- [x] Task 1: v2 setup: dependencies, workflow config and storage interface (P0)
  - Acceptance:
    - `requirements.txt` adds `alembic` and `python-multipart`.
    - `workflow_config.py` defines `REVIEW_SLA_HOURS=48`, `VISIT_INTERVAL_DAYS=14`, `REWORK_LIMIT=2`, `MAX_VIDEO_MB=100` and `MAX_PHOTO_MB=10`, plus the allowed photo types (jpeg, png, webp) and video types (mp4, webm). Each value is marked `# PLACEHOLDER: pending Parvez (D3/D4/D5)`.
    - Settings gain `MEDIA_DIR` (default `backend/media/`, gitignored) and `STORAGE_BACKEND=local`.
    - `services/storage.py` defines a `Storage` protocol (`save(key, bytes)`, `open(key)`, `delete(key)`) and a `LocalStorage` backend that rejects keys escaping `MEDIA_DIR`.
    - Unit tests cover a save and open round trip, delete, and path traversal being rejected. All 111 v1 tests still pass.
  - Files: backend/requirements.txt, backend/app/workflow_config.py, backend/app/config.py, backend/app/services/storage.py, backend/.gitignore, backend/tests/test_storage.py
  - Completed: 2026-09-27. workflow_config.py holds the D3, D4 and D5 placeholders. Storage protocol with LocalStorage: keys must match a strict pattern (each segment starts with a letter or digit) and must resolve inside MEDIA_DIR. Settings gain MEDIA_DIR and STORAGE_BACKEND. Added alembic and python-multipart. 10 new tests, 121 in total.

- [x] Task 2: Alembic baseline migration, applied at startup (P0)
  - Acceptance:
    - `alembic.ini` and `migrations/` are set up.
    - Revision `0001_v1_baseline` creates exactly the v1 tables.
    - App startup runs `alembic upgrade head` instead of `create_all` (tests still use `create_all` for speed).
    - A test upgrades an empty SQLite file and compares its tables and columns with `Base.metadata`.
    - Every later v2 schema change in this sprint adds its own revision.
  - Files: backend/alembic.ini, backend/migrations/env.py, backend/migrations/versions/0001_v1_baseline.py, backend/app/db.py, backend/app/main.py, backend/tests/test_migrations.py
  - Completed: 2026-09-27. Baseline 0001 generated from the v1 models. migrate() runs at startup (AUTO_MIGRATE, off in the test suite). A v1 database made by create_all is stamped 0001 first, so existing local data is kept. run_local.py and the E2E server now migrate too. 3 new tests, 124 in total.

- [x] Task 3: Recurring site visits (P0)
  - Acceptance:
    - Approving a visit completes Step 3, then reopens Step 2 and locks Step 3. The audit trail shows `step.completed`, then `step.activated` for Site Visit.
    - `official_progress` shows the latest approved visit.
    - A second visit can be submitted and approved; its `submission_count` starts from 1 again.
    - `GET /projects/{id}/visits` lists every visit, newest first, with its status, stage, progress and dates, respecting visibility.
    - The project detail gains `visit_number` and `approved_visits`.
    - The v1 test that expected all steps completed is updated to the new cycle.
  - Files: backend/app/routers/reviews.py, backend/app/routers/projects.py, backend/app/schemas.py, backend/tests/test_reviews.py, backend/tests/test_end_to_end.py, backend/tests/test_visits_history.py
  - Completed: 2026-09-27. Approve completes Step 3, then reopens Step 2 and locks Step 3 (all audited). The next visit is a new row with its own submission count. official_progress is always the latest approved visit. Project detail gains approved_visits and visit_number (none before Legal Approval). Added GET /projects/{id}/visits, newest first with approved_at, drafts left out. Updated the v1 review and end-to-end tests and the Task 10 E2E test for the new cycle. E2E ports moved to 8001 and 8090 so run_local.py can stay up. 4 new tests, 128 in total.

- [x] Task 4: Problems become tracked open items (P0)
  - Acceptance:
    - A `Problem` model and migration `0002_problems` are added.
    - Approving a visit creates one open `Problem` per reported problem, with its category, problem or free text, severity, location, responsible party and target date, linked to the visit.
    - `GET /projects/{id}/problems?status=open|resolved` works, respecting visibility.
    - `POST /problems/{id}/resolve` (the assigned engineer or the team lead) needs a non-blank note, sets `resolved_at` and `resolved_by`, and writes `problem.resolved`. Resolving twice returns 409, and other roles get 403.
    - Visits marked "No issues found" create no problems.
  - Files: backend/app/models.py, backend/migrations/versions/0002_problems.py, backend/app/routers/problems.py, backend/app/routers/reviews.py, backend/app/main.py, backend/tests/test_problems.py
  - Completed: 2026-09-27. Problem model and migration 0002. Approval turns each reported problem into an open item (Other stores its free text as the problem). Added GET /projects/{id}/problems?status= and POST /problems/{id}/resolve (engineer or team lead, a note required, 409 if already resolved, 404 when not visible), audited as problem.resolved. 11 new tests, 139 in total.

- [x] Task 5: Media model and the server-side draft visit (P0)
  - Acceptance:
    - A `Media` model and migration `0003_media` are added.
    - `POST /projects/{id}/site-visits/draft` (the assigned engineer, with Step 2 active) returns the project's current rework visit or draft visit, creating a `draft` if there is none. Calling it twice returns the same visit.
    - Submission (`POST /projects/{id}/site-visits`) now fills in and submits that draft or rework visit, and still creates one if none exists, so v1 clients keep working.
    - Draft visits are left out of the review queue and of `latest_visit` until they are submitted.
  - Files: backend/app/models.py, backend/migrations/versions/0003_media.py, backend/app/routers/site_visits.py, backend/app/schemas.py, backend/tests/test_media.py
  - Completed: 2026-09-27. Media model and migration 0003. POST /projects/{id}/site-visits/draft returns the rework or draft visit, or creates one (engineer only, Step 2 open). Submission now fills in that visit. latest_visit, the project list, the queue and the history all leave drafts out. visit_out includes media. 5 new tests, 144 in total.

- [x] Task 6: Media upload endpoint with validation and capture metadata (P0)
  - Acceptance:
    - `POST /site-visits/{id}/media` (multipart, assigned engineer only, visit in draft or rework) accepts a `file`, a `kind` (photo or video), an optional `problem_ref` (a problem index), an optional `captured_at`, and optional `lat` and `lng`.
    - A content type outside the allowed list returns 415, and a file over `MAX_PHOTO_MB` or `MAX_VIDEO_MB` returns 413.
    - The file is stored under a key made from a random name, never the uploaded filename. The row records the uploader, size, sha256, capture time (the server time when none is given) and GPS.
    - A submitted or approved visit returns 409.
    - Tests upload a small PNG and a small MP4, and check the 415, 413, 403, 404 and 409 cases.
  - Files: backend/app/routers/media.py, backend/app/main.py, backend/tests/test_media.py
  - Completed: 2026-09-27. Multipart upload (engineer only, visit in draft or rework). Returns 415 for a disallowed type or when the file signature doesn't match the Content-Type header, 413 when a chunked read passes the limit, and 422 for kind, problem_ref or GPS (lat and lng must come together). Stored under visits/<id>/<random hex>.<ext>. sha256, the uploader and the capture time (converted to UTC, server time by default) are recorded, and media.added is audited. CORS allows DELETE. Note for v3: Starlette spools multipart bodies before the limit check, so put a proxy-level request size cap in front of production. 17 new tests, 161 in total.

- [x] Task 7: Media download, listing and removal (P0)
  - Acceptance:
    - `GET /media/{id}` returns the file with its content type, and only to users who can see the project (404 otherwise).
    - `DELETE /media/{id}` works for the uploader while the visit is in draft or rework (409 after submission) and removes the stored file.
    - `visit_out` includes `media: [{id, kind, problem_ref, captured_at, lat, lng, uploader, size}]`.
    - Every upload and delete writes an audit event (`media.added`, `media.removed`).
  - Files: backend/app/routers/media.py, backend/app/schemas.py, backend/tests/test_media.py
  - Completed: 2026-09-27. GET /media/{id} checks project visibility and returns the file inline with nosniff and private caching. DELETE /media/{id} is for the uploader only, while the visit is in draft or rework (409 after that). The stored file is deleted after the commit, and media.removed is audited. visit_out lists media. The app has to fetch files with its Bearer token (as blobs), because a plain img tag can't send the header. 6 new tests, 167 in total.

- [x] Task 8: Evidence rules at submission (P0)
  - Acceptance:
    - Submission returns 422 with `missing: ["photos"]` when there are fewer photos than `MIN_PHOTOS`.
    - It returns `missing: ["problems[N].photo"]` for each High or Critical problem without a photo whose `problem_ref` is N.
    - Videos don't count toward the photo minimum.
    - `GET /template` exposes `min_photos`, `max_photo_mb` and `max_video_mb`.
    - The v1 site visit tests are updated to upload the photos they need, through a shared fixture.
  - Files: backend/app/services/validation.py, backend/app/routers/site_visits.py, backend/app/routers/template.py, backend/tests/conftest.py, backend/tests/test_site_visits.py
  - Completed: 2026-09-27. Submission now also requires MIN_PHOTOS photos on the open visit (videos don't count), and a photo tagged to each High or Critical problem (missing entries like problems[N].photo). Both are listed alongside the other missing fields. /template exposes the photo and video limits and types. Added a shared evidence fixture, and updated the v1 tests to photograph before submitting. The v1 site visit E2E tests fail until Task 13 adds photo capture to the app. 5 new tests, 171 in total.

- [x] Task 9: Red flag rule engine as a pure function (P0)
  - Acceptance:
    - `evaluate_flags(project_state, now, cfg)` returns a set of `(rule, key)` pairs for the six rules in the PRD table. Keys: the problem id for critical_issue and overdue_fix, the visit id for review_overdue and repeated_rework, and `project` for legal_delay and no_recent_visit.
    - Unit tests give each rule one case where it holds and one where it doesn't, using a fixed `now` and small in-memory states. No database is involved.
  - Files: backend/app/services/red_flags.py, backend/tests/test_red_flag_rules.py
  - Completed: 2026-09-27. evaluate_flags(ProjectState, now, cfg) is a pure function returning (rule, key) pairs for all six rules. A problem due today is not overdue. A Rejected Legal Approval also counts as delayed. Repeated rework applies only to visits not yet approved. No recent visit applies only while Step 2 is open, counting from the last approval or from Legal Approval. RULES gives each rule a label and a rank for the dashboard's sort order. 13 unit tests, 184 in total.

- [ ] Task 10: Red flag persistence, automatic sync and manual clear (P0)
  - Acceptance:
    - A `RedFlag` model and migration `0004_red_flags` are added.
    - `sync_red_flags(db, project, now)` raises new flags, clears automatically the flags whose rule no longer holds, and writes `red_flag.raised` or `red_flag.cleared`.
    - It runs after legal, submit, review and problem-resolve changes.
    - `POST /red-flags/{id}/clear` (team lead only) needs a reason, records `cleared_by` and the reason, and writes an audit event.
    - A flag cleared by hand is not raised again while its rule keeps holding. It is raised again after the rule stops holding and later holds again.
    - Tests move `now` forward for the time-based rules.
  - Files: backend/app/models.py, backend/migrations/versions/0004_red_flags.py, backend/app/services/red_flags.py, backend/app/routers/red_flags.py, backend/app/routers/legal.py, backend/app/routers/site_visits.py, backend/app/routers/reviews.py, backend/app/routers/problems.py, backend/app/main.py, backend/tests/test_red_flags.py

- [ ] Task 11: Dashboard API with the four panels (P0)
  - Acceptance:
    - `GET /dashboard` syncs flags for the visible projects, then returns:
      - `all_projects`: name, location, current step, official progress, open problem count, last approved visit date and red flag count.
      - `needs_attention`: projects with at least one active flag, sorted by highest severity, then oldest flag.
      - `major_problems`: open High and Critical problems, each with its project, owner and the id of its first photo.
      - `review_queue`: submitted visits with their waiting time.
    - Results are scoped by visibility: an engineer sees only their own projects.
    - Tests cover each panel's contents and sort order.
  - Files: backend/app/routers/dashboard.py, backend/app/main.py, backend/tests/test_dashboard.py

- [ ] Task 12: Dashboard filters (P0)
  - Acceptance:
    - `GET /dashboard` accepts these filters: `q` (name), `location`, `step`, `engineer_id`, `red_flag` (true or false), `severity`, `category`, `progress_min`, `progress_max`, `visit_from` and `visit_to`.
    - Filters narrow `all_projects`, `needs_attention` and `major_problems` consistently. Severity and category apply to problems.
    - Invalid values return 422.
    - A parametrised test checks each filter against a seeded set of 4 projects.
  - Files: backend/app/routers/dashboard.py, backend/tests/test_dashboard.py

- [ ] Task 13: UI: photo and video capture in the site visit form (P0)
  - Acceptance:
    - Opening the form calls the draft endpoint.
    - A Photos section offers Take photo (a file input with `accept="image/*" capture="environment"`) and Upload. Each problem card has its own Add photo button, which sets `problem_ref`.
    - Video is optional, with a size hint.
    - Uploads show progress, thumbnails and remove buttons.
    - The capture time comes from the device, and GPS from the form's captured location when there is one.
    - The missing list includes the photo count and the per-problem photo rule, and the server's 413 and 415 errors are shown in plain words.
    - The Playwright test uploads fixture images, sees a High problem blocked until its photo is added, then submits.
  - Files: web-src/api.js, web-src/app.js, web-src/app.html, tests/e2e/fixtures/, tests/e2e/v2-media.spec.js

- [ ] Task 14: UI: media on the review screen and visit history on the project page (P0)
  - Acceptance:
    - The review screen shows a photo grid and a video player, with each problem's photos next to that problem, capture time and GPS on each item, and a larger view when one is opened.
    - The project page shows a visit number ("Visit 3") and a Visit history list of approved visits with their progress and dates.
    - The Playwright test runs visit 1 through approval, then submits and approves visit 2, and sees the history and the updated official progress.
    - Screenshots are saved.
  - Files: web-src/app.js, web-src/app.html, tests/e2e/v2-media.spec.js, tests/e2e/v2-recurring.spec.js

- [ ] Task 15: UI: dashboard with panels, filters and manual red flag clear (P0)
  - Acceptance:
    - A new Dashboard nav item is shown to the Architect and the Team Lead, and is their landing page after sign-in.
    - It shows the four panels, with red flag pills naming each rule, and major problems with thumbnails.
    - A filter bar covers every filter in Task 12, and the chosen filters are remembered on the device.
    - Parvez sees Clear on each flag, which needs a reason.
    - The Playwright test creates flags (a High problem approved, and legal overdue), filters by red flag and severity, and clears one flag with a reason. It checks the audit entry, and takes phone and desktop screenshots.
  - Files: web-src/api.js, web-src/app.js, web-src/app.html, tests/e2e/v2-dashboard.spec.js

- [ ] Task 16: In-app notifications, backend (P1)
  - Acceptance:
    - A `Notification` model and migration `0005_notifications` are added.
    - `notify.event(...)` runs inside the same transaction as the change. Recipients: legal approved goes to the engineer, submitted goes to the team lead, approved goes to the engineer and the architect, rework goes to the engineer, and a red flag raised goes to the architect and the team lead.
    - `GET /notifications` returns the newest first, for the current user only, with an unread count.
    - `POST /notifications/{id}/read` and `POST /notifications/read-all` work only on the user's own notifications (404 otherwise).
    - Tests check the recipients for each event.
  - Files: backend/app/models.py, backend/migrations/versions/0005_notifications.py, backend/app/services/notify.py, backend/app/routers/notifications.py, backend/app/routers/legal.py, backend/app/routers/site_visits.py, backend/app/routers/reviews.py, backend/app/services/red_flags.py, backend/app/main.py, backend/tests/test_notifications.py

- [ ] Task 17: UI: notifications list and unread badge (P1)
  - Acceptance:
    - A bell in the sidebar and in the mobile tabs shows the unread count, refreshed on each navigation.
    - The Notifications view lists items. Opening one marks it read and goes to its project, and "Mark all read" works.
    - The Playwright test has Parvez see a submission notification after the engineer submits.
  - Files: web-src/api.js, web-src/app.js, tests/e2e/v2-notifications.spec.js

- [ ] Task 18: UI: resolve open problems (P1)
  - Acceptance:
    - The project page lists open problems with their severity, owner, target date (overdue shown in red) and photos.
    - The engineer and the team lead see Resolve, which needs a note. After resolving, the problem moves to Resolved, and any Critical issue or Overdue fix flag clears on the dashboard.
    - The Playwright test resolves a problem and sees its flag clear.
  - Files: web-src/api.js, web-src/app.js, tests/e2e/v2-problems.spec.js

- [ ] Task 19: Run on PostgreSQL (P1)
  - Acceptance:
    - With `docker compose up -d db`, `alembic upgrade head` succeeds on an empty PostgreSQL database.
    - `TEST_DATABASE_URL=postgresql+psycopg://... pytest` runs the full suite on PostgreSQL, with each test in a transaction that is rolled back, and passes.
    - `run_local.py` works with `DATABASE_URL` pointing at PostgreSQL.
    - The README section "Run on PostgreSQL" is written.
    - Any SQLite-only assumptions found are fixed and noted.
  - Files: backend/tests/conftest.py, backend/README.md, run_local.py

- [ ] Task 20: Android debug build reaches the API (P1)
  - Acceptance:
    - The debug build sets `server.androidScheme: "http"` and allows cleartext only for `10.0.2.2` and `localhost` through a debug-only network security config. The release keeps `https` and does not allow cleartext.
    - `npm run apk` builds `app-debug.apk`.
    - On an emulator, the engineer signs in, opens the site visit form, takes a photo through the camera intent, and submits against `run_local.py`. Screenshots or a screen recording are saved.
    - If no emulator is available, the build succeeding is recorded, and the device check is left as a T3 item.
  - Files: capacitor.config.json, android/app/src/debug/res/xml/network_security_config.xml, android/app/src/debug/AndroidManifest.xml, README.md

- [ ] Task 21: Client demo parity (P2)
  - Acceptance:
    - `demo-api.js` implements the draft, media (stored in the browser as blobs or data URLs, size-capped), problems, red flags, dashboard, filters and notifications endpoints with the same rules.
    - The sample data includes photos drawn on a canvas, one Critical issue flag, one Legal delay flag and a second approved visit on Kapoor House.
    - The demo E2E test is extended to cover the dashboard and clearing a flag.
    - The shared demo link is republished.
  - Files: web-src/demo-api.js, web-src/build.py, tests/e2e/demo.spec.js, demo/
