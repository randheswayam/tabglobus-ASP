# CLAUDE.md — SiteFlow

Standing instructions for Claude working in this repository. Adapted from `docs/reference/CLAUDE-reference-v4.md` to the stack this repository actually uses (see `docs/decisions/0001-evolve-current-stack.md` and `docs/decisions/0003-module-layout.md`).

## Project

SiteFlow is a mobile and web workflow platform for an architecture practice. The business owner is Architect Parvez, and delivery is by TAN GLOBUS AI. Each residential project runs through the 18-stage Studio and Site workflow, with client sign-offs at major milestones, site visits with photo evidence, red flags, and a portfolio dashboard for about 20 concurrent projects. Clients track their own project and sign off in the same app, under the Client role.

- Core requirements: `docs/SiteFlow-PRD-v3.2.md`.
- V4 enhancements: `docs/SiteFlow-PRD-V4.md`. It governs any capability it specifies.
- Build steps: `docs/IMPLEMENTATION_PLAN.md` (S00 to S20), then `docs/V4_IMPLEMENTATION_PLAN.md` (V01 to V25).
- Execution order, step status and risks: `docs/V4_EXECUTION_PLAN.md`.
- Sprint PRDs and tasks: `sprints/vN/PRD.md` and `sprints/vN/TASKS.md`.
- Workflow diagram: `docs/reference/workflow-diagram.jpeg`.
- Progress log: `docs/PROGRESS.md`.
- Decisions: `docs/decisions/`.

## How to work

1. Read the PRD sections for the current sprint task before writing code.
2. Do only the task you were given. Don't start later tasks.
3. If the PRD is unclear or conflicts with the plan, stop and write the question in `docs/PROGRESS.md` under "Open questions" rather than guessing.
4. Values not yet decided by Parvez go in configuration (`backend/app/*_config.py`) with the marker `TBD_PARVEZ`. Never present a guess as decided.
5. Finish each task by running all tests (pytest and Playwright) and the scans, then update `sprints/vN/TASKS.md` and `docs/PROGRESS.md`.

## Stack

- Backend: Python 3.12 (`backend/.venv`), FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic, and PostgreSQL 16. SQLite is used for the default test run and for `run_local.py`.
- Media: the storage interface in `backend/app/services/storage.py`. Local disk for now, S3-compatible later.
- Web: a vanilla JavaScript single-page app in `web-src/` (`api.js`, `app.js`, `app.html`), built by `web-src/build.py`.
- Mobile: Capacitor 7 wrapping the web app, Android first, app id `ai.tanglobus.siteflow`.
- Client demo: `web-src/demo-api.js`, an in-browser copy of the API rules, built to `demo/`.
- Tests: pytest in `backend/tests` (set `TEST_DATABASE_URL` to run them on PostgreSQL) and Playwright in `tests/e2e`.
- Run locally: `backend/.venv/Scripts/python run_local.py`.

## Architecture rules

- New domain code goes in `backend/app/modules/<domain>/` (decision 0003). Existing `services/` and `routers/` move only when a task touches them for a real reason.
- Routers stay thin. Rules live in services or module code as pure functions where possible, with tests.
- The stage flow is configuration (`stage_config.py`). Gates are evaluated by the stage engine, never hard-coded in the UI.
- Every blocked action returns a list of human-readable reasons.
- Approved, frozen and signed records are immutable. Corrections create a new version linked to the previous one.
- Every write records an `AuditEvent` (actor, action, entity, detail, time) in the same transaction as the change.
- Every schema change gets an Alembic migration. Never edit a migration that has been committed.

## Security and privacy rules

- Enforce authorization on the server for every route: role, project membership and field-level rules.
- The Client role reaches only `/client/*` and `/auth/*`. Client responses are built from an allow-list of fields.
- Private calendar details, internal notes, audit records and red flags never reach a client response.
- Media and documents are served only through authorized endpoints. Never make storage public.
- No secrets in code or commits.

## V4 integration and AI rules

- Webhooks: verify signatures, reject replays, process idempotently, keep the raw payload under policy.
- A delivery or read receipt is never an approval or proof of payment. A calendar RSVP is attendance only.
- Channel-reply approval follows PRD V4 section 11.4A exactly: only a verified WhatsApp button reply or tokenized email APPROVE, and only for sign-off types enabled in configuration.
- A client saying "paid" creates a verification task; only Accounts can mark payment Received or Cleared.
- Every AI call goes through `backend/app/modules/ai` (gateway, prompt registry, `AIExecution` audit). No direct provider calls elsewhere.
- AI output is always labelled as AI, links to its sources, and stays a suggestion or draft until a person accepts it.
- AI must never approve, sign off, pass a checklist item, set official progress, issue drawings, or make structural or safety determinations.
- Core capture, submission and review must keep working when AI is switched off.
- Personal calendar data and records labelled AI Prohibited never enter AI context, embeddings or training data.

## Code conventions

- Type hints everywhere, and Pydantic models for request bodies.
- Tests alongside each feature: unit tests for rules, API tests for permissions, and Playwright with screenshots for screens.
- `data-testid` attributes on interactive elements.
- Small, focused commits with clear messages.
- User-facing text in plain English, with statuses shown in text as well as colour.

## Naming

- The company name is always written TAN GLOBUS AI.
- Delivery phases are described as Build → Deploy → Evaluate → Maintain.
