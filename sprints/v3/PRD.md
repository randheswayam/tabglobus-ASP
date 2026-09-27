# Sprint v3 — PRD: Project Stage Tracker, Client Sign-off and Customer App

## Overview
Sprint v3 aligns SiteFlow with **PRD v3.1** (`docs/reference/SiteFlow-PRD-v3.1.md`) and the architect workflow diagram. It replaces the three-step flow with the **18-stage residential project tracker** (10 phases, with the Studio and Site workstreams running in parallel where the diagram allows).

It adds **client sign-off at four major milestones**:
- The requirements baseline.
- The all-elevation design freeze.
- Tile and material selection.
- Handover.

It also delivers the **customer app**. It's the same web and Android codebase with a Client role, in which a client tracks their own project and signs off each milestone after reviewing the exact package.

The v2 site visit, review, photo, red flag and dashboard features keep working inside the construction stages. This sprint continues the **Build** stage of Build → Deploy → Evaluate → Maintain.

## Scope change recorded against PRD v3.1
PRD v3.1 §3.3 lists "public client portal in the first pilot" as a non-goal "unless separately approved". Implementation plan step S05 also has internal users record client sign-off on the client's behalf. This sprint adds a **client-facing app** instead, as requested on 27 September 2026. The change is recorded in `docs/decisions/0002-client-app.md`, and **Parvez needs to confirm it**.

A second deviation: the implementation plan assumes a React and TypeScript rebuild. v3 instead evolves the existing FastAPI backend and web app, as recorded in `docs/decisions/0001-evolve-current-stack.md`.

## Goals
- Every project runs through the 18 stages and 4 pre-design activities from the workflow diagram, with dependencies:
  - The pre-design Site and Studio branches run in parallel.
  - The 8A architectural and 8B structural packages run in parallel.
  - Each blocked stage shows a plain-language "why blocked" list.
- The four client milestones (stages 4, 11, 17, 18) complete **only** when the named client approves the exact version of a sign-off package. A request for changes creates a new version, and every signed version is immutable.
- A client, invited by the Architect with a one-time code, signs in to the same app. The client sees only their own projects:
  - The phase timeline, current stage and official progress.
  - Sign-off requests and their history.
  - Updates the Architect chose to share.

  None of the internal records (audit, rework comments, red flags, problems, other projects) reach the client's view or API.
- A client can approve only after opening every attachment in the package. Approval records the client's typed full name, a confirmation statement, the time and the method.
- The main dashboard shows each project's phase and current stage, the assigned client, and pending client sign-offs. It includes a "Waiting for client" signal and a red flag for a client decision that is overdue.

## User Stories
- As an Architect, I want every project laid out as the 18-stage workflow, so that I can see which Studio and Site work is done, active or blocked, and why.
- As an Architect, I want to onboard an in-progress project at its current stage with earlier stages marked historical, so that the roughly 20 running projects can join SiteFlow (PRD 7.19).
- As an Architect, I want to send a sign-off package (summary plus drawings, PDFs or photos) for a milestone, so that the client approves an exact version rather than a verbal agreement.
- As a Client, I want to see my project's phases, current stage and progress on my phone, so that I know where my house stands without calling the office.
- As a Client, I want to review the package and then sign off or ask for changes, so that my decisions are recorded against what I actually saw.
- As Parvez, I want to see on the dashboard which projects are waiting for a client decision, and be flagged when one is overdue, so that client delays don't stall the design.
- As an Architect, I want the design-freeze sign-off to be permanent, so that later changes are handled as change requests and are not silently edited (PRD 7.10 and §9).
- As a Civil Engineer, I want site visits to open only when construction has started and Legal Approval is in place, so that the construction-quality loop matches the real project stage.

## Technical Architecture

**Stack (unchanged from v2):** FastAPI, SQLAlchemy 2 and Alembic on PostgreSQL 16 (SQLite in tests). Vanilla-JS web app in `web-src/`, Capacitor 7 for Android, and local media storage behind the storage interface. Playwright and pytest.

