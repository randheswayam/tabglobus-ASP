# SiteFlow — Implementation Plan and Build Steps

**For use with Claude in VS Code**

| Item | Detail |
|---|---|
| Product | SiteFlow — architecture workflow automation (mobile and web) |
| Business owner | Architect Parvez |
| Delivery | TAN GLOBUS AI |
| Source of truth | `docs/SiteFlow-PRD-v3.1.md` |
| Lifecycle | Build → Deploy → Evaluate → Maintain |
| Date | 27 September 2026 |

---

## 1. How to Use This Plan

1. Create the repository and copy these three files into it:
   - `CLAUDE.md` → repository root (standing instructions Claude reads every session)
   - `docs/SiteFlow-PRD-v3.1.md` → the requirements
   - `docs/IMPLEMENTATION_PLAN.md` → this file
2. Run the steps in order. Give Claude **one step per session** by pasting the step's prompt block.
3. Do not start the next step until the current step's acceptance criteria pass and the code is committed.
4. After each step, ask Claude to update `docs/PROGRESS.md` with what was done, any open questions, and any deviations from the PRD.
5. Values Parvez has not yet decided (decisions D-01 to D-15 in the PRD) are seeded as configuration with the marker `TBD_PARVEZ`. Never hard-code a guess.

---

## 2. Technical Baseline

These choices follow the SiteFlow prototype decisions (one codebase for web and Android through Capacitor; FastAPI and PostgreSQL backend; S3 media).

| Layer | Choice |
|---|---|
| Backend | Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic |
| Database | PostgreSQL 16 |
| Background jobs | Redis with arq (reminders, escalations, deadlines, notifications) |
| File and media storage | S3-compatible storage (MinIO locally), presigned upload and download |
| Web app | React, TypeScript, Vite, React Router, TanStack Query |
| Mobile | Same web app wrapped with Capacitor 7 (Android first), camera and geolocation plugins, local draft store |
| Auth | Email or phone plus password, argon2 hashing, short-lived access token plus refresh token |
| Tests | pytest (backend), Vitest (web units), Playwright (end-to-end) |
| Local run | Docker Compose: api, worker, db, redis, minio, web |
| Architecture | Modular monolith with clear domain modules and an internal event bus |

### 2.1 Repository layout

```text
siteflow/
├── CLAUDE.md
├── docker-compose.yml
├── docs/
│   ├── SiteFlow-PRD-v3.1.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── PROGRESS.md
│   └── decisions/              # short ADRs, one per major choice
├── backend/
│   ├── app/
│   │   ├── core/               # config, db, security, events, audit, errors
│   │   ├── modules/
│   │   │   ├── identity/       # users, roles, memberships, delegation
│   │   │   ├── projects/       # projects, clients, sites, onboarding, import
│   │   │   ├── workflow/       # templates, versions, activities, dependencies, gates, engine
│   │   │   ├── meetings/       # meetings, client demos, requirements, baselines
│   │   │   ├── signoff/        # generic versioned sign-off service
│   │   │   ├── documents/      # documents, drawings, packages, revisions, transmittals
│   │   │   ├── site/           # site visits, conditions, investigations
│   │   │   ├── checklists/     # checklist templates and responses, measurements
│   │   │   ├── coordination/   # RFIs, coordination issues, non-conformances, snags
│   │   │   ├── changes/        # change requests
│   │   │   ├── commercial/     # payment milestones, exceptions
│   │   │   ├── selections/     # interior selections, deadlines
│   │   │   ├── calendar/       # calendars, events, visibility, availability
│   │   │   ├── notifications/  # notifications, reminders, escalations
│   │   │   └── dashboard/      # portfolio and project read models
│   │   ├── seeds/              # residential template, checklists, problem lists
│   │   └── main.py
│   ├── migrations/
│   └── tests/
├── web/
│   ├── src/
│   │   ├── app/                # routing, layout, auth
│   │   ├── features/           # one folder per backend module
│   │   ├── components/
│   │   └── lib/                # api client, offline draft store, media upload
│   └── e2e/                    # Playwright acceptance scenarios
└── mobile/                     # Capacitor config, Android project
```

