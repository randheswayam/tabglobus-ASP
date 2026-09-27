# Sprint v1 — Tasks

## Status: In Progress

- [x] Task 1: Set up the FastAPI backend project with config and PostgreSQL (P0)
  - Acceptance: `uvicorn app.main:app` starts and `GET /health` returns `{"status":"ok"}`. `docker compose up db` starts PostgreSQL. CORS allows the web and Capacitor origins. `template_config.py` defines the 8 residential stages (Foundation, Plinth, Superstructure, Masonry, Plastering, Services, Finishes, Handover), each with placeholder checklist items and weights that sum to 100, plus the problem list from plan section 4 and `MIN_PHOTOS`. Placeholders are marked `# PLACEHOLDER: pending Parvez (D2/D3)`. `pytest` runs with one passing health test.
  - Files: backend/requirements.txt, backend/app/main.py, backend/app/config.py, backend/app/template_config.py, backend/docker-compose.yml, backend/.env.example, backend/tests/conftest.py, backend/tests/test_health.py
  - Completed: 2026-09-27. FastAPI app with /health and CORS, settings loaded from env, residential template config with 8 stages (equal 12.5 placeholder weights), problem list and MIN_PHOTOS placeholder of 5. Four tests pass on Python 3.12 venv. docker-compose.yml validates, but PostgreSQL wasn't started because Docker Desktop isn't running.

- [x] Task 2: Create database models and seed script (P0)
  - Acceptance: SQLAlchemy models exist for User (role: architect, team_lead, civil_engineer, admin), Project, ProjectMember, WorkflowStep (order 1–3, status locked, active or completed), LegalApproval, SiteVisit (status draft, submitted, rework or approved; submission_count; JSON form, checklist and problems; computed_progress), Review and AuditEvent. Tables are created on startup. `python -m app.seed` creates one user per role, including "Parvez" as team_lead, with hashed passwords. A test confirms that all tables are created on SQLite.
  - Files: backend/app/db.py, backend/app/models.py, backend/app/seed.py, backend/tests/test_models.py
  - Completed: 2026-09-27. Eight tables with enums stored as values, and JSONB on PostgreSQL with JSON elsewhere. The legal expected date lives on LegalApproval. AuditEvent is append-only, and editing or deleting one raises AuditImmutableError. Added app/passwords.py (stdlib PBKDF2-SHA256, 600k iterations, count set by env for tests). The seed script is idempotent, takes its password from SEED_PASSWORD or prints a random one. Seven new tests, 11 in total. Verified on SQLite; PostgreSQL not run yet because Docker Desktop is off.

- [x] Task 3: Implement sign-in, role checks and project visibility (P0)
  - Acceptance: `POST /auth/login` returns a JWT for valid credentials and 401 otherwise. `GET /auth/me` returns the user and role. The `require_role(...)` dependency returns 403 for the wrong role. The `visible_projects(user)` helper returns all projects for architect and team_lead, and only member projects for the others. Tests cover each case.
  - Files: backend/app/auth.py, backend/app/deps.py, backend/app/routers/auth.py, backend/tests/test_auth.py
  - Completed: 2026-09-27. HS256 JWTs through PyJWT, with sub and exp required. Login matches email case-insensitively, gives one error message for a wrong password and an unknown email, and runs a dummy hash check so both take the same time. Inactive users are rejected at login and on every request. require_role() returns 401 without a token and 403 for the wrong role. visible_projects() returns a Select statement. Added shared users and auth_headers fixtures to conftest. 19 new tests, 30 in total.

- [ ] Task 4: Create a project from the residential template (P0)
  - Acceptance: `POST /projects` (architect only) takes a name, a location, an assigned civil_engineer_id and a legal expected date. It creates the project, adds members, creates 3 WorkflowSteps (Legal Approval active, Site Visit locked, Team Lead Review locked) and a Not started LegalApproval, and writes an AuditEvent. `GET /projects` and `GET /projects/{id}` respect visibility. The detail response includes the steps, the latest visit status, official progress and the audit events. A civil engineer gets 403 on create and 404 on a non-member project.
  - Files: backend/app/routers/projects.py, backend/app/schemas.py, backend/app/services/audit.py, backend/tests/test_projects.py

