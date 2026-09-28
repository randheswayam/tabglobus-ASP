# SiteFlow V4 — Execution Plan and Readiness Check

| Item | Detail |
|---|---|
| Business owner | Architect Parvez |
| Delivery | TAN GLOBUS AI |
| Date | 28 September 2026 |
| Inputs | `CLAUDE.md`, `docs/SiteFlow-PRD-v3.2.md`, `docs/SiteFlow-PRD-V4.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/V4_IMPLEMENTATION_PLAN.md` |
| Code checked | Repository at commit `40a1e36` (sprint v3 complete): 409 backend tests and 28 Playwright tests pass |
| Lifecycle | Build → Deploy → Evaluate → Maintain |

## 1. Summary

SiteFlow is **not ready for V4 step V01**. The V4 plan (section 2) needs core steps S00 to S17 complete and the S18 deployment pipeline running.

- **None of S00 to S18 is Done.**
- **Partial:** S00 to S05, S09, S12, S13, S15, S16 and S17 (12 steps).
- **Not started:** S06, S07, S08, S10, S11, S14 and S18 (7 steps).

What exists is a working vertical slice:

- A FastAPI and PostgreSQL backend.
- An 18-stage tracker with gates.
- Client milestone sign-offs and a client app.
- Construction site visits with photos, a checklist, review and rework.
- Problems, red flags, in-app notifications and a portfolio dashboard.
- A Capacitor Android project that has never been built on this machine.

The slice was built sprint by sprint (v1 to v3). It does not follow the step structure of `docs/IMPLEMENTATION_PLAN.md`. Decision `docs/decisions/0001-evolve-current-stack.md` records that choice.

Before this check, the four source documents were missing from `docs/`. They were copied in from `Inputs/` and `docs/reference/` (see section 6, R-02).

## 2. Core Step Status (S00 to S18)

Status is based on code and tests in the repository. `docs/PROGRESS.md` was not used as evidence.