### 2.2 Non-negotiable engineering rules

- Authorization is enforced on the server for every endpoint: role, project membership, and field-level rules.
- Approved, frozen, and signed records are immutable. A correction creates a new revision linked to the previous one.
- Every state change, sign-off, upload, download of controlled drawings, payment status change, and calendar disclosure writes an `AuditEvent`.
- Gates are evaluated by a deterministic rules engine. The UI must always be able to show why an activity is blocked.
- Private calendar event details never appear in logs, notifications, reports, dashboards, or exports.
- Configurable values (SLAs, thresholds, percentages, lead times, photo counts) live in configuration, not code.

---

## 3. Lifecycle Map

| Lifecycle stage | Steps |
|---|---|
| Build | S00 to S17 |
| Deploy | S18 |
| Evaluate | S19 |
| Maintain | S20 |

PRD release mapping:

| PRD release | Steps |
|---|---|
| Release A — Workflow foundation | S00 to S06 |
| Release B — Design and commercial control | S07 to S11 |
| Release C — Site quality, interiors, calendar, portfolio | S12 to S17 |
| Phase 2 — WhatsApp and AI | Not in this plan; starts after the pilot |

---

## 4. Build Steps

Each step lists the goal, PRD references, what to build, acceptance criteria, and the prompt to paste into Claude. Every step includes backend, web UI, migrations, and tests unless stated otherwise.

---

### S00 — Repository scaffold and tooling

**Goal:** a running empty stack with CI checks.
**PRD:** Sections 15, 17.

**Build**
- Docker Compose with api, worker, db, redis, minio, web.
- FastAPI app with health endpoint, settings from environment, structured logging, error handler.
- SQLAlchemy base with common columns: id (UUID), organization_id, created_by, created_at, updated_at.
- Alembic set up; first empty migration.
- React app shell with login page placeholder and layout.
- Lint and format (ruff, black, eslint, prettier), pre-commit, GitHub Actions running lint and tests.

**Acceptance criteria**
- `docker compose up` starts all services; health endpoint returns OK; web shell loads.
- CI passes on a clean clone.

**Prompt**
```text
Read CLAUDE.md and docs/SiteFlow-PRD-v3.1.md. Implement step S00 from docs/IMPLEMENTATION_PLAN.md exactly as the repository layout in section 2.1 describes. Set up Docker Compose (api, worker, db, redis, minio, web), FastAPI with health endpoint and settings, SQLAlchemy base model with the common columns, Alembic, a React + TypeScript + Vite shell, linting, pre-commit, and a GitHub Actions workflow. Do not build any business features yet. Finish by running the stack and tests, then update docs/PROGRESS.md.
```

---

### S01 — Identity, roles, project membership, audit

**Goal:** secure sign-in and the permission model every later step depends on.
**PRD:** Sections 5, 5.1, 17.1; FR-22.

**Build**
- Users, roles (all roles in PRD section 5), teams, project membership.
- Sign-in, refresh, sign-out, password reset stub, device session revocation.
- Permission layer: role permissions plus project scoping plus field-level hide rules (commercial fields, private calendar fields).
- Delegation of approval authority for a date range, never exceeding the delegator's authority.
- `AuditEvent` table and service; audit middleware for all write endpoints.
- Admin web screens: users, roles, memberships.

**Acceptance criteria**
- A user without membership gets 403 or 404 on another project's records.
- Accounts can see commercial fields; Site Engineer cannot.
- A delegated approval is logged and expires on its end date.
- Every write creates an audit event with actor, action, entity, before and after summary.

**Prompt**
```text
Implement step S01 from docs/IMPLEMENTATION_PLAN.md. Build users, the roles from PRD section 5, teams, project membership, token auth with refresh and revocation, a server-side permission layer (role + project scope + field-level rules), approval delegation, and an append-only AuditEvent service used by all write endpoints. Add admin web screens for users, roles and memberships. Write tests for cross-project access denial, field-level hiding of commercial data, delegation expiry, and audit creation. Update docs/PROGRESS.md.
```

