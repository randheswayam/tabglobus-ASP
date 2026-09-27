# SiteFlow V4 — Implementation Plan and Build Steps

**For use with Claude in VS Code**

| Item | Detail |
|---|---|
| Product | SiteFlow V4 enhancements |
| Business owner | Architect Parvez |
| Delivery | TAN GLOBUS AI |
| Requirements | `docs/SiteFlow-PRD-V4.md` (enhancements) and `docs/SiteFlow-PRD-v3.2.md` (core workflow) |
| Continues | `docs/IMPLEMENTATION_PLAN.md` steps S00 to S20 |
| Lifecycle | Build → Deploy → Evaluate → Maintain |
| Date | 28 September 2026 |

---

## 1. Answers to the Architect's Questions

| Question | Answer in V4 |
|---|---|
| Shall we use an Android APK? | Yes. One Capacitor Android app with Staff and Client modes. Signed APK for the pilot, signed AAB for Google Play. |
| Can replies on WhatsApp or email approve and move to the next step? | Yes, for sign-off types Parvez enables: a WhatsApp Approve button from the verified approver's number, or an email reply with APPROVE on the tokenized thread. Free text and calendar RSVP never approve. High-impact sign-offs use a secure link. (PRD V4 section 11.4A) |
| Can we mark payment received? | Yes. Accounts marks Received with amount, date, method, reference and evidence. A client saying "paid" creates a verification task. |
| Can AI compare site visits and check the report? | Yes. AI suggests observations, progress and mismatches; a reviewer confirms in a side-by-side screen. AI never sets official progress or passes a check. |
| How do we train our own open-source models (second brain)? | Start with retrieval over approved project data (RAG with pgvector). Collect expert-reviewed examples through normal use. Fine-tune small LoRA adapters on open-weight models only for narrow tasks (extraction, classification, report format, tone) once evaluation shows a gain. Project facts stay in retrieval, not in model weights. |
| Can AI generate every step? | AI can draft every step (plan, requirements QA baseline, site summary, centreline/foundation checklists, structural schedules and annotations, MEP clash lists and RFIs, drawing sheet checks). A qualified person always reviews, and AI output is never issued for construction or signed off. |

---

## 2. Prerequisites

- Core steps S00 to S17 are complete and S18 deployment is running, so the pilot can start on the core workflow.
- V4 steps ship through the same S18 pipeline. Each V4 release gets its own Evaluate step (section 7).
- Copy into the repository:
  - `docs/SiteFlow-PRD-V4.md`
  - `docs/SiteFlow-PRD-v3.2.md` (replaces v3.1)
  - `docs/V4_IMPLEMENTATION_PLAN.md` (this file)
  - Updated `CLAUDE.md` (includes the V4 rules)
- As before: one step per Claude session, acceptance criteria must pass, update `docs/PROGRESS.md`, undecided values use `TBD_PARVEZ`.

---

## 3. V4 Technical Additions

| Area | Choice (confirm under the PRD V4 decision named) |
|---|---|
| Scheduling | Own deterministic critical-path engine in Python (forward and backward pass, lags, constraints, working calendars) |
| Push | Firebase Cloud Messaging through `@capacitor/push-notifications` |
| Client login | One-time code by SMS, WhatsApp or email, and magic link; step-up code for sign-off and payment actions |
| Calendar | Google Calendar API with OAuth, minimum scopes, push channels for change watching (V4-D06) |
| Email | Transactional email provider with inbound parsing and per-request reply tokens; Gmail API only for connected mailboxes |
| WhatsApp | WhatsApp Business Platform, directly or through a provider, with approved templates and interactive buttons (V4-D10) |
| SMS | Provider with DLT-registered sender ID and templates for Indian numbers (V4-D10) |
| Payments | Manual verification in V4; optional payment-link provider later through signed webhooks (V4-D09) |
| AI gateway | One internal interface over managed and self-hosted models; provider chosen per task (V4-D15) |
| Transcription | Pluggable; candidate for self-hosting: faster-whisper (Whisper) |
| Vision | Pluggable vision-language model returning structured JSON; managed and open-weight candidates evaluated side by side |
| Embeddings and search | pgvector in the existing PostgreSQL, plus PostgreSQL full-text search for hybrid retrieval |
| Media processing | ffmpeg for frames and audio, perceptual hashing for duplicates, EXIF extraction |
| Fine-tuning (later) | Hugging Face PEFT (LoRA) on an open-weight model, served with vLLM |