| Step | Status | Evidence present | Missing against the plan's build list and acceptance criteria |
|---|---|---|---|
| S00 Scaffold and tooling | Partial (tooling done in sprint v4) | Root `docker-compose.yml` (db, api, web; `.env` git-ignored), ruff (`backend/pyproject.toml`), eslint 9 flat config, `.pre-commit-config.yaml`, `.github/workflows/ci.yml` (backend-lint, backend-tests-sqlite, backend-tests-postgres, backend-scans, web), migrations `0001`–`0022`. Tests: `test_compose_config.py`, `test_ci_config.py`, `test_lint.py`, `test_migrations.py`, `test_health.py`; E2E `lint.spec.js` | No worker, Redis or MinIO services yet. CI is configured but has not run on GitHub (nothing pushed). Integer ids and no `organization_id` (decision 0003, before V08). The React shell is replaced by vanilla JS (decision 0001). |
| S01 Identity, roles, membership, audit | Done, with deviations (sprint v4) | `modules/identity/`: `sessions.py` (refresh rotation, reuse revokes, sign-out everywhere), `admin.py` (users and memberships), `fields.py` (FIELD_RULES, audit redaction), `reset.py` (password reset stub), `delegation.py` (approval delegation). 10 staff roles plus client; `users.is_principal` and `require_principal`. Web: Team screen, members panel. Tests: `test_sessions.py`, `test_roles.py`, `test_admin_users.py`, `test_field_rules.py`, `test_password_reset.py`, `test_delegation.py`, `test_principal.py`, `test_audit.py`; E2E `v4-sessions.spec.js`, `v4-admin.spec.js` | No teams. The password reset issues a code but sends nothing (no channel until S15). Delegation covers site-visit review only. |
| S02 Workflow engine core | Partial (advanced in sprint v4) | `modules/workflow/gates.py` (pluggable gate registry), `events.py` (domain events), `exceptions.py` (recorded exceptions), `attachments.py` (stage files), `health.py`, `states.py` (PRD 6.3 state machine, pure), `versions.py` (projects pinned to a flow version). Tests: `test_gates.py`, `test_events.py`, `test_stage_exceptions.py`, `test_stage_attachments.py`, `test_workflow_health.py`, `test_states.py`, `test_flow_versions.py`, `test_stage_engine.py` | The state machine isn't wired into ProjectStage yet (S05 follow-up). Flow versions snapshot `stage_config`; there is no editable `WorkflowTemplate`. No generic review actions beyond site visits. |
| S03 Residential template seed | Done, with deviation (sprint v4) | `stage_config.py`: 24 stages in 10 phases, Phase 9 "Finishing" with the 80% fee gate; placeholder evaluators for payment, finding disposition, issue closure, document status and checklist; `PRD_STAGE` maps every stage to PRD Stage 0 to 15. Tests: `test_stage_config.py::test_every_stage_maps_to_a_prd_stage_and_every_prd_stage_is_covered`, `test_gates.py`, `test_stage_exceptions.py`; E2E `v4-exceptions.spec.js`, `v4-phase-icons.spec.js` | Numbering still follows the workflow diagram, mapped to the PRD (R-09 closed). Placeholder gates pass only by a recorded exception. |
| S04 Project setup and legacy onboarding | Done, with deviation (sprint v4) | `modules/projects/`: `clients.py` (Client, ClientContact, Site), `fee_plan.py`, `importer.py` (CSV and XLSX preview and commit, `ImportBatch`), `service.py` (shared `create_project`), `image.py` (project image). Tests: `test_clients_sites.py`, `test_fee_plan.py`, `test_import.py`, `test_project_image.py`, `test_projects.py`; E2E `v4-import.spec.js`, `v4-fee-plan.spec.js`, `v4-project-image.spec.js` | No separate `HistoricalGateRecord` entity: historical stages record who confirmed them, and files can be attached to a historical stage as evidence. |
| S05 Meetings, requirements, baseline, sign-off | Partial | Versioned, immutable sign-off: `SignoffRequest`, `SignoffAttachment`, `SignoffView`, a before-flush immutability guard and a `fingerprint` column; `services/signoffs.py`; `routers/signoffs.py`, `routers/client.py`. Tests: `test_signoffs.py` (10), `test_client_signoff.py` (15); E2E `v3-signoff.spec.js` | No meetings, attendees, action items, requirement register or `RequirementBaseline`. Sign-off covers only the 4 client sign-off stages; it is not a generic service for any versioned entity. Deviation: the client signs in the app, while the plan has staff capture it on the client's behalf (decision 0002). |
| S06 Documents, drawings, revisions | Not started | Only sign-off attachments (`SignoffAttachment` with sha256) and site media (`Media`) | No document, drawing, package or revision model. No status set, issue purpose, banners, supersede or document-status gate. |
| S07 Pre-design site-condition visit | Not started | The pre-design visit is a manual stage (`predesign_site_visit`). Reusable parts: site-visit draft and media capture with GPS (`test_media.py::test_upload_photo_with_capture_metadata`, `test_site_visits.py`) | No condition flags, findings, disposition, auto-created investigations, finding-disposition gate or device-local draft store. |
| S08 Freeze package and structural flow | Not started | Stage `grid_freeze` exists as a manual completion | No freeze package, dual sign-off, consultant visibility restriction, RFIs, coordination issues or issue-closure gate. |
| S09 Elevation sign-off and change requests | Partial | `design_freeze_signoff` (stage 11) is a client sign-off with versioning and a changes-requested loop. Tests: `test_client_signoff.py`; E2E `v3-signoff.spec.js` "full cycle" | No completeness check against a configured elevation list. No Change Request model, approval chain, emergency path or linked revisions. |
| S10 Payment milestones and commercial gate | Not started | Stage `payment_gate` (12) is completed by hand; the basis is marked `TBD_PARVEZ` (D-05) in `stage_config.py` | No payment milestone, states, partial receipts, overdue detection, payment evaluator, exceptions or draft request. |
| S11 Detailed drawings and controlled issue | Not started | Stage `detailed_drawings` (13) is completed by hand | Depends on S06. No deliverable checklist, transmittals or acknowledgement. |
| S12 Checklist engine, line-out, construction stages | Partial | `template_config.py` construction-stage checklists (Done, In progress, Not started); `services/validation.py`; problems with severity (`test_problems.py`); construction start is gated on line-out (`test_stage_engine.py::test_line_out_needs_legal_approval`) | No configurable checklist templates. No Pass, Fail or Not Applicable with a reason. No tolerances, per-item evidence, signatures, non-conformances or checklist gate. There is no line-out checklist with diagonal measurements. |
| S13 Civil completion, interiors, selections, handover | Partial | The civil-completion gate is "no open major problems" (`test_stage_engine.py::test_civil_completion_needs_no_open_major_problems`). Interiors and handover are client sign-offs | No snag list or dual sign-off. No selections module, tile records, `SelectionDeadline` red flag, showroom capture or read-only archive. |
| S14 Calendars, privacy, client demos | Not started | None (`clock.py` handles only the business timezone) | Everything in PRD section 10 and 7.18. |
| S15 Notifications, reminders, escalations | Partial | `Notification` model, `services/notify.py`, `routers/notifications.py`; red-flag rules including `client_decision_overdue`, keyed so they are not duplicated. Tests: `test_notifications.py` (6), `test_red_flag_rules.py` (12), `test_red_flags.py`; E2E `v2-notifications.spec.js` | In-app only: no email or push hook. No worker or scheduled jobs: rules run when data is read or changed (decision 0001). No escalation levels 1 to 3, and no acknowledge, reassign or snooze-with-reason. |
| S16 Portfolio dashboard and project view | Partial | `routers/dashboard.py`: all-projects, needs-attention, major problems, review queue and waiting-for-client panels, with filters. Tests: `test_dashboard.py` (14); E2E `v2-dashboard.spec.js`, `v3-dashboard.spec.js` | Several PRD 12.1 columns are missing: Project Architect, next milestone, planned vs actual, pending change requests, payment gate. No workload view, no exports (PRD 15), no 20-project seed. The project view has no requirements, drawings, RFIs, changes, payments or calendar tabs. |
| S17 Mobile app shell, offline, media | Partial | `android/` Capacitor project, `capacitor.config.json` (`ai.tanglobus.siteflow`); photo and video upload with GPS; server-side drafts; offline banner. E2E `task10-mobile.spec.js`, `v2-media.spec.js` | The APK has never been built or installed here (v2 Task 20 is blocked: no JDK or SDK). No push notifications or deep links, no My Work lists, no voice notes, no device-local draft store with sync state, no background upload retry. |
| S18 Deploy | Not started | Only `build-apk.yml` (unsigned debug APK) | No staging or pilot environments, no CD, secrets handling, backups or restore test, signed release, error logging or failed-job alerts. No `docs/DEPLOY.md`. |

