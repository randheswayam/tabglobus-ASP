# Sprint v4 — Tasks

## Status: In Progress

Scope: execution-plan steps 1 to 5 (core S00 to S04). See `sprints/v4/PRD.md` and `docs/V4_EXECUTION_PLAN.md`. Every task ends with the full backend and E2E suites plus scans green, unless the task says a rule deliberately changed.

### S00 — Tooling and CI

- [x] Task 1: v4 setup: CLAUDE.md, decision 0003 and doc links (P0)
  - Acceptance:
    - `CLAUDE.md` points to `docs/SiteFlow-PRD-v3.2.md`, `docs/SiteFlow-PRD-V4.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/V4_IMPLEMENTATION_PLAN.md` and `docs/V4_EXECUTION_PLAN.md`.
    - It gains the "V4 integration and AI rules" section from `docs/reference/CLAUDE-reference-v4.md`. The repository's actual stack section is kept.
    - `docs/decisions/0003-module-layout.md` records:
      - new domain code goes in `backend/app/modules/<domain>/`;
      - existing `services/` and `routers/` move only when touched;
      - integer ids stay for now, and UUID ids and `organization_id` are planned before V08.
    - All 409 backend and 28 E2E tests still pass.
  - Files: CLAUDE.md, docs/decisions/0003-module-layout.md, backend/app/modules/__init__.py
  - Completed: 2026-09-28. CLAUDE.md now points to PRD v3.2, PRD V4, both plans and the execution plan, carries the V4 integration and AI rules, and names backend/app/modules for new code. Decision 0003 records the module layout, integer ids until before V08, and the role mapping. test_repo_docs.py checks the references resolve.