---

### S02 — Workflow engine core

**Goal:** a configurable dependency-graph workflow engine with gates.
**PRD:** Sections 6.1 to 6.4, 8.3; FR-01, FR-02, FR-03.

**Build**
- `WorkflowTemplate` and `TemplateVersion` (draft, published, retired). Running projects keep the version they started on.
- `ActivityDefinition` with type (PRD 6.2), workstream (Studio or Site), responsible role, reviewer, backup reviewer, observers, SLA, reminder schedule, evidence rules, completion rules, auto-created next activities.
- `Dependency` (finish-to-start, approval-required) and `Gate` types: sign-off, payment, checklist, document status, issue closure, finding disposition.
- `ActivityInstance` state machine exactly as PRD 6.3, including Blocked, On Hold, Cancelled, Superseded.
- Rules engine: evaluate gates, release successors (including parallel branches), explain blockers as a list of reasons.
- Review actions: approve, approve with comments, rework (comment required), reject.
- Publish validation: no cycles, no orphans, every activity has an owner and completion rule.
- Domain events published on every transition (for notifications and dashboards later).

**Acceptance criteria**
- A template with a parallel branch releases both branches when the predecessor completes.
- An activity with an unmet gate shows state Blocked and a human-readable reason list.
- Publishing a template with a cycle fails with a clear error.
- An approved activity cannot be edited; a correction creates a new revision.

**Prompt**
```text
Implement step S02 from docs/IMPLEMENTATION_PLAN.md. Build the workflow engine in backend/app/modules/workflow: versioned templates, activity definitions with all fields in PRD 6.4, dependencies, gate types, activity instances with the exact state machine in PRD 6.3, a deterministic rules engine that releases successors and returns a "why blocked" reason list, review actions with mandatory rework comment, publish-time validation (cycles, orphans, missing owners or completion rules), and domain events on each transition. Keep gate types pluggable so later steps can register new gate evaluators. Write thorough unit tests for the state machine and rules engine. Add a minimal web template viewer. Update docs/PROGRESS.md.
```

---

### S03 — Residential workflow template seed

**Goal:** the default residential workflow from PRD section 7 as seed data.
**PRD:** Sections 7.1, 7.1A, 7.2 to 7.17.

**Build**
- Seed a published "Residential v1" template with Studio and Site workstreams and every stage 0 to 15, in the order and with the gates in the PRD 7.1 flow.
- Gates wired as placeholders for gate types that later steps implement (for example, payment gate registered but evaluated in S10).
- Configuration values not yet decided are set with `TBD_PARVEZ` and listed in `docs/PROGRESS.md`.
- Web: read-only visual of the template graph.

**Acceptance criteria**
- The seeded template passes publish validation.
- The graph shows: structural design cannot start before the centerline, foundation, and column freeze; detailed drawings cannot start before elevation sign-off and payment gate; interiors cannot start before civil completion.

**Prompt**
```text
Implement step S03. Create a seed for the "Residential v1" workflow template that follows PRD section 7.1 flow and stages 7.2 to 7.17 exactly, with Studio and Site workstreams, parallel branches where the PRD allows them, and the gates described in the "Mandatory workflow rules" list. Where a gate type is built in a later step, register it as a placeholder evaluator that returns "not yet implemented — blocked". Mark undecided values TBD_PARVEZ and list them in docs/PROGRESS.md. Add a read-only graph view in the web app. Test that the three key blocking rules in the acceptance criteria hold.
```

---

### S04 — Project setup and legacy onboarding

**Goal:** create new projects and bring the in-progress projects in at their current stage.
**PRD:** Sections 7.2, 7.19; FR-01, FR-27.

**Build**
- Client, client contact, site (address, GPS), project, fee plan fields, team assignment.
- New project from template instantiates both workstreams and the project calendar.
- Legacy onboarding: choose current stage; earlier gates saved as `HistoricalGateRecord` with confirming person and optional attachment.
- Spreadsheet import (CSV and XLSX) with a validation preview, row-level errors, and an `ImportBatch` record.

