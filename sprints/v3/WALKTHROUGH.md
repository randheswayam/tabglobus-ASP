# Sprint v3 — Walkthrough

## Summary

Sprint v3 replaced SiteFlow's three-step flow with the **18-stage residential project tracker** from Parvez's workflow diagram:

- 18 numbered stages, with stage 8 split into 8A and 8B.
- 4 pre-design activities on two parallel branches.
- 10 phases in total.

It added **client sign-off at four milestones**: the requirements baseline, the design freeze, interiors and tile selection, and handover. Each sign-off is a versioned package that the client must open in full before approving, and an answered version can never change.

It delivered the **customer app** in the same codebase, under a new Client role. A client, invited by the Architect with a one-time code, sees only their own project: the phase timeline, sign-off requests, and site updates the Architect chose to share.

All 23 tasks are done. The backend has 409 passing tests and the Playwright suite has 28. semgrep, pip-audit and npm audit are clean. The in-browser client demo was brought to the same rules and republished.

## Architecture Overview

```
 ┌──────────────── SiteFlow app (web-src/, one codebase for web and Android) ──────────────────┐
 │  Staff views                                  Client views                                  │
 │  Dashboard (+ Waiting for client panel)       client-home      (my projects)                │
 │  Project page → Stage tracker                 client-project   (phase timeline, updates)    │
 │               → Sign-off composer             client-signoff   (open → confirm → sign)      │
 │               → Client panel (invite code)                                                  │
 │  Visit review  → Share with the client        Sign-in screen → "I have an invite code"      │
 └───────────────┬─────────────────────────────────────────────┬───────────────────────────────┘
                 │ api.js: staff routes                        │ api.js: /client/* and /auth/*
                 │ (every staff router: require_staff → 403    │ (require_client → 403 for staff)
                 │  for the Client role)                       │
 ┌───────────────▼─────────────────────────────────────────────▼───────────────────────────────┐
 │ FastAPI (backend/app)                                                                       │
 │  routers:  projects · stages · signoffs · invites · updates · client · auth (/activate)     │
 │            + v2: site_visits · reviews · media · problems · red_flags · dashboard · …       │
 │  services: stages      (release, gates, why-blocked, complete)                              │
 │            signoffs    (latest version per stage, staff projection)                         │
 │            client_view (allow-listed client projection)                                     │
 │            filecheck   (size limit + magic-byte check, shared by media and sign-offs)       │
 │            red_flags   (+ client_decision_overdue) · notify · audit · storage               │
 │  config:   stage_config.py (the flow) · workflow_config.py (SLA, invite, sign-off values)   │
 └───────────────┬─────────────────────────────────────────────┬───────────────────────────────┘
                 │                                             │
     PostgreSQL 16 (SQLite in tests)                   MEDIA_DIR (local storage)
     project_stages · signoff_requests ·               sign-off documents and site photos,
     signoff_attachments · signoff_views ·             served only through authorized routes
     client_invites · shared_updates(+photos)
     + v2 tables, migrations 0001–0009
```

## Files Created/Modified

### backend/app/stage_config.py (new)

**Purpose**: The residential flow as configuration: 10 phases and 23 stage entries (18 numbered, with 8A and 8B, plus 4 pre-design activities), each with owner, predecessors and gate.

**Key contents**:
- `PHASES`: the 10 phase names from the diagram.
- `STAGES`: built by `_stage(key, number, label, phase, workstream, owner, predecessors, gate, detail)`.
- `SIGNOFF_STAGES`, `CONSTRUCTION_START = "line_out"`, `BY_KEY`.

**How it works**:
The flow is data, not code. A stage lists the keys it waits for, and at most one gate. Parallel branches are simply two stages with the same predecessor:

```python
_stage("predesign_site_visit", None, "Pre-design site visit", 2, "Site", "civil_engineer", ["requirements_signoff"]),
_stage("concept", None, "Preliminary concept", 2, "Studio", "architect", ["requirements_signoff"]),
_stage("grid", "5", "Centerline, grid, foundation basis and column positions", 3, "Studio", "architect",
       ["investigations", "tentative_elevations"]),
```