S19 (Evaluate) and S20 (Maintain) are not V4 prerequisites. S19 is not started (no `docs/EVALUATION.md`).

## 3. Core Gaps That Block V01

The V4 plan makes S00 to S17 complete and S18 running a formal prerequisite, so every gap in section 2 blocks V01. These gaps block V01's own build list or acceptance criteria directly:

1. **S01, missing roles.** V01 requires MFA for Admin, Accounts and high-impact approvers. There is no Accounts role, and approver authority is not modelled.
2. **S01, no session model.** There is no refresh token, device session or revocation. V01 step-up, OTP and magic-link login, and PRD V4 4.3 logout-all-devices all need one.
3. **S01, no field-level rules.** V01's publication rules and PRD V4 4.2 ("commercial/internal fields not explicitly shared") build on field-level hiding.
4. **S05 and S06, no publishable records.** V01 adds a publication flag, but the only client-visible objects are sign-off packages and shared updates. There are no meetings, documents or approved drawings to publish.
5. **S10, no payment records.** V01 step-up applies to "sign-off and payment actions". There is no payment action to step up.
6. **S17, Android never built.** The "separate Staff and Client shells" are in the web app only. V01 acceptance runs on the Android app (PRD V4 20.1), and no APK has been built or installed.
7. **S18, no pipeline.** V4 steps "ship through the same S18 pipeline". Nothing exists beyond a debug APK job.
8. **S00, no CI tests.** CI does not run the test suites. V01's API permission tests would not gate merges.
9. **S15, no worker.** There is no email or SMS channel and no scheduled worker for code delivery and expiry. OTP by email, SMS or WhatsApp has no delivery path until S15 (email) and V10 (SMS and WhatsApp).

## 4. Ordered Steps to Run Next

Core steps come first. Each keeps decision 0001: evolve the current stack. Each step finishes with pytest, Playwright, semgrep, pip-audit and npm audit, then a `docs/PROGRESS.md` update.