- [ ] Task 5: Implement the Legal Approval step with the Step 2 unlock (P0)
  - Acceptance: `PATCH /projects/{id}/legal` (admin only) accepts an authority name, application reference, application date, approval date, document reference and status. Status moves through Not started → Applied → Approved or Rejected only. Approved without a document reference or approval date returns 422. On Approved, Step 1 becomes completed and Step 2 active. Each change writes an AuditEvent. Tests cover an invalid transition, the missing document and the unlock.
  - Files: backend/app/routers/legal.py, backend/app/services/workflow.py, backend/tests/test_legal.py

- [ ] Task 6: Implement progress derivation as a pure function (P0)
  - Acceptance: `derive_progress(current_stage, checklist_states, config)` returns a 0–100 value rounded to 1 decimal. It uses stage progress = Done ÷ total items, with earlier stages counted as 100% and later stages as 0. Multiplying weights by stage progress gives the project figure. Tests with known inputs produce the expected percentages: all Done at Handover gives 100.0, nothing Done at Foundation gives 0.0, and a mid-stage case matches a hand calculation. Unknown stages or items raise ValueError.
  - Files: backend/app/services/progress.py, backend/tests/test_progress.py

- [ ] Task 7: Implement site visit submission with mandatory validation (P0)
  - Acceptance: `POST /projects/{id}/site-visits` (assigned civil_engineer only, Step 2 active) requires visit details (date and time, location with GPS or a manual entry, weather, attendees), a current stage and a state for every checklist item of that stage. It also requires either a list of problems or `no_issues: true`. Each problem must come from the config list ("Other" needs free text) and have a severity, location, responsible party and target date. It also requires a summary and a recommended action. Missing items return 422 with a list of every missing field. On success, the visit is stored as submitted with computed_progress from Task 6, Step 2 is completed, Step 3 becomes active and an AuditEvent is written. Resubmitting a rework visit increments submission_count.
  - Files: backend/app/routers/site_visits.py, backend/app/services/validation.py, backend/tests/test_site_visits.py

- [ ] Task 8: Implement the Team Lead review (approve or rework) (P0)
  - Acceptance: `GET /reviews/queue` (team_lead only) lists submitted visits with their time waiting. `POST /site-visits/{id}/review` (team_lead only) takes `approve`, or `rework` with a comment. Rework without a comment returns 422. Approve sets the visit to approved, sets the project's official progress to the visit's computed_progress and completes Step 3. Rework sets the visit to rework, reactivates Step 2, locks Step 3 and stores the comment where the engineer can see it. Both write a Review record and an AuditEvent. A test runs the full loop through the API: create, then legal, then submit, then rework, then resubmit, then approve.
  - Files: backend/app/routers/reviews.py, backend/tests/test_reviews.py, backend/tests/test_end_to_end.py

- [ ] Task 9: Connect the web app to the API for sign-in, projects and Legal Approval (P0)
  - Acceptance: a new `api.js` wraps fetch with the base URL (`localhost:8000` on the web, `10.0.2.2:8000` on the Android emulator) and the JWT stored on the device. `build.py` includes `api.js`. The app shows a sign-in screen, and after sign-in lists only the projects returned by the API. An Architect can create a project. The project page shows the three steps with their status and the audit trail. An Admin can update Legal Approval, and the save button stays disabled for Approved until a document reference is entered. The old five-step seed data and template editor are removed from navigation.
  - Files: web-src/api.js, web-src/build.py, web-src/app.js, web-src/app.html

- [ ] Task 10: Connect the site visit form and review screen to the API (P0)
  - Acceptance: the Civil Engineer's site visit form matches the Task 7 fields, including the stage checklist and the problem picker from the config (served by `GET /template`). The draft saves to device storage and restores after reopening. Submit stays disabled, with a list of missing items, until the form is complete, and it shows the server's 422 errors when those occur. After submit, the engineer sees the derived progress as pending. Parvez's review queue opens a read-only view of the full submission with Approve, and with Request rework plus a comment box. On rework, the engineer sees the comment and can resubmit. `python web-src/build.py` produces a working `www/index.html`.
  - Files: web-src/app.js, web-src/app.html, backend/app/routers/template.py
