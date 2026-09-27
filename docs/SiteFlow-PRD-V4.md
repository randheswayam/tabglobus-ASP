# SiteFlow V4 — Architecture Workflow Automation

## Product Requirements Document

**Prepared for:** Architect Parvez and TAN GLOBUS AI  
**Version:** V4.0 — Separate standalone PRD  
**Date:** 28 September 2026  
**Status:** Draft for stakeholder and technical sign-off  
**Product surfaces:** Responsive web application, Android mobile application, client experience, integration services, and AI services  
**Relationship to earlier documents:** V4 is a separate enhancement PRD. The core workflow, permissions, checklists, change control, calendar privacy, client demo capture, and legacy onboarding remain defined in **SiteFlow PRD v3.2**, which V4 extends and does not overwrite. Where V4 and v3.2 conflict for the same capability, V4 takes precedence for that capability only.
**Requirement IDs:** V4 requirements use the prefix `V4-FR-` so they never collide with v3.2 `FR-` numbers.

---

## 1. Executive Decision

**Answer to "shall we use an Android APK":** yes. SiteFlow V4 should use a **web application plus an Android mobile app**. For the pilot, the recommended mobile packaging is one role-aware Android application with separate Staff and Client experiences; staff and clients have different navigation, permissions, and data visibility even if the same binary is installed. Capacitor remains a practical route for reusing the existing web code (the SiteFlow prototype already uses Capacitor with app id `ai.tanglobus.siteflow`) while accessing Android-native capabilities through Java/Kotlin plugins.

For internal testing, produce a signed APK that can be installed directly. For production distribution through Google Play, produce a signed Android App Bundle (AAB), because Google Play uses app bundles to generate optimized device-specific APKs and requires app bundles for new Play applications; APK remains appropriate for direct pilot testing.

V4 adds a visual traffic-light dashboard, dependency-based date planning, rolling forecasts, activity-specific templates, Google Calendar integration starting with Parvez, project hold controls, progress-linked fee milestones, multichannel communications, client sign-off workflows, payment tracking, and a governed multimodal AI layer. AI can draft and analyze every stage, but it must not independently approve architecture, structural, MEP, payment, contractual, safety, or construction-release decisions.

---

## 2. Product Vision

SiteFlow is the operating system for an architecture practice managing Studio and Site work across approximately 20 concurrent projects. It converts a configurable project workflow into assignments, calendar commitments, client decisions, consultant coordination, site evidence, design/document gates, progress, fees, alerts, and an auditable project memory.

The product must answer five questions at any moment:

1. What is the current Studio and Site status of each project?
2. What is late, at risk, blocked, on hold, or awaiting a person?
3. What should each staff member, consultant, client, or reviewer do next?
4. What evidence and approval permit the next activity to start?
5. What commercial milestone, client communication, meeting, or escalation should now be generated?

---

## 3. V4 Scope

### 3.1 Included in V4

- Responsive web application for workflow configuration, portfolio control, reviews, documents, calendars, reporting, finance milestones, administration, and AI oversight.
- Android application for staff and clients, with a signed pilot APK and production AAB.
- Separate Staff and Client login experiences with role-, project-, and field-level authorization.
- Studio and Site workflow visualization with traffic-light health states.
- Start-date-driven schedules that calculate every activity and milestone through dependencies, durations, working calendars, and holds.
- Baseline, current forecast, actual dates, threshold warnings, delay alerts, and site-visit reminders.
- Versioned templates and mandatory checklists for every activity/stage.
- Google Calendar integration, initially piloted with Parvez, with complete project context in SiteFlow-created events.
- Project hold/resume with reason, owner, effective date, expected resume date, impact, and approval.
- Progress-linked fee milestones and payment requests through app, email, WhatsApp, and SMS.
- Payment status tracking and authorized “Mark received” action with evidence and audit history.
- Multichannel staff/client notifications and inbound reply handling.
- Secure client sign-off requests through app and signed deep links delivered through approved channels.
- AI analysis of site photos, videos, voice notes, and reports; comparison with previous visits; transcript, issue suggestions, mismatch highlighting, and review.
- AI portfolio/project summaries, action alerts, payment/sign-off message drafting, and governed reminder personalization.
- A permission-aware “second brain” using retrieval over approved project data, followed later by measured fine-tuning of open-source models.
- AI copilots for planning, requirements, question-and-answer baselines, coordination packs, and drawing/document assistance, always under professional review.

### 3.2 Explicit boundaries

- A WhatsApp, SMS, or email delivery/read receipt is not an approval or proof of payment.
- A Google Calendar acceptance indicates meeting attendance only; it cannot approve requirements, drawings, fees, or changes.
- A free-text “OK” or emoji is not sufficient for high-impact sign-off unless the reply can be authenticated, matched to the exact immutable version, and is permitted by the approved sign-off policy.
- AI-generated observations are suggestions, not verified site facts.
- AI-generated drawings are drafts/reference material and are never “Issued for Construction” without the responsible architect/engineer's checks and sign-off.
- The product is not a bank, payment processor, CAD/BIM authoring replacement, structural calculation engine, or statutory approval authority.

---

## 4. Personas and Login Experiences

### 4.1 Staff login

Staff includes Principal Architect/Admin, Project Architect, Architect, Designer, Civil/Site Engineer, Structural Consultant, MEP Consultant, Interior Designer, Reviewer, Accounts, and Office Coordinator.

Staff home experience:

- My Day: assigned, due, overdue, waiting, and blocked activities.
- My Calendar: SiteFlow events plus permitted Google Calendar availability.
- Projects: authorized portfolio/project views.
- Capture: site visit, photo/video, voice note, issue, meeting note, or document.
- Reviews: submissions and sign-offs awaiting the user.
- Alerts: risks, threshold breaches, payment/sign-off dependencies, and escalations.
- AI Assistant: permission-aware questions, summaries, drafts, and recommendations.

### 4.2 Client login

Client experience must be intentionally smaller and simpler:

- Project summary in plain language.
- Approved progress and selected photos/reports.
- Upcoming meetings/demos and decisions required.
- Sign-off requests showing the exact version, implications, comments, and confirmation action.
- Payment requests, due dates, amount/status, invoice/receipt documents, and payment instructions/link when configured.
- Approved documents and communications.
- Change requests requiring client decision.