New backend modules:

```text
backend/app/modules/
├── scheduling/      # calendars, constraints, CPM engine, baseline/forecast/actual, impact preview
├── health/          # progress weights, completion, traffic-light rules and reasons
├── holds/           # hold, impact, review, resume
├── integrations/    # accounts, OAuth vault, webhook intake, event envelope, retry, dead letter, reconciliation
├── channels/        # email, whatsapp, sms, push, consent, preferences, templates, quiet hours
├── gcal/            # Google Calendar sync
├── fees/            # fee agreement, fee milestones, payment requests, verification, reminder campaigns
├── client_portal/   # client-facing read models and actions
├── ai/              # gateway, prompt registry, executions, feedback, evaluation, kill switch
├── media_ai/        # provenance, processing pipeline, observations, comparison, mismatches
└── knowledge/       # ingestion, chunks, embeddings, entity links, retrieval, assistant, copilots
```

---

## 4. Release V4.1 — Mobile, Dashboard, Planning, Hold

### V01 — Staff and Client login

**PRD V4:** 4.1 to 4.3; V4-FR-002.

**Build**
- Client user type with one-time-code and magic-link login; optional password.
- Step-up verification for sign-off and payment actions.
- Multi-factor authentication for Admin, Accounts and high-impact approvers.
- Publication rules: a record is visible to clients only when explicitly published.
- Separate Staff and Client app shells and navigation after login.

**Acceptance criteria**
- Client login shows only published records for the client's own projects.
- Changing a URL or calling the API for another project or an internal note returns 403 or 404.
- Admin cannot finish login without the second factor.

**Prompt**
```text
Read CLAUDE.md, docs/SiteFlow-PRD-V4.md sections 4.1 to 4.3 and docs/V4_IMPLEMENTATION_PLAN.md step V01. Add a Client user type with one-time-code and magic-link login, step-up verification for sign-off and payment actions, MFA for Admin, Accounts and high-impact approvers, a publication flag that controls client visibility, and separate Staff and Client shells. Write API tests proving clients cannot reach unpublished, internal, or other-project data. Update docs/PROGRESS.md.
```

---

### V02 — Android app, APK and AAB

**PRD V4:** 1, 20.1; V4-FR-001.

**Build**
- Role-aware Capacitor app: Staff mode (My Day, Calendar, Projects, Capture, Reviews, Alerts, Assistant) and Client mode (Summary, Decisions, Payments, Documents, Meetings).
- Push notifications with deep links.
- GitHub Actions: signed debug APK for testers, signed release APK for pilot, signed AAB for Play.
- Signing key stored in CI secrets and owned by the company account, never by an individual developer.

**Acceptance criteria**
- Pilot APK installs and both login modes work on the approved device list (V4-D02).
- CI produces a signed AAB that passes Play Console upload checks.

**Prompt**
```text
Implement V02. Build the role-aware Capacitor Android app with the Staff and Client navigation in PRD V4 section 4, FCM push with deep links, and GitHub Actions jobs that produce a signed pilot APK and a signed AAB. Keep signing keys in CI secrets and document key ownership and recovery in docs/DEPLOY.md. Update docs/PROGRESS.md.
```

---

### V03 — Date-driven scheduling engine

**PRD V4:** 7.1, 7.2; V4-FR-004, V4-FR-005.

**Build**
- Working calendars, weekends, holidays, visible planned leave (availability only).
- Activity durations from the template; dependencies finish-to-start, start-to-start, finish-to-finish, with lag.
- Constraints: earliest start, fixed date, not before, deadline.
- Allowances: client response, review SLA, procurement lead time, site-visit recurrence.
- Entering a start date calculates all activity and milestone dates.
- Three date sets: baseline (immutable), current forecast, actual.
- Change handling with impact preview: changed activities, old and new dates, milestone shift, fee impact, client commitments, people notified.
- User options: reforecast only, re-baseline (authority and reason), absorb delay (use float where feasible).