**Acceptance criteria**
- New project starts with Stage 0 active and the rest correctly locked.
- Imported project at structural-design stage shows earlier gates as "Historical — completed before SiteFlow", visually distinct from system sign-offs.
- Import of a file with one bad row imports nothing until fixed, or imports valid rows only if the user chooses; both paths are audited.

**Prompt**
```text
Implement step S04. Build clients, contacts, sites, projects and team assignment; project creation from a published template; legacy onboarding at a chosen current stage with HistoricalGateRecord entries (PRD 7.19); and CSV/XLSX bulk import with preview, row errors and an ImportBatch record. Historical gates must never be displayed or counted as system-verified sign-offs. Add web screens for project creation, onboarding and import. Test all acceptance criteria for S04. Update docs/PROGRESS.md.
```

---

### S05 — Meetings, requirements, baseline, sign-off service

**Goal:** repeatable client meetings feeding a signed requirement baseline.
**PRD:** Sections 7.3, 7.4; FR-04, FR-05.

**Build**
- Meeting with attendees, notes, decisions, open questions, action items (owner, due date, status), attachments, visibility (internal, office-shared, project-team, client-visible).
- Requirement register built from meetings, each item linked to its source meeting, with history.
- `RequirementBaseline` versions compiled from the register.
- Generic `SignOff` service reused by later steps: signs an exact entity version, records signer, method, timestamp, comments, evidence. Signed versions are immutable.
- Client sign-off captured by internal user on the client's behalf in Phase 1 (method recorded), since there is no client portal.

**Acceptance criteria**
- Two meetings produce a register; a baseline is compiled, reworked once, and signed.
- Editing a requirement after sign-off creates a draft of the next baseline version; the signed one is unchanged.

**Prompt**
```text
Implement step S05. Build meetings with all fields in PRD 7.3, action items, a requirement register linked to source meetings, versioned RequirementBaseline compiled from the register, and a reusable SignOff service that signs an exact version immutably (signer, method, time, comments, evidence). Register a "signoff" gate evaluator in the workflow engine. Add web screens for meetings, register, baseline compare and sign-off. Test the S05 acceptance criteria. Update docs/PROGRESS.md.
```

---

### S06 — Documents, drawings, revisions

**Goal:** a controlled drawing register.
**PRD:** Sections 7.6, 7.8, 7.12; FR-08, FR-13.

**Build**
- Document, drawing, package, revision; discipline; status: Tentative, For Review, Frozen, Approved, Superseded, Construction Use; issue purpose (PRD 7.12).
- Presigned upload and download; checksum; uploader; controlled-download audit.
- Status banners and watermark text on preview, for example "Not Frozen — Not for Construction" and "Superseded".
- Superseding a revision notifies previous recipients (event only; delivery in S15).
- Register a "document status" gate evaluator.

**Acceptance criteria**
- A tentative elevation shows the not-frozen banner everywhere it is displayed.
- A superseded drawing stays viewable but clearly invalid; the new revision links to it.

**Prompt**
```text
Implement step S06. Build the documents module: documents, drawings, packages and revisions with discipline, the status set and issue purposes from PRD 7.6 and 7.12, presigned S3 upload/download with checksum, audited controlled downloads, status banners/watermark labels on previews, supersede with linked revisions and a supersede event. Register a "document status" gate evaluator. Add a web drawing register with filters by discipline, package, revision and status. Test the S06 acceptance criteria. Update docs/PROGRESS.md.
```

---

### S07 — Pre-design site-condition visit

**Goal:** mobile site visit that can block design decisions.
**PRD:** Section 7.5; FR-06, FR-07; Section 14.