Clients cannot access internal drafts, staff conversations, private calendars, AI confidence/debug data, consultant-only packages, other projects, or commercial/internal fields not explicitly shared.

### 4.3 Authentication

- Staff: email/phone plus password or enterprise identity; multi-factor authentication required for Admin, Accounts, and high-impact approvers.
- Client: email/phone OTP or secure magic link; optional password; step-up verification for sign-off and payment-related actions.
- Session/device management, logout-all-devices, failed-login protection, and revocation.
- Every approval stores authenticated identity, project, object/version, action, timestamp, channel, IP/device metadata where legally permitted, and acceptance text.

---

## 5. Core Project Workflow

V4 retains the complete Studio and Site lifecycle:

```text
Project Setup
  -> Client Discovery Meetings (repeatable)
  -> Preliminary Requirements / Q&A Baseline
  -> Client Sign-off
  -> Pre-design Site-condition Visit and Investigations
  -> Preliminary Concept and Tentative Elevations
  -> Centreline/Grid + Foundation Basis + Column-position Freeze
  -> Structural Consultant Design
  -> Parallel Architectural + Structural + MEP Coordination
  -> All-elevation Client Sign-off / Design Freeze
  -> Progress/Fee Milestone and Payment Gate
  -> Detailed Drawings and Controlled Issue
  -> Site Line-out
  -> Construction-stage Quality Checks and MEP Checks
  -> Civil Completion
  -> Interiors and Selections, including Tiles
  -> Handover and Closeout
```

Each activity supports sequential or parallel dependencies, responsible role, assignee, reviewer, dates, duration, work calendar, templates, evidence, sign-off, payment gate, notifications, reminder/escalation rules, and auto-created next activities.

---

## 6. Visual Dashboard

### 6.1 Required views

The portfolio dashboard must show Studio and Site as distinct but connected tracks for every project. Users can switch among Portfolio Grid, Workflow Timeline, Milestone/Gantt, Calendar, Workload, Map/Site Visits, Review Queue, Client Decisions, and Payment Queue.

Each project card shows:

- Project name, client, Project Architect, location, and current phase.
- Studio traffic light and percentage complete.
- Site traffic light and percentage complete.
- Baseline completion date and current forecast completion date.
- Next three ready/blocked activities.
- Pending client sign-offs and unanswered decisions.
- Next site visit and visit-alert state.
- Open critical issues/non-conformances.
- Earned fee percentage, requested amount, received amount, and overdue payment state.
- Hold badge and reason where applicable.
- AI-generated plain-language summary clearly labeled as AI-generated.

### 6.2 Traffic-light rules

Traffic lights are calculated from rules, not manually chosen colors. The dashboard must also display the reason behind every color so color is never the only signal.

| State | Default rule | Examples |
|---|---|---|
| Green — On track | No blocking item; forecast is within baseline/approved tolerance; no critical overdue item. | Current activity progressing; next dependencies ready. |
| Amber — At risk | Threshold crossed but due date/milestone not yet missed, or a medium/high unresolved dependency threatens forecast. | 75% of allowed duration used with insufficient progress; client response due soon; site visit at risk. |
| Red — Delayed/critical | Due date or approved threshold missed; critical failed check; milestone forecast beyond tolerance; payment/sign-off gate overdue. | Overdue review, critical site issue, missed visit, expired payment gate. |
| Blue — On hold | Authorized project or workstream hold is active. | Client requested hold, statutory hold, commercial hold. |
| Grey — Not started/not applicable | Not released by dependencies or excluded from scope. | Future stage or activity not in this project. |

Default threshold suggestions must be configurable by template. Example: amber when remaining planned time is below 25% and progress is materially below planned; red when the due date is crossed. No threshold is final until Parvez approves it.

### 6.3 Accessibility

Every state includes icon, text, reason, owner, and age in addition to color. Filters include Studio/Site state, project, assignee, client, discipline, milestone, hold, risk, payment, sign-off, and site-visit status.

---

## 7. Date-wise Planning Engine

### 7.1 Start-date scheduling

When an authorized user enters the project start date, SiteFlow calculates tentative start/finish dates for all activities and milestones using:

- Template activity duration.
- Finish-to-start, start-to-start, finish-to-finish, and configurable lag dependencies.
- Parallel activity branches.
- Staff/consultant working calendars, weekends, holidays, and planned leave where visible.
- Earliest-start, fixed-date, not-before, and deadline constraints.
- Client response allowance, review SLA, procurement lead time, and site-visit recurrence.
- Project/workstream holds and approved schedule changes.

The system stores three date sets:

| Date set | Purpose |
|---|---|
| Baseline | Original approved plan; immutable except through authorized re-baseline. |
| Current forecast | Rolling dates recalculated from actual progress, delays, dependency changes, and holds. |
| Actual | Real start, submission, approval, completion, hold, and resume timestamps. |

### 7.2 Schedule propagation

When an activity starts late, finishes early/late, changes duration, is held, or receives a new dependency, the engine recalculates affected successors and milestones. It must show an impact preview before saving: changed activities, old/new dates, milestone shift, fee impact, client commitments, and who will be notified.

Users can choose:

- **Reforecast only:** baseline remains unchanged; variance is visible.
- **Re-baseline:** requires authority, reason, impact approval, and audit history.
- **Absorb delay:** adjust float or selected activities without changing a committed milestone, subject to feasibility.

### 7.3 Threshold and next-activity alerts

- Alert assignee before activity threshold is crossed.
- Alert reviewer when pending review risks its successor.
- Alert Project Architect when a downstream milestone is predicted to miss tolerance.
- Raise site-visit alert when a scheduled/recurring visit is approaching, unconfirmed, missed, or not submitted within the post-visit SLA.
- Show next activity readiness and “why not ready.”
- Suppress ordinary reminders during approved hold, but continue critical safety, statutory, security, and explicitly exempt alerts.

### 7.4 Completion calculation

Activity completion can be manual, checklist-derived, quantity-derived, approval-derived, or AI-suggested. AI suggestions never become official progress until an authorized person confirms them.

Workstream progress uses configurable activity weights:

`Workstream completion = Sum(activity weight x approved activity completion) / Sum(in-scope activity weights)`

Project completion combines Studio and Site through template-defined weights. The dashboard must show both overall completion and the underlying approved activities to avoid a misleading single percentage.