So when the requirements sign-off completes, both pre-design branches open together, and stage 5 waits for both to finish. There are three gate types:

- `client_signoff` on stages 4, 11, 17 and 18.
- `legal_approval` on stage 14, Site line-out. This is decision D-01, an assumption marked `TBD_PARVEZ`.
- `no_open_major_problems` on stage 16, Civil completion.

Owner roles use the four staff roles that exist today. The PRD's Structural Consultant, MEP, Interior Designer and Accounts roles don't exist yet, so an Architect, Team Lead or Admin records their stages. Stage 12, the 50% upfront gate, is a manual completion by an Admin; there is no payment module yet.

### backend/app/services/stages.py (new)

**Purpose**: The stage engine: decides which stages open, why a stage is blocked, and applies completions to a project.

**Key functions**:
- `to_release(statuses)`: locked stages whose predecessors are all completed or historical.
- `gate_reasons(stage, facts)`: plain-language reasons a gate is unmet.
- `evaluate(statuses, facts)`: each stage's state (locked, active, blocked, completed, historical) and reasons.
- `create_stages(db, project, start_stage, confirmed_by)`: all rows for a new project, with earlier stages historical.
- `release()`, `complete()`: database helpers that activate or complete stages, write an audit event and notify.
- `project_view(db, project, user)`: the tracker response, including `can_complete` for the caller.
- `construction_started()`, `visit_approved()`: the bridge to the v2 site-visit loop.

**How it works**:
The core is pure functions, which are tested without a database. The database stores only four statuses. The engine derives a fifth view, `blocked`, for an active stage whose gate isn't met:

```python
def evaluate(statuses, facts, config=sc.STAGES):
    for s in config:
        stored = statuses[s["key"]]
        if stored in DONE:        -> {"state": stored, "reasons": []}
        elif stored == "locked":  -> reasons = ["Waiting for: <labels of unfinished predecessors>"]
        else:
            reasons = gate_reasons(s, facts)
            -> {"state": "blocked" if reasons else "active", "reasons": reasons}
```

`GateFacts` carries everything a gate needs: the Legal Approval status, the count of open High or Critical problems, and the latest sign-off request per stage. For a sign-off stage, the reason follows the package: "Sign-off package not sent to the client yet", "Waiting for client sign-off on version 2, sent 26 Sept 2026", or "The client asked for changes on version 1; prepare version 2".

`complete()` records who completed the stage and their note, audits `stage.completed`, and calls `release()`. That activates every successor that is now ready, audits `stage.activated` and sends a `stage_ready` notification to the owners. Client sign-off stages can't be completed through this route. They complete only from the client's approval (see `routers/client.py`).

`visit_approved()` connects v2 to v3. The first approved construction site visit completes Site line-out, which opens stage 15, Construction quality stages.

### backend/app/routers/stages.py (new)

**Purpose**: `GET /projects/{id}/stages` returns the tracker; `POST /projects/{id}/stages/{key}/complete` completes a stage.

**How it works**:
Completion checks run in a fixed order, and each failure returns the engine's reasons:

1. A client sign-off stage is refused with 409 ("completes when the client approves").
2. A caller who isn't the owner role, Architect or Team Lead gets 403.
3. A stage that isn't active (locked, blocked or already done) gets 409.
4. A blank note gets 422 ("Add a note on what was completed").

The router has `dependencies=[Depends(require_staff)]`, like every staff router.

### backend/app/services/signoffs.py (new)

**Purpose**: Queries and staff-side output for sign-off packages.

**Key functions**:
- `requests_for(db, project, stage_key)`: every version, in stage and version order.
- `latest_by_stage(db, project)`: `{stage: {status, version, sent_at}}` of the newest version. This is what the stage engine's sign-off gate reads.
- `signoff_out(r)`: the full staff view, including the client's response, signer and method.
- `attachment_out(a, viewed_by_client)`: attachment metadata. The client version adds a `viewed` flag.