**Build**
- Site visit form with all mandatory data in PRD 7.5; condition flags list (well, black cotton soil, rock, waterlogging, trees, encroachment, services, restricted access) seeded and configurable.
- Findings with risk level, owner, target date, next action, disposition.
- Rules: selected conditions auto-create an investigation activity (survey, soil test, test pit, outstation test pit, utility scan, consultant visit) according to configuration.
- "Finding disposition" gate evaluator that blocks the foundation freeze until critical findings are resolved or formally accepted.
- Missing-information list before submit; submit disabled until complete.
- Mobile-first screens; local draft saved on device; photos with timestamp, uploader and GPS.
- Review: Site Engineer submits, Project Architect reviews, Structural Consultant notified for ground findings.

**Acceptance criteria**
- Recording "black cotton soil" creates an investigation task and blocks the foundation freeze.
- Closing the investigation with a report releases the block.
- Draft survives closing the app.

**Prompt**
```text
Implement step S07. Build the pre-design site-condition visit (PRD 7.5): mobile-first form, configurable condition flags, findings with disposition, configuration-driven auto-creation of investigation activities, a "finding disposition" gate evaluator that blocks the foundation/column freeze, a missing-information list with disabled submit, local draft persistence in web/src/lib, and photo capture with timestamp, uploader and GPS. Implement the review route in the PRD. Test the S07 acceptance criteria including the black cotton soil scenario. Update docs/PROGRESS.md.
```

---

### S08 — Freeze package and structural consultant flow

**Goal:** Studio submits centerline, foundation basis and column positions; Architect and Structural Consultant freeze them; structural design follows.
**PRD:** Sections 7.7, 7.8, 7.9; FR-09, FR-10.

**Build**
- Freeze package made of linked drawing revisions (centerline/grid, foundation basis, column positions, levels and zones).
- Two sign-offs: Project Architect internal freeze and Structural Consultant acceptance; optional client approval by configuration.
- Structural Consultant sees only the frozen package and approved inputs.
- Structural flow: accept assignment, RFIs, responses, package submission, architectural coordination review, rework, structural sign-off.
- Coordination issues and RFIs with location, snapshot, owner, due date, severity, closure evidence; "issue closure" gate evaluator.
- Architectural, structural and MEP packages run in parallel when inputs are approved.

**Acceptance criteria**
- Structural design is blocked until both freeze sign-offs exist and critical clashes are zero.
- Structural Consultant cannot open tentative drawings not included in the frozen package.

**Prompt**
```text
Implement step S08. Build the freeze package (PRD 7.7) owned and submitted by Studio, with Project Architect and Structural Consultant sign-offs through the SignOff service, restricted consultant visibility to the frozen package, the structural consultant flow in PRD 7.8, RFIs and coordination issues with an "issue closure" gate evaluator, and parallel architectural/structural/MEP packages (PRD 7.9). Test the S08 acceptance criteria and consultant access restrictions. Update docs/PROGRESS.md.
```

---

### S09 — All-elevation client sign-off and change requests

**Goal:** stop uncontrolled changes after the client approves elevations.
**PRD:** Sections 7.10, 9; FR-11.

**Build**
- Elevation package assembling all in-scope elevations; completeness check against the configured list.
- Client sign-off of the exact package version; comments trigger rework and a new revision.
- Change Request with every field in PRD 9.1; approvals from internal, consultant, client and accounts as configured; emergency path with retrospective confirmation.
- Frozen records never overwritten; approved change creates linked new revisions and activities.
- Dashboard data: pending changes and cumulative approved time and cost impact.

**Acceptance criteria**
- A change request against a frozen elevation cannot start work until approved.
- A rejected change leaves the baseline unchanged and keeps the decision record.

**Prompt**
```text
Implement step S09. Build the all-elevation package and client sign-off (PRD 7.10) and the changes module (PRD section 9) with all Change Request fields, configurable approval chain, emergency path with retrospective confirmation SLA, and linked new revisions on approval. Any edit attempt on a frozen record must route to a Change Request. Test the S09 acceptance criteria. Update docs/PROGRESS.md.
```

---

### S10 — Payment milestones and commercial gate

**Goal:** detailed drawings stay blocked until the upfront fee is cleared.
**PRD:** Section 7.11; FR-12.