- [ ] Task 2: ruff and pre-commit for the backend (P0)
  - Acceptance:
    - `ruff check backend` and `ruff format --check backend` pass, with the config in `backend/pyproject.toml` (line length 120, rules E, F, I, B, UP).
    - Existing findings are fixed without behaviour changes.
    - `.pre-commit-config.yaml` runs ruff on commit.
    - `ruff` is added to a new `backend/requirements-dev.txt`.
    - Tests still pass.
  - Files: backend/pyproject.toml, backend/requirements-dev.txt, .pre-commit-config.yaml, backend/app/**

- [ ] Task 3: eslint for web-src and the E2E tests (P0)
  - Acceptance:
    - `npx eslint web-src tests/e2e` passes, with a flat `eslint.config.js` (recommended rules, browser globals for `web-src`, node globals for `tests/`).
    - Built files (`www/`, `demo/`) are ignored.
    - Existing findings are fixed without behaviour changes.
    - The eslint hook is added to pre-commit.
    - The E2E suite still passes.
  - Files: eslint.config.js, package.json, .pre-commit-config.yaml, web-src/*.js, tests/e2e/*.js

- [ ] Task 4: GitHub Actions: backend lint, tests on SQLite and PostgreSQL, and scans (P0)
  - Acceptance:
    - `.github/workflows/ci.yml` runs on push and pull request, with jobs for:
      - ruff;
      - pytest on SQLite;
      - pytest on a PostgreSQL 16 service with `TEST_DATABASE_URL`;
      - semgrep (the same rulesets as `scan.sh`);
      - pip-audit.
    - Any failure fails the workflow.
    - The existing `build-apk.yml` is untouched.
    - `backend/README.md` documents how to run the same commands locally.
  - Files: .github/workflows/ci.yml, backend/README.md

- [ ] Task 5: GitHub Actions: eslint, Playwright and npm audit (P0)
  - Acceptance:
    - `ci.yml` gains a web job:
      - `npm ci`, eslint, and `npx playwright install --with-deps chromium`;
      - starts the API and web app the way `playwright.config.js` expects, and runs the full Playwright suite;
      - uploads `tests/screenshots` and `test-results` as artifacts when it fails;
      - runs `npm audit --audit-level=high`.
    - Locally, `npx playwright test` still passes.
  - Files: .github/workflows/ci.yml, playwright.config.js (only if CI needs a flag)

- [ ] Task 6: Docker Compose: api and web services (P0)
  - Acceptance:
    - `backend/Dockerfile` builds the API on `python:3.12-slim`, runs `alembic upgrade head`, then uvicorn.
    - `docker-compose.yml` at the repository root has:
      - `db` (PostgreSQL 16, moved from `backend/docker-compose.yml` and keeping the same volume name);
      - `api` (depends on a healthy `db`, with a health check on `/health`);
      - `web` (serves `www/` on 8080).
    - `docker compose up` gives a working sign-in against the seeded users.
    - Secrets come from `.env`; a `.env.example` is added and `.env` is git-ignored.
    - `backend/docker-compose.yml` is removed, and README.md is updated.
  - Files: backend/Dockerfile, docker-compose.yml, .env.example, .gitignore, README.md, backend/docker-compose.yml

### S01 — Identity, roles, sessions, admin

- [ ] Task 7: Add the PRD staff roles (P0)
  - Acceptance:
    - `Role` gains `structural_consultant`, `mep_consultant`, `interior_designer`, `accounts` and `office_coordinator`.
    - The existing roles keep their values. `architect` is the Project Architect and Architect, `team_lead` the Reviewer and Team Lead, `civil_engineer` the Civil and Site Engineer, and `admin` the Principal Architect and Admin. This mapping is documented in `models.py` and in decision 0003.
    - A migration is added if the column needs one; `test_migrations.py` covers it.
    - The seed adds one user per new role.
    - The route-walk test still passes: the new roles are staff, and clients are still refused.
    - A new test shows each new role can sign in and reach `/auth/me`.
  - Files: backend/app/models.py, backend/app/seed.py, backend/migrations/versions/0010_*.py (if needed), backend/tests/test_roles.py

- [ ] Task 8: Assign stages to the new roles (P0)
  - Acceptance:
    - In `stage_config.py`:
      - `structural_design` and `structural_package` are owned by `structural_consultant`;
      - `mep` by `mep_consultant`;
      - `payment_gate` by `accounts`;
      - `grid_freeze` stays with `team_lead`.
    - The owner mapping carries a `TBD_PARVEZ` comment (stage owners).
    - The Architect and Team Lead can still complete any ordinary stage.
    - `notify.stage_ready` reaches project members with the owner role.
    - `test_stage_config.py` and `test_stage_completion.py` gain a case: a structural consultant who is a project member completes `structural_design`, while a civil engineer gets 403.
  - Files: backend/app/stage_config.py, backend/app/services/stages.py, backend/tests/test_stage_completion.py, backend/tests/test_stage_config.py

- [ ] Task 9: Sessions and refresh tokens (P0)
  - Acceptance:
    - A new `UserSession` model has user, refresh token hash, created, last used, expires, revoked, and user agent. It has a migration.
    - `/auth/login` and `/auth/activate` create a session and return `refresh_token` alongside `access_token`. The access token carries `sid`.
    - `POST /auth/refresh` rotates the refresh token and issues a new access token. A reused old refresh token is refused (401) and revokes that session.
    - `get_current_user` rejects an access token whose session is revoked or missing.
    - The token lifetimes are settings marked for confirmation by TAN GLOBUS AI.
    - `web-src/api.js` stores the refresh token and retries once on 401 through `/auth/refresh`.
    - Tests: `test_sessions.py` covers login, refresh, rotation, reuse detection, and an expired refresh token.
  - Files: backend/app/models.py, backend/migrations/versions/0011_user_sessions.py, backend/app/auth.py, backend/app/deps.py, backend/app/routers/auth.py, backend/app/config.py, web-src/api.js, backend/tests/test_sessions.py

- [ ] Task 10: Sign out and sign out everywhere (P0)
  - Acceptance:
    - `POST /auth/logout` revokes the current session; `POST /auth/logout-all` revokes every session for the user. Both are audited.
    - An access token from a revoked session gets 401 on the next request.
    - An Admin deactivating a user revokes that user's sessions.
    - The web Sign out button calls logout.
    - The menu offers "Sign out on all devices" (`data-testid="signout-all"`).
    - Tests cover each case. An E2E test signs in two browser contexts, signs out everywhere from one, and the other is sent to sign-in on its next action (with screenshots).
  - Files: backend/app/routers/auth.py, web-src/app.js, web-src/api.js, backend/tests/test_sessions.py, tests/e2e/v4-sessions.spec.js

- [ ] Task 11: Audit before-and-after summary (P0)
  - Acceptance:
    - `audit.record` accepts `changes={field: [old, new]}`, stored in `detail["changes"]`.
    - The Legal Approval update, project edits, and the admin user and membership changes (Task 12) pass their changes.
    - A helper `diff(obj, fields, new_values)` builds the dict.
    - Secret fields (password hash, token hashes) are never included; a test asserts this.
    - `test_audit.py` checks a Legal Approval change records old and new status.
  - Files: backend/app/services/audit.py, backend/app/routers/legal.py, backend/tests/test_audit.py

- [ ] Task 12: Admin API for users and project memberships (P0)
  - Acceptance:
    - New module `backend/app/modules/identity/admin.py` (Admin only):
      - `GET /admin/users`;
      - `POST /admin/users` (name, email, staff role; returns a one-time temporary password);
      - `PATCH /admin/users/{id}` (role, active);
      - `POST` and `DELETE /projects/{id}/members/{user_id}`.
    - Client users can't be created here (they use the invite flow), and nobody can change their own role or deactivate themselves.
    - Every change is audited with before and after values.
    - Non-admins get 403, and the route walk still passes.
  - Files: backend/app/modules/identity/__init__.py, backend/app/modules/identity/admin.py, backend/app/main.py, backend/tests/test_admin_users.py

- [ ] Task 13: Admin web screens for users and memberships (P0)
  - Acceptance:
    - The Admin sees a "Team" navigation item with a users table and an add-user form. The temporary password is shown once.
    - The users table has role and active controls.
    - The project page has a members panel to add or remove staff, which only the Admin sees.
    - All controls have `data-testid`s.
    - E2E `v4-admin.spec.js` covers:
      - the Admin adds a Structural Consultant;
      - the Admin adds them to a project;
      - the consultant signs in and sees that project.
    - Screenshots are saved.
  - Files: web-src/app.js, web-src/api.js, web-src/app.html, tests/e2e/v4-admin.spec.js

### S02 and S03 — Workflow engine and template

- [ ] Task 14: Gate evaluator registry and multiple gates per stage (P0)
  - Acceptance:
    - `backend/app/modules/workflow/gates.py` has `register(gate_type)` as a decorator and `reasons(stage, facts)`, which concatenates the reasons from every gate on the stage.
    - `stage_config` stages use `gates: [...]` instead of `gate`. Current stages keep their current gates, and `SIGNOFF_STAGES` is derived from the lists.
    - The three existing gates become registered evaluators with unchanged reason text.
    - An unknown gate type fails `test_stage_config.py`.
    - Every existing stage-engine, API and E2E test passes unchanged, apart from the `gate` to `gates` key.
  - Files: backend/app/modules/workflow/__init__.py, backend/app/modules/workflow/gates.py, backend/app/stage_config.py, backend/app/services/stages.py, backend/app/routers/stages.py, backend/tests/test_stage_config.py, backend/tests/test_gates.py

- [ ] Task 15: In-process domain event bus (P0)
  - Acceptance:
    - `backend/app/modules/workflow/events.py` provides `subscribe(event_type, handler)` and `publish(db, event_type, **payload)`. It is synchronous, in the same transaction, and runs handlers in registration order.
    - `stages.release` and `stages.complete` publish `stage.activated` and `stage.completed`.
    - The `stage_ready` notification moves to a subscriber, with no direct call.
    - A test shows a handler error rolls back the transaction, so no half-applied stage change remains.
    - `test_notifications.py` still passes.
  - Files: backend/app/modules/workflow/events.py, backend/app/services/stages.py, backend/app/services/notify.py, backend/tests/test_events.py

- [ ] Task 16: Placeholder gates with a recorded exception (P0)
  - Acceptance:
    - Register placeholder evaluators and add them to stages:
      - `payment` on `payment_gate`;
      - `finding_disposition` on `grid_freeze`;
      - `issue_closure` on `mep`;
      - `document_status` on `detailed_drawings`;
      - `checklist` on `civil_completion`, alongside the existing gate.
    - Each placeholder blocks with "<Gate name> is not built in SiteFlow yet. An Admin or Team Lead can record an exception with a reason."
    - A new `StageException` model (project, stage, gate, reason, by, at) is immutable, with a migration.
    - `POST /projects/{id}/stages/{key}/exceptions` (roles from `EXCEPTION_ROLES`, marked `TBD_PARVEZ`) needs a reason (422 without one). It is audited, publishes `stage.exception_recorded`, and clears only that gate.
    - The tracker shows the exception ("Exception recorded by … : reason"), and staff can record one from the stage detail (`data-testid="stage-exception-<key>"`).
    - Tests and fixtures that pass these stages are updated.
    - An E2E test records an exception on the 50% upfront gate and completes the stage, with screenshots.
  - Files: backend/app/modules/workflow/gates.py, backend/app/modules/workflow/exceptions.py, backend/app/models.py, backend/migrations/versions/0012_stage_exceptions.py, backend/app/stage_config.py, backend/app/workflow_config.py, web-src/app.js, web-src/api.js, backend/tests/test_stage_exceptions.py, tests/e2e/v4-exceptions.spec.js

### S04 — Project records and onboarding

- [ ] Task 17: Client, contacts and Site records (P0)
  - Acceptance:
    - New models, with a migration and a nullable `client_id` and `site_id` on `projects`:
      - `Client` (name, type, notes);
      - `ClientContact` (client, name, email, phone, is_signatory);
      - `Site` (address, GPS latitude and longitude, city).
    - `POST /projects` accepts `client` and `site`, either as ids or inline objects. The project detail returns them.
    - Staff can list and create clients (`/clients`).
    - A client-role user still sees only the allow-listed fields: the client view tests pass, and no contact phone numbers leak.
    - The New project form gains client and site fields.
    - Tests: `test_clients_sites.py`.
  - Files: backend/app/modules/projects/__init__.py, backend/app/modules/projects/clients.py, backend/app/models.py, backend/migrations/versions/0013_clients_sites.py, backend/app/routers/projects.py, web-src/app.js, web-src/api.js, backend/tests/test_clients_sites.py

- [ ] Task 18: Project fee plan fields (P0)
  - Acceptance:
    - `projects` gains `contract_value` (numeric), `currency` (default INR), `fee_basis` (text) and `fee_notes`, with a migration.
    - Architect, Admin and Accounts can set them through `PATCH /projects/{id}/fee-plan`, with the change audited before and after.
    - Values are validated: the contract value is 0 or more, and currency is a 3-letter code.
    - The fee basis carries the D-05 note in its help text. No percentages are seeded.
    - Tests: `test_fee_plan.py`.
  - Files: backend/app/models.py, backend/migrations/versions/0014_fee_plan.py, backend/app/modules/projects/fee_plan.py, backend/tests/test_fee_plan.py

- [ ] Task 19: Field-level rules for commercial fields (P0)
  - Acceptance:
    - `backend/app/modules/identity/fields.py` defines `FIELD_RULES = {"fee_plan": [...roles]}`. The default is admin, accounts, team_lead and architect, marked `TBD_PARVEZ`.
    - `visible_fields(user, obj_dict)` removes denied keys, and it is applied in project detail, project list, dashboard rows and the fee-plan route. A denied role gets 403 on `PATCH` and never sees the keys in `GET`.
    - The client role never sees them.
    - A test walks project detail, list and dashboard as every role and asserts that the fee keys appear only for allowed roles.
    - The UI hides the fee panel when the keys are absent.
  - Files: backend/app/modules/identity/fields.py, backend/app/routers/projects.py, backend/app/routers/dashboard.py, web-src/app.js, backend/tests/test_field_rules.py

- [ ] Task 20: CSV import preview (P0)
  - Acceptance:
    - `POST /admin/import/projects/preview` (Admin only; multipart CSV, up to 1 MB and 500 rows) parses the file. The columns are project name, location, client name, client email, site address, current stage key, civil engineer email, confirmed by and legal expected date.
    - It returns per-row `ok` or `errors` (unknown stage, unknown engineer, missing required field, duplicate project name in the file or the database) and writes nothing.
    - A downloadable template CSV is served at `/admin/import/projects/template`.
    - Formula-injection cells (starting with `=`, `+`, `-` or `@`) are rejected with a row error.
    - Tests: `test_import.py` covers the preview with good and bad rows.
  - Files: backend/app/modules/projects/importer.py, backend/app/main.py, backend/tests/test_import.py

- [ ] Task 21: CSV import commit and ImportBatch (P0)
  - Acceptance:
    - `POST /admin/import/projects/commit` takes the same file plus `mode` ("all_or_nothing" or "valid_rows_only").
    - In all-or-nothing mode, any error imports nothing (422, with the row errors).
    - Valid-rows mode imports good rows only.
    - Each imported project goes through the same code path as a normal onboarding: client, site, historical stages up to the current stage with the confirmer, then release.
    - An `ImportBatch` row (who, when, filename, sha256, mode, counts, errors) is written, with a migration. The commit is audited, and the batch is listed at `GET /admin/import/batches`.
    - Tests cover both modes and the historical stages of an imported project.
  - Files: backend/app/models.py, backend/migrations/versions/0015_import_batches.py, backend/app/modules/projects/importer.py, backend/tests/test_import.py

- [ ] Task 22: Import screen (P0)
  - Acceptance:
    - The Admin "Import projects" screen offers:
      - a template download and a file picker;
      - a preview table with row errors highlighted in text as well as colour;
      - a mode choice and a commit button;
      - the result, with a link to each new project.
    - All controls have `data-testid`s.
    - E2E `v4-import.spec.js` imports a 3-row file with 1 bad row: first all-or-nothing is refused, then valid-rows-only creates 2 projects. One of them shows historical stages. Screenshots are saved.
  - Files: web-src/app.js, web-src/api.js, web-src/app.html, tests/e2e/v4-import.spec.js, tests/e2e/fixtures/import-3rows.csv

### Stage completion with files (requested 28 September 2026)

Applies to every workflow activity in the v3 tracker: staff mark a stage complete with a text note and attach photos, videos, AutoCAD drawings (DWG or DXF) or PDFs.

- [ ] Task 23: Stage attachments: model, upload and file checks (P0)
  - Acceptance:
    - A new `StageAttachment` model has a migration. Fields: project, stage key, kind (photo, video, cad, document), filename, content type, size, sha256, storage key, uploaded by, uploaded at, and `completed_with` (null until the stage is completed).
    - `POST /projects/{id}/stages/{key}/attachments` (multipart) is open to anyone who may complete the stage (`can_complete` rules), on active stages and on historical stages (as evidence).
    - `filecheck` accepts:
      - JPEG, PNG and WEBP photos;
      - MP4 and WEBM videos;
      - PDF;
      - AutoCAD DWG (leading bytes `AC10`);
      - DXF (text whose first non-blank lines are `0` then `SECTION`).
    - Any other type gets 415. A declared type that doesn't match the file's bytes gets 415.
    - Size limits per kind come from `workflow_config` (`MAX_STAGE_ATTACHMENT_MB`, marked `TBD_PARVEZ`); over the limit gets 413.
    - Files are stored under random keys through the storage interface.
    - `DELETE .../attachments/{aid}` works only by the uploader while the stage isn't completed.
    - `GET .../attachments/{aid}` is a staff download, sent as an attachment with `nosniff`. DWG and DXF are never served inline.
    - Upload and removal are audited. The client route walk still returns 403 for these routes.
    - Tests: `test_stage_attachments.py` covers each accepted type, a wrong signature, too large, a locked stage, a non-owner, and remove after completion.
  - Files: backend/app/models.py, backend/migrations/versions/0016_stage_attachments.py, backend/app/services/filecheck.py, backend/app/workflow_config.py, backend/app/modules/workflow/attachments.py, backend/app/main.py, backend/tests/test_stage_attachments.py

- [ ] Task 24: Mark complete with a note and files (P0)
  - Acceptance:
    - `POST /projects/{id}/stages/{key}/complete` still requires the text note (422 without it). Every pending attachment of that stage is linked to the completion (`completed_with`).
    - A new `evidence_required` setting per stage in `stage_config` (default: none required, marked `TBD_PARVEZ`) can require at least one file of a kind. When it isn't met, the completion gets 422 with `missing: ["attachments"]` and a plain-language reason, and the stage detail shows the same reason before submitting.
    - After completion the stage's files and note are immutable: a before-flush guard blocks changes, as for sign-offs.
    - The tracker response lists each stage's attachments (id, kind, filename, size, uploaded by, time) and the completion note.
    - Client sign-off stages are unchanged: they still complete only by client approval.
    - Tests cover completion with files, a missing required file, and the immutability guard.
  - Files: backend/app/routers/stages.py, backend/app/services/stages.py, backend/app/stage_config.py, backend/app/models.py, backend/tests/test_stage_completion.py, backend/tests/test_stage_attachments.py

- [ ] Task 25: Stage detail: attach files and mark complete (P0)
  - Acceptance:
    - In the stage detail, beside the "What was completed?" note (the area circled in the screenshot of 28 September 2026), add:
      - "Add photo" (opens the camera on mobile, through `capture`);
      - "Add video";
      - "Add drawing or document" (`.dwg`, `.dxf` and `.pdf`).
    - Each shows upload progress. The list shows photo thumbnails, and a file chip with name and size for DWG, DXF, PDF and video; each item has a Remove control.
    - "Mark complete" sends the note. When the stage requires evidence, the button stays disabled until a file is attached, with the reason shown.
    - All controls have `data-testid`s (`stage-attach-photo-<key>`, `stage-attach-video-<key>`, `stage-attach-file-<key>`, `stage-file-<id>`, `stage-file-remove-<id>`).
    - It works at phone width.
    - E2E `v4-stage-files.spec.js`: attach a photo, a DWG and a PDF, remove one, mark complete with a note, then see the files on the completed stage. It also runs in a phone viewport. Screenshots are saved.
  - Files: web-src/app.js, web-src/api.js, web-src/app.html, tests/e2e/v4-stage-files.spec.js, tests/e2e/helpers.js

- [ ] Task 26: Completed stages show their note and files; clients don't see them (P0)
  - Acceptance:
    - A completed or historical stage shows the completion note, who completed it and when, and its files: images open in the viewer, and DWG, DXF, PDF and video download. The stage chip shows "N files".
    - The completion is audited with the file list.
    - The client view (`client_view.py`) never includes stage attachments or completion notes. The allow-list key test is extended, and a client request for a stage attachment id gets 404.
    - The client demo is unchanged (sprint v4 PRD, R-16); this is recorded in `docs/PROGRESS.md` as a possible later demo update.
  - Files: web-src/app.js, backend/app/services/client_view.py, backend/tests/test_client_view.py, docs/PROGRESS.md

### Dashboard workflow callout (requested 28 September 2026)

On the dashboard and the Projects cards, the progress dashes become phase icons taken from the workflow diagram, and hovering over a project shows its complete workflow as a callout drawn like that diagram. Each stage is coloured green (completed), yellow (waiting) or red (delayed), always with an icon and text as well as the colour.

- [ ] Task 27: Workflow health per stage for the dashboard (P0)
  - Acceptance:
    - `backend/app/modules/workflow/health.py` provides `stage_health(project)`, which returns every stage with `health` and `reason`:
      - `done`: completed or historical, shown green;
      - `waiting`: active or blocked, shown yellow; the reason is the engine's first reason or "In progress";
      - `delayed`: shown red; the rules are below;
      - `upcoming`: locked, shown grey.
    - A stage is `delayed` when either:
      - an open red flag applies to it:
        - Legal delay → Site line-out;
        - Client decision overdue → the sign-off stage it names;
        - Critical issue, Overdue fix, Review overdue or No recent visit → Construction quality stages;
      - or it has been active longer than `STAGE_DELAYED_AFTER_DAYS[stage]`. That setting is in `workflow_config`, empty by default so the rule is off, and marked `TBD_PARVEZ`. No day counts are invented.
    - The reason names the flag or the days active.
    - Each dashboard row gains `workflow`: the phases with stages (key, number, label, health, reason) and counts per health. The same field-rule filtering applies, and no internal notes are included.
    - Clients can't reach it: the dashboard is staff only, and the route walk still passes.
    - Tests: `test_workflow_health.py` covers each colour, each flag-to-stage mapping, the days rule when configured, and the rule staying off when empty.
  - Files: backend/app/modules/workflow/health.py, backend/app/workflow_config.py, backend/app/routers/dashboard.py, backend/tests/test_workflow_health.py

- [ ] Task 28: Phase and stage icons replace the progress dashes (P0)
  - Acceptance:
    - Each phase and stage in `stage_config` gains an `icon` key, following the workflow diagram (`docs/reference/workflow-diagram.jpeg`), for example:
      - project setup: folder;
      - client discovery: people;
      - requirement baseline: document;
      - client sign-offs: check badge;
      - pre-design site visit: hard hat;
      - investigations: magnifier;
      - concept: pencil;
      - tentative elevations: drafting;
      - grid: ruler and set square;
      - freeze: people with a check;
      - structural design: gear;
      - architectural package: house;
      - structural package: frame;
      - MEP: pipes;
      - elevations: building;
      - 50% gate: payment card;
      - detailed drawings: drawing sheet;
      - line-out: surveyor;
      - construction: clipboard;
      - civil completion: city block;
      - interiors: sofa;
      - handover: key.
    - `test_stage_config.py` asserts that every phase and stage has an icon from the known set.
    - `web-src/icons.js` holds the icons as inline SVG, with no external image or font requests. `build.py` includes it in the web, Android and demo builds.
    - On the Projects cards and in the dashboard's All Projects Stage column, the 10 dash segments become 10 phase icons in order.
    - Each icon is coloured by the phase's health from Task 27, using the worst stage in the phase: green Completed, yellow Waiting, red Delayed, grey Upcoming.
    - Each icon has an `aria-label` such as "Phase 5, Client approval and commercial gate: waiting" and `data-testid="phase-icon-<project id>-<phase>"`.
    - Hovering, focusing or tapping one icon shows a small tooltip with that phase's name, its stages and their states.
    - It stays readable at phone width: the icons shrink and the strip scrolls rather than wraps.
    - The client app's timeline uses the same icons, with the client-safe states only.
    - E2E: the Projects card for a project onboarded at the design freeze shows four green phase icons and a yellow phase-5 icon. Screenshots are saved.
  - Files: backend/app/stage_config.py, backend/tests/test_stage_config.py, web-src/icons.js, web-src/build.py, web-src/app.js, web-src/app.html, tests/e2e/v4-phase-icons.spec.js

- [ ] Task 29: Workflow callout drawn like the workflow diagram (P0)
  - Acceptance:
    - In All Projects and Needs Architect Attention on the dashboard, and on each Projects card, hovering over a project (or focusing it with the keyboard, or tapping it on a touch screen) opens a callout. It has `data-testid="wf-callout-<project id>"`, `role="tooltip"`, and is linked by `aria-describedby`. A second tap or Esc closes it.
    - The callout is a small visual version of the workflow diagram:
      - a phase column on the left;
      - the stages as boxes in flow order, joined by arrows, each with its icon, number, title and one-line detail;
      - the Site and Studio pre-design workstreams side by side;
      - 8A and 8B side by side;
      - the client review and rework loop shown on stage 4.
    - Each box takes its state colour from Task 27, and the legend and counts sit at the top (for example "15 completed · 1 waiting · 1 delayed · 6 upcoming"):
      - green with a tick for Completed;
      - yellow with a clock for Waiting, with the reason;
      - red with a warning icon for Delayed, with the reason;
      - grey for Upcoming;
      - Historical boxes are green and marked "before SiteFlow".
    - Colour is never the only signal: each box carries its icon and state text, and is readable by screen readers.
    - The callout fits the viewport. On a narrow or short screen it scrolls inside itself, and at phone width it opens as a full-width sheet below the row.
    - Opening it makes no extra API call; the data comes from the dashboard and project list responses.
    - E2E `v4-dashboard-callout.spec.js`:
      - hovering a project onboarded at the design freeze shows earlier stages green and the sent sign-off yellow with its reason;
      - a project with a critical problem shows Construction quality stages red, with the reason;
      - the keyboard and phone-tap paths work.
      - Screenshots are saved.
  - Files: web-src/app.js, web-src/app.html, web-src/icons.js, tests/e2e/v4-dashboard-callout.spec.js

### P1 — Should have

- [ ] Task 30: Password reset stub (P1)
  - Acceptance:
    - An Admin can issue a reset for a staff user: a one-time token hashed at rest, a TTL setting, and single use. Nothing is emailed (no channel until S15).
    - `POST /auth/reset` with the token sets a new password (minimum 10 characters) and revokes every session.
    - It is audited.
    - Tests cover expiry, reuse and the session revocation.
  - Files: backend/app/models.py, backend/migrations/versions/0017_password_resets.py, backend/app/modules/identity/reset.py, backend/tests/test_password_reset.py

- [ ] Task 31: Approval delegation (P1)
  - Acceptance:
    - A new `ApprovalDelegation` model (delegator, delegate, start, end, reason) has a migration. A Team Lead can delegate site-visit review to another staff user for a date range.
    - The delegate can review while the range is active in the business timezone; after the end date they get 403.
    - A delegation can't exceed the delegator's authority: a civil engineer can't delegate review.
    - Creating a delegation and each review under it are audited. The review audit names both people.
    - Tests: `test_delegation.py` (active, expired, over-authority).
  - Files: backend/app/models.py, backend/migrations/versions/0018_delegations.py, backend/app/modules/identity/delegation.py, backend/app/routers/reviews.py, backend/tests/test_delegation.py

- [ ] Task 32: Activity state machine (pure) (P1)
  - Acceptance:
    - `backend/app/modules/workflow/states.py` defines the PRD 6.3 states:
      - Not Started, Ready, In Progress, Submitted, Under Review, Approved, Rework, Rejected, Completed;
      - plus Blocked, On Hold, Cancelled and Superseded.
    - It has a transition table and `transition(state, action)`, which raises on an illegal move. Rework and Reject require a comment.
    - A mapping from today's stored stage statuses to these states is documented.
    - Unit tests cover every legal transition and a sample of illegal ones.
    - Nothing is wired into ProjectStage yet: that's a follow-up task in S05, recorded in `docs/PROGRESS.md`.
  - Files: backend/app/modules/workflow/states.py, backend/tests/test_states.py

- [ ] Task 33: Pin each project to a flow version (P1)
  - Acceptance:
    - A new `FlowVersion` model (number, created_at, snapshot JSON of `stage_config.PHASES` and `STAGES`) has a migration that backfills version 1 from a frozen copy.
    - `projects.flow_version_id` is added, and new projects pin the current version.
    - The stage engine reads the project's pinned snapshot, so a later edit to `stage_config.py` doesn't change running projects.
    - A test changes the config in memory, creates a new version, and shows that an existing project keeps the old flow.
  - Files: backend/app/models.py, backend/migrations/versions/0019_flow_versions.py, backend/app/modules/workflow/versions.py, backend/app/services/stages.py, backend/tests/test_flow_versions.py

- [ ] Task 34: Map the diagram stages to PRD Stage 0 to 15 (P1)
  - Acceptance:
    - Each stage in `stage_config` gains `prd_stage` (for example setup → 0, `requirements_signoff` → 2, `line_out` → 11).
    - A test asserts that every PRD stage 0 to 15 is covered at least once.
    - The mapping table is added to `docs/V4_EXECUTION_PLAN.md` (closes R-09) and shown as a small label in the stage detail.
  - Files: backend/app/stage_config.py, backend/tests/test_stage_config.py, docs/V4_EXECUTION_PLAN.md, web-src/app.js

- [ ] Task 35: XLSX import (P1)
  - Acceptance:
    - The preview and commit also accept `.xlsx` (the first sheet, same columns) through `openpyxl`, which is added to requirements and passes pip-audit.
    - The file type is checked by its signature (a zip header), not only the extension.
    - Tests reuse the CSV cases with an XLSX fixture.
  - Files: backend/requirements.txt, backend/app/modules/projects/importer.py, backend/tests/test_import.py, backend/tests/fixtures/import.xlsx

- [ ] Task 36: Sprint close: status docs (P1)
  - Acceptance:
    - `docs/V4_EXECUTION_PLAN.md` section 2 updates S00 to S04 with the new evidence (file paths and test names) and their new status.
    - `docs/PROGRESS.md` gets a dated entry: done, not done, deviations, and open questions (stage owners, field matrix, exception roles, stage evidence rules and file size limits, stage delay thresholds, D-13 data).
    - The next sprint is named: execution-plan step 6 onwards (S05).
    - The full suites and scans are green.
  - Files: docs/V4_EXECUTION_PLAN.md, docs/PROGRESS.md
