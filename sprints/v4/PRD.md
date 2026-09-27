# Sprint v4 — PRD: Core Foundation Catch-up (S00 to S04)

## Overview
Sprint v4 is the first sprint of the V4 programme. It closes the core gaps that block V4 step V01, as listed in `docs/V4_EXECUTION_PLAN.md`. It covers execution-plan steps 1 to 5, which finish core steps S00 to S04 of `docs/IMPLEMENTATION_PLAN.md`, plus one requested change to the v3 stage tracker (stage completion with files):

- **S00:** tooling and CI.
- **S01:** identity.
- **S02 and S03:** the workflow engine and residential template.
- **S04:** project setup and onboarding.

- **Requested on 28 September 2026:** every workflow activity can be marked complete with a text note and attached photos, videos, AutoCAD drawings (DWG or DXF) and PDFs.
- **Requested on 28 September 2026:** hovering over a project on the dashboard shows its complete workflow as a callout, coloured green (completed), yellow (waiting) and red (delayed).

No V4 feature (V01 to V25) is built in this sprint. This sprint continues the **Build** stage of Build → Deploy → Evaluate → Maintain.

## Goals
- **CI gates every change.** GitHub Actions runs:
  - pytest on SQLite and on PostgreSQL 16;
  - the Playwright suite;
  - ruff and eslint;
  - semgrep, pip-audit and npm audit.

  `docker compose up` starts the database, API and web app.
- **Identity matches PRD v3.2 section 5.** Every staff role exists, including Accounts, Structural Consultant, MEP Consultant, Interior Designer and Office Coordinator. Sessions can be refreshed, signed out and revoked on all devices. Admins manage users and project memberships. Commercial fields are hidden from roles the permission matrix doesn't allow.
- **The workflow engine is pluggable.**
  - Gates are registered evaluators, and a stage can carry more than one.
  - Stage events go through an in-process event bus.
  - The gates that later steps build (payment, finding disposition, issue closure, document status, checklist) are registered as placeholders. Each placeholder blocks with a plain-language reason and can be passed only by a recorded, authorized exception.
- **Projects have real records.** Each project has a Client with contacts, a Site and a fee plan. The roughly 20 running projects can be bulk-imported from a CSV file: preview first, with row-level errors, then commit, with an `ImportBatch` audit record.
- **Stages are completed with evidence.** On every v3 stage, the person completing it writes what was done and can attach photos (with the camera on mobile), videos, AutoCAD DWG or DXF drawings and PDFs.
  - Files are type-checked by their bytes, size-limited, stored privately, and frozen once the stage completes.
  - Stages can be configured to require a file before completion (none required by default, `TBD_PARVEZ`).
  - Clients never see stage files or notes.
- **The dashboard shows each project's whole workflow at a glance.** Hovering over (or focusing, or tapping) a project row opens a callout with all 10 phases and 23 stages.
  - Colours: green Completed, yellow Waiting, red Delayed, grey Upcoming. Each has an icon, text and a reason.
  - Delayed comes from the existing red-flag rules mapped to their stage. A per-stage days threshold can be added once Parvez sets it.
- **Nothing regresses.** All 409 backend tests and 28 E2E tests from v3 still pass, or are updated only where a rule deliberately changed.