**Build**
- Payment milestone auto-created when the elevation freeze completes; percentage and basis from configuration (initial 50%, basis `TBD_PARVEZ` per D-05).
- States exactly as PRD 7.11; partial receipts; overdue detection.
- "Payment" gate evaluator; authorized exception with reason, logged.
- Reviewable payment request draft for the client; nothing is sent or confirmed without a person.

**Acceptance criteria**
- Detailed drawing activities show "Blocked — payment milestone not cleared" until Accounts records clearance.
- A principal's exception releases the gate and is visible in the audit trail.

**Prompt**
```text
Implement step S10. Build the commercial module: auto-created payment milestone after elevation freeze, configurable percentage and basis, the state list in PRD 7.11, partial receipts, overdue detection, a "payment" gate evaluator, authorized logged exceptions, and a draft payment request for human review. Only Accounts and authorized principals can change payment status. Test the S10 acceptance criteria. Update docs/PROGRESS.md.
```

---

### S11 — Detailed drawings and controlled issue

**Goal:** reviewed, transmitted, acknowledged drawing sets.
**PRD:** Section 7.12; FR-13.

**Build**
- Deliverable checklist per project type; internal review; issue-purpose classification.
- Transmittal with recipients, set contents, and acknowledgement.
- Supersede notifications to affected recipients.

**Acceptance criteria**
- A construction issue cannot be made while any mandatory drawing is unreviewed or a critical coordination issue is open.
- Revising an issued drawing notifies all previous recipients.

**Prompt**
```text
Implement step S11. Build detailed drawing production controls (PRD 7.12): per-project-type deliverable checklist, internal review, issue purpose, transmittals with acknowledgement, and supersede notifications. Reuse the documents and coordination modules. Test the S11 acceptance criteria. Update docs/PROGRESS.md.
```

---

### S12 — Checklist engine, line-out, construction stages

**Goal:** site hold points with evidence instead of verbal confirmation.
**PRD:** Sections 7.13, 7.14, 8.1, 8.2; FR-14, FR-15.

**Build**
- Checklist templates by stage and revision; item fields from PRD 8.1 (response type, tolerance, evidence count, geolocation, signature, failure severity, blocker behavior).
- Seed checklists: line-out (including diagonal measurements) and each construction stage in PRD 7.14 (foundation, reinforcement including cover and no exposed steel, formwork including diagonal check, beam and slab, masonry, waterproofing, MEP rough-in, plaster and finishes). Tolerances seeded as `TBD_PARVEZ`.
- Pass, Fail, Not Applicable with mandatory reason for Not Applicable; measurements checked against tolerance.
- Failed critical item creates a non-conformance and blocks stage approval; "checklist" gate evaluator.
- Mobile inspection screens with evidence per item.

**Acceptance criteria**
- A failed diagonal check on line-out blocks foundation stages until rework is approved.
- Reinforcement stage cannot be approved without cover evidence photos.

**Prompt**
```text
Implement step S12. Build the checklists module (PRD 8.1, 8.2) with configurable templates, all item response types, tolerance checks, evidence rules and blocker behavior; seed the line-out and construction-stage checklists from PRD 7.13 and 7.14 with tolerances marked TBD_PARVEZ; create non-conformances on failed critical items; register a "checklist" gate evaluator; and build mobile inspection screens. Test the S12 acceptance criteria. Update docs/PROGRESS.md.
```

---

### S13 — Civil completion, interiors, selections, handover

**Goal:** civil completion releases interiors; selections, including tiles, stop causing delays.
**PRD:** Sections 7.15, 7.16, 7.17; FR-16, FR-17, FR-28.

**Build**
- Civil completion review with snag list and dual sign-off.
- Interior selection schedule; tile record fields from PRD 7.16; client approval through SignOff; substitution through Change Request.
- `SelectionDeadline`: "decision needed by" computed from the planned dependent site stage minus configured lead time; reminders; red flag when missed.
- Quick mobile capture of a showroom choice (sample photo, code, space) then client confirmation.
- Handover checklist and read-only archive.