**Acceptance criteria**
- A template with parallel branches and a holiday produces the expected dates in unit tests.
- Delaying one activity changes the forecast of its successors only; the baseline stays the same.
- Re-baseline without authority is refused.

**Prompt**
```text
Implement V03 in backend/app/modules/scheduling. Build a deterministic critical-path engine (forward and backward pass, FS/SS/FF dependencies with lag, constraints, working calendars and holidays), start-date plan generation, baseline/forecast/actual date sets, and an impact-preview API with reforecast, re-baseline and absorb options as in PRD V4 7.1 and 7.2. Durations and allowances come from template configuration; undecided values are TBD_PARVEZ. Write table-driven unit tests with hand-calculated expected dates. Add a web Gantt view and impact-preview dialog. Update docs/PROGRESS.md.
```

---

### V04 — Progress and traffic-light dashboard

**PRD V4:** 6, 7.4; V4-FR-003.

**Build**
- Completion methods per activity: manual, checklist-derived, quantity-derived, approval-derived, AI-suggested (not official until confirmed).
- Weighted Studio and Site completion using the formula in PRD V4 7.4.
- Traffic-light rules Green, Amber, Red, Blue, Grey from configurable thresholds, each with reason, owner and age.
- Project card with every field in PRD V4 6.1.
- Views: Portfolio Grid, Workflow Timeline, Milestone/Gantt, Calendar, Workload, Map/Site Visits, Review Queue, Client Decisions, Payment Queue.
- Colour never used alone: icon and text on every state.

**Acceptance criteria**
- Each colour state is produced by a seeded test project and shows the correct reason text.
- Dashboard percentages match the approved activities listed in the drill-down.

**Prompt**
```text
Implement V04. Build the health module: completion methods, weighted Studio/Site/project completion (PRD V4 7.4), rule-based traffic lights with reasons (PRD V4 6.2) using configurable thresholds marked TBD_PARVEZ, the project card fields in 6.1, and the listed dashboard views. Extend the 20-project seed so every colour state appears. Test each rule and the drill-down totals. Update docs/PROGRESS.md.
```

---

### V05 — Threshold and site-visit alerts

**PRD V4:** 7.3; V4-FR-006.

**Build**
- Threshold rules per activity type: warn assignee before the threshold, alert reviewer when a pending review risks its successor, alert Project Architect when a milestone is forecast beyond tolerance.
- Site-visit alerts: approaching, unconfirmed, missed, report not submitted within the post-visit SLA.
- "Next activity readiness" and "why not ready" on activity and dashboard.
- Suppression during hold, except safety, statutory and exempt alerts.

**Acceptance criteria**
- A visit not confirmed by the configured time raises an alert to the assignee, then escalates.
- An on-hold project receives no ordinary reminders but still receives a safety alert.

**Prompt**
```text
Implement V05. Add threshold rules and the alert types in PRD V4 7.3 to the scheduling and notifications modules, including site-visit approaching/unconfirmed/missed/report-late alerts, successor-risk and milestone-risk alerts, next-activity readiness, and hold suppression with exemptions. Use scheduled worker jobs and existing escalation levels. Test the acceptance criteria. Update docs/PROGRESS.md.
```

---

### V06 — Stage templates and meeting packs

**PRD V4:** 8.1; V4-FR-007.

**Build**
- Extend activity templates with: purpose, instructions, agenda and minutes template, client questions, consultant inputs, approval text, quality checks, channel message templates, fee rule, AI schema and reviewer.
- Instantiate using the planned activity date.
- Template migration for active projects with a difference preview and recorded acceptance.
- Meeting pack generation: stage, objective, agenda, decision needed, latest approved drawings, prior minutes, open actions, risks, checklist.

**Acceptance criteria**
- Every stage in the residential template has a template version.
- Editing a template does not change an active project until an authorized migration is accepted.

**Prompt**
```text
Implement V06. Extend the workflow template model with the fields in PRD V4 8.1, instantiate templates using planned activity dates, add a template-migration preview and acceptance flow for active projects, and build meeting pack generation with the project context listed in the plan. Add templates for every residential stage with placeholder content marked TBD_PARVEZ. Update docs/PROGRESS.md.
```

---

### V07 — Project hold and resume

**PRD V4:** 9; V4-FR-010.