| Order | Step | Scope adapted to this repository |
|---|---|---|
| 1 | **S00 complete** | Run the full test suite and scans in GitHub Actions. Add ruff and eslint with pre-commit. Add Compose services api and web. Point `CLAUDE.md` to PRD v3.2 and V4 and add the V4 integration and AI rules from `docs/reference/CLAUDE-reference-v4.md`. Add ADR 0003 on where new domain code lives (`backend/app/modules/` for V4 code as the plan expects, or the current `services/` and `routers/` layout). |
| 2 | S01 complete | All PRD section 5 roles; refresh tokens, sign-out and device-session revocation; field-level rules; delegation with expiry; admin screens; audit before-and-after summary. |
| 3 | S02 complete | Activity state machine (PRD 6.3); generic review actions; a pluggable gate-evaluator registry; domain events; a versioned flow (`TemplateVersion`) with running projects pinned. |
| 4 | S03 complete | Map PRD Stage 0 to 15 to the 18-stage configuration. Register placeholder evaluators for the payment, finding, checklist, document and issue-closure gates. |
| 5 | S04 complete | Client, contact and site entities; fee plan fields; historical gate attachment; CSV and XLSX import with an `ImportBatch`. |
| 6 | S05 | Meetings, action items, requirement register and baseline; generalise the sign-off service to any versioned entity. |
| 7 | S06 | Documents, drawings, packages, revisions, statuses and banners; document-status gate. |
| 8 | S07 | Pre-design site-condition visit, findings, investigations; finding-disposition gate; device-local drafts. |
| 9 | S08 | Freeze package, dual sign-off, consultant visibility, RFIs, issue-closure gate. |
| 10 | S09 complete | Elevation completeness; Change Requests. |
| 11 | S10 | Payment milestones and the payment gate (replaces the manual stage 12). |
| 12 | S11 | Detailed drawings, transmittals, acknowledgement. |
| 13 | S12 complete | Checklist engine, line-out with diagonals, construction-stage checklists, non-conformances. |
| 14 | S13 complete | Civil completion with snags, selections with deadlines, handover archive. |
| 15 | S14 | Calendars, privacy, client demos, leak tests. |
| 16 | S15 complete | Worker (Redis and arq), email channel, push hook, escalation levels, snooze, idempotency. |
| 17 | S16 complete | Remaining columns, workload, exports, 20-project seed, project-view tabs. |
| 18 | S17 complete | Install JDK 21 and the Android SDK (closes v2 Task 20); build and install the APK; push and deep links; My Work lists; offline sync. |
| 19 | S18 | Environments, CI/CD, secrets, backups and restore test, signed release, monitoring, `docs/DEPLOY.md`. |
| 20 | V01 | Staff and Client login (V4.1) |
| 21 | V02 | Android app, APK and AAB |
| 22 | V03 | Date-driven scheduling engine |
| 23 | V04 | Progress and traffic-light dashboard |
| 24 | V05 | Threshold and site-visit alerts |
| 25 | V06 | Stage templates and meeting packs |
| 26 | V07 | Project hold and resume; then **Evaluate V4.1** |
| 27 | V08 | Integration framework (V4.2) |
| 28 | V09 | Google Calendar, starting with Parvez |
| 29 | V10 | Omnichannel notifications |
| 30 | V11 | Sign-off service V4 and channel-reply approval |
| 31 | V12 | Progress-linked fees and payment requests |
| 32 | V13 | Client experience; then **Evaluate V4.2** |
| 33 | V14 | AI platform foundation (V4.3) |
| 34 | V15 | Capture provenance |
| 35 | V16 | Media processing pipeline |
| 36 | V17 | Vision observations and issue suggestions |
| 37 | V18 | Previous-visit comparison and suggested progress |
| 38 | V19 | Side-by-side report mismatch review |
| 39 | V20 | AI summaries, action centre, reminders; then **Evaluate V4.3** |
| 40 | V21 | Knowledge ingestion (V4.4) |
| 41 | V22 | Project assistant (RAG) |
| 42 | V23 | Stage copilots |
| 43 | V24 | Training data and LoRA fine-tuning (gated on V4-D12 and RAG evaluation) |
| 44 | V25 | CAD/BIM connectors (optional); then **Evaluate V4.4** |