**Acceptance criteria**
- Interiors stay locked until civil completion is signed.
- A missed tile deadline shows a red flag on the portfolio and in "Needs Parvez's attention".

**Prompt**
```text
Implement step S13. Build civil completion with snags and sign-off (PRD 7.15), the selections module with tile records, client approval and substitutions (PRD 7.16), SelectionDeadline derived from the site schedule with reminders and red flags (FR-28), quick mobile showroom capture, and handover with a read-only archive (PRD 7.17). Test the S13 acceptance criteria. Update docs/PROGRESS.md.
```

---

### S14 — Calendars, privacy, client demos

**Goal:** shared office and project calendars, private personal calendars, and client demos everyone can see.
**PRD:** Sections 10, 7.18; FR-18, FR-19, FR-26.

**Build**
- Calendar types: office shared, project shared, personal private, availability-only (PRD 10.1).
- Personal events private by default; owner can share full details, selected fields, title-only, or busy-only.
- Free and busy lookup for schedulers that returns no private detail.
- Client demo quick-add (PRD 7.18): project-shared by default, office calendar placement by permitted roles, prep tasks, outcome capture creating actions and Change Requests where frozen items are affected.
- Backfill screen to enter all currently known verbal demos.
- Tests that private fields never leak through API, notifications, exports or dashboards.

**Acceptance criteria**
- A staff member sees the Principal's personal appointment only as "Busy".
- A verbally agreed demo is added in under a minute on mobile and appears on the project calendar.

**Prompt**
```text
Implement step S14. Build the calendar module (PRD section 10) with the four calendar types, owner-controlled disclosure levels, privacy-safe free/busy, and client demo quick-add, prep tasks, outcome capture and onboarding backfill (PRD 7.18). Add automated leak tests proving private event fields never appear in any API response, notification payload, export or dashboard query for non-owners. Test the S14 acceptance criteria. Update docs/PROGRESS.md.
```

---

### S15 — Notifications, reminders, escalations

**Goal:** the right person is told at the right time, and delays reach Parvez.
**PRD:** Section 11; FR-20.

**Build**
- Subscribe to domain events; notification templates; in-app notifications; email; push hook for mobile.
- Scheduled worker jobs: reminders before due date, overdue detection, escalation levels 1 to 3 (PRD 11.3), payment overdue, selection deadlines.
- Acknowledge, resolve, reassign, snooze with reason; auto-clear when the trigger resolves; history kept.
- Idempotent sending (no duplicates on retries).

**Acceptance criteria**
- An overdue activity escalates through the configured levels and clears automatically when completed.
- Replaying the same event does not send a second notification.

**Prompt**
```text
Implement step S15. Build the notifications module: event subscribers, templates, in-app and email channels, a push hook, arq scheduled jobs for reminders, overdue, escalation levels from PRD 11.3, payment overdue and selection deadlines, acknowledge/resolve/reassign/snooze-with-reason, auto-clear, and idempotency keys. Test the S15 acceptance criteria. Update docs/PROGRESS.md.
```

---

### S16 — Portfolio dashboard and project view

**Goal:** one screen that shows Parvez what needs attention across about 20 projects.
**PRD:** Section 12; FR-21.

**Build**
- Portfolio read model with every column and filter in PRD 12.1.
- "Needs Parvez's attention" queue sorted by criticality, gate impact and age.
- Workload view by user and role.
- Project view: workflow graph with blockers and "why blocked", baseline and latest revisions, tabs for requirements, meetings, drawings, RFIs, issues, changes, payments, calendar, site media, audit.
- Exports listed in PRD 15.
- Seed script creating 20 realistic demo projects across all stages for testing.

**Acceptance criteria**
- With 20 seeded projects, the dashboard shows blockers, next action, pending sign-offs, payment gate and critical issues for each.
- Every filter narrows results correctly.

**Prompt**
```text
Implement step S16. Build the dashboard module: portfolio read model with all columns and filters in PRD 12.1, the "Needs Parvez's attention" queue, workload view, the project view in PRD 12.2 with the workflow graph and "why blocked" explanations, and exports from PRD 15. Create a seed script for 20 demo projects spread across all stages. Keep private calendar details out of every query. Test the S16 acceptance criteria. Update docs/PROGRESS.md.
```