---

## 8. Stage Templates and Calendar Context

### 8.1 Template at every stage

Each workflow activity must have a versioned template that may include:

- Purpose, instructions, responsible role, reviewer, SLA, and dependency guidance.
- Required fields and checklist.
- Required photos/videos/documents/drawings and naming/revision rules.
- Meeting agenda and minutes template.
- Client questions, consultant inputs, and approval text.
- Quality checks, tolerance/measurement fields, and failure actions.
- Notification/reminder/escalation templates by channel and audience.
- Fee milestone percentage or payment rule.
- AI prompt/schema, approved context sources, confidence policy, and human reviewer.

Templates are instantiated using the planned activity date. Later template edits do not silently change an active project's historical template; an authorized migration previews differences and records acceptance.

### 8.2 Google Calendar integration

The initial calendar pilot starts with Parvez. Google Calendar supports creating and updating events, attendee information, and change watching through its API. SiteFlow should request only the minimum required OAuth scopes; Google documents separate scopes for event editing, owned events, and free/busy access.

SiteFlow-created meeting event must include:

- Project code/name and meeting/activity type in title.
- Start/end, location or video link, organizer, attendees, and visibility.
- Current stage, objective, agenda, decision/sign-off needed, and due date.
- Links to SiteFlow project, activity, latest approved drawings/documents, prior minutes, open actions, risks, and checklist.
- Client-safe context only for external attendees.
- Event-to-activity ID for synchronization and audit.

Google Calendar can create events and attach Google Drive files; SiteFlow should primarily link back to permission-controlled project context so revocation and latest-version rules remain under SiteFlow control.

### 8.3 Privacy rules

- Office and project calendars can show shared activities and client demos.
- Personal events remain private by default; SiteFlow should request free/busy access where full details are unnecessary.
- “Busy” can block scheduling without exposing title, attendees, location, or notes.
- The owner may disclose selected details at their discretion.
- Calendar RSVP changes meeting-attendance status only and never approve a design or commercial item.

---

## 9. Project Hold and Resume

An authorized user can place the entire project, Studio workstream, Site workstream, or selected activity on hold.

### 9.1 Mandatory hold data

- Scope of hold.
- Reason category: Client Request, Payment, Statutory/Approval, Design Decision, Site Condition, Safety, Resource, Consultant, Force Majeure, or Other.
- Detailed reason and supporting document/message.
- Requested by, approved by, effective date/time.
- Expected resume date or “unknown.”
- Affected activities/milestones and communication recipients.
- Whether reminders, calendar events, and recurring visits pause, remain, or are cancelled.
- Contract/schedule/fee implications.

### 9.2 Hold behavior

- Dashboard turns blue and displays reason, duration, owner, and next review date.
- Freeze affected schedule clocks and calculate a forecast impact preview.
- Cancel/reschedule only after user confirmation; do not silently remove meetings.
- Preserve safety/statutory alerts and any hold-exempt obligations.
- Send approved hold notification to affected parties.
- Require periodic hold review.
- Resume requires authority, resume date, revised plan, impacted fee/milestone review, and notifications.

---

## 10. Progress-linked Fees and Payments

### 10.1 Fee schedule

The Project Architect/Accounts configures fees as percentages or fixed amounts linked to approved milestones, approved weighted completion, dates, or combinations. The total schedule must validate against the approved contract value and permitted taxes/adjustments.

Example only, requiring Parvez's approval:

| Trigger | Fee action |
|---|---|
| Appointment/project start | Raise agreed mobilization percentage. |
| Preliminary requirement sign-off | Raise configured percentage. |
| All-elevation design freeze | Raise payment needed before detailed drawings; V4 retains configurable 50% upfront option. |
| Detailed drawing issue | Raise configured percentage. |
| Construction/site milestones | Raise based on approved milestone or approved weighted completion, not AI estimate alone. |
| Handover | Raise balance/final milestone. |

### 10.2 Payment request

When a fee trigger is approved, SiteFlow creates a payment request containing request number, client/project, milestone, percentage, amount, tax/fee components, due date, payment instructions/link, supporting invoice/document, contact, and late-reminder policy.

The request can be delivered through:

- Client app/in-app notification.
- Email.
- WhatsApp approved template.
- SMS containing a short secure link and minimal sensitive data.

### 10.3 Payment status

Statuses: Draft, Approved to Send, Sent, Delivered, Viewed, Partially Received, Received Pending Verification, Cleared, Failed, Overdue, Waived, Cancelled, and Refunded/Adjusted where applicable.

Accounts can mark payment received only with amount, date, method, transaction/reference number, evidence, and notes. A second approver is configurable above an amount threshold. A client reply such as “paid” sets **Client Claims Paid** and creates an Accounts verification task; it does not mark the payment Cleared. Future payment-gateway or bank reconciliation can update status through signed webhooks.

### 10.4 Reminder policy

- Personalize tone and context, but use approved templates and quiet hours.
- Stop reminders immediately when Cleared, Waived, Cancelled, disputed/on hold, or manually suppressed by authorized staff.
- Apply frequency caps and escalation levels.
- Never threaten, shame, or expose payment information in group messages.
- Record generated text, approver, channel, delivery status, reply, and stop condition.


## 11. Omnichannel Integration

### 11.1 Channel matrix

| Channel | Staff use | Client use | Inbound behavior |
|---|---|---|---|
| In-app/push | Assignments, site alerts, reviews, escalations. | Project updates, sign-offs, payment requests. | Authenticated app action updates workflow immediately. |
| WhatsApp | Selected urgent/project notifications. | Sign-off/payment links, meeting reminders, approved updates. | Webhook records reply and routes it to a decision parser or human review. |
| SMS | Time-sensitive fallback and OTP/deep links. | Reminder/fallback when consented. | Reply is captured where provider/number supports it; ambiguous text routes to staff. |
| Email | Formal notifications, documents, minutes, transmittals. | Sign-off/payment requests and formal communications. | Reply ingestion associates email to project/request and proposes action for review. |
| Google Calendar | Meetings, site visits, review slots, deadlines. | Client demos and invited meetings. | RSVP changes attendance only; calendar event does not approve workflow objects. |

