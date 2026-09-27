# Sprint v1 — PRD: SiteFlow Three-Step Residential Loop

## Overview
Build the thinnest working version of the SiteFlow MVP loop on a real backend. An Admin records Legal Approval, a Civil Engineer submits a site visit against the fixed residential template, the system derives progress from the stage checklist, and Team Lead Parvez approves it or sends it back for rework. This sprint is the first **Build** increment of the Build → Deploy → Evaluate → Maintain lifecycle.

## Goals
- A FastAPI + PostgreSQL backend runs locally with seeded users for all four roles.
- An Architect creates a residential project; the three steps (Legal Approval → Site Visit → Team Lead Review) are created automatically, with Step 1 active and Steps 2 and 3 locked.
- Admin moves Legal Approval to Approved (only with a document reference). This unlocks the Site Visit for the assigned Civil Engineer.
- The Civil Engineer submits a site visit that passes server-side mandatory validation. Progress is calculated from the checklist and stage weights, never typed in.
- Parvez approves the visit, which makes its progress official on the project, or requests rework with a mandatory comment. The engineer can then resubmit. Every status change writes an audit event.

## User Stories
- As an Architect, I want to create a residential project from the fixed template, so that every project starts with the same three-step workflow.
- As an Admin, I want to record the authority, reference, dates and approval document for Legal Approval, so that site work only starts on approved projects.
- As a Civil Engineer, I want a mandatory site visit form with a stage checklist and a prepopulated problem list, so that I capture a complete visit the first time.
- As a Civil Engineer, I want my draft kept on the device, so that I don't lose work when the app closes or coverage drops.
- As Team Lead Parvez, I want to approve a visit or send it back with comments, so that only reviewed progress reaches the dashboard.
- As an Architect, I want progress derived from the checklist, so that project percentages are consistent and can't be disputed.
- As any user, I want to see only the projects I'm a member of, while Parvez and the Architect see all projects, so that project data stays with the right people.

## Technical Architecture

**Stack**
- **Backend**: Python 3.11+, FastAPI, SQLAlchemy 2.x, Pydantic v2, JWT bearer auth (email + password, hashed).
- **Database**: PostgreSQL via `DATABASE_URL` (docker-compose provided). The test suite runs on in-memory SQLite for speed.
- **Frontend**: the existing SiteFlow vanilla JS app in `web-src/`, built by `build.py` into `www/index.html`. One codebase for the web console and the Android app (Capacitor 7 wrapper, unchanged).
- **Template config**: `backend/app/template_config.py` holds the residential stage list, checklist items, stage weights, problem list and minimum photo count. **Stage weights (D2), checklist items and minimum photo count (D3) are placeholders pending Parvez's sign-off.** Changing them needs no code change.

**Component diagram**
```
 ┌──────────────────────────────┐        ┌───────────────────────────────────────┐
 │ SiteFlow app (web-src)       │  HTTPS │ FastAPI backend (Code/backend)        │
 │  web console  ─┐             │  JSON  │                                       │
 │  Android app  ─┤ api.js ─────┼───────▶│ routers: auth, projects, legal,       │
 │  (Capacitor)   │             │  JWT   │          site_visits, reviews         │
 │  local draft ──┘ (device     │        │ services: workflow (step unlock),     │
 │   storage)                   │        │           validation, progress, audit │
 └──────────────────────────────┘        │ template_config.py (placeholders)     │
                                         └──────────────────┬────────────────────┘
                                                            │ SQLAlchemy
                                                   ┌────────▼────────┐
                                                   │   PostgreSQL    │
                                                   └─────────────────┘
```

**Core entities (v1 subset)**
User (with role), ProjectMember, Project, WorkflowStep, LegalApproval, SiteVisit (form data, checklist states, problems as JSON), Review, AuditEvent.

**Data flow**
1. Architect `POST /projects`. The backend creates the project, members and three WorkflowSteps (1 = active, 2 and 3 = locked) and writes an audit event.
2. Admin `PATCH /projects/{id}/legal`: Not started → Applied → Approved or Rejected. Approved requires a document reference. On Approved, Step 1 completes and Step 2 becomes active.
3. Civil Engineer fills the form. The draft lives in device storage. `POST /projects/{id}/site-visits` validates mandatory fields, checklist and problems, stores the visit as Submitted, activates Step 3 and computes pending progress.
4. Parvez `POST /site-visits/{id}/review` with `approve`, or with `rework` plus a comment. Approve sets the project's official progress and completes the workflow. Rework sets the visit to Rework and reactivates Step 2. The engineer resubmits, and each submission increments a counter.
5. Every transition appends an AuditEvent (who, what, when). No update or delete endpoints exist for audit events.

**Progress rule**
stage progress = Done items ÷ total items in the stage. Project progress = Σ (stage weight × stage progress), with weights summing to 100. v1 records the checklist for the selected current stage. Earlier stages count as complete and later stages as zero. This interpretation needs Parvez to confirm it under D2.

## Out of Scope (v2+)
- Photo and video capture, media storage (S3) and the minimum photo count check (F5). The config value exists, but enforcement ships with media.
- High and Critical problems needing a photo (depends on media).
- Dashboard panels, filters and red flag rules (F9).
- In-app notifications (F10 notifications part). v1 records audit events only.
- Phone sign-in, password reset and user management screens.
- Automated test pass against the acceptance criteria (T1), field test, pilot (v2 Evaluate).
- Security hardening, encrypted storage, retention policy, signed release (v3).
- Offline sync queue (local draft only, D6). Multiple legal approvals per project (D7).
- Everything listed as out of scope in section 2.2 of the implementation plan.

## Dependencies
- Greenfield backend. The frontend reuses the existing prototype in `Code/web-src` (layout, styles, site visit capture screens).
- Local tools: Python 3.11+, Node.js 20+ (for the Capacitor sync), Docker or a local PostgreSQL 15+.
- Open decisions that affect this sprint's values but don't block it: D2 (stage weights), D3 (min photo count), D7 (single legal approval assumed).
