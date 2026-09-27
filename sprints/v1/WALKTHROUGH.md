# Sprint v1 — Walkthrough

## Summary
Sprint v1 built the smallest working version of the SiteFlow MVP loop on a real backend. It runs the three-step residential workflow, **Legal Approval → Site Visit → Team Lead Review**, end to end. An Admin records the approval, the Civil Engineer submits a mandatory site visit form, the system derives progress from the stage checklist, and Parvez approves it or sends it back for rework.

The backend is FastAPI with SQLAlchemy (PostgreSQL in configuration, SQLite in tests). The existing SiteFlow web and Android app code was rewritten to call the API in place of its local demo engine. It is covered by 111 backend tests and 6 Playwright end-to-end tests.

This sprint is the first **Build** increment of the Build → Deploy → Evaluate → Maintain lifecycle.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  SiteFlow app  (web-src/ → built into www/index.html)                │
│  One codebase: web console in a browser, Android via Capacitor 7     │
│                                                                      │
│  Sign in ─▶ Projects ─▶ Project page ─┬─▶ Legal Approval form (Admin)│
│                 │                     ├─▶ Site visit form (Engineer) │
│                 │                     └─▶ Review screen (Parvez)     │
│                 └─▶ Review queue (Parvez)                            │
│                                                                      │
│  app.js (views, events) ──▶ api.js (fetch + JWT) ──┐                 │
│  Site visit draft ──▶ localStorage (on the device) │                 │
└────────────────────────────────────────────────────┼─────────────────┘
                                                     │ HTTP + JSON
                                                     │ Authorization: Bearer <JWT>
┌────────────────────────────────────────────────────▼─────────────────┐
│  FastAPI backend  (backend/app)                                      │
│                                                                      │
│  routers/   auth · projects · legal · site_visits · reviews · template│
│      │                                                               │
│  deps.py    get_current_user · require_role · visible_projects       │
│      │                                                               │
│  services/  workflow (step changes) · validation (visit form)        │
│             progress (derived %) · audit (append-only events)        │
│      │                                                               │
│  template_config.py  stages, checklists, weights, problem list       │
│  models.py  SQLAlchemy entities ── db.py ──┐                         │
└────────────────────────────────────────────┼─────────────────────────┘
                                             ▼
                          PostgreSQL (docker-compose)  or  SQLite (tests)
```

## Files Created/Modified

Paths are relative to `Code/`.

---

### backend/requirements.txt
**Purpose**: Python dependencies for the backend and its tests.

**How it works**:
It lists the FastAPI stack: `fastapi`, `uvicorn[standard]`, `sqlalchemy>=2.0`, `psycopg[binary]` (the PostgreSQL driver), `pydantic`, `pydantic-settings`, `PyJWT`, `pytest` and `httpx`.

Password hashing uses Python's standard library, so there is no bcrypt or argon2 dependency. The virtual environment lives in `backend/.venv` and runs on Python 3.12, because the machine's default Python 3.10 is older than the PRD's 3.11 minimum.

---

### backend/pytest.ini
**Purpose**: Puts `backend/` on the import path and points pytest at `tests/`.

---

### backend/docker-compose.yml
**Purpose**: A local PostgreSQL 16 database (`siteflow`/`siteflow`, port 5432) with a named volume.

**How it works**:
Run `docker compose up -d db` in `backend/`. The app's default `DATABASE_URL` points at this database. The database was **not** started during the sprint because Docker Desktop was off, so every run so far used SQLite.

---

### backend/.env.example and backend/.gitignore
**Purpose**: `.env.example` documents `DATABASE_URL`, `JWT_SECRET` and `JWT_EXPIRE_MINUTES`. `.gitignore` keeps `.venv/`, caches and the real `.env` out of git.

---

### backend/app/config.py
**Purpose**: Typed settings read from environment variables and `.env`.

**Key Functions/Components**:
- `Settings`: `database_url`, `jwt_secret`, `jwt_expire_minutes` and `cors_origins`.
- `get_settings()`: a cached single instance.

**How it works**:
It uses `pydantic-settings`, so `DATABASE_URL=...` in the environment overrides the default. `cors_origins` lists the only origins allowed to call the API: the local web server on port 8080, a dev server on 5173, and the Capacitor WebView origins (`capacitor://localhost`, `https://localhost`).

The default `jwt_secret` is a development placeholder, `change-me-in-env`. It must be replaced before anything is deployed.

---

### backend/app/template_config.py
**Purpose**: The fixed residential template, which is the single source of truth for the workflow and the site visit form.