**Build**
- Hold scope: project, Studio, Site, or selected activities.
- Mandatory data from PRD V4 9.1, including reason category (Client Request and others) and evidence.
- Blue status with reason, duration, owner and next review date.
- Schedule clock freeze and impact preview; meetings are cancelled or rescheduled only after confirmation.
- Periodic hold review task; resume with authority, date, revised plan, fee review and notifications.

**Acceptance criteria**
- "Client Request" hold turns the project blue, pauses configured reminders and shows impact.
- Resume creates a revised forecast and notifies the affected people.

**Prompt**
```text
Implement V07 in backend/app/modules/holds with the hold data in PRD V4 9.1 and behaviour in 9.2: scopes, reason categories, evidence, blue health state, schedule freeze with impact preview, confirmed meeting changes, hold review tasks, and authorized resume with revised forecast and notifications. Test the acceptance criteria. Update docs/PROGRESS.md.
```

---

## 5. Release V4.2 — Integrations, Calendar, Channels, Sign-off, Fees, Client App

### V08 — Integration framework

**PRD V4:** 11.2, 19.2.

**Build**
- Integration accounts; encrypted, revocable OAuth token storage.
- Webhook intake: signature verification, replay protection, idempotency, normalized event envelope (PRD V4 11.2).
- Retry with exponential backoff, dead-letter queue, admin replay screen.
- Daily reconciliation job for message status.

**Acceptance criteria**
- The same webhook delivered twice is processed once.
- A webhook with a bad signature is rejected and logged.

**Prompt**
```text
Implement V08 in backend/app/modules/integrations: integration accounts, encrypted OAuth token vault, a generic webhook endpoint with per-provider signature verifiers, replay protection, idempotency keys, the normalized event envelope in PRD V4 11.2, retry with backoff, a dead-letter table with admin replay, and a daily reconciliation job interface. Test duplicate and bad-signature cases. Update docs/PROGRESS.md.
```

---

### V09 — Google Calendar, starting with Parvez

**PRD V4:** 8.2, 8.3, 11.5; V4-FR-008, V4-FR-009.

**Build**
- OAuth connect for one user (Parvez) with minimum scopes; free/busy scope where details are not needed.
- Create and update events from SiteFlow meetings, demos and site visits with the context in PRD V4 8.2; client-safe context for external attendees.
- Event ID linked to activity ID; push channel watch with renewal monitoring.
- RSVP updates attendance only; event description includes the secure approval link when a sign-off is due.
- Private events appear only as busy.

**Acceptance criteria**
- A SiteFlow meeting appears in Parvez's Google Calendar with project context and links; editing it in SiteFlow updates the event.
- An RSVP changes attendance and never approves anything.

**Prompt**
```text
Implement V09 in backend/app/modules/gcal. Add OAuth connect for a single pilot user with minimum scopes, create/update events carrying the project context in PRD V4 8.2 (client-safe for external attendees), event-to-activity linking, push channel watches with renewal monitoring, RSVP-to-attendance mapping, and free/busy-only handling of private events. Use a Google Cloud test project; never log event contents of private events. Update docs/PROGRESS.md.
```

---

### V10 — Omnichannel notifications

**PRD V4:** 11.1, 11.3, 11.4; V4-FR-014, V4-FR-027.

**Build**
- Channel adapters: in-app, push, email, WhatsApp, SMS; one interface.
- Consent per person and channel; preferences; quiet hours; frequency caps.
- Approved message templates per channel and audience; WhatsApp templates with interactive buttons.
- Delivery status tracking (sent, delivered, read where supported, failed) and reconciliation.
- Inbound email with reply tokens; inbound WhatsApp and SMS through V08 webhooks; classification into Approve, Reject, Question, Paid Claim, Unclear, Other.
- SMS and WhatsApp carry minimal data plus a secure link.

**Acceptance criteria**
- A person without WhatsApp consent receives email instead.
- No message is sent in quiet hours unless the rule is marked urgent.
- An inbound reply is attached to the correct project and request.

**Prompt**
```text
Implement V10 in backend/app/modules/channels: adapters for in-app, push, email, WhatsApp and SMS behind one interface (start with provider sandbox or mock adapters until V4-D10 is decided), consent and preferences, quiet hours, frequency caps, approved templates, delivery status tracking, inbound email with reply tokens, inbound WhatsApp/SMS via the V08 webhook, and reply classification. Test the acceptance criteria with mocks. Update docs/PROGRESS.md.
```