**New configuration:**
- `backend/app/stage_config.py` holds the 22-entry stage flow: key, number, label, phase, workstream, owner role, predecessors, and gate type (`client_signoff`, `legal_approval`, `no_open_major_problems`, or none).
- `workflow_config.py` gains `CLIENT_SIGNOFF_SLA_DAYS`, `INVITE_CODE_TTL_DAYS`, `INVITE_MAX_ATTEMPTS` and `SIGNOFF_ATTACHMENT_TYPES`.

Undecided values use the marker **`TBD_PARVEZ`**, as the attached CLAUDE.md requires. The v2 `PLACEHOLDER` markers are renamed to match.

**Stage flow (from the workflow diagram)**
```
Phase 1  Initiation and requirements   1 Project setup → 2 Client discovery meetings (repeatable)
                                       → 3 Preliminary requirement baseline → 4 CLIENT SIGN-OFF (requirements)
Phase 2  Parallel pre-design           Site:   Pre-design site visit → Investigations
                                       Studio: Preliminary concept → Tentative elevations (not frozen)
Phase 3  Structural design             5 Centerline/grid, foundation basis, column positions
                                       → 6 Architect + structural consultant freeze → 7 Structural design package
Phase 4  Design development            8A Architectural package ║ 8B Structural package → 9 MEP / coordination
                                       → 10 All elevations package
Phase 5  Client approval and gate      11 CLIENT SIGN-OFF (design freeze) → 12 50% upfront gate
Phase 6  Detailed drawings             13 Detailed drawings / controlled issue
Phase 7  Construction execution        14 Site line-out [needs Legal Approval] → 15 Construction quality stages
                                          (v2 site visits, photos, review and derived progress run here)
Phase 8  Civil completion              16 Civil completion [no open High/Critical problems]
Phase 9  Interiors                     17 CLIENT SIGN-OFF (tile and material selection)
Phase 10 Handover                      18 CLIENT SIGN-OFF (handover / closeout)
```

**Component diagram**
```
 ┌──────────────── SiteFlow app (web-src, one codebase, web + Android) ────────────────┐
 │ Staff:  Dashboard · Projects · Stage tracker · Sign-off composer · Site visits ·    │
 │         Review · Notifications                                                      │
 │ Client: My projects · Phase timeline · Sign-off review (view → confirm → sign) ·    │
 │         Shared updates                                                              │
 └──────────────┬────────────────────────────────────────────────┬─────────────────────┘
                │ staff API (require_staff)                      │ client API (/client/*, role=client)
 ┌──────────────▼────────────────────────────────────────────────▼─────────────────────┐
 │ FastAPI                                                                             │
 │ routers: projects · stages · signoffs · client · invites · site_visits · reviews ·  │
 │          media · problems · red_flags · dashboard · notifications                   │
 │ services: stages (dependency + gate evaluation, why-blocked) · signoffs             │
 │           (versioned, immutable) · client_view (client-safe projection) ·           │
 │           red_flags (+ client_decision_overdue) · notify · audit · storage          │
 └──────────────┬──────────────────────────────────────────────────┬───────────────────┘
          PostgreSQL (ProjectStage, SignoffRequest, SignoffAttachment,     MEDIA_DIR
          SignoffView, ClientInvite, SharedUpdate + v2 tables)             (sign-off files)
```