### backend/app/routers/signoffs.py (new)

**Purpose**: The Architect's sign-off composer API: create a version, edit the draft, add or remove attachments, send, and download.

**Key routes**:
- `POST /projects/{id}/signoffs`: create a version for an active sign-off stage. Only one draft or sent version per stage is allowed (409). The version number follows the previous one, and `supersedes_id` links them.
- `PATCH /signoffs/{id}`: edit title and summary, drafts only.
- `POST /signoffs/{id}/attachments`: upload a PDF, JPEG, PNG or WEBP file. The file is checked by `filecheck.read_checked`, stored under a random key, and its SHA-256 recorded.
- `DELETE /signoffs/{id}/attachments/{aid}`: remove an attachment, drafts only.
- `POST /signoffs/{id}/send`: needs at least one attachment and an invited client (422 with `missing`). It audits the send, notifies the client and syncs red flags.
- `GET /signoffs/{id}/attachments/{aid}`: staff download.

**How it works**:
`_draft(req)` guards every edit: once sent, "Version N was sent and can no longer change" (409). Only the Architect prepares packages. Other staff can read and download them.

### backend/app/routers/client.py (new)

**Purpose**: The customer app API under `/client/*`. Only the Client role reaches it.

**Key functions**:
- `require_client`: 403 for staff.
- `_my_request(db, user, id)`: a sent or answered package on one of the client's projects. Drafts and other projects return 404, not 403, so the client can't tell whether a package exists.
- `open_attachment`: streams the document and records a `SignoffView` the first time the client opens it.
- `approve`: the sign-off.
- `request_changes`: needs a comment.
- `my_projects`, `my_project`, `my_signoffs`, `shared_photo`.

**How it works**:
Approval is where the milestone completes, so every condition is checked on the server, not only in the UI:

```python
unviewed = [a.filename for a in req.attachments if a.id not in viewed]
missing = (["attachments"] if unviewed else []) + ([] if body.confirm else ["confirm"])
invalid = [] if body.signer_name.strip() and _norm(body.signer_name) == _norm(user.name) else ["signer_name"]
if missing or invalid:
    raise HTTPException(422, {"message": "Open every document, tick the confirmation and type your full name ...",
                              "missing": missing, "invalid": invalid, "unviewed": unviewed})
```

On success it records:

- The signer, the typed name and the time.
- The method, `client_app`.
- The confirmation text in force.
- A `fingerprint`: a SHA-256 of the IP address and user agent, so there is evidence of where the approval came from without storing the address itself.

It then audits `signoff.approved` and calls `stages.complete()`, which releases the successors (for example, stage 12 after the design freeze). It notifies the Architect and the Team Leads and syncs red flags, all in one transaction. A second answer to the same version is a 409.

`shared_photo` serves only photos that the Architect put into a shared update on one of the client's projects. Any other media id returns 404, even if it belongs to the same visit.

### backend/app/services/client_view.py (new)

**Purpose**: The client's project projection, built field by field from an allow-list (decision 0002).

**Key functions**:
- `project_card(db, project)`: name, location, phase, current stages, stage progress, official progress, and the count of sign-offs waiting for this client.
- `project_detail(db, project, user, signoff_out)`: the card plus phases and stages, the client's sign-offs, and shared updates.

**How it works**:
The module never reads audit events, completion notes, review comments, red flags, problems or staff contacts. They cannot leak because they are never loaded. Stage states are renamed for the client: `active` becomes `in_progress`, `locked` becomes `upcoming`, and a historical stage says "Completed before SiteFlow". A stage shows "Signed by …" only when it was completed by an approved package, never when it is historical. `test_client_view.py` checks the exact key set of each response, so a new internal field added by mistake fails a test.

### backend/app/routers/invites.py (new)

**Purpose**: The Architect invites a client to a project: `POST /projects/{id}/client-invite` and `GET /projects/{id}/clients`.