## User Stories
- As TAN GLOBUS AI, I want every change tested, linted and scanned in CI, so that nothing reaches the pilot without passing the suite.
- As an Admin, I want to add users with the correct PRD role and manage project memberships from the web app, so that consultants and Accounts can join projects without a developer.
- As any user, I want to sign out on all my devices, so that a lost phone can't keep acting in my name.
- As Accounts, I want to see a project's fee plan, while a Site Engineer doesn't, so that commercial data stays with the people entitled to it.
- As the Structural Consultant, I want the structural stages assigned to my role, so that my work appears in my own list.
- As Parvez, I want gates for work SiteFlow doesn't manage yet (payment, findings, drawings) to block with a clear reason and need a recorded exception, so that nobody skips them silently.
- As a Civil Engineer, I want to attach site photos and videos when I mark the pre-design site visit complete, so that the conditions are on record, not only in my phone.
- As an Architect, I want to attach the AutoCAD centerline or grid drawing (DWG or DXF) to the stage I complete, so that the Structural Consultant works from the file that was actually issued.
- As Parvez, I want to hover over a project on the dashboard and see every stage coloured by state, so that I know what is done, what is waiting and what is late without opening the project.
- As an Admin, I want to import the in-progress projects from a spreadsheet with a preview and row errors, so that onboarding the roughly 20 projects doesn't mean entering each one by hand (PRD 7.19, FR-27).

## Technical Architecture

**Stack (unchanged, per decision 0001):**
- FastAPI, SQLAlchemy 2 and Alembic on PostgreSQL 16, with SQLite for the fast local run.
- The vanilla-JS web app in `web-src/`, and Capacitor 7.
- pytest and Playwright.

**Additions:**
- **Tooling:** ruff, eslint, a pre-commit config, GitHub Actions and a backend Dockerfile.
- **Code location:** new domain code goes under `backend/app/modules/<domain>/` (decision 0003). The existing `services/` and `routers/` stay where they are and move only when touched for a real reason.
- **New tables:**
  - `user_sessions` (refresh tokens stored as hashes, revocation);
  - `clients`, `client_contacts` and `sites`;
  - fee plan columns on `projects`;
  - `stage_exceptions`;
  - `import_batches`;
  - `stage_attachments` (stage completion files);
  - `approval_delegations` (P1);
  - `flow_versions` (P1).

**Component diagram**
```
 ┌──────────── web-src (staff and client app) ────────────┐
 │ Admin: Users · Memberships · Import (CSV preview/commit)│
 │ Project: Client · Site · Fee plan (hidden by role)     │
 │ Stage tracker: gates with reasons · Record exception   │
 │   · note + photo / video / DWG / DXF / PDF → complete  │
 └───────────────┬────────────────────────────────────────┘
                 │ access token (short) + refresh token (rotated)
 ┌───────────────▼────────────────────────────────────────┐
 │ FastAPI                                                │
 │  auth: login · refresh · logout · logout-all           │
 │  modules/identity: roles · sessions · admin · fields   │
 │  modules/workflow: gate registry · event bus ·         │
 │                    placeholder gates · exceptions      │
 │  modules/projects: clients · sites · fee plan · import │
 │  existing services: stages · signoffs · notify · audit │
 └───────────────┬────────────────────────────────────────┘
          PostgreSQL 16 (CI + compose) / SQLite (local tests)

 GitHub Actions: lint → pytest (SQLite, PostgreSQL) → Playwright → semgrep · pip-audit · npm audit
```

**Data flow**
1. **Sign-in.**
   - Login returns a short-lived access token that carries a session id, plus a refresh token that is stored only as a hash.
   - Every request checks that the session hasn't been revoked.
   - Refresh rotates the refresh token.
   - Logout revokes the current session; logout-all revokes every session for the user.
2. **Gate evaluation.**
   - `stage_config` gives each stage a `gates` list. The engine asks each registered evaluator for reasons.
   - A placeholder evaluator returns "<Gate> is not built yet: an Admin or Team Lead can record an exception with a reason", unless a `StageException` exists for that project, stage and gate.
   - Recording an exception is audited and publishes an event.
3. **Events.** `stage.activated`, `stage.completed` and `stage.exception_recorded` are published on the in-process bus. Notifications subscribe to the bus instead of being called directly.
4. **Import.**
   - Upload a CSV file, then run the preview. The preview validates every row (client, site, stage key, engineer email, confirmer) without writing anything.
   - Commit either imports all rows or only the valid ones; the Admin chooses.
   - Each commit creates projects with historical earlier stages, plus an `ImportBatch` row with counts and errors, and is audited.