**Key contents**:
- `WORKFLOW_STEPS`: the three step names, in order.
- `STAGES`: eight construction stages (Foundation, Plinth, Superstructure, Masonry, Plastering, Services, Finishes, Handover). Each has a `weight` and a `checklist` of `{id, label}` items.
- `CHECKLIST_STATES`: `Done`, `In progress` or `Not started`.
- `PROBLEMS`: the prepopulated problem list by category. `Other` is empty because it takes free text.
- `SEVERITIES`: Low, Medium, High or Critical.
- `MIN_PHOTOS`: the minimum photo count.

**How it works**:
Several values are **placeholders** waiting on Parvez, and are marked in the file:
- Every stage weight is 12.5, an equal split (decision D2).
- The checklist items are drafts for the P1 workshop.
- `MIN_PHOTOS = 5`, taken from the prototype (decision D3). It is not enforced yet, because photo capture is in v2.

Both the server's validation and the app's form read this one file, served to the app through `GET /template`. Changing a weight or a checklist item needs no code change anywhere else.

---

### backend/app/db.py
**Purpose**: The SQLAlchemy engine, the session factory, the `get_db` request dependency, and `create_all()`.

**How it works**:
An in-memory SQLite URL gets a `StaticPool`, so every session in a test run shares one connection and therefore one database. Any other URL, such as PostgreSQL or a SQLite file, gets a normal pool with `pool_pre_ping`.

```python
def _make_engine(url: str):
    if url.startswith("sqlite") and ":memory:" in url:
        return create_engine(url, connect_args={"check_same_thread": False}, poolclass=StaticPool)
    return create_engine(url, pool_pre_ping=True)
```

`create_all()` imports `models` so every table is registered, then creates the tables. It runs at app startup. There are no Alembic migrations yet.

---

### backend/app/models.py
**Purpose**: The database schema: eight tables and their enums.

**Key Functions/Components**:
- **Enums**:
  - `Role`: architect, team_lead, civil_engineer or admin.
  - `StepStatus`: locked, active or completed.
  - `LegalStatus`: Not started, Applied, Approved or Rejected.
  - `VisitStatus`: draft, submitted, rework or approved.
  - `ReviewDecision`: approve or rework.
- **`User`**: name, unique email, role, `password_hash`, `is_active`.
- **`Project`**: name, location, template id and version, `created_by_id`, `official_progress`.
- **`ProjectMember`**: links a user to a project. Each pair is unique.
- **`WorkflowStep`**: `order` 1 to 3, name, status, and when the step was activated and completed. `(project_id, order)` is unique.
- **`LegalApproval`**: one per project. It holds the status, authority, reference, application date, approval date, expected date and document reference.
- **`SiteVisit`**: status, `submission_count`, `current_stage`, and JSON columns `form`, `checklist` and `problems`. Also `no_issues`, `computed_progress` and `submitted_at`.
- **`Review`**: the decision, an optional comment and the reviewer.
- **`AuditEvent`**: actor, action, entity and a JSON `detail`.

**How it works**:
Enums are stored as their **values**, such as `"Not started"`, in portable VARCHAR columns. The API and the database therefore use the same strings. JSON columns become `JSONB` on PostgreSQL and plain `JSON` elsewhere.

The audit trail must not be editable (F10), so a session-level hook refuses any flush that changes or deletes an `AuditEvent`:

```python
@event.listens_for(Session, "before_flush")
def _block_audit_changes(session, _ctx, _instances):
    for obj in session.deleted:
        if isinstance(obj, AuditEvent):
            raise AuditImmutableError("Audit events are append-only")
    for obj in session.dirty:
        if isinstance(obj, AuditEvent) and session.is_modified(obj):
            raise AuditImmutableError("Audit events are append-only")
```

This protects against application code only. Someone with direct database access could still change rows; database-level protection belongs in the v3 security work.

---

### backend/app/passwords.py
**Purpose**: Password hashing and verification with PBKDF2-SHA256 from the standard library.

**Key Functions/Components**:
- `hash_password(pw)`: returns a hash string in the form `pbkdf2_sha256$<iterations>$<salt>$<digest>`.
- `verify_password(pw, stored)`: recomputes the hash and compares it in constant time.

**How it works**:
Each hash gets a random 16-byte salt and 600,000 iterations. The iteration count is stored inside each hash, so verification always uses the count the hash was made with.

That also makes the count safe to change: tests set `PASSWORD_HASH_ITERATIONS=1000`, which brought the suite from 38 seconds down to under 1 second, and hashes made at other counts still verify.

---

### backend/app/auth.py
**Purpose**: Creating and checking the sign-in tokens (JWTs).

**Key Functions/Components**:
- `create_access_token(user_id, expires_in=None)`: signs `{sub, iat, exp}` with HS256.
- `decode_access_token(token)`: returns the user id. It raises `InvalidToken` for a bad signature, an expired token, a missing claim or a non-numeric subject.