**How it works**:
An unknown email creates an inactive Client user with a random, unusable password. An email that belongs to a staff member is refused with 409. The client becomes a project member.

While the client is still inactive, each invite:

- Revokes any earlier unused code.
- Generates a new 8-character code from an alphabet without 0, O, 1 or I (easy to misread).
- Stores only the code's PBKDF2 hash, with an expiry of `INVITE_CODE_TTL_DAYS`.

The code is returned once, to the Architect, who shares it with the client. Nothing is emailed yet. Inviting an already active client to a second project adds the membership without a code.

### backend/app/routers/auth.py (modified)

**Purpose**: Adds `POST /auth/activate`: the client sets a password with the invite code and is signed in.

**How it works**:
Every failure returns the same message ("This invite code is not valid…"): an unknown email, no invite, too many attempts, expired, or a wrong code. When no usable invite exists, the handler still runs a password verification against a dummy hash, so the response time doesn't reveal whether the email exists. A wrong code increments `attempts`. At `INVITE_MAX_ATTEMPTS` (5) the invite is locked. A password shorter than 10 characters gets 422.

### backend/app/routers/updates.py (new)

**Purpose**: `POST /site-visits/{id}/share` lets the Architect or Team Lead share an **approved** visit with the client, as a note plus photos they pick. `GET /projects/{id}/shared-updates` lists them.

**How it works**:
Only approved visits can be shared (409 otherwise). The photo ids must belong to that visit (422 with `invalid: ["media_ids.N"]`). The update is audited and the client is notified. Problems, checklist states, rework comments and unselected photos stay internal.

### backend/app/services/filecheck.py (new)

**Purpose**: Upload checks shared by site media and sign-off documents, extracted from `routers/media.py`.

**How it works**:
`read_checked` reads in 1 MB chunks and stops with 413 as soon as the size limit is passed, so a huge upload never sits in memory. It then compares the file's leading bytes with the declared type (for example, `%PDF-` for PDF), because the `Content-Type` header comes from the client. A mismatch is 415.

### backend/app/services/notify.py (modified)

**Purpose**: Adds four notification kinds.

- `stage_ready`: to the owners of a newly opened stage. Client stages aren't announced here.
- `signoff_requested` (from `signoff_sent`): to the project's clients, including clients who haven't activated yet (`include_invited=True`), so it's waiting when they first sign in.
- `signoff_answered`: to the Architect and Team Leads, with the signer name or the change comment.
- `update_shared`: to the project's clients.

### backend/app/services/red_flags.py and backend/app/workflow_config.py (modified)

**Purpose**: Adds the `client_decision_overdue` red flag and the v3 settings.

**How it works**:
A sent package older than `CLIENT_SIGNOFF_SLA_DAYS` raises "Client decision overdue" (rank 4), keyed `signoff-{id}` so each package flags once. The flag clears itself when the client answers. `workflow_config.py` adds the following settings. The ones marked `TBD_PARVEZ` are placeholders until Parvez decides:

- `CLIENT_SIGNOFF_SLA_DAYS` (TBD_PARVEZ).
- `INVITE_CODE_TTL_DAYS` (TBD_PARVEZ).
- `INVITE_MAX_ATTEMPTS`: a security default.
- `SIGNOFF_ATTACHMENT_TYPES`.
- `MAX_SIGNOFF_ATTACHMENT_MB` (TBD_PARVEZ).
- `SIGNOFF_CONFIRMATION_TEXT` (TBD_PARVEZ, needs legal review).
- `BUSINESS_TIMEZONE = "Asia/Kolkata"`.

### backend/app/clock.py (new)

**Purpose**: `business_date(t)`: the office's calendar day in Asia/Kolkata. Overdue checks and dashboard date filters compare dates in the office's day, not UTC. This fixed a bug where a visit at 00:30 in Pune counted as the previous day.

### backend/app/models.py (modified)

**Purpose**: New tables and the two immutability guards.

