# Sprint v3 — Tasks

## Status: In Progress

- [x] Task 1: v3 setup: reference documents, decision records, config and the TBD_PARVEZ marker (P0)
  - Acceptance:
    - Copy `Inputs/SiteFlow-PRD-v3.1.md`, `Inputs/SiteFlow-Implementation-Plan-for-Claude-Code.md`, `Inputs/CLAUDE.md` and the workflow diagram into `docs/reference/`.
    - Add a repo-root `CLAUDE.md` adapted to the actual stack (FastAPI with vanilla JS, not React), keeping the reference version's rules.
    - Add `docs/decisions/0001-evolve-current-stack.md`, `docs/decisions/0002-client-app.md` (the PRD §3.3 scope change, pending Parvez) and `docs/PROGRESS.md`, which lists the open questions from the PRD.
    - `workflow_config.py` gains `CLIENT_SIGNOFF_SLA_DAYS`, `INVITE_CODE_TTL_DAYS`, `INVITE_MAX_ATTEMPTS` and `SIGNOFF_ATTACHMENT_TYPES` (PDF, JPEG, PNG, WEBP). Every undecided value is marked `TBD_PARVEZ`.
    - The existing `PLACEHOLDER: pending Parvez` markers are renamed to `TBD_PARVEZ`.
    - All 234 tests still pass.
  - Files: docs/reference/*, CLAUDE.md, docs/decisions/0001-evolve-current-stack.md, docs/decisions/0002-client-app.md, docs/PROGRESS.md, backend/app/workflow_config.py, backend/app/template_config.py, backend/tests/test_storage.py
  - Completed: 2026-09-27. Reference documents are in docs/reference/ (PRD 3.1, the plan, the reference CLAUDE.md and the workflow diagram). Added a repo CLAUDE.md adapted to the real stack, decisions 0001 (evolve the stack) and 0002 (client app, pending Parvez), and docs/PROGRESS.md with the open questions. workflow_config.py gains the client sign-off SLA, invite TTL and attempts, sign-off attachment types, limit and confirmation wording. The PLACEHOLDER markers are now TBD_PARVEZ. 2 new tests, 236 in total.

- [ ] Task 2: Stage flow configuration from the workflow diagram (P0)
  - Acceptance:
    - `stage_config.py` defines the 22 stages: 18 numbered, plus 4 pre-design activities (site visit, investigations, concept, tentative elevations). Each has a key, number or label, phase (1 to 10), workstream (Studio, Site or Both), owner role, predecessors and gate type.
    - The parallel branches match the diagram: the pre-design Site and Studio branches after stage 4, 8A and 8B after stage 7, and 9 after both 8A and 8B.
    - The client sign-off gates are on stages 4, 11, 17 and 18. `legal_approval` is on 14, and `no_open_major_problems` is on 16.
    - Unit tests check there are no cycles, no orphans and exactly one start stage, that every predecessor exists, and that the phase order is the diagram's.
  - Files: backend/app/stage_config.py, backend/tests/test_stage_config.py

- [ ] Task 3: ProjectStage model, migration, and backfill of existing projects (P0)
  - Acceptance:
    - The `ProjectStage` model has project, key, status (`locked`, `ready`, `active`, `completed` or `historical`), started_at, completed_at, completed_by, a completion note, and a historical confirmer and note.
    - Migration 0006 creates it and backfills existing projects. For v2 projects, stages 1 to 13 become `historical` ("completed before SiteFlow stage tracking"). Stage 14 becomes `completed` or `active`, depending on Legal Approval, and stage 15 becomes `active` when a site visit already exists.
    - The migration test still matches the models, and a backfill test runs on a seeded v2-style database.
  - Files: backend/app/models.py, backend/migrations/versions/0006_project_stages.py, backend/tests/test_migrations.py

- [ ] Task 4: Stage engine: readiness, gates and "why blocked" (P0)
  - Acceptance:
    - `services/stages.py` provides `evaluate(project)`. It returns each stage's status with human-readable blocked reasons: the missing predecessors by name, "Waiting for client sign-off", "Legal Approval is Applied, not Approved" or "2 open High or Critical problems".
    - `release(project)` activates stages whose predecessors are completed or historical. Parallel branches release together.
    - It is a pure function over the state, plus a thin database wrapper.
    - Unit tests cover: both parallel branches opening together, stage 9 waiting on 8A and 8B, a gate that blocks with a reason, and historical stages counting as done.
  - Files: backend/app/services/stages.py, backend/tests/test_stage_engine.py

- [ ] Task 5: Stage tracker API and legacy onboarding at project creation (P0)
  - Acceptance:
    - `POST /projects` creates the 22 stages with stage 1 active.
    - An optional `start_stage` and `historical_confirmed_by` mark earlier stages historical, with the confirmer recorded (PRD 7.19). Historical stages are labelled "Historical — completed before SiteFlow" in every response.
    - `GET /projects/{id}/stages` returns phases, stages, statuses, owners, reasons and the allowed next action for the caller.
    - Project detail and summary gain `phase`, `current_stages` (a list, because branches run in parallel) and `stage_progress` (completed stages out of the total).
    - Visibility rules as in v2. Tests cover creation, legacy start, the historical labels and 404 for non-members.
  - Files: backend/app/routers/stages.py, backend/app/routers/projects.py, backend/app/schemas.py, backend/app/main.py, backend/tests/test_stages_api.py

- [ ] Task 6: Owners complete ordinary stages; gate stages cannot be completed by hand (P0)
  - Acceptance:
    - `POST /projects/{id}/stages/{key}/complete` works for the owner role (or the architect or team lead), needs a non-blank note, and only while the stage is active.
    - It returns 409 with the reasons when a gate isn't met. Client sign-off stages always return 409, "Completes when the client approves".
    - Stage 16 is blocked while High or Critical problems are open.
    - On completion, successors are released, `stage.completed` and `stage.activated` are audited, and the next owners are notified.
    - Tests cover each gate type and each role.
  - Files: backend/app/routers/stages.py, backend/app/services/stages.py, backend/app/services/notify.py, backend/tests/test_stages_api.py

- [ ] Task 7: The construction-stage gate on the v2 site visit loop (P0)
  - Acceptance:
    - The Site Visit step (v2) opens only when Legal Approval is approved **and** stage 14 (Site line-out) has started. Otherwise the draft and submit calls return 409 with the reason.
    - Approving the first construction visit activates stage 15, if it's not already active.
    - Stage 15's official progress remains the v2 derived progress.
    - `ready_project` and the E2E `createApprovedProject` use `start_stage=14`, so the v1 and v2 tests keep passing. A new test shows a stage-3 project can't open a site visit.
  - Files: backend/app/routers/site_visits.py, backend/app/routers/legal.py, backend/app/routers/reviews.py, backend/tests/conftest.py, backend/tests/test_site_visits.py, tests/e2e/helpers.js

- [ ] Task 8: Client role, client membership and staff-only routes (P0)
  - Acceptance:
    - `Role.client` is added, with a `ProjectMember` flag `is_client`.
    - `require_staff` is applied to every existing router, so a client gets 403 on all staff APIs, including `/projects`, `/dashboard`, `/media/{id}`, `/notifications` and `/users`.
    - An authorization test enumerates every route in `app.routes` and asserts the client role gets 403 (or 401 without a token), except `/auth/*`, `/health`, `/template` and the future `/client/*`.
  - Files: backend/app/models.py, backend/migrations/versions/0007_client_role.py, backend/app/deps.py, backend/app/routers/*.py, backend/tests/test_client_access.py

- [ ] Task 9: Client invite and activation with a one-time code (P0)
  - Acceptance:
    - `POST /projects/{id}/client-invite` (architect) takes the client's name and email. It creates the client user (inactive) and the membership, and returns a one-time 8-character code **once**. Only a hash is stored, and it expires after `INVITE_CODE_TTL_DAYS`.
    - `POST /auth/activate` takes the email, code and a new password (at least 10 characters). It activates the account and burns the code.
    - A wrong code counts an attempt, and the invite locks after `INVITE_MAX_ATTEMPTS`. Expired, used or locked codes all return the same 400 message.
    - Re-inviting replaces the old code. An existing client can be added to a second project without a new code.
    - Everything is audited. Tests cover all of these paths.
  - Files: backend/app/models.py, backend/migrations/versions/0008_client_invites.py, backend/app/routers/invites.py, backend/app/routers/auth.py, backend/app/main.py, backend/tests/test_invites.py

- [ ] Task 10: Sign-off requests: versioned packages with attachments (P0)
  - Acceptance:
    - `SignoffRequest` and `SignoffAttachment` models and migration 0009 are added.
    - The architect, for a client sign-off stage that is active:
      - creates a draft (title, summary);
      - uploads attachments with the `SIGNOFF_ATTACHMENT_TYPES` and the v2 signature and size checks;
      - removes attachments while the request is a draft;
      - sends it. Sending needs at least one attachment and a client member on the project.
    - Only one open request per stage is allowed (409 otherwise). Versions number from 1 per stage.
    - `GET /projects/{id}/signoffs` returns the history.
    - Audit events are `signoff.created`, `signoff.sent` and `signoff.attachment_added`.
  - Files: backend/app/models.py, backend/migrations/versions/0009_signoffs.py, backend/app/routers/signoffs.py, backend/app/services/signoffs.py, backend/app/main.py, backend/tests/test_signoffs.py

- [ ] Task 11: Client reviews and signs off (approve or request changes) (P0)
  - Acceptance:
    - `GET /client/signoffs/{id}` and `GET /client/signoffs/{id}/attachments/{aid}` serve the file and record a `SignoffView`. This is for the client on that project only; other clients get 404.
    - `POST /client/signoffs/{id}/approve` needs every attachment viewed (422 listing the unviewed ones), `confirm: true` and a typed full name matching the invited name case-insensitively. It records signer_name, method `client_app`, the time and a request fingerprint (a hash of IP and user agent).
    - `POST /client/signoffs/{id}/request-changes` needs a comment.
    - Once responded, a version is immutable: it returns 409, and the model guard blocks edits like the audit guard does.
    - Approval completes the stage and releases successors. After changes are requested, the architect's next draft supersedes and links to the previous version.
    - Tests cover the full cycle v1 → changes → v2 → approve, and every rejection path.
  - Files: backend/app/routers/client.py, backend/app/services/signoffs.py, backend/app/models.py, backend/tests/test_client_signoff.py

- [ ] Task 12: Client-safe project view API (P0)
  - Acceptance:
    - `GET /client/projects` and `GET /client/projects/{id}` are for the client's own projects only.
    - They are built from an allow-list: project name and location, phases and stages (status, historical label, completed dates), official progress, current stages, sign-off requests (status, version, dates, the client's own responses) and shared updates.
    - A test serialises the responses and asserts that none of these keys or values appear: audit, rework comments, red flags, problems, internal notes, emails of staff, or other projects' ids.
  - Files: backend/app/routers/client.py, backend/app/services/client_view.py, backend/tests/test_client_view.py

- [ ] Task 13: Sign-off notifications and the "client decision overdue" red flag (P0)
  - Acceptance:
    - A sent request notifies the client ("Please review and sign off: …").
    - An approval or a change request notifies the project architect and team leads, with the client's comment.
    - A new red flag rule, `client_decision_overdue` (label "Client decision overdue", rank 4), holds while a sent request is older than `CLIENT_SIGNOFF_SLA_DAYS`, and clears on response.
    - The rule is added to `evaluate_flags`, with unit tests using a fixed clock.
  - Files: backend/app/services/notify.py, backend/app/services/red_flags.py, backend/app/workflow_config.py, backend/tests/test_red_flag_rules.py, backend/tests/test_notifications.py

- [ ] Task 14: Dashboard: phase, stage, client and waiting-for-client (P0)
  - Acceptance:
    - `GET /dashboard` rows gain `phase`, `current_stages`, `stage_progress`, `client` (name, or null) and `waiting_for_client` (the open sent request with its days waiting).
    - A new panel `waiting_for_client` is sorted by longest wait.
    - New filters `phase` and `client_pending` (true or false) return 422 on invalid values.
    - Tests extend the dashboard portfolio fixture.
  - Files: backend/app/routers/dashboard.py, backend/tests/test_dashboard.py

- [ ] Task 15: UI: stage tracker on the project page (P0)
  - Acceptance:
    - The v1 3-step stepper is replaced by a phase timeline: 10 phases, each showing its stages with status text and colour, parallel branches side by side, the Studio or Site label and "Historical" styling.
    - Opening a stage shows its owner, reasons when blocked, completion notes, and Complete (with a note) for its owner.
    - The v2 Legal Approval card and site-visit and review cards stay, now inside phase 7.
    - Phone layout without horizontal scroll. The Playwright test completes stage 1 to 3, sees stage 4 blocked with "Waiting for client sign-off", with screenshots.
  - Files: web-src/api.js, web-src/app.js, web-src/app.html, tests/e2e/v3-stages.spec.js, tests/e2e/task9-signin-projects-legal.spec.js

- [ ] Task 16: UI: invite the client and client activation (P0)
  - Acceptance:
    - The project page has a Client panel: Invite client (name, email), which shows the one-time code once with a copy button and a note that nothing is sent automatically, and re-invite.
    - The sign-in screen has "I have an invite code", which takes the email, code and new password.
    - Errors are in plain words.
    - The Playwright test invites a client, activates, and signs in as the client, with screenshots.
  - Files: web-src/api.js, web-src/app.js, tests/e2e/v3-client-invite.spec.js

- [ ] Task 17: UI: sign-off composer for the Architect (P0)
  - Acceptance:
    - On an active client sign-off stage, the Architect has "Prepare sign-off". It covers the title, summary for the client, attachments (PDF and images, with upload progress), send, and the history of versions with the client's responses, comments and the signer's name and time.
    - After changes are requested, "Prepare version N+1" opens with the previous content copied.
    - The Playwright test prepares and sends version 1, with screenshots.
  - Files: web-src/api.js, web-src/app.js, web-src/app.html, tests/e2e/v3-signoff.spec.js

- [ ] Task 18: UI: the customer app: my projects and phase timeline (P0)
  - Acceptance:
    - Signing in as a client routes to a client home. It shows "My projects" cards (phase, current stage, progress, and "Sign-off waiting for you" badges) and the project timeline (10 phases, current stage highlighted, dates of completed milestones, and signed milestones with the signer's name).
    - The staff navigation is hidden. It's mobile-first and works in the Android shell.
    - The Playwright test at desktop and Pixel 7 width checks that no internal text appears (audit, flags, problems), with screenshots.
  - Files: web-src/api.js, web-src/app.js, web-src/app.html, tests/e2e/v3-client-app.spec.js

- [ ] Task 19: UI: client sign-off review screen (P0)
  - Acceptance:
    - The client opens a request, and it shows the summary and each attachment: images inline, PDFs in an in-page viewer, and a download link as a fallback.
    - Each attachment is ticked when viewed.
    - Approve stays disabled until every attachment is viewed, the confirmation box is ticked and the typed name matches. The confirmation wording is shown and marked `TBD_PARVEZ` in config.
    - "Request changes" needs a comment.
    - The Playwright test covers the full cycle: the client requests changes on version 1, the Architect sends version 2, the client approves, stage 4 completes and the Phase 2 branches open. Screenshots at phone width.
  - Files: web-src/app.js, web-src/app.html, tests/e2e/v3-signoff.spec.js

- [ ] Task 20: UI: dashboard shows phase, client and waiting for client (P1)
  - Acceptance:
    - The All Projects table gains Phase and Stage columns and a Client column.
    - A "Waiting for client" panel is sorted by longest wait, with days waiting, and the "Client decision overdue" flag appears in Needs Architect Attention.
    - New Phase and Client pending filters.
    - The Playwright test is extended, with screenshots.
  - Files: web-src/app.js, tests/e2e/v2-dashboard.spec.js, tests/e2e/v3-dashboard.spec.js

- [ ] Task 21: Share approved site updates with the client (P1)
  - Acceptance:
    - On an approved visit, the Architect can share an update: a short note plus chosen photos.
    - `SharedUpdate` model and migration 0010 are added.
    - The client sees shared updates on their project timeline, with photos served through `/client/updates/{id}/media/{mid}` (client access only).
    - Unshared visits, photos and problems stay invisible. API and E2E tests cover this.
  - Files: backend/app/models.py, backend/migrations/versions/0010_shared_updates.py, backend/app/routers/client.py, backend/app/routers/projects.py, web-src/app.js, backend/tests/test_shared_updates.py, tests/e2e/v3-client-app.spec.js

- [ ] Task 22: UI: legacy onboarding on the New project form (P1)
  - Acceptance:
    - The New project form has an optional "Already in progress?" section: a current stage picker (grouped by phase) and "Earlier stages confirmed by" (a name, required when a stage is picked).
    - The created project shows earlier stages as Historical.
    - The Playwright test onboards a project at stage 13 and checks that the historical stages never read as signed by the client.
  - Files: web-src/app.js, tests/e2e/v3-stages.spec.js

- [ ] Task 23: Client demo parity and republish (P2)
  - Acceptance:
    - `demo-api.js` implements stages, the stage engine, sign-offs, client invite and activation, the client view and shared updates with the same rules.
    - The sample data adds a client account ("Mr. Gokhale", in the demo accounts) whose project waits on a design-freeze sign-off.
    - The demo E2E test covers the client's approval.
    - The demo is republished to the same link.
  - Files: web-src/demo-api.js, web-src/app.js, web-src/build.py, tests/e2e/demo.spec.js, demo/