---

### S17 — Mobile app shell, offline drafts, media upload

**Goal:** a reliable Android app for site users.
**PRD:** Section 14.

**Build**
- Capacitor 7 Android project with app id `ai.tanglobus.siteflow` (from the prototype).
- My Work lists: Today, Upcoming, Overdue, Waiting for Review, Blocked.
- Camera, video, document and voice-note capture; GPS with manual fallback and reason.
- Local draft store with explicit sync state; background upload with progress, retry and duplicate-submission prevention.
- Push notifications with deep links to the exact activity.

**Acceptance criteria**
- A site visit started offline is completed and submitted once the phone reconnects, with no data loss and no duplicate.
- Tapping a push notification opens the exact activity.

**Prompt**
```text
Implement step S17. Configure the Capacitor 7 Android project (app id ai.tanglobus.siteflow), build the mobile My Work lists, media capture (camera, video, documents, voice notes), GPS with manual fallback and reason, a local draft store with visible sync state, background upload with retry and idempotent submission, and push notifications with deep links (PRD section 14). Test offline-to-online submission and deep links. Update docs/PROGRESS.md.
```

---

## 5. Deploy — S18

**Goal:** repeatable environments and a signed Android build.

**Build**
- Environments: development, staging, pilot production.
- CI/CD: tests, migrations, container build, deploy to staging on merge, manual promotion to pilot production.
- Secrets management, database backups (daily during pilot per PRD 17.3), restore test.
- Signed Android release through Play internal testing (APK build via GitHub Actions, as the prototype already set up).
- Error logging, health checks, failed-job alerts.

**Prompt**
```text
Implement step S18. Set up staging and pilot production deployment, CI/CD with tests and migrations, secrets handling, daily backups with a documented restore test, a signed Android release build in GitHub Actions for Play internal testing, and error logging, health checks and failed-job alerts. Document everything in docs/DEPLOY.md.
```

---

## 6. Evaluate — S19

**Goal:** prove the PRD acceptance scenario and security before the pilot.

**Build**
- Playwright suite in `web/e2e/` covering PRD section 20 scenarios 1 to 18, one test file per scenario.
- Security review: authorization tests for every endpoint, private calendar leak tests, upload validation, rate limits, dependency audit.
- Pilot on 2 to 3 residential projects (PRD 21), with in-progress projects onboarded through S04.
- Collect the pilot measures in PRD 19.2; targets are set by Parvez after the baseline is measured.

**Prompt**
```text
Implement step S19. Write Playwright end-to-end tests in web/e2e for PRD section 20 scenarios 1 to 18, one file per scenario, using seeded data. Add an authorization test that iterates every API route with each role and asserts the expected allow or deny. Run a dependency audit and fix high-severity findings. Produce docs/EVALUATION.md listing each scenario result and each security check.
```

---

## 7. Maintain — S20

- Issue log triaged weekly with Parvez; fixes prioritized by gate impact.
- Template changes made as new template versions; running projects keep their version.
- Checklist and threshold tuning from pilot feedback, each change recorded in `docs/decisions/`.
- Monthly restore test and dependency update.
- Phase 2 (WhatsApp and AI agent) planned only after the pilot shows stable adoption, per PRD 21.

---

## 8. Open Items Before Build

| Item | Needed for step |
|---|---|
| Transcript content: the meeting link could not be retrieved; review it manually and add any new points to the PRD | S03 |
| D-01, D-02 residential lifecycle and centerline terminology | S03, S08 |
| D-03 site conditions that trigger investigations | S07 |
| D-05 basis of the 50% fee | S10 |
| D-07 checklist tolerances and evidence counts | S12 |
| D-09 SLAs and escalation thresholds | S15 |
| D-10, D-15 calendar visibility and who places demos on the office calendar | S14 |
| D-13 list of in-progress projects and current stages | S04 |
| D-14 selection lead times | S13 |