**How it works**:
Decoding pins the algorithm list to `["HS256"]` and requires both `sub` and `exp`. A token that claims a different algorithm, or has no expiry, is rejected.

---

### backend/app/deps.py
**Purpose**: The FastAPI dependencies that every protected endpoint uses.

**Key Functions/Components**:
- `get_current_user`: reads the Bearer token, loads the user, and returns 401 if the token is missing or invalid, the user doesn't exist, or the user is inactive.
- `require_role(*roles)`: a dependency factory that returns 403 when the user's role isn't allowed.
- `visible_projects(user)`: returns a `Select` statement for the projects this user may see.
- `get_visible_project(project_id)`: loads one project, or returns 404.

**How it works**:
The access rule from the plan, "users see only projects they are members of; Parvez and the Architect see all projects," lives in one place:

```python
ALL_PROJECTS_ROLES = {Role.architect, Role.team_lead}

def visible_projects(user: User) -> Select:
    stmt = select(Project).order_by(Project.id)
    if user.role in ALL_PROJECTS_ROLES:
        return stmt
    return stmt.where(Project.id.in_(
        select(ProjectMember.project_id).where(ProjectMember.user_id == user.id)))
```

`get_visible_project` returns 404 both for a project that doesn't exist and for one the user can't see. A user therefore can't discover which project IDs exist. Endpoints list `require_role` before `get_visible_project`, so a wrong role gets 403 before the visibility check runs.

---

### backend/app/main.py
**Purpose**: The FastAPI app: its startup, CORS and routers.

**How it works**:
A lifespan hook calls `create_all()` at startup. CORS allows only the configured origins, the methods GET, POST, PATCH and OPTIONS, and the `Authorization` and `Content-Type` headers. Credentials (cookies) are disabled, because the token travels in a header.

The app registers the routers for auth, projects, legal, site visits, reviews and template, and exposes `GET /health`, which returns `{"status": "ok"}`.

---

### backend/app/seed.py
**Purpose**: `python -m app.seed` creates one demo user per role.

**Key Functions/Components**:
- `SEED_USERS`, all with `@siteflow.local` emails:
  - Meera Joshi, Architect
  - **Parvez**, Team Lead
  - Farhan Shaikh, Civil Engineer
  - Office Coordinator, Admin
- `seed(db, password)`: can run repeatedly, because it looks users up by email first.

**How it works**:
The password comes from `SEED_PASSWORD`. If that isn't set, a random one is generated and printed once. No password is hard-coded.

---

### backend/app/schemas.py
**Purpose**: The input model for project creation, and the functions that shape API responses.

**Key Functions/Components**:
- `ProjectIn`: name, location, `civil_engineer_id`, optional `legal_expected_date`. Blank names and locations are rejected.
- `project_summary(p)`: one card in the project list, with the current step, official progress, latest visit status and engineer.
- `project_detail(db, p)`: the summary plus the template, steps, Legal Approval, latest visit and full audit trail.
- `visit_brief(v)` and `visit_out(v)`: the short and full forms of a site visit. The full form adds the form data, checklist, problems and review history.
- `iso_utc(t)`: formats a timestamp in ISO 8601 with an explicit `+00:00` offset.

**How it works**:
`visit_brief` shows the latest rework comment only while the visit is actually in rework. The engineer sees Parvez's note until they resubmit.

`iso_utc` exists because SQLite returns datetimes without a timezone. Without it the browser treated UTC times as local time, and times appeared 5.5 hours off in India. An end-to-end test caught this, and two pytest tests now guard it.

---

### backend/app/services/audit.py
**Purpose**: `record(db, actor, action, *, project_id, entity_type, entity_id, detail)` adds an `AuditEvent` to the session.

**How it works**:
It deliberately doesn't commit. The event is saved in the same transaction as the change it describes, so an audit record can't exist without its change, and the reverse is also true.

---

### backend/app/services/workflow.py
**Purpose**: Step changes for the three-step workflow, each one audited.

**Key Functions/Components**:
- Constants: `LEGAL = 1`, `SITE_VISIT = 2`, `REVIEW = 3`.
- `step(project, order)` and `is_active(project, order)`.
- `activate`, `complete` and `lock`: set the step's status and timestamps, and record `step.activated`, `step.completed` or `step.locked`.

**How it works**:
A change to the status a step already has does nothing and records nothing, so the audit trail only shows real changes. Every router moves steps through these three functions rather than setting `status` directly.

---

### backend/app/services/progress.py
**Purpose**: Derived progress, which is calculated and never typed in (F7).

**Key Functions/Components**:
- `derive_progress(current_stage, checklist_states, config=None)`: returns a value from 0 to 100, rounded half up to one decimal.

**How it works**:
A visit records the checklist for its **current stage** only. Stages before it count as complete, stages after it count as zero, and the current stage counts by the share of its items that are Done:

```python
done = sum(1 for i in item_ids if checklist_states.get(i) == "Done")
total = sum((Decimal(str(s["weight"])) for s in stages[:idx]), Decimal(0))
total += Decimal(str(stage["weight"])) * Decimal(done) / Decimal(len(item_ids))
return float(total.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
```

For example, a visit at Plinth with 1 of 3 items Done gives 12.5 (Foundation) + 12.5 × 1/3 = **16.7%**. The calculation uses `Decimal` so that half-up rounding is exact; floats would round 56.25 down to 56.2.

The function raises `ValueError` for an unknown stage, an item from another stage, an invalid state, or weights that don't sum to 100. Counting earlier stages as complete is **my interpretation** of the plan, and Parvez needs to confirm it under D2.

---

### backend/app/services/validation.py
**Purpose**: The mandatory-field check for a site visit submission (F4 and F6).

**Key Functions/Components**:
- Loose Pydantic models, with every field optional: `SiteVisitIn`, `LocationIn`, `GpsIn` and `ProblemIn`.
- `validate_site_visit(v)`: returns two lists of field paths, `(missing, invalid)`.

**How it works**:
Every field is optional at the parsing stage so the endpoint can report **every** problem at once, instead of FastAPI's first-error-per-field format. The paths are written so the app can turn them into readable labels, for example `problems[0].severity`.

The rules:
- **Visit details:** the date and time, weather, attendees, stage, summary and recommended action are all required.
- **Location:** GPS or a manual description is required, and GPS coordinates are range-checked.
- **Checklist:** every item of the selected stage needs a valid state.
- **Problems:** there must be at least one problem, or `no_issues`, but not both.
- **Each problem:** it needs a category and problem from the config list (or free text for Other), a severity, a location, a responsible party and a target date.

---

### backend/app/routers/auth.py
**Purpose**: `POST /auth/login` and `GET /auth/me`.

**How it works**:
Login matches the email case-insensitively. A wrong password and an unknown email both return 401 with the same message, "Incorrect email or password."

To stop the response time from revealing which emails exist, an unknown email is still checked against a dummy hash:

```python
ok = verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
if not (user and ok and user.is_active):
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
```

The response contains `access_token`, `token_type` and `user`, which holds the id, name, email and role.

---

### backend/app/routers/projects.py
**Purpose**: Creating and reading projects (F2), plus a user list for the assignment picker.

**Key Functions/Components**:
- `POST /projects` (Architect only): creates the project from the residential template.
- `GET /projects`: the visible projects, as summaries.
- `GET /projects/{id}`: one visible project in full.
- `GET /users?role=` (Architect only): active users, for choosing the Civil Engineer.

**How it works**:
Creating a project does all of this in one transaction:
- Checks the assignee is an active Civil Engineer, and returns 422 if not.
- Adds the members: the creating Architect, the assigned engineer and **every active Admin**. Without the Admins, the access rule would lock them out of Legal Approval.
- Creates the three steps, with Legal Approval active and the other two locked.
- Creates a Not started `LegalApproval` with the expected date.
- Writes a `project.created` audit event.

---

### backend/app/routers/legal.py
**Purpose**: `PATCH /projects/{id}/legal` (Admin only), which is Step 1 (F3).

**How it works**:
Status can only move along the allowed paths. Approved and Rejected are final, so any change after either returns 409:

```python
_NEXT = {
    LegalStatus.not_started: {LegalStatus.applied},
    LegalStatus.applied: {LegalStatus.approved, LegalStatus.rejected},
}
```

The request is merged with the stored record, then checked against the fields the target status needs:
- **Applied** needs the authority, the reference and the application date.
- **Approved** also needs the approval date and a non-blank document reference, and the approval date can't be earlier than the application date.

Anything missing returns 422 with `{message, missing}`. Fields can be saved without a status change while the record is still open.

Every change writes `legal.updated` with the old and new status. On **Approved**, the workflow service completes Step 1 and activates Step 2.

---

### backend/app/routers/site_visits.py
**Purpose**: `POST /projects/{id}/site-visits` (the assigned Civil Engineer) and `GET /site-visits/{id}` (anyone who can see the project).

**How it works**:
A submission is refused in these cases:
- **403** if the user isn't a Civil Engineer.
- **404** if the engineer isn't assigned to the project.
- **409** if Step 2 isn't active, for example while the approval is pending or a visit is waiting for review.
- **422** with the full `missing` and `invalid` lists from the validation service.

A resubmission after rework reuses the same visit row, so its history stays in one place:

```python
visit = next((v for v in project.site_visits if v.status == VisitStatus.rework), None)
if visit is None:
    visit = SiteVisit(project_id=project.id, engineer_id=user.id, submission_count=0)
    db.add(visit)
...
visit.computed_progress = derive_progress(body.current_stage, body.checklist)
visit.status = VisitStatus.submitted
visit.submission_count += 1
```

It then records `site_visit.submitted`, completes Step 2 and activates Step 3. The project's `official_progress` does **not** change here, because only approval makes progress official.

---

### backend/app/routers/reviews.py
**Purpose**: Parvez's review queue and decisions (F8).

**Key Functions/Components**:
- `GET /reviews/queue` (Team Lead only): submitted visits, oldest first, with `waiting_minutes`.
- `POST /site-visits/{id}/review` (Team Lead only): the body is `{decision: "approve" | "rework", comment}`.

**How it works**:
Reviewing a visit that isn't `submitted` returns 409. A rework decision with a blank comment returns 422 with `missing: ["comment"]`.

Both decisions save a `Review` record and an audit event. After that, they differ:
- **Approve:** the visit becomes `approved`, `project.official_progress` is set to the visit's computed progress, and Step 3 is completed.
- **Rework:** the visit becomes `rework`, Step 3 is locked and Step 2 is reactivated, so the engineer can resubmit.

After approval all three steps are complete and the workflow is finished. v1 has no "next visit" cycle; see Known Limitations.

---

### backend/app/routers/template.py
**Purpose**: `GET /template` (any signed-in user) returns the residential template: stages with checklists and weights, checklist states, problems, severities and the minimum photo count.

**How it works**:
The app builds its site visit form from this response, so the form and the server's validation always agree. Neither side keeps its own copy of the lists.

---

### backend/tests/conftest.py
**Purpose**: Shared test setup.

**Key Functions/Components**:
- Environment set before import: in-memory SQLite, and 1,000 hash iterations.
- `fresh_schema` (runs for every test): drops and recreates all tables.
- Fixtures: `db`, `client` (a FastAPI `TestClient`), `users` (seeded, keyed by role), `auth_headers(role)`, `new_project(...)`, and `ready_project` (a project with Legal Approval already approved).
- `valid_visit(**overrides)`: a complete Plinth-stage visit payload with one High-severity problem.

---

### backend/tests/test_*.py
**Purpose**: The backend test suite. Counts and coverage are listed under Test Coverage below.

---

### web-src/api.js
**Purpose**: The browser's API client. It is bundled ahead of `app.js`.

**Key Functions/Components**:
- `SiteFlowAPI`: `login`, `logout`, `me`, `template`, `projects`, `project`, `createProject`, `engineers`, `updateLegal`, `submitVisit`, `visit`, `reviewQueue`, `review`.
- `ApiError`: carries the HTTP status, the error detail, and the `missing` and `invalid` lists.
- Server address, checked in this order:
  1. A `?api=` query parameter (saved for later launches) or the sign-in screen's Server field.
  2. Otherwise, on Android: `http://10.0.2.2:8000`, the emulator's route to the host machine.
  3. Otherwise, in a browser: the same host on port 8000.

**How it works**:
Every call goes through one `request()` function. It attaches the token and turns network failures into a readable message. On a 401 while signed in, it clears the token and tells the app, which returns to the sign-in screen. The token is kept in `localStorage`.

---

### web-src/app.js
**Purpose**: The whole user interface, rewritten from the prototype. The prototype's local engine, five-step templates, template editor, demo data and "Viewing as" switcher are gone. The helpers, icons and CSS classes are kept.

**Key Functions/Components**:
- `go(route, params)`: loads the view's data, then renders it.
- `render()`: draws either the sign-in screen or the signed-in layout plus the current view.
- `can`: role checks that decide which actions to show. The server enforces the same rules independently.
- Views in `V`:
  - `login`
  - `projects`: cards with a three-bar step indicator and official progress.
  - `new-project`
  - `project`: stepper, step cards, project facts, audit trail.
  - `visit`: the site visit form.
  - `queue`: Parvez's review queue.
  - `review`: the read-only submission, with Approve and Request rework.
- Legal Approval form: `legalCard()` and `syncLegalSave()`. Save stays disabled for Approved until a document reference is entered.
- Site visit form:
  - `visitMissing(draft)`: the same rules as the server, used for the live "Required to submit" list.
  - `visitPayload(draft)`: turns the draft into the API payload.
  - `readDraft`, `saveDraft` and `dropDraft`: keep the draft in `localStorage` under `siteflow.draft.<userId>.<projectId>`.
  - `draftFromVisit(v)`: prefills a rework resubmission from the last submission.
- `decide(decision)`: Parvez's approve or rework action.

**How it works**:
Rendering is plain template strings set as `innerHTML`, like the prototype. Every value goes through `esc()` first, which escapes HTML.