WhatsApp business-initiated notifications outside the customer-service window require pre-approved message templates; inbound messages can be delivered to SiteFlow through webhooks. Messaging status callbacks can track lifecycle states such as sent, delivered, undelivered, and—in supported WhatsApp flows—read.

### 11.2 Integration event model

All integrations use a normalized event envelope:

- Integration provider and channel.
- Organization/project/user/request correlation IDs.
- Provider message/event ID.
- Event type, provider timestamp, received timestamp, and processing status.
- Signed payload hash and verified webhook status.
- Retry count, dead-letter status, and reconciliation status.
- Link to notification, approval request, payment request, meeting, or activity.

Inbound handlers must verify provider signatures, be idempotent, ignore replayed events, retain original payloads under policy, and never trust message text as an authorized action without identity and version validation.

### 11.3 Email response handling

For connected Gmail accounts, Gmail push notifications use Cloud Pub/Sub and mailbox watches; watches expire and must be renewed at least every seven days, with daily renewal recommended by Google.

- Use a unique reply-to token or signed request identifier for each sign-off/payment request.
- Associate the email thread with one project and exact object version.
- Classify response as Approve, Reject, Question, Paid Claim, Unclear, or Other.
- For permitted low-risk sign-offs, send a secure confirmation link to complete the authenticated action.
- For high-impact sign-offs, always require authenticated SiteFlow confirmation.
- Never auto-approve from forwarded emails, ambiguous replies, group threads, or unknown addresses.

### 11.4 WhatsApp/SMS response handling

- Approved structured replies may use buttons such as Review, Approve, Request Changes, View Payment, and Contact Accounts.
- The action opens a signed, expiring deep link to the exact version and requires OTP/login where policy demands.
- Plain text is classified and presented to a staff reviewer unless the sign-off policy explicitly permits a low-risk structured confirmation.
- Delivery/read status updates communication status only.
- Client “paid” response creates verification workflow, not payment clearance.

### 11.4A Channel-reply approval policy

The requirement is that a client or staff reply from WhatsApp or email can mark an item approved and move the workflow to the next step. SiteFlow supports this, controlled per sign-off type:

| Reply method | Can complete approval? | Conditions |
|---|---|---|
| In-app Approve (logged in) | Yes, for all sign-off types | Authenticated user with authority over the exact version. |
| Secure deep link opened from WhatsApp, SMS, email, or calendar event | Yes, for all sign-off types | Signed, expiring link to the exact version; OTP step-up when the policy requires it. |
| WhatsApp interactive **Approve** button | Yes, only for sign-off types Parvez enables | Reply comes from the registered, verified number of the named approver; button payload carries the request token and version hash; request not expired or superseded. |
| Email reply containing **APPROVE** | Yes, only for sign-off types Parvez enables | Reply from the verified approver address, on the original thread with the unique reply-to token; not forwarded, not a group thread; version still current. |
| Free-text WhatsApp, SMS, or email ("ok", "fine", emoji) | No | Classified and shown to staff, who can send the approver a secure link to confirm. |
| Google Calendar RSVP | No | Attendance only. The event description carries the secure approval link instead. |

When a channel reply completes an approval, SiteFlow:

1. Records the channel, sender identity, provider message ID, raw reply, request token, and version hash.
2. Sends an approval receipt back on the same channel and by email.
3. Releases the configured successor activities, exactly as an in-app approval does.
4. Allows the approver to revoke within a configurable window (to be set by Parvez) before downstream work starts.

Recommended starting policy: channel-button and email-keyword approval enabled for low-risk items (meeting minutes acknowledgement, tile or selection choice, demo feedback); secure deep link required for requirement baseline, elevation freeze, change requests, and handover.

### 11.5 Calendar response handling

Google Calendar can create, update, list, and watch event resources. RSVP Accepted/Declined/Tentative updates meeting attendance and may generate rescheduling actions; it cannot complete a project approval, payment, site checklist, or sign-off.

---

## 12. Sign-off Service

### 12.1 Sign-off request

Every sign-off request includes:

- Sign-off type and legal/business significance.
- Exact object and immutable version hash.
- Human-readable summary, changes since prior version, and consequences of approval.
- All documents/drawings in the package.
- Approver identity/authority and due date.
- Approve, Request Changes, Reject, Ask Question actions.
- Required acknowledgement text and optional/mandatory comment.
- Expiry, reminder policy, and escalation.

### 12.2 Workflow rules

- Sign-off can be initiated through app, email, WhatsApp, or SMS, but the authoritative action occurs in the authenticated sign-off service.
- The system records consent text, identity, version, timestamp, device/session, and channel.
- Any package revision invalidates pending sign-off links and creates a new request.
- Approval releases configured next activities; rejection/rework returns to the named owner.
- Client-accessible evidence and final approval receipt remain downloadable.

---

## 13. AI Site Intelligence

### 13.1 Capture pipeline

When staff captures or uploads a site photo/video/voice note, SiteFlow must:

1. Capture server receipt time and, when permission is granted, device capture time, GPS coordinates, accuracy, device/user, project/site, visit, and activity.
2. Preserve original media and create processing derivatives without overwriting the original.
3. Calculate a cryptographic hash and retain provenance metadata. C2PA Content Credentials are designed to hold cryptographically verifiable provenance and tamper-evident assertions for media, so C2PA-compatible capture is a recommended enhancement where devices/tooling support it.
4. Extract technical metadata, sample video frames, separate audio, and run transcription.
5. Detect low quality, blur, duplicate/near-duplicate media, missing coverage, and wrong/uncertain site association.
6. Produce suggested tags, visible conditions, quantities only where reliable, possible issues, and confidence.
7. Compare with the previous approved visit and applicable checklist/report.
8. Build a draft site summary and mismatch list for human review.

GPS and device timestamps are evidence attributes, not absolute proof. The app must record accuracy and capture source, flag manual edits, distinguish camera capture from gallery upload, and avoid claiming authenticity solely from metadata.

### 13.2 Video and notes

OpenAI's open-source Whisper can perform multilingual speech recognition, translation, and language identification, making it an option for local/private transcription evaluation. V4 should support a pluggable transcription service so the practice can choose managed or self-hosted processing.

Video pipeline:

- Preserve the original.
- Extract audio transcript with timestamps and speakers where feasible.
- Select representative and change-relevant frames.
- Link transcript statements to timecodes and frames.
- Identify potential safety/quality/sequence issues with confidence and evidence.
- Require reviewer confirmation before an observation becomes an issue/non-conformance.