---

### V11 — Sign-off service V4 and channel-reply approval

**PRD V4:** 11.4A, 12; V4-FR-015, V4-FR-016, V4-FR-026.

**Build**
- Sign-off package with immutable version hash, summary, changes since last version, consequences, documents.
- Signed, expiring deep links; revision invalidates pending links.
- Channel-reply approval policy table per sign-off type (PRD V4 11.4A):
  - WhatsApp Approve button from the verified number of the named approver, with request token and version hash.
  - Email reply with APPROVE on the original tokenized thread from the verified address.
  - Free text and calendar RSVP never approve.
- On approval from any path: record evidence, send receipt on the same channel and email, release successors, allow revoke within the configured window.

**Acceptance criteria**
- All three sign-off acceptance cases in PRD V4 20.6 pass.
- A button reply from an unregistered number is routed to staff and does not approve.

**Prompt**
```text
Implement V11. Upgrade the SignOff service to PRD V4 section 12: packages with version hash, signed expiring deep links invalidated on revision, and the channel-reply approval policy in section 11.4A (verified WhatsApp button, tokenized email APPROVE, never free text or RSVP), with evidence recording, receipts, successor release and a revoke window marked TBD_PARVEZ. Write tests for every row of the 11.4A table and the PRD V4 20.6 scenarios. Update docs/PROGRESS.md.
```

---

### V12 — Progress-linked fees and payment requests

**PRD V4:** 10; V4-FR-011, V4-FR-012, V4-FR-013, V4-FR-021.

**Build**
- Fee agreement with total value, taxes and milestones as percentage or fixed amount; validation against the contract value.
- Triggers: approved milestone, approved weighted completion, date, or combination; never AI estimate alone.
- Payment request with the fields in PRD V4 10.2, delivered by app, email, WhatsApp, SMS per consent.
- Status list in PRD V4 10.3; Accounts "Mark received" with amount, date, method, reference, evidence; optional second approver above a threshold.
- Client "paid" reply sets Client Claims Paid and creates a verification task.
- Reminder campaigns with approved templates, caps, quiet hours, escalation and stop conditions (PRD V4 10.4).
- Keeps the core 50% gate before detailed drawings as one configured milestone.

**Acceptance criteria**
- All PRD V4 20.5 scenarios pass.
- Reminders stop within one job cycle after Cleared, Waived, dispute or hold.

**Prompt**
```text
Implement V12 in backend/app/modules/fees: fee agreements and milestones (percentage or fixed) validated against contract value, approved-progress and milestone triggers, payment requests with the fields in PRD V4 10.2, the status list in 10.3, evidence-backed Mark Received with optional dual approval, Client Claims Paid verification tasks, and reminder campaigns with the stop rules in 10.4. Integrate with the existing commercial gate. Percentages and thresholds are TBD_PARVEZ. Test PRD V4 20.5. Update docs/PROGRESS.md.
```

---

### V13 — Client experience

**PRD V4:** 4.2.

**Build**
- Client home: plain-language summary, approved progress and selected photos, upcoming meetings and demos, decisions needed, sign-offs, payment requests with documents, approved documents, change requests for decision.
- Configurable language for client text.
- Approval receipts and invoice/receipt documents downloadable.

**Acceptance criteria**
- A client completes a sign-off and views a payment request end to end on the Android app.

**Prompt**
```text
Implement V13 in backend/app/modules/client_portal and the Client app shell: the screens in PRD V4 4.2 using only published records, plain-language text with a configurable language, and downloadable receipts. Add a Playwright test for client sign-off and payment viewing. Update docs/PROGRESS.md.
```

---

## 6. Release V4.3 — AI Site Intelligence

### V14 — AI platform foundation (build before any AI feature)

**PRD V4:** 13.5, 14.1, 15.4, 19.1; V4-FR-025.

