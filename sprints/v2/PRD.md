# Sprint v2 — PRD: Evidence, Dashboard and Red Flags

## Overview
Sprint v2 finishes the MVP Build scope on top of the v1 three-step loop.
- **Evidence:** site visits carry photo and video evidence.
- **Recurring visits:** a project records one visit after another, with a history.
- **Dashboard:** the Architect gets one screen of projects, major problems and red flags.
- **Notifications:** every step change notifies the right person in the app.

The sprint also makes the system run for real, with PostgreSQL migrations and a working Android build. It closes F5, F9 and F10 from the implementation plan, and leaves the product ready for the Evaluate stage: the T1 test sheet, the T2 walkthrough with Parvez, and the T3 field test.

## Goals
- A Civil Engineer captures photos and an optional video in the site visit form. Each item stores its capture time, GPS and uploader. Submission is blocked until the minimum photo count is met, and until every High or Critical problem has its own photo.
- After Parvez approves a visit, Site Visit reopens for the next one. The project page shows the history of approved visits, and approved problems become tracked open items that can be resolved.
- The dashboard shows four panels: All Projects, Needs Architect Attention, Major Problems and Review Queue. Every filter in plan section 5.2 works, and each of the six red flag rules raises on a test case and clears when resolved. Parvez can also clear a flag by hand, with a reason.
- An in-app notification with an unread count is sent on step unlock, submission, approval, rework and red flag.
- The backend runs its migrations on PostgreSQL and passes the full test suite there. The Android debug build reaches the API from the emulator.

## User Stories
- As a Civil Engineer, I want to take photos and a short video from the form, so that my site visit carries its own evidence.
- As a Civil Engineer, I want to be told which High or Critical problem still needs a photo, so that my submission isn't sent back for missing evidence.
- As Team Lead Parvez, I want to see the photos and video next to each problem when I review, so that I can decide without calling the site.
- As a Civil Engineer, I want the next visit to open after an approval, so that I can keep reporting on the same project.
- As an Architect, I want one dashboard of all projects, with the ones needing my attention on top, so that I know where to act first.
- As an Architect, I want to filter by location, step, engineer, red flag, severity, category, progress and visit date, so that I can find the projects I care about.
- As Team Lead Parvez, I want to clear a red flag with a reason, so that known and handled issues stop crowding the dashboard, and the reason is kept in the audit trail.
- As an Engineer or an Architect, I want to mark an open problem as resolved, so that fixed issues stop raising red flags.
- As any user, I want a notification when something needs me, so that I don't have to check each project.

## Technical Architecture

**Stack changes from v1**
- **Backend additions:**
  - `alembic` for migrations, with a baseline generated from the v1 schema.
  - `python-multipart` for uploads.
  - A new `services/storage.py`, a storage interface with a `LocalStorage` backend, which stores files under `MEDIA_DIR`. An S3 backend can be added later by config (plan section 7).
- **New config** (`backend/app/workflow_config.py`), each value marked `PLACEHOLDER` pending Parvez:
  - `REVIEW_SLA_HOURS = 48` (D4)
  - `VISIT_INTERVAL_DAYS = 14` (D5)
  - `REWORK_LIMIT = 2` (from the plan: rework twice on the same visit)
  - `MAX_VIDEO_MB = 100` (D3)
  - `MAX_PHOTO_MB = 10`
  - `MIN_PHOTOS = 5` stays in `template_config.py` (D3).
- **Frontend:** the same `web-src` app gains a Dashboard view, photo and video capture using a file input with `capture`, a notifications view and visit history. `demo-api.js` gets the same endpoints, so the client demo keeps up.
- **Android:** the Capacitor config allows the debug build to reach an http API on the emulator host. The release build stays https-only, and that hardening is v3 work.

**Component diagram**
```
 ┌───────────────────────── SiteFlow app (web-src) ──────────────────────────┐
 │ Dashboard · Projects · Project (visit history) · Site visit (+ media)     │
 │ Review (media gallery) · Notifications (unread badge)                     │
 └───────────────┬──────────────────────────────────────┬────────────────────┘
                 │ JSON                                 │ multipart upload / GET file
 ┌───────────────▼──────────────────────────────────────▼────────────────────┐
 │ FastAPI                                                                   │
 │ routers: auth · projects · legal · site_visits · media · reviews ·        │
 │          problems · dashboard · red_flags · notifications · template      │
 │ services: workflow · validation · progress · audit                        │
 │           red_flags (rule engine) · notify · storage (Local → S3 later)   │
 │ config:   template_config.py · workflow_config.py (placeholders)          │
 └───────────────┬───────────────────────────────────────┬───────────────────┘
                 │ SQLAlchemy + Alembic                  │ files
          ┌──────▼───────┐                        ┌──────▼───────┐
          │ PostgreSQL   │                        │ MEDIA_DIR    │
          │ (SQLite test)│                        │ (S3 later)   │
          └──────────────┘                        └──────────────┘
```