### 13.3 Previous-visit comparison

Comparison is valid only after media is aligned by project, location/zone, viewpoint/area tags, and construction stage. The AI must distinguish:

- New work visible.
- Previously visible work still unchanged.
- Previously reported issue apparently resolved, still visible, or not observable.
- New potential issue.
- Incomparable evidence due to angle, lighting, obstruction, stage, or insufficient image quality.

The system must not manufacture a numeric progress percentage from unmatched imagery. Visual progress is **AI Suggested** until the Site Engineer/Project Architect confirms it against checklist/quantity evidence.

### 13.4 Image/report side-by-side review

Reviewer screen must provide:

- Current and previous media synchronized by area/stage.
- AI annotations/regions and issue list with confidence.
- Submitted report/checklist on the opposite panel.
- Mismatch categories: visible but not reported; reported but not evidenced; contradictory status; location/time discrepancy; duplicate/old media; and uncertain.
- Source frame/timecode, extracted transcript, relevant drawing/checklist link, and AI reasoning summary.
- Accept, Edit, Dismiss, Create Issue, Request Evidence, and Request Rework actions.
- Mandatory human disposition for critical/high-confidence mismatches before approval.

### 13.5 AI safety boundaries

- No AI structural adequacy determination.
- No autonomous “safe to pour,” conceal, energize, occupy, or construct decision.
- No face identification or worker productivity scoring.
- No client/private calendar information in site-model context unless necessary and authorized.
- No training on client/project media without an approved data-use policy.

---

## 14. AI Dashboard and Actions

### 14.1 Project summary

For each project, AI generates a concise, permission-filtered summary:

- What changed since the last summary.
- Studio and Site status with reasons.
- Approved progress versus planned progress.
- Decisions/sign-offs/payments awaiting action.
- Key site observations and unresolved mismatches.
- Forecast milestone impact and immediate next actions.
- Links to source records for every substantive statement.

The summary displays generation time, source cutoff, confidence/limitations, and “AI-generated—verify before action.”

### 14.2 Portfolio action center

- Projects most likely to miss milestone.
- Site visits overdue or lacking submitted reports.
- High-risk report/media mismatches.
- Approval/payment bottlenecks.
- Projects on hold and upcoming hold-review dates.
- Staff/reviewer workload concentration.
- Draft interventions for Parvez to approve.

### 14.3 Personalized payment and sign-off reminders

AI may tailor an approved template using client name, language preference, project, exact milestone/version, due date, prior communications, and selected tone. It must not invent promises, penalties, amounts, status, or concessions.

Automated sequence requires:

- Client consent and valid channel.
- Approved base templates.
- Frequency cap, quiet hours, escalation path, and stop conditions.
- Human approval for first send and policy changes; later sends may be automatic if the approved campaign permits.
- Immediate stop on payment clearance, sign-off, dispute, hold, opt-out, wrong recipient, or manual suppression.
- Full generation, approval, delivery, reply, and outcome audit.

---

## 15. Project Second Brain

### 15.1 Recommended approach

Do not start by training a foundation model on 20 projects. Start with a governed project knowledge system and retrieval-augmented generation (RAG), because most value comes from finding the correct, latest, permission-appropriate project evidence. PostgreSQL can be extended with pgvector to store vectors alongside relational project data and support exact or approximate similarity search.

The second brain consists of:

1. **System of record:** structured workflow, dates, approvals, checklists, issues, payments, and audit events.
2. **Document/media lake:** original files, drawings, photos, videos, transcripts, and revisions.
3. **Knowledge graph:** people, projects, activities, decisions, requirements, drawing revisions, issues, areas, milestones, and dependencies.
4. **Search index/vector store:** chunked approved content with project, discipline, stage, revision, validity, and permission metadata.
5. **Retrieval layer:** hybrid keyword/vector/relational retrieval with access control before and after retrieval.
6. **Model gateway:** pluggable cloud or self-hosted language, vision, speech, and embedding models.
7. **Evaluation and audit:** gold questions, source correctness, hallucination rate, permission leakage tests, latency, cost, and user feedback.

### 15.2 Data preparation

- Classify each record as Public-to-client, Project Team, Discipline Restricted, Commercial Restricted, Personal, or AI Prohibited.
- Clean OCR/transcripts and preserve original source.
- Remove duplicates and identify superseded drawings/documents.
- Chunk by semantic unit while preserving project, date, stage, discipline, revision, and approval state.
- Exclude personal calendar details and unrelated client data.
- Obtain data-use rights and consent before model training.
- Create expert-reviewed question/answer, classification, extraction, and drafting examples.

### 15.3 Fine-tuning open-source models

Fine-tuning should begin only after RAG quality is measured and enough expert-reviewed examples exist. Parameter-efficient fine-tuning such as LoRA freezes the base model and trains smaller low-rank update matrices, reducing trainable parameters and memory needs compared with full fine-tuning.

Recommended training targets:

- Company terminology and classification.
- Requirement/action/decision extraction.
- Site issue taxonomy and report formatting.
- Communication tone and structured JSON output.
- Project-stage recommendation ranking.

Do not fine-tune factual project memory into model weights; project facts change and should come from current retrieval. Keep client-specific adapters/data isolated, version datasets/models, and maintain hold-out evaluation sets.

### 15.4 Deployment gates

- Offline evaluation against expert-labeled cases.
- Permission leakage and prompt-injection testing.
- Shadow mode with no user-visible actions.
- Copilot mode with mandatory human approval.
- Limited automation only for reversible, low-risk actions under explicit policy.
- Continuous monitoring for accuracy, drift, latency, cost, bias, and overrides.

NIST's AI risk guidance emphasizes clearly defined human roles and responsibilities in decision-making and oversight; V4 therefore assigns every AI output an accountable human reviewer and escalation route.

---

## 16. AI Generation by Workflow Stage

AI can assist at every stage, but “generate” means **draft, analyze, retrieve, check, or recommend**. Responsibility remains with qualified professionals.