**Build**
- Model gateway: one interface for text, vision, speech and embeddings; providers configured per task; managed and self-hosted adapters.
- Prompt registry with versions and JSON output schemas; schema validation of every output.
- `AIExecution` record: model and version, prompt version, context references, output, confidence, cost, latency, user edits, acceptance or rejection.
- Permission check before building context; personal calendar data and "AI Prohibited" records excluded.
- Global and per-feature kill switch; core workflows keep working when AI is off.
- Feedback buttons and evaluation harness skeleton.

**Acceptance criteria**
- Turning AI off leaves capture, submission and review fully working.
- Every AI output in the system links to an `AIExecution` record.

**Prompt**
```text
Implement V14 in backend/app/modules/ai: a model gateway with pluggable providers per task (text, vision, speech, embeddings) including a mock provider for tests, a versioned prompt registry with JSON schemas and output validation, AIExecution audit records, permission-filtered context building that excludes private calendar and AI-prohibited data, kill switches, feedback capture, and an evaluation harness skeleton. No AI feature may bypass this module. Update docs/PROGRESS.md.
```

---

### V15 — Capture provenance

**PRD V4:** 13.1; V4-FR-017.

**Build**
- Store original, never overwritten; derivatives separate.
- Server receipt time, device capture time, GPS with accuracy, device and user, project, visit, activity.
- Camera capture flagged separately from gallery upload; manual edits flagged.
- SHA-256 hash of the original; optional visible stamp (time, GPS, project) on a derivative only.
- C2PA-compatible provenance as a later enhancement where tooling supports it.

**Acceptance criteria**
- PRD V4 20.7 first scenario passes.
- A gallery upload is labelled as such on every screen that shows it.

**Prompt**
```text
Implement V15 in backend/app/modules/media_ai and the mobile capture screens: immutable originals with SHA-256, separate derivatives, capture metadata (server time, device time, GPS and accuracy, source camera or gallery, device, user, visit, activity), manual-edit flags, and an optional stamped derivative. Never describe metadata as proof of authenticity in UI text. Update docs/PROGRESS.md.
```

---

### V16 — Media processing pipeline

**PRD V4:** 13.1, 13.2; V4-FR-018.

**Build**
- Background jobs: EXIF extraction, video frame sampling, audio separation, transcription with timestamps through the gateway.
- Quality checks: blur, darkness, near-duplicate (perceptual hash), missing coverage against checklist areas.
- Transcript linked to timecodes and frames.

**Acceptance criteria**
- A test video yields a timestamped transcript and linked frames.
- A duplicated photo from a previous visit is flagged.

**Prompt**
```text
Implement V16: arq jobs using ffmpeg for frames and audio, EXIF extraction, transcription through the AI gateway (faster-whisper adapter plus mock), blur/darkness checks, perceptual-hash duplicate detection across visits, and transcript-to-timecode-to-frame linking. Processing failure must never block submission. Update docs/PROGRESS.md.
```

---

### V17 — Vision observations and issue suggestions

**PRD V4:** 13.1 step 6, 13.2, 13.5.

**Build**
- Vision prompt per stage returning structured observations: tags, visible conditions, possible issues, evidence region, confidence.
- Suggestions stay "AI Suggested" until a reviewer accepts, edits or dismisses; accepted items can become issues or non-conformances.
- Prohibited outputs enforced: no structural adequacy, no "safe to pour", no face identification, no worker scoring.

**Acceptance criteria**
- An AI suggestion cannot close or pass a checklist item by itself.
- Prohibited phrases or claims are blocked by output validation.

**Prompt**
```text
Implement V17: stage-specific vision prompts in the registry returning schema-validated observations with regions and confidence, reviewer disposition (accept, edit, dismiss, create issue), and output guards that block the prohibited determinations in PRD V4 13.5. Evaluate at least two vision providers on a small labelled sample and record results in docs/EVALUATION.md. Update docs/PROGRESS.md.
```

---

### V18 — Previous-visit comparison and suggested progress

**PRD V4:** 13.3.

**Build**
- Align media by project, zone or area tag, viewpoint and stage before comparing.
- Output categories: new work, unchanged, previous issue resolved or still visible or not observable, new potential issue, incomparable with reason.
- AI-suggested progress shown next to checklist-derived progress; never saved as official without confirmation.

**Acceptance criteria**
- Unaligned media is labelled incomparable rather than scored.
- Confirmed progress is the only value used by the dashboard.