The order follows the plans. TAN GLOBUS AI and Parvez can instead approve an earlier V4.1 start, after steps 1 to 5 plus S17 and S18, with S06 to S16 in parallel. That changes the V4 plan's stated prerequisite and would need to be recorded as a decision.

## 5. Open V4 Decisions and TBD_PARVEZ Seeds by Release

None of V4-D01 to V4-D16 has a recorded decision. PRD V4 section 26 shows every approval as Pending. Values below are seeded as configuration with the marker `TBD_PARVEZ`; no number is invented.

### V4.1 (V01 to V07)

| Decision | Open question | Seeded as TBD_PARVEZ |
|---|---|---|
| V4-D01 | One role-aware app or two apps | Build follows the PRD recommendation (one app); recorded as an assumption, not a config value |
| V4-D02 | Android OS and device list; Play, managed or direct APK | `MIN_ANDROID_SDK`, `PILOT_DEVICE_LIST`, `PILOT_DISTRIBUTION` |
| V4-D03 | Activity weights and traffic-light thresholds | `STUDIO_ACTIVITY_WEIGHTS`, `SITE_ACTIVITY_WEIGHTS`, `PROJECT_WORKSTREAM_WEIGHTS`, `AMBER_THRESHOLD_RULES`, `RED_THRESHOLD_RULES`, `FORECAST_TOLERANCE_DAYS` |
| V4-D04 | Durations, workweek, holidays, dependency types, allowances, float, re-baseline authority | `ACTIVITY_DURATIONS`, `WORKWEEK`, `HOLIDAYS`, `DEPENDENCY_LAGS`, `CLIENT_RESPONSE_ALLOWANCE`, `REVIEW_SLA` (the existing `REVIEW_OVERDUE_DAYS` stays TBD_PARVEZ), `PROCUREMENT_LEAD_TIMES`, `REBASELINE_ROLES` |
| V4-D05 | Site-visit frequency, confirmation, missed and report-late thresholds | `VISIT_INTERVAL_DAYS` (existing), `VISIT_CONFIRM_BY_HOURS`, `VISIT_MISSED_GRACE_HOURS`, `VISIT_REPORT_SLA_HOURS` |
| V4-D07 | Hold authorities, reminder exceptions, review frequency, contract treatment | `HOLD_APPROVER_ROLES`, `HOLD_EXEMPT_ALERTS`, `HOLD_REVIEW_INTERVAL_DAYS`, `HOLD_DEFAULT_PAUSE_POLICY` |
| V4-D13 | Progress ground truth by stage | `COMPLETION_METHOD_BY_STAGE` |
| (TAN GLOBUS AI, not Parvez) | OTP and magic-link lifetimes, step-up window, MFA method | `OTP_TTL_MINUTES`, `MAGIC_LINK_TTL_MINUTES`, `STEP_UP_VALID_MINUTES`, `MFA_METHOD`: security settings to be set by TAN GLOBUS AI, marked TBD until agreed |

### V4.2 (V08 to V13)

| Decision | Open question | Seeded as TBD_PARVEZ |
|---|---|---|
| V4-D06 | Calendar context shown vs kept behind a secure link | `GCAL_EVENT_CONTEXT_FIELDS`, `GCAL_CLIENT_SAFE_FIELDS` |
| V4-D08 | Fee milestones, percentages, tax basis, due rules, partial payments, release gates | `FEE_MILESTONES`, `FEE_TAX_BASIS`, `PAYMENT_DUE_DAYS`, `ALLOW_PARTIAL_PAYMENTS` (plus v3.2 D-05, the 50% basis) |
| V4-D09 | Payment provider; who marks Received vs Cleared; dual approval | `PAYMENT_PROVIDER`, `MARK_RECEIVED_ROLES`, `MARK_CLEARED_ROLES`, `DUAL_APPROVAL_THRESHOLD` |
| V4-D10 | WhatsApp, SMS and email providers, senders, consent, templates, quiet hours, frequency | `WHATSAPP_PROVIDER`, `SMS_PROVIDER`, `EMAIL_PROVIDER`, `SENDER_IDS`, `CONSENT_TEXT`, `QUIET_HOURS`, `REMINDER_FREQUENCY_CAP`; sandbox or mock adapters until decided |
| V4-D11 | Sign-off types that allow button or email approval; revoke window | `CHANNEL_REPLY_APPROVAL_TYPES` (default: none enabled), `APPROVAL_REVOKE_WINDOW` |