**New models**:
- `ProjectStage`: project, key, status, start and completion times, completer, note, historical fields.
- `SignoffRequest`: stage, version, status (draft, sent, approved, changes_requested), title, summary, response, signer, method, confirmation text, fingerprint, `supersedes_id`.
- `SignoffAttachment` (with sha256) and `SignoffView`.
- `ClientInvite`: code hash, expiry, attempts, used and revoked times.
- `SharedUpdate` and `SharedUpdatePhoto`.
- `Role.client`.

**How it works**:
Immutability is enforced below the routers, in a SQLAlchemy `before_flush` listener, so no code path can change an answered sign-off:

```python
@event.listens_for(Session, "before_flush")
def _block_answered_signoff_changes(session, _ctx, _instances):
    for obj in list(session.dirty) + list(session.deleted):
        if isinstance(obj, SignoffRequest) and (obj in session.deleted or session.is_modified(obj)):
            original = <status before this flush>
            if original in (approved, changes_requested):
                raise SignoffImmutableError(...)
    # attachments of a sent package cannot be added or removed either
```

A second listener makes `AuditEvent` rows append-only.

### backend/app/deps.py (modified)

**Purpose**: Adds `require_staff`, the router-level guard that returns 403 for the Client role ("This area is for the SiteFlow team. Clients use the client app."). Every staff router declares it in `APIRouter(dependencies=[...])`, so a new route on a staff router is protected automatically.

### backend/app/routers/projects.py, site_visits.py, media.py, dashboard.py and main.py (modified)

- **projects.py**: project creation accepts `start_stage` and `historical_confirmed_by`, creates the stage rows and releases the first stages. The audit event records the onboarding.
- **site_visits.py**: `_require_site_visit_open` adds the construction gate. Visits open only once Site line-out has started ("Site visits open once Site line-out (stage 14) has started"), on top of the v2 Legal Approval rule.
- **reviews.py**: the first approved visit calls `stages.visit_approved`.
- **media.py**: now uses `filecheck`.
- **dashboard.py**: each row gains `phase`, `current_stages`, `stage_progress`, `client` and `waiting_for_client` (stage, version, days waiting). Also added:
  - A `waiting_for_client` panel, sorted by longest wait.
  - Filters `phase` (1 to 10) and `client_pending`.
  - Visit-date filters that use `business_date`.
- **main.py**: registers the five new routers.

### backend/app/routers/template.py (modified)

**Purpose**: `GET /template` also returns `phases` and a short `flow` list (key, number, label, phase), so the New project form can offer "Already in progress? Start at stage …".

### backend/migrations/versions/0006 to 0009 (new)

- **0006_project_stages**: creates `project_stages` and backfills every v2 project. Those projects were already running the construction loop, so they join at Site line-out. Earlier stages become historical, confirmed by "SiteFlow v2 migration". Line-out is completed if the project has submitted visits, and then Construction is active. The stage order is a **frozen copy** inside the migration: migrations never import app code, so a later change to `stage_config.py` can't change what this migration did.
- **0007_client_invites**, **0008_signoffs**, **0009_shared_updates**: the tables above. `test_migrations.py` runs upgrade and downgrade.

### web-src/app.js (modified)

**Purpose**: The single-page app gained the staff stage tracker, the sign-off composer, the client panel, the customer app views and the share form.

**Key components**:
- `stageTracker`, `phaseBlock`, `stageChip`, `stageDetail`: the tracker on the project page. Each chip shows its state in text and colour. 8A and 8B sit on one row. The detail shows reasons, the completion note field, the historical label and "signed by the client".
- `signoffComposer`, `draftEditor`: create a version, then attach, edit and send it. After a change request, the next version's title is prefilled.
- `clientPanel`: invite the client and show the one-time code once.
- `V['client-home']`, `V['client-project']`, `V['client-signoff']`: the customer app. `home()` sends a client to `client-home`, and `isClient()` hides staff navigation. Finished phases fold on the client timeline.
- `shareUpdateForm`: on an approved visit's review screen, tick photos and write a note.
- The activation form on the sign-in screen ("I have an invite code"). The typed code is kept across a failed password check.
- Dashboard: Stage and Client columns, the Waiting for client panel, and the phase and client-pending filters.