**Prompt**
```text
Implement V18: media alignment by area tag, viewpoint and stage, comparison output with the categories in PRD V4 13.3, and AI-suggested progress displayed beside official progress with an explicit confirm action. Never compute a percentage from unaligned images. Update docs/PROGRESS.md.
```

---

### V19 — Side-by-side report mismatch review

**PRD V4:** 13.4; V4-FR-019.

**Build**
- Reviewer screen: current and previous media synced by area, AI annotations, submitted report and checklist on the other side.
- Mismatch categories from PRD V4 13.4, with source frame, timecode, transcript excerpt and linked checklist item.
- Actions: accept, edit, dismiss, create issue, request evidence, request rework.
- Mandatory disposition for critical and high-confidence mismatches before approval.

**Acceptance criteria**
- PRD V4 20.7 side-by-side scenario passes.
- A visit cannot be approved while a critical mismatch has no disposition.

**Prompt**
```text
Implement V19: the side-by-side review screen (web first, tablet-friendly), mismatch detection between AI observations and the submitted report/checklist using the categories in PRD V4 13.4, reviewer actions, and a gate evaluator that blocks approval while critical mismatches lack disposition. Update docs/PROGRESS.md.
```

---

### V20 — AI summaries, action centre, personalized reminders

**PRD V4:** 14; V4-FR-020, V4-FR-021.

**Build**
- Project summary with source links for every statement, generation time, source cutoff and "AI-generated — verify before action".
- Site report summaries across visits.
- Portfolio action centre (PRD V4 14.2) with draft interventions for Parvez to approve.
- Personalized payment and sign-off reminders built from approved templates; no invented amounts, promises or penalties; first send approved by a person; stop conditions from PRD V4 14.3.

**Acceptance criteria**
- Every sentence in a summary links to at least one source record.
- A reminder whose generated text contains an amount different from the payment request is blocked.

**Prompt**
```text
Implement V20: permission-filtered project and portfolio summaries with per-statement source links, site report summaries, the action centre in PRD V4 14.2, and personalized reminders that fill approved templates, validate amounts/dates/versions against records, require human approval for first send, and honour all stop conditions. Update docs/PROGRESS.md.
```

---

## 7. Release V4.4 — Second Brain and Stage Copilots

### V21 — Knowledge ingestion

**PRD V4:** 15.1, 15.2; V4-FR-022.

**Build**
- Data classification labels: Public-to-client, Project Team, Discipline Restricted, Commercial Restricted, Personal, AI Prohibited.
- Ingestion of documents, drawings (OCR of PDFs), minutes, transcripts, site reports, decisions and workflow history.
- Chunking by semantic unit with project, date, stage, discipline, revision, approval state and label.
- Embeddings in pgvector; full-text index; entity links (people, activities, decisions, drawings, areas, milestones) in PostgreSQL.
- Superseded records marked; duplicates removed.

**Prompt**
```text
Implement V21 in backend/app/modules/knowledge: classification labels, ingestion jobs for the listed sources with OCR for drawing PDFs, metadata-rich chunking, pgvector embeddings through the AI gateway, a full-text index, entity links, and superseded/duplicate handling. Personal and AI Prohibited records are never embedded. Update docs/PROGRESS.md.
```

---

### V22 — Project assistant (RAG)

**PRD V4:** 15.1, 20.8.

**Build**
- Hybrid retrieval (vector, full-text, relational filters) with authorization before retrieval and again before answering.
- Answers only from retrieved sources, with citations; superseded documents shown with a warning.
- Prompt-injection defences on retrieved content; permission-leak test suite.
- Gold question set built with Parvez's team; accuracy and source-correctness measured.

**Acceptance criteria**
- All PRD V4 20.8 scenarios pass.
- The leak test suite returns no restricted content for any role.

**Prompt**
```text
Implement V22: hybrid retrieval with pre- and post-retrieval authorization, a cited-answer assistant in the Staff app, superseded-document warnings, prompt-injection handling for retrieved text, a permission-leak test suite across all roles, and an evaluation run over a gold question set stored in the repo. Update docs/PROGRESS.md and docs/EVALUATION.md.
```

---

### V23 — Stage copilots

**PRD V4:** 16; V4-FR-024.