### V4.3 (V14 to V20)

| Decision | Open question | Seeded as TBD_PARVEZ |
|---|---|---|
| V4-D12 | Media retention, GPS and voice consent, AI processing location, client data-use | `MEDIA_RETENTION_DAYS`, `GPS_CONSENT_TEXT`, `VOICE_CONSENT_TEXT`, `AI_PROCESSING_REGION` |
| V4-D14 | Professional reviewers and prohibited AI actions by discipline | `AI_REVIEWER_ROLES`, `AI_PROHIBITED_ACTIONS` (starts with the PRD V4 13.5 list, which is fixed, not TBD) |
| V4-D15 | Self-hosted vs managed models, budget, data residency | `AI_PROVIDER_BY_TASK` (mock provider in tests), `AI_MONTHLY_BUDGET`, `DATA_RESIDENCY` |
| (evaluation) | Blur, darkness, duplicate and mismatch-confidence thresholds | `BLUR_THRESHOLD`, `DARKNESS_THRESHOLD`, `DUPLICATE_HASH_DISTANCE`, `MISMATCH_MANDATORY_CONFIDENCE`: set from the V17 evaluation, TBD until then |

### V4.4 (V21 to V25)

| Decision | Open question | Seeded as TBD_PARVEZ |
|---|---|---|
| V4-D12 | Data use for training | `TRAINING_DATA_ALLOWED` (default false) |
| V4-D15 | Hosting for fine-tuned models | `FINETUNE_SERVING_TARGET` |
| V4-D16 | 2 to 3 pilot projects and users | `PILOT_PROJECTS`, `PILOT_USERS` |

These core decisions from PRD v3.2 are also still open and hold back the missing core steps:

| Decisions | Hold back |
|---|---|
| D-01, D-02 | S03, S08 |
| D-03 | S07 |
| D-04 | S09 |
| D-05 | S10 and V12 |
| D-06 | S11 |
| D-07 | S12 |
| D-08 | S13 |
| D-09 | S15 |
| D-10, D-15 | S14 |
| D-11 | Pilot |
| D-12 | V4.3 |
| D-13 | S04 |
| D-14 | S13 |

## 6. Risks and Conflicts