| Stage/output | Permitted AI assistance | Required validation / prohibited action |
|---|---|---|
| Project plan and date plan | Draft activity graph, durations from approved templates, dependencies, risk register, meeting plan. | Project Architect approves scope, dates, resources, and commitments. |
| Client discovery | Transcribe/summarize meetings, extract requirements/actions/decisions, propose follow-up questions. | User confirms speaker intent and client record. |
| Preliminary requirements/Q&A baseline | Draft baseline, identify missing/contradictory answers, compare revisions, prepare sign-off pack. | Architect approves; client signs exact version. |
| Site-condition assessment | Summarize evidence, tag conditions, compare visits, propose investigations. | Site/Project Architect and relevant consultant verify; AI cannot diagnose soil/structure. |
| Concept/elevations | Generate briefs, option narratives, schedules, presentation text, and visual concept aids. | Architect owns design; outputs marked preliminary and not for construction. |
| Centreline/foundation/column plans | Retrieve constraints, overlay/check coordination inputs, propose draft geometry/checklist and clashes. | Architect and Structural Engineer create/verify final engineering inputs; no autonomous sign-off. |
| Preliminary structural drawings | Generate annotations, schedules, repetitive details, code/check lists, clash candidates from approved calculations/model inputs. | Structural Engineer performs design/calculation/code review and signs; AI is not Engineer of Record. |
| MEP coordination | Extract routes/openings, compare discipline models/drawings, flag potential clashes, draft RFIs. | MEP/structural/architect teams resolve and approve. |
| Detailed drawings | Draft notes, sheet lists, labels, schedules, revision summaries, consistency checks. | Responsible professional validates dimensions, constructability, compliance, and issue status. |
| Site QA | Compare evidence/checklist/report, suggest defects, progress, and follow-up. | Authorized reviewer determines pass/fail and releases construction hold points. |
| Fees/communications | Draft milestone explanation, invoice/request text, reminders, and response classification. | Accounts verifies amount/status; authorized user approves policy and exceptions. |
| Handover | Assemble index, summarize snags, detect missing records, draft handover pack. | Project team verifies completeness and client signs handover. |

### 16.1 CAD/BIM integration roadmap

- **Level 1:** Document intelligence over PDF/image drawings: OCR, title-block metadata, revision comparison, markup suggestions, and sheet checks.
- **Level 2:** CAD/BIM metadata connector: read model properties, sheets, levels, rooms, objects, issue IDs, and exported clash reports.
- **Level 3:** Controlled draft generation using approved parametric rules/families and sandboxed model copies.
- **Level 4:** Agentic coordination that proposes edits/RFIs but cannot publish, overwrite, sign, or issue without professional approval.

---

## 17. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| V4-FR-001 | Deliver responsive web plus signed Android pilot APK and production AAB. | Must |
| V4-FR-002 | Provide distinct Staff and Client login experiences and permissions. | Must |
| V4-FR-003 | Show Studio/Site workflow progress, percentage, traffic light, reason, and next action. | Must |
| V4-FR-004 | Generate a tentative date-wise plan from project start date, dependencies, durations, calendars, and milestones. | Must |
| V4-FR-005 | Preserve baseline/current forecast/actual dates and preview downstream impacts before update. | Must |
| V4-FR-006 | Raise threshold, successor-risk, milestone-risk, and site-visit alerts. | Must |
| V4-FR-007 | Configure/version templates, checklists, evidence, communications, fee rules, and AI schemas per activity. | Must |
| V4-FR-008 | Integrate Parvez's Google Calendar first, then opt-in staff/client calendars with minimum scopes. | Must |
| V4-FR-009 | Add project context and permission-controlled links to generated meeting events. | Must |
| V4-FR-010 | Hold/resume project, workstream, or activity with reason, impact, review date, and audit. | Must |
| V4-FR-011 | Configure fee percentages/fixed amounts against milestones or approved progress. | Must |
| V4-FR-012 | Raise and deliver payment requests via app, email, WhatsApp, and SMS. | Must |
| V4-FR-013 | Record payment received/cleared with authorization, amount, reference, evidence, and optional dual approval. | Must |
| V4-FR-014 | Send multichannel notifications and reconcile delivery/read/failure status. | Must |
| V4-FR-015 | Ingest inbound channel replies and route authenticated, unambiguous actions or human review. | Must |
| V4-FR-016 | Complete client sign-off against an immutable version through secure app/deep-link flow. | Must |
| V4-FR-017 | Capture media with timestamp/GPS/source/accuracy and immutable original/hash. | Must |
| V4-FR-018 | Transcribe/analyze media/notes and compare with previous approved visit. | Must, staged rollout |
| V4-FR-019 | Provide side-by-side media/report comparison with mismatch disposition. | Must, staged rollout |
| V4-FR-020 | Generate permission-aware project/portfolio summaries with evidence links and action alerts. | Must, staged rollout |
| V4-FR-021 | Personalize approved payment/sign-off reminders with frequency caps and stop conditions. | Must, staged rollout |
| V4-FR-022 | Build a permission-aware RAG second brain before model fine-tuning. | Must for AI foundation |
| V4-FR-023 | Support evaluated, versioned PEFT/LoRA adapters for narrow approved tasks when data is sufficient. | Later |
| V4-FR-024 | Provide stage-specific AI copilots while prohibiting autonomous professional approvals/releases. | Must |
| V4-FR-025 | Audit every external message, AI output/action, approval, payment update, schedule change, and data access. | Must |
| V4-FR-026 | Allow verified WhatsApp button replies and tokenized email replies to complete approval for sign-off types enabled by policy, then release successors and send a receipt. | Must |
| V4-FR-027 | Push notifications to staff and clients through app, WhatsApp, SMS, email, and Google Calendar according to each person's consent and channel preferences. | Must |

---

## 18. Data Model Additions

V4 adds these entities to the earlier core model:

- ProjectSchedule, ScheduleBaseline, ActivityForecast, WorkingCalendar, Holiday, Constraint, Lag, Float, ThresholdRule.
- ProgressSnapshot, ProgressEvidence, WorkstreamHealth, TrafficLightReason.
- Hold, HoldImpact, HoldReview, ResumeDecision.
- FeeAgreement, FeeMilestone, PaymentRequest, PaymentTransactionClaim, PaymentVerification, PaymentReminderCampaign.
- IntegrationAccount, OAuthGrant, ChannelConsent, MessageTemplate, OutboundMessage, InboundMessage, DeliveryEvent, WebhookEvent, DeadLetter.
- CalendarLink, ExternalEvent, RSVPEvent, EventContextSnapshot.
- SignOffPackage, SignOffRequest, SignOffAction, VersionHash, ApprovalReceipt.
- MediaOriginal, MediaDerivative, CaptureMetadata, MediaHash, Transcript, VideoFrame, AIObservation, VisitComparison, ReportMismatch, HumanDisposition.
- KnowledgeDocument, KnowledgeChunk, Embedding, EntityLink, RetrievalTrace, AIModel, ModelVersion, PromptVersion, AIExecution, AIFeedback, EvaluationDataset, EvaluationRun.