5. **Stage completion with files.**
   - In the stage detail, the user attaches files; each upload is checked by its leading bytes and stored under a random key.
   - The user writes the note and presses Mark complete. The completion links every pending file and makes the note and files immutable, then releases successors as before.
   - Downloads are staff only. DWG and DXF files are always downloaded, never rendered in the browser.
6. **Dashboard callout.**
   - The dashboard response carries each row's `workflow` summary, built by `modules/workflow/health.py` from the stage engine and the open red flags. There is no extra request per hover.
   - A stage is Delayed when an open red flag applies to it (for example Legal delay → Site line-out, or Client decision overdue → that sign-off stage), or when it has been active longer than its configured threshold.
   - This is an early, rule-based version of the V4 traffic lights. V04 later derives Studio and Site health from the same rules instead of adding a second rule set (R-12).
7. **Field rules.** A single permission matrix (`FIELD_RULES`) removes commercial fields from API responses for roles without access. It is applied in the response builders, not in the UI.

## Out of Scope (later sprints)
- **Core steps S05 to S18:**
  - meetings and baselines, documents, the pre-design visit, the freeze package;
  - change requests, payment milestones (the payment gate stays a placeholder with exceptions);
  - checklists, calendars, notifications with a worker;
  - dashboard completion, mobile completion, deploy.
- **All V4 steps V01 to V25:** OTP and magic-link login, MFA, the publication flag and the rest.
- **The Android build (S17 and v2 Task 20).** It needs JDK 21 and the Android SDK installed on the build machine.
- **UUID ids and `organization_id`.** Recorded in decision 0003 as a later step, before V08 (R-14).
- **React migration.** Not in this sprint (decision 0001).
- **Date-based delay.** Red from planned and forecast dates needs the V03 scheduling engine. In this sprint, Delayed comes only from red flags and an optional per-stage day count.
- **Viewing AutoCAD drawings in SiteFlow.** DWG and DXF files are stored and downloaded only; there is no in-app preview or conversion.
- **Demo parity.** The client demo stays exactly as published for v3 (R-16). `demo-api.js` is not changed, and the demo E2E test must still pass.

## Dependencies
- The sprint v3 codebase at commit `40a1e36`: 409 backend and 28 E2E tests passing, and migrations 0001 to 0009.
- The documents in `docs/`: `SiteFlow-PRD-v3.2.md`, `SiteFlow-PRD-V4.md`, `IMPLEMENTATION_PLAN.md`, `V4_IMPLEMENTATION_PLAN.md`, `V4_EXECUTION_PLAN.md` and `reference/CLAUDE-reference-v4.md`.
- A GitHub repository with Actions enabled, for the CI tasks. Locally, CI configuration can be validated only by running the same commands.
- **Decisions still open.** Placeholders marked `TBD_PARVEZ` until answered; none blocks the build:
  - **D-13:** the list of in-progress projects and their current stages. The import format is built now; the data comes later.
  - **Field permission matrix:** which roles see fee plan fields. The seeded default is Admin, Accounts and Team Lead, marked `TBD_PARVEZ`.
  - **Stage owners:** which new role owns each stage. The seeded defaults come from PRD v3.2 section 5 and are marked `TBD_PARVEZ`.
  - **Exception authority:** who may record a gate exception. The seeded default is Admin and Team Lead, marked `TBD_PARVEZ`.
  - **Stage evidence rules:** which stages require a file before completion, and the size limit per file kind (`MAX_STAGE_ATTACHMENT_MB`). The seeded default requires no file, marked `TBD_PARVEZ`.
  - **Stage delay thresholds:** how many days a stage may stay active before it shows as Delayed (`STAGE_DELAYED_AFTER_DAYS`). Empty by default so the rule is off, marked `TBD_PARVEZ`.
  - **Session lengths:** access and refresh token lifetimes. These are TAN GLOBUS AI security settings, marked for confirmation.