**How it works**:
The client sign-off screen mirrors the server rule so the button is only enabled when approval will succeed:

```js
function syncApprove(){
  const allOpened = ui.data.so.attachments.every(a => a.viewed);
  const confirmed = $('#so-confirm').checked;
  const named = normName($('#so-name').value) === normName(ui.me.name) && !!normName(ui.me.name);
  btn.disabled = !(allOpened && confirmed && named);
}
```

A checklist beside the button ("Open every document (2 of 3 opened)", "Tick the confirmation", "Type your full name") shows what is missing. Documents open through `API.clientDocumentUrl`, which is what records the view.

### web-src/api.js (modified)

**Purpose**: Client methods for the new routes: stages, completeStage, inviteClient, projectClients, activate, the sign-off calls (including multipart upload with `requestForm`), the `/client/*` calls, sharedUpdates and shareUpdate.

`clientDocumentUrl` and `clientUpdatePhotoUrl` fetch with the bearer token and return an object URL, because an `<img>` or link can't send the token itself.

### web-src/app.html (modified)

**Purpose**: Styles for the tracker (phase blocks, chips, the parallel row), the sign-off composer and checklist, the onboarding section, shared-update photo pickers and the client timeline. It works at phone width.

### web-src/build.py and web-src/demo-api.js (modified)

**Purpose**: The client demo (`demo/SiteFlow-Demo.html`, published as an Artifact) runs the whole app in the browser on sample data.

**How it works**:
`build.py` embeds `stage_config` and the sign-off settings into the demo template, so the demo uses the same flow as the backend. `demo-api.js` re-implements the v3 rules in the browser with the same interface as `api.js`:

- The stage engine and gates.
- Invites and activation.
- Sign-offs with the view-before-approve check.
- The allow-listed client view.
- Shared updates.
- The overdue flag.

The sample data adds Mr. Gokhale, a client whose project waits on the design freeze with three drawn sample elevations, and Mrs. Kapoor with a shared update. The storage key is now `siteflow.demo.db.v3`, so old demo data is reset.

### Docs and configuration

- **`CLAUDE.md`**: repository instructions for this stack.
- **`docs/decisions/0001-evolve-current-stack.md`**: keep FastAPI and vanilla JS rather than the React rebuild in the reference plan.
- **`docs/decisions/0002-client-app.md`**: the client app is a scope change against PRD v3.1 §3.3 and needs Parvez's confirmation.
- **`docs/reference/`**: PRD v3.1, the reference plan, the reference CLAUDE.md and the workflow diagram.
- **`docs/PROGRESS.md`**: status, deviations, and the open questions for Parvez.

## Data Flow

**Milestone sign-off, end to end (stage 11, design freeze):**

1. The Architect completes stage 10 (All elevations package) with a note. `stages.complete()` releases stage 11, which is now active but **blocked**: "Sign-off package not sent to the client yet".
2. The Architect invites the client on the project page. `POST /projects/{id}/client-invite` returns an 8-character code once, and the Architect gives it to the client.
3. The client taps "I have an invite code" and enters email, code and a new password. `POST /auth/activate` checks the hash, expiry and attempts, activates the account and returns a token. The app routes the client to `client-home`.
4. The Architect opens stage 11 and creates version 1 (`POST /projects/{id}/signoffs`). They attach the elevation PDFs (magic-byte checked, SHA-256 stored), then send it (`POST /signoffs/{id}/send`). The version is frozen, the client is notified, and the dashboard shows the project under "Waiting for client".
5. The client opens the package (`GET /client/signoffs/{id}`). Each document opened through `/client/signoffs/{id}/attachments/{aid}` writes a `SignoffView`.
6. The client then either:
   - **Approves**: after every document is opened, the confirmation is ticked and the name typed. `POST /client/signoffs/{id}/approve` records the evidence and completes stage 11. That releases stage 12 (50% upfront gate), audits, and notifies the Architect and Team Leads.
   - **Requests changes**: with a comment. The version becomes immutable, and the Architect creates version 2, linked by `supersedes_id`, and sends it again.