---

## 19. Non-functional Requirements

### 19.1 Security and privacy

- Server-side RBAC, project membership, client publication rules, and field-level controls.
- Encryption in transit and at rest; time-limited object-storage access.
- Secrets in a managed vault; OAuth tokens encrypted and revocable.
- Webhook signature verification, replay protection, idempotency, allowlists where supported, and rate limits.
- Immutable audit log and version hashes for sign-offs/evidence.
- Data minimization for SMS/WhatsApp; secure links instead of sensitive message content.
- AI retrieval must enforce authorization before retrieval and before response.
- Client data isolation and prohibition on cross-client retrieval/training without explicit authorization.

### 19.2 Reliability

- Retry queues with exponential backoff for integrations.
- Dead-letter queue and administrative replay after correction.
- Daily reconciliation of external message status; callback-based messaging should still be reconciled because callbacks can be missed.
- Calendar and email watch renewal monitoring.
- No duplicate payments, sign-offs, messages, activities, or schedule updates from repeated webhooks.
- Local mobile drafts and resumable media uploads.

### 19.3 Performance

- Portfolio useful view target within 3 seconds under agreed pilot load.
- Activity view target within 2 seconds excluding large-media transfer.
- Background AI processing with status/progress; core site submission must remain possible if AI is unavailable.
- Paginated search and dashboard performance for 20 active projects plus archive.

### 19.4 Accessibility and explainability

- Never rely on traffic-light color alone.
- All AI summaries and alerts show source links, generation time, and user feedback actions.
- Plain-language client text with configurable language.
- Large mobile touch targets and low-bandwidth mode.

---

## 20. Acceptance Scenarios

### 20.1 Android and login

- A signed APK installs on approved pilot Android devices.
- Staff login displays staff workspace; client login displays only explicitly shared client records.
- A client cannot access internal notes or another project through URL manipulation/API calls.
- Production build generates a signed AAB for Play distribution.

### 20.2 Dashboard and planning

- Creating a project from a start date calculates every activity/milestone across parallel dependencies and working calendars.
- Delaying an activity previews affected dates and changes current forecast without altering baseline.
- Studio/Site cards show correct traffic light, textual reason, percentage, owner, and next action.
- Crossing a site-visit threshold raises an alert to the correct assignee/escalation path.

### 20.3 Templates and calendar

- Each activity instantiates the correct template version and planned date.
- A Parvez meeting creates/updates a Google Calendar event containing client-safe project context links.
- A private appointment exposes only busy/free to permitted scheduling users.
- Calendar acceptance updates attendance but cannot approve a drawing/sign-off.

### 20.4 Hold

- Client Request Hold turns project/workstream blue, stores reason/evidence, pauses configured activities/reminders, preserves exempt alerts, and shows schedule impact.
- Resume requires approval and creates a revised forecast plus notifications.

### 20.5 Fees and payments

- An approved progress/milestone trigger creates the configured percentage fee request.
- Client receives app/email/WhatsApp/SMS notices according to consent and policy.
- A “paid” reply creates a verification task; only authorized Accounts action marks Cleared.
- Payment reminders stop after clearance or dispute/hold.

### 20.6 Sign-offs and replies

- Email/WhatsApp/SMS directs the client to the exact immutable sign-off package.
- A revised package invalidates the old link.
- Authenticated approval releases the correct successor; ambiguous free-text reply does not.
- A WhatsApp Approve button reply from the verified approver, for a sign-off type enabled by policy, marks the item approved, releases the next activity, and sends a receipt.
- The same button reply from an unregistered number, or after the package is revised, does not approve and is routed to staff.
- An email reply with APPROVE on the original tokenized thread approves an enabled sign-off type; a forwarded copy does not.

### 20.7 Site AI

- New capture stores original, hash, server time, device time/source, GPS/accuracy where permitted, visit, activity, and uploader.
- Video transcript links text to timecodes/frames.
- Comparison aligns current/previous evidence and clearly labels incomparable content.
- Side-by-side reviewer can accept/edit/dismiss mismatch or create issue/rework.
- AI outage does not block manual capture and submission.

### 20.8 Second brain and generation

- User asks a project question and receives an answer only from authorized, current records with links to sources.
- Superseded drawing is not presented as current without warning.
- Permission-leak tests return no restricted content.
- AI draft plan/baseline/drawing assistance cannot be issued or approved without the configured professional review.

---

## 21. Delivery Roadmap

### Release V4.1 — Mobile, dashboard, and planning

- Android Staff application pilot APK; production AAB pipeline.
- Staff/client authentication and role-aware shells.
- Studio/Site traffic-light dashboard.
- Baseline/current/actual scheduling engine, thresholds, and site alerts.
- Stage templates and activity calendar.
- Project hold/resume.

### Release V4.2 — Client, calendar, fees, and channels

- Client app/portal experience.
- Google Calendar pilot with Parvez, then controlled rollout.
- Progress-linked fee milestones, payment requests, manual receipt verification.
- Email, WhatsApp, SMS, push/in-app delivery and reconciliation.
- Secure sign-off service, inbound reply routing, and reminders.

### Release V4.3 — AI site intelligence

- Capture provenance, transcription, frame extraction, quality checks.
- Previous-visit comparison and AI-suggested progress/issues.
- Side-by-side report mismatch review.
- Project/portfolio summaries and action alerts.
- Personalized governed reminders.

### Release V4.4 — Second brain and design copilots

- Document/media ingestion, hybrid search, knowledge graph, RAG assistant.
- Evaluation harness, model gateway, security tests, audit, and feedback.
- Stage-specific planning/requirements/document/drawing copilots.
- CAD/BIM metadata connectors and controlled draft-generation experiments.
- Fine-tuning/LoRA only after evaluation supports a defined use case.