**New entities**
- `Media`: visit, kind (photo or video), `problem_ref`, content type, size, sha256, `captured_at`, GPS, uploader, storage key.
- `Problem`: a tracked open item from an approved visit. Fields: project, visit, category, problem, severity, location, responsible party, target date, status (open or resolved), resolved by, resolved at, and a resolution note.
- `RedFlag`: project, rule, key, `raised_at`, `cleared_at`, `cleared_by`, `clear_reason`, and how it was cleared (auto or manual).
- `Notification`: user, kind, text, project, `read_at`.

**Data flow**
1. **Media draft:** the engineer opens the form, and the app calls `POST /projects/{id}/site-visits/draft`. This returns the project's draft or rework visit, creating a draft if none exists. The form fields stay in device storage, as in v1, and only media goes to the server.
2. **Upload:** `POST /site-visits/{id}/media` is a multipart upload with `kind`, an optional `problem_ref`, `captured_at` and GPS. The server checks the content type and size, stores the file through `storage` and saves a `Media` row. Files are downloaded through `GET /media/{id}`, which checks project visibility.
3. **Submit:** v1's validation, plus the minimum photo count and a photo for each High or Critical problem (matched by `problem_ref`). The draft visit becomes `submitted`.
4. **Approve:** v1's behaviour, plus three things:
   - Each problem on the visit becomes a `Problem` row with status open.
   - Step 3 completes, then Step 2 reopens and Step 3 locks for the next visit, so the cycle repeats.
   - `official_progress` shows the latest approved visit.
5. **Red flags:** `sync_red_flags(project, now)` runs after every state change and on every dashboard read. It raises flags whose rule now holds, and clears automatically those whose rule no longer holds. A flag Parvez cleared by hand stays cleared until its rule stops holding and later holds again.
6. **Notifications:** `notify.event(...)` runs in the same transaction as the change and sends to the owner of the next step: the engineer on unlock or rework, Parvez on submission, the engineer and the Architect on approval, and the Architect and Parvez on a red flag.
7. **Dashboard:** `GET /dashboard?filters…` returns the four panels, scoped by project visibility.

**Red flag rules** (plan section 5.3, with placeholder thresholds)

| Rule | Raised when |
|---|---|
| Critical issue | Any open Problem with severity High or Critical |
| Legal delay | Legal Approval is not Approved, and today is past its `expected_date` |
| Review overdue | A submitted visit has waited longer than `REVIEW_SLA_HOURS` |
| Repeated rework | The current visit has at least `REWORK_LIMIT` rework reviews |
| No recent visit | Step 2 is open, and there has been no approved visit within `VISIT_INTERVAL_DAYS` (counted from the last approval, or from Legal Approval) |
| Overdue fix | An open Problem is past its `target_date` |

## Out of Scope (v3+)
- **Delivery channels:** push and email notifications, and a WhatsApp channel. v2 notifications are in-app only.
- **Media:** a real S3 or MinIO backend (the interface is ready), image compression and thumbnails on the server, and video transcoding.
- **Offline:** a full offline sync queue (D6). Media needs a connection to upload, and the form draft stays on the device.
- **Security hardening (S1 to S4):** production secrets, token storage and rate limiting, encryption at rest for media, a retention policy (D8), and a signed release build.
- **Legal Approval:** multiple approvals per project and reapplying after a rejection (D7).
- **Everything in plan section 2.2**, for example the configurable workflow builder, other project templates, payments and integrations.

## Dependencies
- The sprint v1 codebase and its passing test suites: 111 pytest tests and 7 Playwright tests.
- Docker Desktop running, for the PostgreSQL task.
- Android Studio or the SDK command-line tools with an emulator, for the Android task. The Gradle build needs JDK 21 and Android SDK 35 (see README).
- Parvez's decisions D2 to D5 are still open. The v2 values are placeholders in config, so they can change without code changes.