The site visit form keeps its state in `ui.data.draft`. Each keystroke updates the draft, saves it to the device, and updates the missing list **in place**. Structural changes re-render the form: picking a stage, adding a problem or changing a problem's category.

The in-place update matters because of a bug found during testing. A text field's `change` event fires when the user clicks Submit, between mouse-down and mouse-up. If that replaced the button, the click was lost:

```js
/* Updates the checklist in place. The submit buttons are never replaced here: a field's change
   event fires on blur, between mousedown and mouseup, and a swapped button would swallow the click. */
function refreshVisit(){
  const miss = visitMissing(ui.data.draft);
  const ml = $('#miss-list'); if (ml) ml.innerHTML = missList(miss);
  ...
  document.querySelectorAll('[data-act="submit-visit"]').forEach(b => { b.disabled = !!miss.length; });
}
```

After a failed save, forms keep what the user typed; this was another test-found fix. The Legal form keeps a `legalDraft`, and the sign-in email is kept too. Interactive elements carry `data-testid` attributes for the Playwright tests. On a phone, the layout switches to a top bar, bottom tabs and a fixed submit bar.

---

### web-src/app.html
**Purpose**: The page's markup and all its CSS.

**How it works**:
The prototype's styles are unchanged: colour tokens with dark mode, and a responsive layout that switches at 899px. v1 added:
- Sign-in screen styles, including a `body.anon` mode that hides the sidebar and tabs.
- A plain "SiteFlow" page title.

v1 removed the hidden file inputs for camera, video, voice and documents, because media capture moved to v2.

---

### web-src/build.py
**Purpose**: Builds the app from `app.html` + `api.js` + `app.js`.

**How it works**:
It writes two files: `www/index.html`, the Android app with a full `<head>`, and `web-src/siteflow.html`, a hosted version without the wrapper. The only change this sprint is bundling `api.js` ahead of `app.js`.

Run `python web-src/build.py` and then `npx cap sync android` after any change to the app.

---

### www/index.html
**Purpose**: The built output of `build.py`. It is committed, so the Android project can sync without a build step.

---

### playwright.config.js
**Purpose**: The end-to-end test runner configuration.

**How it works**:
It runs tests one at a time (one worker) and starts two servers:
1. `tests/e2e/serve_api.py`: the API on `127.0.0.1:8001`.
2. `build.py`, then Python's `http.server` serving `www/` on `localhost:8080`.

Paths are quoted absolute paths, so the commands work in Windows `cmd`. Traces are kept, and screenshots are taken, when a test fails.

---

### tests/e2e/serve_api.py
**Purpose**: Starts a throwaway API for the end-to-end tests.

**How it works**:
It deletes and recreates `tests/e2e/.data/e2e.db`, a SQLite file, and seeds the four users with the password `e2e-pass-123`. It sets a test-only JWT secret, then runs uvicorn on port 8001.

---

### tests/e2e/helpers.js
**Purpose**: Shared helpers for the end-to-end tests.

**Key Functions/Components**:
- `signIn(page, role)` and `signOut(page)`: work at both desktop and phone width, because they target whichever copy of the element is visible.
- `shot(page, name)`: saves a full-page screenshot to `tests/screenshots/`.
- `api(request, role, method, url, data)`: calls the API directly.
- `createApprovedProject(request, name)`: sets up a project that is ready for a site visit, in three API calls.

---

### tests/e2e/task9-signin-projects-legal.spec.js, task10-visit-review.spec.js, task10-mobile.spec.js
**Purpose**: The browser tests. Coverage is listed under Test Coverage below.

---

### package.json
**Purpose**: Adds `@playwright/test` as a development dependency. The Capacitor dependencies and scripts are unchanged.

---

### .gitignore
**Purpose**: Now also ignores the end-to-end test database, `test-results/`, `playwright-report/` and the generated `web-src/siteflow.html`.

---

### sprints/v1/PRD.md and sprints/v1/TASKS.md
**Purpose**: The sprint plan and the completed task list, with a note on each task.

## Data Flow

**Sign in**
1. The user submits email and password, and `api.js` sends `POST /auth/login`.
2. The router checks the PBKDF2 hash and returns a JWT and the user.
3. The token is stored on the device. Every later request sends `Authorization: Bearer <token>`.
4. `get_current_user` decodes the token and loads the user on each request. A 401 sends the app back to the sign-in screen.

**Create a project (Architect)**
1. The New project form calls `GET /users?role=civil_engineer` to fill the engineer picker.
2. Submitting calls `POST /projects`. The server creates the project, members, three steps and Legal Approval, plus the `project.created` audit event, in one transaction.
3. The app opens the project page from the detail response.