7. If the client doesn't answer within `CLIENT_SIGNOFF_SLA_DAYS`, the next red-flag sync raises "Client decision overdue" on the dashboard's Needs attention panel.

**Construction loop inside the tracker:** stage 14 (line-out) opens after detailed drawings, blocked until Legal Approval is Approved. When it is active, site visits open. The first approved visit completes line-out, stage 15 runs the v2 visits, photos, review and progress, and stage 16 waits until no High or Critical problems are open.

**Onboarding:** New project, then "Already in progress?", then pick the current stage and name who confirms the earlier ones. Earlier stages are stored as historical and shown as "Historical — completed before SiteFlow", never as client sign-offs.

## Test Coverage

**Backend (pytest): 409 pass, up from 234 at the end of v2.** New or extended files this sprint:

- **Unit (rules and configuration)**:
  - `test_stage_config.py` (7): stage and phase counts, a well-formed flow with one start and no cycles or orphans, parallel branches, gate placement, and no planning markers in client-facing text.
  - `test_stage_engine.py` (9): the release rules, including both pre-design branches opening together, and every gate reason.
  - `test_config.py` (2): the v3 settings exist and carry the TBD markers.
- **Integration (API and permissions)**:
  - `test_stages_api.py` (7) and `test_stage_completion.py` (9): the tracker, completion rules (owner, note, gate stages refused) and successor release.
  - `test_invites.py` (10): code creation, activation, lock after wrong codes, expiry, re-invite revoking the old code, a second project without a code, and staff emails refused.
  - `test_signoffs.py` (10): composing, attachment types, one open package per stage, frozen after send.
  - `test_client_signoff.py` (15): approve only after viewing everything with confirmation and the matching name, request changes, and the version 2 cycle.
  - `test_client_view.py` (6): exact allow-listed keys, drafts hidden, other projects hidden.
  - `test_client_access.py` (5 functions, parametrized over every route): walks every OpenAPI route and asserts the Client role gets 403 on each staff route and anonymous callers get 401.
  - `test_shared_updates.py` (6).
  - Additions to `test_dashboard.py`, `test_site_visits.py`, `test_red_flag_rules.py`, `test_migrations.py` and `test_template.py`.
- **Migrations**: upgrade and downgrade through 0009, and the v2 backfill.

**E2E (Playwright, with screenshots in `tests/screenshots/`): 28 pass, up from 15.**
- `v3-stages.spec.js` (4): working through the first stages; historical stages with 8A and 8B side by side; the tracker on a phone; onboarding from the New project form.
- `v3-client-invite.spec.js` (1): invite, activate, sign in.
- `v3-signoff.spec.js` (4, serial): version 1 sent, the client asks for changes, version 2 prepared, the client opens every document and signs.
- `v3-client-app.spec.js` (3): the client sees only their projects and timeline, the phone layout, and a shared update showing only the chosen photos with no internal words.
- `v3-dashboard.spec.js` (1): phase, client, Waiting for client, and the filters.
- `demo.spec.js` (updated): the demo walk now includes Mr. Gokhale signing the design freeze.

## Security Measures

- **Role separation on the server.**
  - Every staff router carries `require_staff`.
  - `/client/*` carries `require_client`.
  - A test walks every route with the Client role.
- **Allow-listed client responses.** `client_view` and `client_signoff_out` build responses field by field, and tests pin the key sets. Drafts and other clients' projects return 404.
- **Invite codes.**
  - Random 8-character codes, stored only as PBKDF2 hashes.
  - An expiry, 5 attempts, and revocation on re-invite.
  - The same error for every failure, with dummy-hash timing when no invite exists.