**Data flow**
1. **Project creation.** It instantiates 22 `ProjectStage` rows, with stage 1 active. With `start_stage`, earlier stages are marked **Historical**, with the confirming person and a note, and are never shown as system or client sign-offs (PRD 7.19). The migration treats existing v2 projects the same way: stages 1 to 13 become historical and stage 14 or 15 is active.
2. **The stage engine.** A stage is *ready* when all its predecessors are completed or historical. It is *blocked* when its gate isn't met, with a reason list such as "Waiting for client sign-off (version 2 sent 3 days ago)" or "Legal Approval not approved". Owners complete ordinary stages with a note. Gate stages can't be completed by hand.
3. **Sign-off.** The Architect drafts a `SignoffRequest` for a sign-off stage (version N: title, summary, attachments) and sends it. The client is notified.
4. **Client review.** The client opens the request, and each attachment view is recorded as a `SignoffView`. The client then either:
   - **Approves**, which needs every attachment viewed, the typed full name and the confirmation tick. The version is frozen, the stage completes and successors are released.
   - **Requests changes**, which needs a comment. The Architect prepares version N+1, linked to the previous version.

   Every step is audited, and the Architect and Parvez are notified.
5. **Customer app.** The client API returns a **client-safe projection** built from an allow-list of fields. It contains no internal notes, audit, rework comments, red flags, problems, team member contacts or other projects. All staff routers reject the `client` role (403), and a test walks every route with the client role to prove it.
6. **Dashboard.** Each row adds phase, stage, client and `waiting_for_client`. The `client_decision_overdue` flag is raised when a sent request is older than `CLIENT_SIGNOFF_SLA_DAYS`.

**New entities:** `ProjectStage`, `HistoricalStageRecord` (fields on `ProjectStage`), `SignoffRequest` (project, stage, version, status draft/sent/approved/changes_requested/superseded, title, summary, sent_at, responded_at, decision, comment, signer_name, method, `supersedes_id`), `SignoffAttachment`, `SignoffView`, `ClientInvite` (user, code hash, expires_at, attempts, used_at) and `SharedUpdate` (visit, note, shared_by).

## Out of Scope (v4+)
- **The full configurable workflow engine and template builder** (plan S02 and PRD 6): v3 stage flow is a fixed configuration file. Dependency-graph editing, template versions and gate plug-ins come later.
- **Stage content modules**: meetings and the requirement register (S05), the drawing register and revisions (S06), freeze packages and structural consultant flows (S08), change requests (S09), payment milestones (S10, beyond a manual stage completion), checklists (S12) and calendars (S14). In v3 these stages are tracked, completed with notes and, where marked, signed by the client. Their detailed tooling isn't built yet.
- **New roles**: Structural Consultant, MEP, Interior Designer and Accounts (PRD 5). Their stages are owned by existing staff roles in v3.
- **Email, SMS or WhatsApp delivery** of invites and sign-off requests: the Architect shares the invite code by hand, and everything is in-app.
- **Client e-signature standards** (for example Aadhaar e-sign), multi-factor sign-in and a legal review of the sign-off wording. The wording is `TBD_PARVEZ` and needs legal confirmation.
- **Security hardening (plan S19)**: rate limiting beyond invite attempts, token storage changes, and encryption at rest.
- **The Android build and device check**, still open from v2 Task 20.

## Dependencies
- The sprint v2 codebase: 234 backend tests and 15 E2E tests passing, and migrations 0001 to 0005.
- The reference documents in `Inputs/`, to be copied into `docs/reference/`: `SiteFlow-PRD-v3.1.md`, `SiteFlow-Implementation-Plan-for-Claude-Code.md`, `CLAUDE.md` and the workflow diagram.
- **Decisions needed from Parvez.** These are placeholders until answered; none blocks the build:
  - **Client portal (§3.3 change):** confirm the customer app.
  - **D-01:** whether Legal Approval is the gate for stage 14 Site line-out, as assumed here.
  - **D-04:** the named client signatory and a backup, per project.
  - **Sign-off wording:** the confirmation statement, which also needs legal review.
  - **`CLIENT_SIGNOFF_SLA_DAYS`:** the client decision SLA.
  - **`INVITE_CODE_TTL_DAYS`:** how long an invite code stays valid.
  - **Shared updates:** which site updates clients may see by default.
- There is no sprint v2 `WALKTHROUGH.md` yet. Running `/walkthrough` for v2 first is recommended, but it isn't blocking.