**Legal Approval (Admin)**
1. The Admin sends `PATCH /projects/{id}/legal` with status Applied and the application details.
2. A second PATCH sets Approved, with the approval date and document.
3. The router checks the transition and the required fields, saves the record, and records `legal.updated`.
4. The workflow service completes Step 1 and activates Step 2, and audits both changes.

**Site visit (Civil Engineer)**
1. **Start site visit** calls `GET /projects/{id}` and `GET /template`.
2. The draft comes from device storage if there is one, then from the last submission if it's a rework, and otherwise starts empty.
3. As the engineer fills the form, the draft is saved to the device and the missing list updates.
4. **Submit** calls `POST /projects/{id}/site-visits`.
5. The server validates the visit, derives progress, and saves the visit as `submitted` with the next submission number.
6. Step 2 is completed and Step 3 activated. The device draft is deleted, and the project page shows "16.7% (pending approval)".

**Review (Parvez)**
1. The queue calls `GET /reviews/queue`. Opening an item calls `GET /site-visits/{id}` for the full submission.
2. **Approve** sends `POST /site-visits/{id}/review` with `{decision: "approve"}`. The visit is approved, `official_progress` is set, and Step 3 is completed. The project card and page now show the official figure to everyone.
3. **Request rework** sends a comment. The visit goes to `rework`, Step 3 is locked and Step 2 reopened. The engineer sees the comment on the project page and on the prefilled form, and resubmits. The count becomes 2 and the same visit returns to the queue.

## Test Coverage

Running the suite:
- Backend: `cd backend && .venv/Scripts/python -m pytest`, which runs 111 tests in about 9 seconds.
- End to end: `npx playwright test` from `Code/`, which runs 6 tests in about 55 seconds.

**Unit: 19 tests**
- `test_progress.py` (12):
  - Known cases: all Done at Handover gives 100.0, nothing Done at Foundation gives 0.0, and a mid-stage custom config gives 35.0.
  - In progress items don't count as Done, and missing items count as not done.
  - Half-up rounding: 56.25 becomes 56.3.
  - Errors are raised for an unknown stage or item, an item from another stage, an invalid state, and weights that don't sum to 100.
- `test_models.py` (7):
  - All tables are created, and the enum values match the PRD.
  - The seed creates one user per role, with Parvez as Team Lead and hashed passwords, and can be run twice safely.
  - Relationships and JSON columns work, and step order is unique per project.
  - Audit events can't be edited or deleted.

**Integration: 92 API tests**
- `test_health.py` (4): `/health`, CORS for the web and Capacitor origins, and the template's stages, weights and problem list.
- `test_auth.py` (19):
  - Login returns a JWT; email matching ignores case; wrong passwords and unknown emails get the same 401; inactive users are rejected.
  - `/auth/me`, with a missing, tampered or expired token, and for a user deactivated after signing in.
  - `require_role` for each role, and the visibility rule for each role.
- `test_projects.py` (14):
  - Creating a project sets up the steps, Legal Approval and members, and writes the audit event.
  - Only the Architect can create; a non-engineer assignee and blank fields are rejected.
  - List and detail respect visibility, with 404 for other projects.
  - The summary fields, the engineer picker, and timestamps in UTC.
- `test_legal.py` (15): Applied then Approved unlocks Step 2; the audit sequence; Applied can't be skipped; the document and dates are required; approval can't predate the application; Rejected and Approved are final; only the Admin can update; an Admin who isn't a member gets 404.
- `test_site_visits.py` (21):
  - A valid submission moves the project to review; an empty one lists every missing field; blank strings count as missing.
  - Location needs GPS or manual entry, and GPS is range-checked.
  - The checklist must be complete and valid, and the stage must exist.
  - "No issues found" versus problems; required problem fields; problems must come from the config list; Other needs free text.
  - Only the assigned engineer, with Step 2 open, and no double submission.
  - Resubmitting after rework increments the count; the full visit can be read back.
- `test_reviews.py` (16): the queue and its time waiting; Team Lead only; approve makes progress official; rework returns the visit with a comment, and the comment is required; unknown decisions, double review and missing visits; UTC timestamps.
- `test_template.py` (2): the template contents, and that sign-in is required.
- `test_end_to_end.py` (1): the full loop of create, legal, submit, rework, resubmit and approve through the API. It checks the progress figures and the exact audit trail order.

**End to end: 6 Playwright tests, 17 screenshots in `tests/screenshots/`**
- `task9-signin-projects-legal.spec.js` (3):
  - Sign-in error and success, and the session surviving a reload.
  - The Architect creates a project and the legacy screens are gone; the engineer sees the project.
  - The Admin moves Legal Approval from Applied to Approved; Save stays disabled until a document is entered; Site Visit unlocks.