| ID | Finding | Effect | Proposed handling |
|---|---|---|---|
| R-01 | **Stack conflict.** `docs/reference/CLAUDE-reference-v4.md`, `IMPLEMENTATION_PLAN.md` and `V4_IMPLEMENTATION_PLAN.md` assume React and TypeScript, `backend/app/modules/*`, Redis and arq, MinIO and Vitest. The repository is vanilla JS with flat `services/` and `routers/`, and has no worker (decision 0001). | Every V4 prompt names module paths that do not exist. V05, V10, V12 and V16 need scheduled jobs. | ADR 0003 in step 1: adopt `backend/app/modules/` for new code; bring in the worker at S15. Revisit React at S06 and S09, as decision 0001 already says. |
| R-02 | **Document versions.** `Inputs/` holds three V4 PRDs: `Claude SiteFlow-PRD-V4.md` (has 11.4A, V4-FR-026 and 027), `SiteFlow-PRD-V4.md` (older: leftover `[cite:]` markers, different V4-D11) and `SiteFlow-PRD-v4.0(1).md` (a merged v3 and v4 draft). The v3.2 PRD is in a file named `Claude PRd V3.1.md`. | A step could read the wrong baseline. | `docs/SiteFlow-PRD-V4.md` is the `Claude SiteFlow-PRD-V4.md` version, because PRD v3.2 cites its sections 10 to 16 and 11.4A. `docs/SiteFlow-PRD-v3.2.md` is `Claude PRd V3.1.md` (header says 3.2). The other copies stay in `Inputs/` and are not used. |
| R-03 | **Numbering collision in the discarded draft.** `SiteFlow-PRD-v4.0(1).md` reuses FR-26 to FR-45 and D-13 to D-22, which clash with v3.2 FR-26 to FR-28 and D-13 to D-15. | Traceability errors if anyone cites it. | Use only the `V4-FR-` and `V4-D` IDs from the canonical V4 PRD. |
| R-04 | **`CLAUDE.md` is out of date.** The repository `CLAUDE.md` points to PRD v3.1 and lacks the V4 integration and AI rules. | V4 sessions would not load the V4 rules. | Step 1 merges the V4 rules while keeping the repository's actual stack section. |
| R-05 | **Client portal scope.** PRD v3.2 3.3 lists "public client portal in the first pilot" as a non-goal unless approved. The code already has a client app (decision 0002, approval pending), and V4 4.2 requires one. | Scope approval is still open. | Ask Parvez to confirm decision 0002 as part of V4-D01. |
| R-06 | **Client authentication.** Clients now activate with an invite code and a password. V4 4.3 asks for OTP or magic link, optional password and step-up. | V01 must extend the current flow without locking out activated clients. | V01 keeps invite activation as the first OTP and adds OTP and magic-link sign-in. |
| R-07 | **Sign-off semantics.** Plan S05 has staff record a client's sign-off; v3 has the client sign in the app; V4 section 12 adds Reject and Ask Question actions, deep links and a version hash. The current `fingerprint` exists but is not exposed as a version hash, and only Approve and Request Changes exist. | Three definitions of one service. | Generalise in S05; extend to the V4 service in V11; keep the existing immutability guard. |
| R-08 | **Three progress numbers.** The construction checklist `official_progress` (equal weights, TBD_PARVEZ), the stage count `stage_progress` (done of 23), and V4 7.4 weighted Studio and Site completion. | Clients and Parvez could see conflicting percentages. | V04 defines one approved completion model under V4-D13; the others are shown only as drill-down. |
| R-09 | **Stage numbering.** The code uses the workflow diagram's 18 stages (with 8A and 8B). PRD v3.2 uses Stage 0 to 15. | Templates (V06) and fee triggers (V12) could reference the wrong stage. | **Closed in sprint v4 Task 40:** `stage_config.PRD_STAGE` maps each stage to its PRD stage; see the table in the notes below. |
| R-10 | **Legal approval gate.** The code gates Site line-out on Legal Approval (D-01 assumption); PRD v3.2 7.1 has no explicit legal gate. | Could block real projects wrongly. | Keep it as `TBD_PARVEZ` D-01 until Parvez confirms. |
| R-11 | **Payment and freeze gates are manual.** Stages 12 and 6 complete with a note. V12 "keeps the core 50% gate", which assumes S10 exists. | V12 has nothing to integrate with until S10 ships. | S10 before V12 (kept in the order above). |
| R-12 | **Red flags vs traffic lights.** Existing red-flag rules (`workflow_config.RED_FLAG_RULES`) overlap V4 6.2 Red and Amber. | Duplicate or contradictory signals. | V04 derives traffic-light reasons from the red-flag rules rather than adding a second rule set. |
| R-13 | **Android toolchain.** No JDK or SDK on the build machine; CI builds only an unsigned debug APK; no company-owned signing key. | S17, S18 and V02 cannot be accepted. V4 plan 24.4 requires company ownership of the signing key. | Install the toolchain before step 18. Create the key under the agreed TAN GLOBUS AI or legal-entity account. |
| R-14 | **Tenancy and ids.** No `organization_id`; integer ids in URLs. | V4 19.1 client isolation and signed deep links rely on ids that must not be guessable. | Signed tokens for links (V11); add `organization_id` under ADR 0003 before V08. |
| R-15 | **SQLite in tests.** The default test run uses SQLite. | pgvector (V21) and some constraints need PostgreSQL. | Make the PostgreSQL run (`TEST_DATABASE_URL`) the CI default in step 1. |
| R-16 | **Demo parity cost.** `web-src/demo-api.js` mirrors the backend rules; every V4 step would double the work. | Slower delivery and possible drift. | Freeze the demo at v3. Refresh it only at release Evaluate points. |
| R-17 | **Plan wording.** V4 plan section 2 says each release's Evaluate step is "section 7"; it is section 8. Section 9 places V4-D16 (pilot projects) only in V4.4, but the pilot and V01 acceptance (V4-D02 devices) start in V4.1. | Pilot users are needed earlier than the plan shows. | Ask for V4-D16 with the V4.1 decisions. |
| R-18 | **Plan prerequisite vs reality.** S00 to S17 are about half built. The core backlog (19 steps) is larger than V4.1. | Long lead time before any V4 value. | Decide at the step-1 review whether to keep the strict order or approve the early V4.1 option in section 4. |

## 7. Next Step