---

## 22. Decisions Required from Parvez

| ID | Decision |
|---|---|
| V4-D01 | One Android app with role-aware Staff/Client modes, or two separately branded apps? Recommended: one app for pilot, revisit after client UX testing. |
| V4-D02 | Minimum Android OS/device list and whether Play Store, managed distribution, or direct APK is required for pilot. |
| V4-D03 | Approve Studio/Site activity weights and traffic-light thresholds. |
| V4-D04 | Approve template durations, workweek/holidays, dependency types, client-response allowances, float, and re-baseline authority. |
| V4-D05 | Define site-visit frequency, confirmation, missed-visit, and report-submission alert thresholds. |
| V4-D06 | Approve what project context appears in Parvez's calendar and what remains a secure link. |
| V4-D07 | Define project-hold authorities, reminder exceptions, hold-review frequency, and contractual schedule treatment. |
| V4-D08 | Approve fee milestones/percentages, tax basis, payment due rules, partial payments, and release gates. |
| V4-D09 | Choose payment collection instructions/provider and who can mark Received versus Cleared. |
| V4-D10 | Approve WhatsApp/SMS provider, sender numbers, consent wording, templates, quiet hours, and reminder frequency. |
| V4-D11 | Decide which sign-off types permit WhatsApp button or email keyword approval (section 11.4A), and the revoke window. Recommended: low-risk items only; secure deep link for baseline, elevation freeze, change requests, and handover. |
| V4-D12 | Approve media retention, GPS consent, voice transcription consent, AI processing location, and client data-use policy. |
| V4-D13 | Define progress ground truth: checklist weights, quantities, professional estimate, or combined method by stage. |
| V4-D14 | Nominate professional reviewers and prohibited AI actions for Architecture, Structural, MEP, Site QA, Accounts, and client communication. |
| V4-D15 | Select self-hosted versus managed model policy, infrastructure budget, and data residency requirement. |
| V4-D16 | Select 2–3 pilot projects and representative staff/client users. |

---

## 23. Requirements Traceability

| New requirement | V4 response |
|---|---|
| Android APK; Staff and Client login | Sections 1, 4, 17, 20, 21. Pilot APK plus Play AAB; separate role experiences. |
| Visual Studio/Site traffic-light dashboard | Section 6 with calculated Green/Amber/Red/Blue/Grey rules and reasons. |
| Start-date-based tentative plan | Section 7 with dependencies, calendars, baseline/forecast/actual dates, propagation, and alerts. |
| Templates and calendar integration starting with Parvez | Section 8 with stage templates, project context, least-privilege Google Calendar integration. |
| Project on hold with reason | Section 9 with hold scope, reason, impact, pause/exemption, review, and resume. |
| Completion-based fee percentages | Section 10 with configurable percentage/fixed milestones and approved-progress triggers. |
| App/email/WhatsApp/SMS payment requests | Sections 10–11 with consent, delivery tracking, inbound reply and stop rules. |
| Mark payment received | Section 10.3; authorized evidence-backed action and distinction from client “paid” claim. |
| Sign-off through channels and move next | Sections 11–12 and 11.4A; verified WhatsApp button or tokenized email reply, or secure link, approves the exact version and triggers the successor. |
| Photo/video/note analysis and previous-visit comparison | Section 13. |
| Timestamp/GPS, transcript, issues, report mismatch | Sections 13.1–13.4 with provenance and side-by-side review. |
| AI progress/dashboard summaries and action alerts | Section 14. |
| Personalized payment/sign-off reminders | Section 14.3 with approved templates, caps, and stop conditions. |
| Own open-source model/second brain | Section 15: governed RAG first, then narrow evaluated LoRA fine-tuning. |
| AI generation at every stage | Section 16 with permitted assistance and mandatory professional validation. |

---

## 24. Recommended Immediate Actions

1. Approve V4-D01 through V4-D07 in a product workshop.
2. Map every existing workflow stage to duration, dependencies, weight, responsible role, reviewer, checklist, meeting template, fee rule, and alert threshold.
3. Prototype three screens first: portfolio traffic-light dashboard, start-date plan/impact preview, and site AI side-by-side review.
4. Register Android package/signing ownership under TAN GLOBUS AI or the agreed legal entity; never leave production signing tied to an individual developer.
5. Configure a Google Cloud test project and connect only Parvez's test calendar using minimum required scopes.
6. Select WhatsApp/SMS/email providers and confirm consent/templates before building reply automation.
7. Define immutable sign-off and payment-verification policies before channel integrations.
8. Establish an AI evaluation set from expert-reviewed historical meetings, site visits, reports, issues, and document revisions before model selection or fine-tuning.

---

## 25. Technical References

Inline citation markers from the earlier draft were removed. The technical statements in this PRD rely on these public sources, which the delivery team must re-check at build time because platform rules change:

- Android App Bundle and Play publishing — https://developer.android.com/guide/app-bundle
- Capacitor Android and native plugins — https://capacitorjs.com/docs/android
- Google Calendar API events, push notifications, and OAuth scopes — https://developers.google.com/calendar/api/guides/overview
- Gmail push notifications and watch renewal — https://developers.google.com/gmail/api/guides/push
- WhatsApp Business Platform message templates and webhooks — https://developers.facebook.com/docs/whatsapp
- OpenAI Whisper speech recognition — https://github.com/openai/whisper
- pgvector for PostgreSQL — https://github.com/pgvector/pgvector
- LoRA: Low-Rank Adaptation of Large Language Models — https://arxiv.org/abs/2106.09685
- C2PA content provenance — https://c2pa.org
- NIST AI Risk Management Framework — https://www.nist.gov/itl/ai-risk-management-framework

For SMS to Indian numbers, sender ID and message templates must be registered on the telecom DLT platform before sending; confirm with the chosen SMS provider under V4-D10.

---

## 26. Approval Record

| Role | Name | Decision | Date | Comments |
|---|---|---|---|---|
| Business owner | Architect Parvez | Pending |  |  |
| Product / Delivery | TAN GLOBUS AI | Pending |  |  |
| Architecture representative |  | Pending |  |  |
| Structural representative |  | Pending |  |  |
| Site/Civil representative |  | Pending |  |  |
| Accounts representative |  | Pending |  |  |
| Data protection / security |  | Pending |  |  |