- **Evidence and immutability.**
  - Answered sign-offs and sent attachments are blocked at flush time.
  - Audit events are append-only.
  - Approval stores the signer, typed name, confirmation text, method, time and a hashed fingerprint.
- **Uploads.**
  - Allowed types only.
  - Size is checked while reading.
  - Magic bytes must match the declared type.
  - Files are stored under random keys and served through authorized routes with `nosniff`.
- **Client photos.** Only photos explicitly included in a shared update can be fetched.
- **Scans.** All clean:
  - semgrep on the backend (`p/python`, `p/fastapi`, `p/secrets`, `p/jwt`, `p/sql-injection`).
  - semgrep on the web app and E2E tests (`p/javascript`, `p/xss`, `p/secrets`).
  - pip-audit and npm audit.

## Known Limitations

- **The flow is fixed configuration.** There is no template builder, no template versions and no pluggable gate registry (plan S02). Changing the flow means a code change and a migration.
- **Several stages are only tracked.** Meetings, requirement register, drawings, freeze package, change requests, payment milestone and checklists are stages completed with a note. In particular, stage 12 (50% upfront) is a manual Admin completion, not a payment check.
- **Missing roles.** Structural Consultant, MEP, Interior Designer and Accounts aren't built. Their stages are owned by Architect, Team Lead or Admin.
- **No outbound channel.** Invite codes and sign-off requests aren't emailed or messaged; the Architect shares the code by hand.
- **Session limits.** No refresh tokens or session revocation; a JWT stays valid until it expires. No multi-factor sign-in or step-up check before signing.
- **Weak signing evidence.** The typed name is compared with the account name, and the fingerprint is a hash of IP and user agent. This isn't a legal e-signature, and the confirmation wording needs legal review (`TBD_PARVEZ`).
- **Sign-off gaps against the PRD.** There's no "Reject" or "Ask a question" action, no `superseded` status (a new version links to the old one instead), and no completeness check against a required-elevations list.
- **Red flags are computed on reads and writes, not on a schedule.** An overdue sign-off is flagged the next time the project or dashboard is loaded, and nobody is alerted in between.
- **Onboarding is incomplete.** Historical stages take a name and note but no attachment, and there is no spreadsheet import (PRD 7.19).
- **Double maintenance for the demo.** Every rule is implemented twice, in the backend and in `demo-api.js`. In the hosted Artifact, the document "Download" link doesn't work because the hosted page can't save files; viewing works.
- **Android.** The Android app is still not built or device-tested (v2 Task 20: no JDK or Android SDK on the build machine).
- **Scope approval.** Decision 0002 (the client app) and D-01 (Legal Approval gates line-out) still await Parvez's confirmation.

## What's Next

`docs/V4_EXECUTION_PLAN.md` holds the readiness check against the core plan and PRD V4. It sets the order for the next sprint:

1. **Finish the scaffold (S00).**
   - CI running pytest (SQLite and PostgreSQL), Playwright and the scans.
   - Lint with pre-commit.
   - Compose services.
   - `CLAUDE.md` pointing to PRD v3.2 and V4.
   - An ADR on where new domain code lives.
2. **Identity (S01).**
   - All PRD roles, including Accounts.
   - Refresh tokens and session revocation.
   - Field-level rules, delegation, and admin screens.
3. **Workflow engine (S02 and S03).**
   - A pluggable gate registry with placeholder payment, finding, checklist, document and issue-closure gates.
   - A versioned flow.
   - A mapping from the diagram's 18 stages to the PRD's Stage 0 to 15.
4. **Onboarding and records (S04 and S05).**
   - Client, contact and site entities; spreadsheet import.
   - Meetings and the requirement baseline.
   - Generalising the sign-off service beyond the four client milestones.
5. **Android.** Install the toolchain and close v2 Task 20, since S17, S18 and V4 all depend on a working Android build.

Run `/prd v4` to turn these into sprint tasks.