**Build** (each output is a labelled draft that enters the normal review and sign-off flow)
- Plan copilot: draft activity graph, durations from approved templates, risk register, meeting plan.
- Requirements copilot: meeting transcript to requirements, missing or contradictory answers, QA baseline draft, revision comparison.
- Site assessment copilot: evidence summary and proposed investigations.
- Centreline, foundation and column copilot: constraint retrieval, coordination checklist, clash candidates from submitted drawings.
- Structural drafting assistant: schedules, annotations and repetitive-detail lists from approved calculations supplied by the engineer.
- MEP coordination copilot: routes and openings extraction, clash candidates, draft RFIs.
- Drawing checks: sheet list, title block and revision consistency (CAD/BIM Level 1 in PRD V4 16.1).

**Acceptance criteria**
- No copilot output can be marked Issued, Frozen or Approved without the configured professional sign-off.
- Every copilot draft is watermarked "AI draft — not for construction".

**Prompt**
```text
Implement V23 as copilot actions on the relevant activities, each using a registered prompt and schema, retrieval from V22, and output saved as a labelled draft that enters the normal review flow. Enforce in the workflow engine that AI drafts cannot be issued, frozen or approved without the professional sign-offs listed in PRD V4 16. Start with the plan and requirements copilots, then the rest. Update docs/PROGRESS.md.
```

---

### V24 — Training data and LoRA fine-tuning (gated)

**PRD V4:** 15.3, 15.4; V4-FR-023.

**Start only when:** RAG evaluation is stable, a narrow task is chosen, enough expert-reviewed examples exist, and the data-use policy (V4-D12) is approved.

**Build**
- Dataset export from accepted AI outputs and reviewer edits, with consent and label filtering, versioned.
- Training pipeline with PEFT (LoRA) on a chosen open-weight model; hold-out evaluation set; comparison against the current provider.
- Model registry; serving through vLLM behind the gateway; shadow mode, then copilot mode.
- Separate adapters per client where required; no project facts trained into weights.

**Prompt**
```text
Implement V24 as a separate training/ folder: versioned dataset export from accepted outputs and reviewer edits (consented, labelled, no personal or AI-prohibited data), a PEFT LoRA training script for one narrow task, hold-out evaluation comparing against the current gateway provider, a model registry entry, and a vLLM serving adapter registered in the gateway in shadow mode only. Document results in docs/EVALUATION.md.
```

---

### V25 — CAD/BIM connectors (optional)

**PRD V4:** 16.1.

- Level 1 is covered by V23 drawing checks.
- Level 2: read IFC model metadata (levels, spaces, elements, issue IDs) and imported clash reports.
- Levels 3 and 4 stay out of scope until Levels 1 and 2 are evaluated.

---

## 8. Deploy, Evaluate, Maintain for V4

| Lifecycle | Activity |
|---|---|
| Deploy | Each release ships through the S18 pipeline. Add provider secrets, webhook endpoints, Google Cloud project, FCM project, and AI provider keys per environment. |
| Evaluate | After each release, run the PRD V4 section 20 scenarios for that release as Playwright and API tests, the permission-leak suite, and (from V4.3) the AI evaluation set. Record in `docs/EVALUATION.md`. |
| Maintain | Watch renewal, dead-letter queue, reconciliation results, AI cost and override rates, and reminder opt-outs weekly. Template and threshold changes are versioned and recorded in `docs/decisions/`. |

---

## 9. Decisions Needed Before Each Release

| Release | PRD V4 decisions |
|---|---|
| V4.1 | V4-D01 app packaging, V4-D02 devices and distribution, V4-D03 weights and thresholds, V4-D04 durations and calendars, V4-D05 site-visit alerts, V4-D07 hold rules, V4-D13 progress ground truth |
| V4.2 | V4-D06 calendar context, V4-D08 fee milestones, V4-D09 payment handling, V4-D10 WhatsApp/SMS/email providers and consent, V4-D11 channel-reply approval types and revoke window |
| V4.3 | V4-D12 media, GPS, voice and AI data policy, V4-D14 reviewers and prohibited AI actions, V4-D15 model hosting and data residency |
| V4.4 | V4-D12 data-use for training, V4-D15, V4-D16 pilot projects and users |