**Step 1 — S00 complete.** Suggested prompt:

```text
Read CLAUDE.md, docs/IMPLEMENTATION_PLAN.md step S00, docs/V4_EXECUTION_PLAN.md sections 2, 4 and 6 (R-01, R-02, R-04, R-15) and docs/decisions/0001-evolve-current-stack.md. Complete step S00 for this repository without building business features: add a GitHub Actions workflow that runs pytest on SQLite and PostgreSQL 16, the Playwright suite, semgrep, pip-audit and npm audit; add ruff and eslint with a pre-commit config; add api and web services to docker compose; update CLAUDE.md to point to docs/SiteFlow-PRD-v3.2.md and docs/SiteFlow-PRD-V4.md and add the V4 integration and AI rules from docs/reference/CLAUDE-reference-v4.md while keeping the actual stack section; and write docs/decisions/0003 on where new domain code lives. Run all tests and scans, then update docs/PROGRESS.md.
```

## Notes added during sprint v4

- **Interim fee ledger (sprint v4 Task 33).** `fee_entries` records client fees due and received by hand, for Accounts and the principal architect. It is not the V12 fee module: no milestones, payment requests, reminders or verification. **V12 must migrate these entries** into its fee agreements and payment records and then retire the ledger.
- **Principal overview (sprint v4 Task 34).** `GET /principal/overview` seeds three values as `TBD_PARVEZ` in `workflow_config`: `OVERALL_COMPLETION_WEIGHTS` (V4-D03; empty, so every stage weighs 1), `MAJOR_MILESTONES` (the four client sign-offs, the 50% and 80% fee gates, Site line-out and civil completion) and `RESOLVED_ISSUES_DAYS` (30). V04 traffic lights and V12 fees should feed this view instead of replacing it.
- **Flow versions (sprint v4 Task 39).** Each project is pinned to a `flow_versions` snapshot, and migration 0022 backfilled version 1 from a frozen copy. An edit to `stage_config.py` now applies to new projects only. To move running projects onto a new flow, write a data migration that re-pins them and adds or retires their stage rows. Two projects created at the same moment after a config edit could both try to create the next version number; the unique constraint refuses the second, which then fails and must be retried.
- **Diagram stages mapped to PRD Stage 0 to 15 (sprint v4 Task 40, closes R-09).** Every PRD stage is covered at least once (`test_every_stage_maps_to_a_prd_stage_and_every_prd_stage_is_covered`). The label also shows in the stage detail. Adding `prd_stage` changed the config snapshot, so the next new project pins flow version 2. Running projects stay on version 1 and read the label from the config.

| Diagram no. | Stage key | Stage | PRD stage |
|---|---|---|---|
| 1 | `setup` | Project setup | 0 |
| 2 | `discovery` | Client discovery meetings | 1 |
| 3 | `baseline` | Preliminary requirement baseline | 2 |
| 4 | `requirements_signoff` | Client sign-off: preliminary requirements | 2 |
| — | `predesign_site_visit` | Pre-design site visit | 3 |
| — | `investigations` | Investigations | 3 |
| — | `concept` | Preliminary concept | 4 |
| — | `tentative_elevations` | Tentative elevations | 4 |
| 5 | `grid` | Centerline, grid, foundation basis and column positions | 5 |
| 6 | `grid_freeze` | Architect and structural consultant freeze | 5 |
| 7 | `structural_design` | Structural design package | 6 |
| 8A | `architectural_package` | Architectural package | 7 |
| 8B | `structural_package` | Structural package | 7 |
| 9 | `mep` | MEP and coordination | 7 |
| 10 | `elevations_package` | All elevations package | 8 |
| 11 | `design_freeze_signoff` | Client sign-off: design freeze | 8 |
| 12 | `payment_gate` | 50% upfront gate | 9 |
| 13 | `detailed_drawings` | Detailed drawings and controlled issue | 10 |
| 14 | `line_out` | Site line-out | 11 |
| 15 | `construction` | Construction quality stages | 12 |
| 16 | `civil_completion` | Civil completion | 13 |
| — | `finishing_fee_gate` | 80% fee gate | 14 |
| 17 | `interiors_signoff` | Client sign-off: finishing package (tile and material selection) | 14 |
| 18 | `handover_signoff` | Client sign-off: handover and closeout | 15 |