- `task10-visit-review.spec.js` (2, run in order):
  - The engineer is blocked on an empty form, the draft survives a reload, and the full form submits with 16.7% pending.
  - Parvez requests rework (a comment is required), the engineer sees it and resubmits with 20.8%, and Parvez approves so 20.8% becomes official.
- `task10-mobile.spec.js` (1): at Pixel 7 width, the visit form has no sideways scrolling and shows the fixed submit bar.

## Security Measures
- **Passwords**: PBKDF2-SHA256 with 600,000 iterations and a salt per user, checked in constant time. The seed script generates or reads its password instead of hard-coding one.
- **Sign-in responses**: a wrong password and an unknown email get the same message and take the same time, so the endpoint doesn't reveal which accounts exist.
- **Tokens**: HS256 only, and every token must carry a user and an expiry. Deactivated users are rejected on every request, not just at sign-in.
- **Access control on the server**: every endpoint checks the role (403) and the project visibility (404). The app's own role checks only decide what to show.
- **No existence leak**: a project or visit the user can't see returns 404, the same as one that doesn't exist.
- **Input validation**: typed Pydantic input with server-side mandatory-field rules, and the problem list and checklist validated against the config. All database access goes through SQLAlchemy, so there is no raw SQL.
- **Audit trail**: append-only from the application, and every status change records who, what and when.
- **CORS**: an explicit list of origins, methods and headers, with credentials disabled.
- **XSS**: every value is escaped before it goes into the page.
- **Scans run for each task**:
  - semgrep rule sets: `p/python`, `p/fastapi`, `p/secrets`, `p/jwt`, `p/sql-injection`, `p/javascript` and `p/xss`, with no findings.
  - `pip-audit` and `npm audit`, with no known vulnerabilities.

## Known Limitations
- **PostgreSQL not verified**: every run used SQLite, because Docker Desktop was off. There are no migrations yet (`create_all` only), so a schema change needs a manual reset.
- **Android not verified**: the app has not been run on a device or emulator. The Capacitor WebView loads the page over `https://localhost` and calls the API over plain `http`, which Android blocks by default. It needs either an https API or `android.allowMixedContent` for development only.
- **One pass per project**: after approval all three steps are complete and nothing reopens Step 2, so a project can't record its next site visit. Real construction projects need repeated visits.
- **A rejected Legal Approval is final**: there is no way to reapply (relates to D7). The project stays at Step 1.
- **Placeholder template values**: equal 12.5 weights, draft checklist items and `MIN_PHOTOS = 5` (D2 and D3). The rule that earlier stages count as complete is also an assumption to confirm.
- **Not built yet (planned for v2)**: photos and video (F5), including the minimum photo count and the photo rule for High and Critical problems; the dashboard panels, filters and red flags (F9); and in-app notifications (F10's notification half).
- **The document is a text reference only**: Legal Approval stores a link or file reference, not an uploaded file.
- **Security left for v3**:
  - The default `JWT_SECRET` is a development placeholder.
  - Tokens live in `localStorage`, which a script injected into the page could read.
  - There is no rate limiting on sign-in, and no refresh or revocation of tokens.
  - The audit guard protects against the application, not against direct database access.
- **Frontend structure**: one large file (`app.js`, about 700 lines) that renders HTML strings. It works and is tested end to end, but it has no JavaScript unit tests and will get harder to change as screens are added.
- **The offline draft is saved but not sent**: submitting needs a connection. There is no sync queue (D6, as planned).
- **Timestamps**: always stored and sent as UTC. The app shows them in the device's local time.

## What's Next
Suggested v2 priorities, following the PRD trajectory and the limitations above:
1. **Recurring site visits**: after approval, reopen Step 2 for the next visit while keeping a history of approved visits and their progress. Confirm the approach with Parvez.
2. **Photo and video capture (F5)**: S3-compatible storage with direct upload, capture time, GPS and uploader on each item, `MIN_PHOTOS` enforced, and a photo required for High and Critical problems.
3. **Dashboard, filters and red flags (F9)**: All Projects, Needs Architect Attention, Major Problems and Review Queue panels, plus the six red flag rules with automatic and manual clearing. This needs the D4 and D5 thresholds.
4. **In-app notifications (F10)**: on step unlock, submission, approval, rework and red flag.
5. **Run it for real**: PostgreSQL through Docker, Alembic migrations, and an Android emulator build with the mixed-content question settled.
6. **Evaluate (T1 and T2)**: record every F1 to F10 acceptance criterion in a test sheet, and walk Parvez through one project end to end.
7. **Decisions**: D2 (weights and checklists), D3 (photo count and video size), D4 (review SLA and a backup reviewer), D5 (red flag thresholds) and D7 (reapplying after rejection).

Security hardening (S1 to S4) stays in v3: production secrets, token storage and rate limiting, encrypted media, and a signed Android release.
