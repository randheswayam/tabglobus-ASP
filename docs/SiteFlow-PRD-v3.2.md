# SiteFlow Architecture Workflow Automation

## Updated Product Requirements Document

**Prepared for:** Architect Parvez and TAN GLOBUS AI  
**Product:** SiteFlow — mobile and web workflow platform  
**Document version:** 3.2  
**Date:** 28 September 2026  
**Status:** Draft for stakeholder sign-off  
**Supersedes:** SiteFlow MVP Implementation Plan dated 27 September 2026  
**Updated from:** SiteFlow PRD v2.0 + Parvez workflow discussion/requirements supplied on 27 September 2026  
**Companion document:** SiteFlow PRD V4 (separate) specifies the V4 enhancements: Android Staff and Client login, traffic-light dashboard, date-driven planning, stage templates with Google Calendar context, project hold, progress-linked fees, omnichannel notifications and approvals, and AI. This v3.2 document remains the core workflow baseline.  
**Source note:** The supplied GoToMeeting transcript link could not be retrieved (the site blocks automated access). All requirements explicitly supplied in the architect's written notes are incorporated. Any transcript-only points must be added after a manual review of the transcript.

---

## 1. Executive Summary

SiteFlow will manage the complete architecture-project lifecycle across **Studio** and **Site** workstreams. It must support approximately 20 concurrent projects, repeated client requirement meetings, versioned approvals, site-condition assessment, architectural and structural coordination, construction-quality checks, interiors, milestone-based fees, notifications, calendar privacy, and controlled client communication.

The earlier three-step MVP is expanded into a configurable but controlled residential workflow. The workflow engine must support sequential gates, parallel activities, rework loops, mandatory checklists, evidence upload, digital sign-off, delay escalation, and automatic creation of downstream activities. Mobile is optimized for site capture; web is optimized for configuration, project control, review, documents, dashboards, and administration.

Phase 1 provides deterministic workflow automation: people remain responsible for decisions and sign-offs. Phase 2 adds WhatsApp and an AI agent for intelligent note capture, meeting/site-visit summaries, missing-information detection, drawing/document understanding, risk alerts, and next-step recommendations. AI output must remain reviewable and must never replace contractual, design, structural, commercial, or client approvals.

### 1.1 Key product outcomes

- One source of truth for studio, consultant, client, site, civil, MEP, interior, and account activities.
- Clear visibility across 20 or more active projects without relying on verbal updates.
- No detailed drawing release before the required elevation sign-off and configurable payment gate.
- No stage completion without its checklist, evidence, reviewer action, and audit record.
- Controlled design changes after freeze, including cost and schedule impact approval.
- Privacy-safe calendars: office events can be shared while personal details stay private unless the owner chooses otherwise.

---

## 2. Background and Problem

The architecture practice currently coordinates many activities through meetings, verbal instructions, private calendars, messages, drawings, and site visits. Multiple client meetings may occur before requirements stabilize. Elevations and structural assumptions can remain tentative while site conditions—such as a well, black cotton soil, or the need for an outstation test pit—materially affect design decisions.

With around 20 projects, the practice needs explicit dependencies and gates. Foundation and column positions must be frozen and signed off before structural work proceeds. All elevations require client sign-off to prevent uncontrolled changes. Detailed drawings must not start or be issued before the configured commercial milestone, initially proposed as 50% upfront fees. During construction, critical checks such as line-out, diagonal measurements, formwork, reinforcement cover, and exposed steel must be recorded instead of confirmed verbally.

The current MVP document limits scope to Legal Approval, Site Visit, and Team Lead Review. This PRD replaces that narrow flow with an end-to-end project workflow while preserving mobile evidence capture, mandatory-field validation, review/rework, role-based access, red flags, notifications, and audit history.

---

## 3. Goals and Boundaries

### 3.1 Phase 1 goals

1. Configure reusable workflow templates for residential architecture projects.
2. Run Studio and Site workstreams with dependencies, parallel branches, hold points, sign-offs, and rework.
3. Record every client meeting and consolidate evolving requirements into a controlled requirement baseline.
4. Capture site conditions and investigations before design freeze.
5. Coordinate architect, structural consultant, civil/site team, MEP, interiors, accounts, client, and reviewers.
6. Enforce architectural, structural, quality, client, and commercial gates.
7. Manage tasks, documents, drawings, revisions, checklists, photos, videos, comments, decisions, and approvals.
8. Provide portfolio visibility for at least 20 concurrent projects.
9. Support office-shared and private-personal calendars with owner-controlled disclosure.
10. Generate reminders, escalations, meetings, client communication drafts, and payment-readiness milestones.

### 3.2 Phase 2 goals

Phase 2 scope is now detailed in the separate SiteFlow PRD V4. Where V4 specifies a capability listed below, V4 governs that capability.

- WhatsApp messaging through approved templates and linked project conversations.
- AI-assisted notes for client meetings and site visits.
- AI detection of missing data and inconsistent project records.
- AI extraction and understanding of photos, documents, and drawing metadata.
- Delay-risk alerts and next-best-action recommendations.
- Conversational project assistant with strict authorization and human approval.

### 3.3 Non-goals for initial release

- Authoring CAD/BIM models inside SiteFlow.
- Replacing structural design or professional engineering judgment.
- Autonomous approval, client sign-off, payment confirmation, or drawing issue.
- Full accounting or ERP; SiteFlow creates payment milestones and can integrate later.
- Public client portal in the first pilot unless separately approved.
- Monitoring or exposing private employee calendar details without consent.

---

## 4. Assumptions and Terminology

| Term | Working interpretation for this PRD |
|---|---|
| Studio | Requirement gathering, concept and architectural design, coordination, drawing production, client meetings, and review activities. |
| Site | Site investigation, line-out, execution checks, quality checks, media capture, issue closure, civil work, interiors, and handover. |
| SCon / Structural consultant | External or internal structural engineering consultant. |
| Centerline / central line / line-out | The approved grid and physical setting-out reference used to position walls, columns, and foundations. Final terminology requires Parvez's confirmation. |
| Freeze | A versioned baseline that cannot be changed without a formal change request. |
| Sign-off | Named approval of a specific version, with timestamp, comments, and evidence. |
| Payment gate | A configurable rule that blocks an activity until accounts records the required status. Initial rule: 50% upfront fee before detailed drawings. |
| Client demo | A client-facing presentation, walkthrough, or design review that must be visible on the office/project calendar. |
| MEP | Mechanical, electrical, and plumbing coordination. |
| Tentative elevation | An elevation available for coordination but not yet client-frozen or approved for detailed issue. |

The notes “Hanuman Nagar,” “well,” “black cotton soil,” and “outstation test pit” are treated as example site conditions and investigation triggers, not hard-coded workflow stages.

---

## 5. Users and Access

| Role | Core responsibilities | Default visibility |
|---|---|---|
| Principal Architect / Admin | Configure templates, oversee portfolio, approve exceptions, manage roles. | All authorized projects and portfolio controls. |
| Project Architect / Project Manager | Own project plan, studio workflow, assignments, coordination, releases, and client interactions. | Assigned projects; project calendars and records. |
| Architect / Designer | Requirements, concepts, elevations, architectural drawings, responses, and checklists. | Assigned project activities and documents. |
| Structural Consultant | Foundation concept, grid/column positions, calculations, structural drawings, responses. | Assigned structural package and approved coordination inputs. |
| Civil / Site Engineer | Investigations, line-out, construction-stage checks, issues, photos, videos, and site reports. | Assigned sites and site activities. |
| MEP Consultant / Coordinator | MEP inputs, coordinated routes/openings, clash responses, and service-stage checks. | Assigned MEP and coordination packages. |
| Interior Designer | Selection schedules, sample approvals, interior drawings, execution checks. | Assigned interior activities and approved base drawings. |
| Reviewer / Team Lead | Review, approve, reject, request rework, or delegate within authority. | Assigned reviews; Parvez may receive portfolio-wide review rights. |
| Accounts | Payment milestones, invoices, receipts/statuses, and commercial clearance. | Commercial fields; no unnecessary personal-calendar detail. |
| Client / External Reviewer | Review selected packages, attend demos, comment, and sign off approved versions. | Explicitly shared records only. |
| Office Coordinator | Schedule shared meetings, maintain attendees, issue approved communications. | Shared/project calendars, not private event contents. |

### 5.1 Access rules

- Access is role-based and project-scoped; sensitive commercial, client, and personal-calendar information has additional field-level controls.
- External users see only explicitly published versions and cannot browse internal drafts or discussions.
- A user may delegate an approval for a defined period; delegation must be logged and cannot exceed the delegator's authority.
- Download, upload, revision, submission, sign-off, rejection, payment clearance, and calendar disclosure events must be auditable.

---

## 6. Workflow Model

### 6.1 Project workstreams

Each project contains two synchronized workstreams:

- **Studio workstream:** discovery, requirements baseline, concept, elevations, consultant coordination, design freezes, detailed drawings, client demos, selections, and document issue.
- **Site workstream:** site-condition visit, investigations, line-out, construction-stage inspections, quality checklists, issue closure, civil completion, interiors execution, and handover.

A project workflow is a directed dependency graph rather than a simple checklist. An activity may have one or more predecessors; activities start when all required gates are satisfied. Parallel activities are allowed when dependencies permit them.

### 6.2 Activity types

- Task
- Meeting or client demo
- Form or checklist
- Site visit or inspection
- Document/drawing submission
- Review and rework
- Client sign-off
- Consultant sign-off
- Internal freeze
- Payment milestone or commercial gate
- Notification or communication
- Decision / request for information
- Stage gate / hold point

### 6.3 Activity states

`Not Started → Ready → In Progress → Submitted → Under Review → Approved / Rework / Rejected → Completed`

Additional states are `Blocked`, `On Hold`, `Cancelled`, and `Superseded`. A completed or approved item is immutable; a correction creates a new revision linked to the prior record.

### 6.4 Configurable activity fields

Every template activity can define:

- Responsible role, assignee rule, reviewer, backup reviewer, and observers.
- Required predecessor activities and parallel branches.
- Planned start/due dates, duration, SLA, working calendar, and reminder schedule.
- Mandatory fields, checklist, evidence count/type, document category, and naming rule.
- Submit, review, approval, rejection, and rework conditions.
- Escalation levels and recipients.
- Client visibility and communication template.
- Payment, sign-off, document, or issue-closure gates.
- Automatically created next activities, milestones, meetings, notifications, and tasks.

---

## 7. End-to-End Project Flow

### 7.1 Flow overview

The default residential workflow is intentionally stage-gated, while allowing parallel activities where inputs are ready. The critical sequence is: **requirements baseline → site-condition understanding → tentative design → centerline/foundation/column-position freeze → structural design → coordinated architectural/structural/MEP packages → complete elevation/client freeze → commercial gate → detailed drawings → site execution controls → civil completion → interiors → handover**.

```text
PROJECT SETUP
    |
    v
STUDIO — Client Discovery Meetings (repeatable)
    |
    v
PRELIMINARY REQUIREMENT BASELINE
    |
    +---- Client Review / Rework ----+
    |                                 |
    +--------------------> CLIENT SIGN-OFF
                              |
                    +---------+---------+
                    |                   |
                    v                   v
             SITE WORKSTREAM      STUDIO WORKSTREAM
             Pre-design visit     Preliminary concept
             Site conditions      Tentative elevations
             Investigations       not frozen
                    |                   |
                    +---------+---------+
                              |
                              v
                    CENTERLINE / GRID
                    FOUNDATION BASIS
                    COLUMN POSITIONS
                              |
                              v
                 ARCHITECT + SCON FREEZE/SIGN-OFF
                              |
                              v
                    STRUCTURAL CONSULTANT
                         DESIGN PACKAGE
                              |
                  +-----------+-----------+
                  |                       |
                  v                       v
          ARCHITECTURAL PACKAGE       STRUCTURAL PACKAGE
                  |                       |
                  +-----------+-----------+
                              |
                              v
                    MEP / COORDINATION
                    (parallel where ready)
                              |
                              v
                    ALL ELEVATIONS PACKAGE
                              |
                              v
                  CLIENT SIGN-OFF / DESIGN FREEZE
                              |
                              v
                       50% UPFRONT GATE
                              |
                              v
                DETAILED DRAWINGS / CONTROLLED ISSUE
                              |
                              v
                         SITE LINE-OUT
                              |
                              v
                  CONSTRUCTION QUALITY STAGES
             (diagonal / formwork / cover / steel / MEP)
                              |
                              v
                       CIVIL COMPLETION
                              |
                              v
                    INTERIORS / TILE SELECTION
                              |
                              v
                       HANDOVER / CLOSEOUT
```

**Mandatory workflow rules:**

- Tentative elevations are coordination inputs only and cannot become construction-use drawings without the configured freeze/sign-off gate.
- Centerline/grid, foundation basis, and column positions are explicitly frozen before the Structural Consultant's downstream structural-design activities are released.
- Structural, architectural, and MEP work may run in parallel only when their predecessor inputs are approved.
- All elevations in scope are consolidated into a client sign-off package to prevent uncontrolled post-approval changes.
- Detailed drawing production/issue is blocked by the configured commercial gate; the initial project rule is 50% upfront payment.
- Every site-quality stage is a checklist-driven hold point with evidence and reviewer approval.
- A completed/frozen stage is never silently edited; later changes create a controlled change request and a new revision.

The template must allow project-specific reordering where professional practice requires it. No configuration may bypass required legal, safety, structural, client, or commercial approvals without an authorized exception and recorded reason.

### 7.1A — Parvez workflow clarifications incorporated

| Architect requirement | System treatment |
|---|---|
| Studio is the primary client-facing requirement and design workstream | Studio owns discovery, baseline, concept, elevations, coordination, drawing production, client demos, and design approvals. |
| Multiple client meetings may occur before requirements are final | Meetings remain repeatable; only a versioned Preliminary Requirements Baseline is eligible for formal client sign-off. |
| Site condition is important before design decisions | A pre-design Site Visit is a formal gate/input and can automatically generate investigations. |
| Structural inputs can be tentative initially | Structural Consultant receives clearly identified tentative inputs only; frozen centerline/grid/foundation/column package is the controlled downstream input. |
| Foundation and column positions must be frozen/signoff before structural design | Workflow blocks Structural Consultant design release until the freeze gate passes. |
| Architectural and structural drawings are submitted and coordinated | Discipline packages have independent revisions and can run in parallel when dependencies are satisfied. |
| All elevations must be frozen with client sign-off | A single controlled elevation package becomes the baseline; later changes use Change Request. |
| Changes are costly | Change Request captures reason, effort, cost, schedule, affected drawings, site rework, and approvals before implementation. |
| 50% upfront before detailed drawings | Payment milestone is auto-created after design freeze and blocks detailed drawing issue until cleared or authorized exception. |
| Site quality needs repeatable checks | Line-out, diagonal, formwork, reinforcement cover, exposed-steel, MEP and related checks are configurable stage checklists. |
| Civil completion releases interiors | Civil completion is a gate; interior work and selection activities are released only after configured completion criteria. |
| Approximately 20 projects need visibility | Portfolio dashboard, blocker queue, workload, milestones, and pending approvals are first-class features. |
| Staff need not see personal calendar details | Personal calendars are private by default; sharing is owner-controlled. |
| Client demos must be shared | Client demos are project/office shared events and can be surfaced on the shared calendar without exposing unrelated personal event details. |
| Client demos are currently agreed verbally | Quick-capture of a verbal demo commitment into the project calendar (7.18) and a one-time backfill of all currently known demos during onboarding. |
| Around 20 projects are already running at different stages | Legacy project onboarding lets a project start mid-workflow with earlier gates recorded as historical (7.19). |
| Tile selection is a recurring problem | Selection deadlines are derived from the site schedule, with reminders and a red flag before the dependent site stage (7.16). |
| Studio prepares the centerline drawing | Centerline/grid package is a Studio-owned deliverable submitted to the Structural Consultant (7.7). |

### 7.2 Stage 0 — Project setup

**Owner:** Project Architect / Admin  
**Required data:** project name/code, client, site address/GPS, project type, scope, estimated dates, project team, consultant team, fee plan, document folders, workflow template/version.  
**Completion gate:** required team and responsible Project Architect assigned; client and site records created.  
**System action:** instantiate Studio and Site workstreams, initial tasks, shared project calendar, and audit trail.

### 7.3 Stage 1 — Client discovery and repeated meetings

Requirement gathering is a repeatable activity, not a single form. Users can create any number of meetings until the Project Architect proposes a baseline.

**Per-meeting mandatory capture:**

- Meeting title, date/time, location or link, attendees, and organizer.
- Notes/minutes, client needs, preferences, constraints, decisions, open questions, and action items.
- Attachments, sketches, voice notes, photos, or presentations.
- Each action item's owner, due date, and status.
- Whether the meeting is internal, office-shared, project-team, or client-visible.

**Output:** a live requirement register that preserves source meeting and change history.  
**Completion gate:** Project Architect marks discovery “Ready for baseline”; unresolved mandatory questions are either closed or accepted as assumptions.

### 7.4 Stage 2 — Preliminary requirements and client sign-off

The system compiles a versioned **Preliminary Requirements Baseline** containing scope, spaces, priorities, constraints, assumptions, exclusions, budget band if recorded, and unresolved client decisions.

**Review flow:** Internal review → Share with client → Client comments → Rework if needed → Client sign-off.  
**Completion gate:** named client approver signs the exact version; timestamp, comments, attachments, and method are recorded.  
**Change rule:** later changes create a Change Request; the signed baseline remains unchanged.

### 7.5 Stage 3 — Pre-design site-condition visit

The visit must occur before the relevant design freeze. The mobile form must work as a draft during poor connectivity and upload when a connection is available.

**Mandatory visit data:**

- Visit date/time, GPS/manual location, attendees, weather, and site access notes.
- Existing structures, dimensions, levels, boundaries, approach, utilities, drainage, and neighboring conditions.
- Ground observations and known soil information.
- Condition flags such as well, black cotton soil, rock, waterlogging, trees, encroachment, overhead/underground services, or restricted access.
- Required investigation: survey, soil test, test pit, outstation test pit, utility scan, or consultant visit.
- Minimum evidence by category; photos require timestamp/uploader and optional annotation.
- Summary, risk level, owner, target date, and recommended next action for every finding.

**Example:** If a Hanuman Nagar site records a well or black cotton soil, the workflow creates a mandatory investigation/consultation task and blocks foundation freeze until the finding is resolved or formally accepted by the responsible professional.

**Review:** Civil/Site Engineer submits → Project Architect reviews → Structural Consultant is notified for relevant ground/structural findings.  
**Completion gate:** all critical findings have an owner and disposition; required investigation reports are attached or an authorized hold/exception is recorded.

### 7.6 Stage 4 — Preliminary concept and tentative elevations

The Studio team may develop concept options and tentative elevations in parallel with early site/structural input. Every file must show revision, status, author, and permitted use.

**Rules:**

- Tentative elevations are marked “Not Frozen — Not for Construction.”
- Structural consultant can comment on assumptions but may not treat tentative elevations as final input.
- Client review can produce comments, but formal elevation sign-off occurs at the configured design-freeze stage.
- A decision register tracks accepted/rejected options and reasons.

### 7.7 Stage 5 — Centerline, foundation, and column-position freeze

This stage converts coordinated assumptions into approved positional inputs for structural design.

**Packages (prepared and submitted by Studio):**

- Architectural grid / centerline plan.
- Proposed foundation basis informed by site/soil findings.
- Column positions and constraints.
- Relevant levels, setbacks, shafts, stairs, openings, and coordination zones.

**Required approvals:** Project Architect internal freeze and Structural Consultant acceptance; client approval is configurable if positions affect agreed planning.  
**Completion gate:** centerline/grid, foundation basis, and column-position versions are frozen; unresolved critical clashes equal zero.  
**System action:** release structural-design activities and preserve the frozen input package.

### 7.8 Stage 6 — Structural consultant design

The structural consultant receives only the approved input package. Typical outputs include foundation, column, beam, slab, staircase, and structural-detail packages according to project scope.

**Flow:** Accept assignment → Raise queries/RFIs → Receive responses → Submit structural package → Architectural coordination review → Rework if required → Structural sign-off.  
**Gate:** every structural drawing records revision, status, submission date, reviewer, and approved-for-use classification. Superseded drawings remain accessible but visibly invalid.

### 7.9 Stage 7 — Architectural, structural, and MEP coordination

Architectural drawings, structural packages, and MEP coordination can proceed in parallel once their inputs are ready. Dependencies are package-specific rather than forcing the entire project into one serial sequence.

**Required controls:**

- Drawing register by discipline, package, revision, and use status.
- Coordination issues/RFIs with location, snapshot, owner, due date, severity, and closure evidence.
- Explicit checks for shafts, wet areas, slab/opening requirements, equipment spaces, routes, and structural constraints.
- “Ready for next gate” only when required reviewers approve and critical coordination issues are closed.

### 7.10 Stage 8 — All-elevation client sign-off and design freeze

All client-facing elevations within scope must be assembled into one sign-off package or clearly linked packages.

**Completion conditions:**

- Required elevations are present and internally reviewed.
- The client views the exact version through a shared link, recorded meeting, or controlled document issue.
- Client signs off or submits comments; comments trigger rework and a new revision.
- Approved elevations are frozen and marked with sign-off evidence.

**Change control:** Any requested modification after sign-off becomes a formal Change Request with reason, affected drawings/stages, estimated design effort, consultant impact, site rework, cost, schedule impact, and required approvals. Work does not start until approval conditions are met, except an authorized emergency path.

### 7.11 Stage 9 — Commercial gate: 50% upfront fees

After elevation sign-off, the system automatically creates a payment milestone. The initial template uses **50% upfront fees before detailed drawings**, but the percentage, amount basis, due date, and blocker behavior must be configurable.

**States:** Draft → Raised → Sent → Partially Received → Received/Cleared → Waived by Authorized User → Overdue.  
**Gate:** detailed drawings remain blocked until Accounts records clearance or an authorized principal grants a logged exception.  
**Client communication:** the system generates a reviewable payment request/notification; it does not send or confirm money without human action.

### 7.12 Stage 10 — Detailed drawings and controlled issue

After client and commercial gates, the Studio creates detailed architectural drawings and coordinates structural/MEP references.

**Controls:**

- Drawing deliverable checklist per project type.
- Internal review and issue-purpose classification: Preliminary, Coordination, Client Review, Approval, Tender, or Construction.
- Revision history and transmittal record.
- Client/contractor acknowledgement where configured.
- Automatic notification of revised or superseded documents to affected recipients.

**Completion gate:** all mandatory drawings pass review, critical coordination issues are closed, and the correct issue set is transmitted.

### 7.13 Stage 11 — Site line-out

Line-out is a hold point before foundation/execution work proceeds.

**Checklist:** approved drawing revision available; benchmark and grid references; boundary/setback verification; centerline marking; column/wall positions; diagonal measurements; key dimensions; levels; photographs; deviations; engineer/architect review.  
**Gate:** mandatory checks pass and deviations are resolved or approved.  
**Failure:** create non-conformance/rework, notify responsible roles, and block dependent construction checks.

### 7.14 Stage 12 — Construction and MEP quality stages

The template must let Parvez configure stage-specific checklists. Recommended baseline:

| Stage | Mandatory checks and evidence examples |
|---|---|
| Excavation / foundation | Location, dimensions, depth, bearing/soil condition, dewatering, PCC, reinforcement, cover blocks, inserts, pre-pour photographs. |
| Column / wall reinforcement | Position, size/count, spacing, lap/anchorage, stirrups, cover, plumb, opening coordination, no exposed steel after approved closure. |
| Formwork | Line, level, plumb, dimensions, diagonal check where applicable, supports, joints, release readiness, openings/sleeves. |
| Beam / slab | Levels, reinforcement, cover, conduits/sleeves, openings, MEP coordination, pour clearance. |
| Masonry / civil | Line, level, plumb, joint quality, openings, lintels, service chases, curing, concealed-service evidence. |
| Waterproofing | Surface preparation, slope, upturns, junctions, application record, pond/flood test, defect closure. |
| MEP rough-in | Approved coordinated drawing, routes, sleeves, boxes, pressure/continuity tests, concealment approval. |
| Plaster / finishes | Substrate, levels, corners, thickness, hollowness/defects, samples, approved material. |

Every check supports Pass, Fail, Not Applicable with mandatory reason for Not Applicable. Failed critical checks create an issue and block stage approval. Inspection records require reviewer sign-off and retain photos/videos/documents.

### 7.15 Stage 13 — Civil completion

When configured civil stages are complete, the system creates a Civil Completion review.

**Requirements:** all mandatory civil checklists approved; open critical issues equal zero; snag list assigned; required tests and as-built records attached; Site Engineer and Project Architect sign off.  
**System action:** release interior execution or handover-preparation activities according to scope.

### 7.16 Stage 14 — Interiors and selections

Interior activities can begin in parallel where base-building dependencies permit. Selection schedules must cover items such as tiles, sanitary fixtures, finishes, colors, hardware, lighting, and approved samples.

**Tile-selection record:** spaces, tile type/code, supplier, size, finish, batch/sample photo, quantity allowance, client choice, approval date, budget/variation status, and linked drawings.  
**Gate:** procurement or installation cannot proceed without required client approval and commercial clearance when configured. Substitution requires a controlled change.

**Selection deadlines (tile selection is a known pain point):**

- Each selection item has a "decision needed by" date calculated backwards from the planned start of the dependent site stage, using a configurable lead time.
- Reminders go to the client-facing owner before the deadline; a missed deadline raises a red flag on the portfolio dashboard and in "Needs Parvez's attention".
- Client choices captured verbally or at a showroom visit can be recorded quickly on mobile (photo of sample, code, space) and then sent to the client for confirmation.

### 7.17 Stage 15 — Handover and closeout

**Requirements:** final snag closure, approved completion records, key drawings/as-builts, warranties/manuals where applicable, client walkthrough, pending-item register, final commercial milestone, and handover sign-off.  
**Output:** read-only project archive with full audit trail and retained obligations/tasks.

### 7.18 Client demo capture

Client demos are currently agreed verbally and are not visible to the team.

- Any authorized user can quick-add a client demo from mobile or web in a few fields: project, date/time, place or link, attendees, purpose, and what will be shown.
- A demo is always a project-shared event; it is placed on the office calendar when the office coordinator or Project Architect chooses.
- Presenters get preparation tasks (for example, "elevation package ready") linked to the demo, with reminders.
- After the demo, the organizer records outcome, client comments, decisions, and follow-up actions; comments on frozen items open a Change Request.
- During onboarding, all currently known upcoming demos are entered once so that nothing agreed verbally is lost.

### 7.19 Legacy project onboarding

About 20 projects are already in progress at different stages.

- An Admin can create a project from the template and set its current stage.
- Earlier gates are marked "Historical — completed before SiteFlow" with an optional attachment (signed drawing, receipt, photo) and the name of the person confirming.
- Historical gates are visible as such and never presented as system-verified sign-offs.
- From the current stage onward, all normal gates, checklists, and payment rules apply.
- A bulk import from a spreadsheet (project, client, site, stage, team) is supported for the initial load.

---

## 8. Checklists, Evidence, and Review

### 8.1 Checklist configuration

An Admin can configure checklists by workflow template, stage, project type, discipline, and revision. Each item defines:

- Label and guidance.
- Mandatory/optional status.
- Response type: Pass/Fail/NA, yes/no, number, text, measurement, date, or selection.
- Acceptance range/tolerance if applicable.
- Required photo/video/document count.
- Whether geolocation, timestamp, annotation, or signature is required.
- Failure severity, default issue owner, due-date rule, and blocker behavior.
- Required reviewer and approval SLA.

### 8.2 Submission validation

Before submission, the system must show a clear “missing information” list and navigate the user to each incomplete field. The submit action remains disabled if a blocking requirement is missing. Phase 1 validation is rules-based; Phase 2 AI can suggest likely omissions but cannot waive hard requirements.

### 8.3 Review and rework

A reviewer can approve, approve with non-blocking comments, request rework, or reject when authorized. Rework requires a comment and identifies affected checklist items/files. Resubmission retains prior versions, comments, and response evidence.

---

## 9. Change and Revision Control

Changes after a requirement, elevation, grid, structural package, selection, or construction drawing is frozen can be costly. SiteFlow must make this cost and impact visible before work begins.

### 9.1 Change request fields

- Requester, date, source, reason, and description.
- Affected requirement, drawing, selection, activity, consultant, and site work.
- Urgency and whether work is stopped.
- Design/consultant effort estimate.
- Cost or fee impact and payer.
- Schedule impact and affected milestones.
- Site demolition/rework risk.
- Required internal, consultant, client, and accounts approvals.
- Approved implementation plan and resulting revisions.

### 9.2 Rules

- Frozen records are never overwritten.
- An approved change creates new linked activity and document revisions.
- Rejected changes retain a decision record but do not alter the baseline.
- Emergency changes require named authority and retrospective confirmation within a configurable SLA.
- Dashboard shows pending changes and cumulative approved time/cost impact.

---

## 10. Calendar and Meeting Privacy

### 10.1 Calendar types

The system must distinguish **business visibility** from **personal availability**. Personal calendar details are never exposed merely because an employee participates in a project. Sharing is explicit and owner-controlled.

| Calendar | Purpose | Default visibility |
|---|---|---|
| Office shared | Office meetings, reviews, client demos, holidays, shared deadlines. | Authorized office staff. |
| Project shared | Project meetings, site visits, consultant reviews, deadlines, client demos. | Assigned project team; client only if invited. |
| Personal private | Personal appointments and private work blocks. | Owner only. |
| Availability-only | Busy/free block derived from a private event. | Users who can schedule the owner, without title, attendee, location, notes, or reason. |

### 10.2 Privacy rules

- Personal events are private by default and are never copied into the office calendar automatically.
- The owner may share a personal event as: full details, selected fields, title-only, or busy-only.
- Staff do not need to know why a person is unavailable; scheduling uses free/busy information.
- Client demos and project commitments must be placed on the project/shared calendar, with attendees and visibility deliberately selected.
- Verbal commitments can be converted into calendar events by an authorized user; the creator and source are logged.
- Calendar integrations require least-privilege consent and must not expose unrelated events.

### 10.3 Meeting features

Create/update/cancel meetings; check participant availability where permitted; add conferencing links; send invites; record attendance; attach agenda/materials; link minutes, decisions, actions, and follow-up tasks; remind attendees; and escalate unconfirmed critical meetings.

---

## 11. Notifications, Reminders, and Escalations

### 11.1 Phase 1 channels

- In-app notifications.
- Push notification where supported.
- Email for selected workflow events and external invitations.

### 11.2 Triggers

Assignment, activity ready, due soon, overdue, meeting created/changed, submission, review required, rework, approval, issue raised, critical site finding, drawing superseded, sign-off needed, payment milestone, payment overdue, change request, and escalation.

### 11.3 Escalation model

| Level | Example trigger | Recipient/action |
|---|---|---|
| Reminder | Configurable time before due date. | Assignee. |
| Level 1 | Due date missed. | Assignee and Project Architect. |
| Level 2 | Missed by configured threshold or critical item unresolved. | Team Lead/Parvez and Project Manager. |
| Level 3 | Milestone threatened, client decision overdue, safety/structural critical, or repeated delay. | Principal Architect and designated stakeholders. |

Users can acknowledge, resolve, reassign, or snooze only within policy. Snooze requires a reason and never changes the contractual due date. Escalations clear automatically when the trigger is resolved, with a retained history.

---

## 12. Portfolio and Project Dashboards

The application must remain usable with at least 20 active projects and their documents/media.

### 12.1 Portfolio view

- Project, client, location, Project Architect, current stage, Studio status, Site status, next milestone, planned vs actual date, progress, open critical issues, pending sign-offs, pending change requests, payment gate, and latest activity.
- Filters for project, stage, discipline, assignee, reviewer, delay, risk, client decision, payment, site visit, issue severity, and date range.
- “Needs Parvez's attention” queue sorted by criticality, gate impact, and age.
- Workload view by role/user and overdue assignments.
- Calendar view of office commitments, project meetings, client demos, and site visits without leaking private-event details.

### 12.2 Project view

- Visual workflow with parallel branches and blockers.
- Current approved baseline and latest revisions.
- Requirements, meetings, decisions, documents/drawings, RFIs, issues, changes, payments, calendar, site media, and audit trail.
- Clear “why blocked” explanation and authorized next actions.

---

## 13. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Create projects from versioned workflow templates with Studio and Site workstreams. | Must |
| FR-02 | Configure sequential/parallel dependencies, gates, loops, auto-created activities, and milestones. | Must |
| FR-03 | Assign by role/user with backup, reviewer, watcher, due date, SLA, reminders, and escalation. | Must |
| FR-04 | Record repeatable client meetings and consolidate them into a versioned requirement register. | Must |
| FR-05 | Obtain client sign-off on preliminary requirements and preserve the signed version. | Must |
| FR-06 | Capture site-condition visits on mobile with forms, GPS/manual location, media, findings, and investigations. | Must |
| FR-07 | Block design/structural gates when critical site findings or investigations remain unresolved. | Must |
| FR-08 | Manage tentative, review, frozen, approved, superseded, and construction-use document/drawing statuses. | Must |
| FR-09 | Freeze centerline/grid, foundation basis, and column positions with architect/structural sign-off. | Must |
| FR-10 | Coordinate architectural, structural, and MEP packages with RFIs/issues and parallel workflow. | Must |
| FR-11 | Obtain all-elevation client sign-off and route later requests through change control. | Must |
| FR-12 | Auto-create a configurable payment milestone; block detailed drawings until clearance/exception. | Must |
| FR-13 | Manage detailed drawing review, issue purpose, revision, transmittal, and acknowledgement. | Must |
| FR-14 | Run line-out and construction-stage checklists including diagonal, formwork, and reinforcement-cover checks. | Must |
| FR-15 | Prevent stage approval when blocking checklist items fail or evidence is missing. | Must |
| FR-16 | Manage civil completion, snag closure, and release of interior/handover stages. | Must |
| FR-17 | Manage interior selections including tile approval and substitutions. | Should |
| FR-18 | Maintain office, project, personal-private, and availability-only calendar behavior. | Must |
| FR-19 | Share client demos on project/office calendars without exposing private calendar details; personal events may be shared as availability-only only when the owner permits. | Must |
| FR-20 | Notify, remind, escalate, and auto-clear alerts based on configurable rules. | Must |
| FR-21 | Provide portfolio dashboard and priority queue for 20+ projects. | Must |
| FR-22 | Keep immutable audit and revision history for workflow, documents, approvals, payments, and access-sensitive actions. | Must |
| FR-23 | Draft client communications for human review and send through approved Phase 1 channels. | Should |
| FR-26 | Quick-capture verbal client demo commitments as project-shared events with prep tasks and outcome record. | Must |
| FR-27 | Onboard in-progress projects at their current stage with historical gates, including spreadsheet bulk import. | Must |
| FR-28 | Derive selection deadlines from the site schedule and red-flag missed selections. | Should |
| FR-24 | Integrate WhatsApp using approved templates and consent controls. | Phase 2 |
| FR-25 | Provide AI note capture, missing-information prompts, risk alerts, and next-step recommendations. | Phase 2 |

---

## 14. Mobile Requirements

- Fast activity list: Today, Upcoming, Overdue, Waiting for Review, and Blocked.
- Site forms optimized for one-handed use and intermittent connectivity.
- Local draft with explicit sync state; no silent data loss.
- Camera/video/document/voice-note capture from the activity.
- Automatic metadata when permission is granted; manual fallback with reason.
- Media compression with original retained according to policy.
- Missing-item summary before submission.
- Cached assigned project/drawing references required for a scheduled visit, subject to security policy.
- Upload retry and conflict handling; duplicate submission prevention.
- Push notifications and deep links to the exact activity.

---

## 15. Web Requirements

- Workflow-template builder with versioning and safe draft/publish process.
- Portfolio dashboard, project workflow, review queue, workload, documents, reports, and administration.
- Drawing/document register with revision comparison metadata and controlled downloads.
- Bulk assignment and due-date changes subject to authority and audit.
- Calendar views with privacy-aware availability.
- Configurable checklists, validation rules, notification templates, SLAs, escalation levels, payment gates, and sign-off roles.
- Exports for project status, open issues, drawing register, meeting/action log, change register, site reports, and audit history.

---

## 16. Data Model

Core entities:

- Organization, User, Role, Permission, Team, ProjectMembership.
- Client, ClientContact, Project, ProjectTemplate, TemplateVersion.
- Workflow, Workstream, ActivityDefinition, ActivityInstance, Dependency, Gate, Assignment, SLA.
- Meeting, Attendee, Requirement, RequirementBaseline, Decision, ActionItem, SignOff.
- SiteVisit, SiteCondition, Investigation, ChecklistTemplate, ChecklistResponse, Measurement.
- Document, Drawing, Package, Revision, Transmittal, Acknowledgement.
- RFI, CoordinationIssue, NonConformance, Snag, ChangeRequest.
- Consultant, StructuralPackage, MEPPackage, InteriorSelection.
- PaymentMilestone, PaymentStatus, CommercialException.
- Calendar, CalendarEvent, AvailabilityBlock, VisibilityPolicy.
- Media, Comment, Review, Notification, Escalation, AuditEvent.
- ClientDemo (a Meeting subtype with prep tasks and outcome), HistoricalGateRecord, SelectionDeadline, ImportBatch.

All project records need organization/project identifiers, creator, created/updated timestamps, status, revision/version where relevant, and retention classification.

---

## 17. Non-Functional Requirements

### 17.1 Security and privacy

- Role-, project-, and field-level authorization enforced on the server.
- Encryption in transit and at rest; secure object storage and time-limited media access.
- Strong authentication; administrator and high-risk approval actions should support multi-factor authentication.
- Tenant isolation, audit logging, backup, restore tests, session controls, and device logout/revocation.
- Personal calendar details excluded from logs, notifications, reports, and AI context unless explicitly authorized.
- Client/employee consent and retention rules for photos, videos, voice notes, and WhatsApp messages.

### 17.2 Performance and scale

- Portfolio dashboard target: initial useful view within 3 seconds under agreed pilot conditions.
- Typical activity/form view target: within 2 seconds excluding large-media download.
- Support at least 20 active projects in the pilot, with scalable pagination/search for growth.
- Background media upload with visible progress and retry.

### 17.3 Reliability and traceability

- No approved record can be destructively edited.
- Idempotent submission and notification handling prevents duplicates.
- Daily backups during pilot; recovery objectives to be confirmed.
- System health, error logging, failed-job alerts, and integration retry queues.
- Every gate decision can be explained from current records and rule configuration.

### 17.4 Usability and accessibility

- Clear language, large touch targets, field guidance, and color-independent status indicators.
- Mobile forms minimize typing through defaults, selections, recent values, and voice notes.
- Validation errors identify both the problem and corrective action.

---

## 18. Phase 2 — WhatsApp and AI Agent

> Superseded in detail by SiteFlow PRD V4 sections 10 to 16. The principles below still apply; V4 adds channel-reply approval (V4 section 11.4A), site AI, the second brain, and stage copilots.

### 18.1 WhatsApp integration

- Link an approved business number and authorized client/team contacts.
- Use consent and approved templates for reminders, meeting confirmations, sign-off requests, and status communications.
- Link inbound/outbound messages to a project and activity with access controls.
- Prevent sensitive drawings or private-calendar details from being sent automatically.
- Escalate failed delivery or ambiguous replies to a human.

### 18.2 AI capabilities

| Capability | AI assistance | Human control |
|---|---|---|
| Meeting notes | Transcribe/summarize, extract requirements, decisions, and actions. | User reviews before adding to the official register. |
| Site notes | Convert voice/text/media context into a draft visit summary. | Site user edits and submits. |
| Missing information | Flag likely missing evidence, inconsistent fields, or unresolved findings. | Hard workflow rules remain authoritative. |
| Document/photo understanding | Classify files, extract drawing metadata, tag visible conditions, find likely duplicates. | Reviewer confirms; no autonomous engineering conclusion. |
| Next steps | Recommend activities based on workflow, blockers, and past patterns. | Workflow owner accepts or rejects recommendations. |
| Delay risk | Highlight overdue trends, dependency risk, review bottlenecks, and threatened milestones. | Project lead chooses intervention. |
| Conversational assistant | Answer project-status questions within user's permissions. | Sources shown; restricted data omitted. |

### 18.3 AI governance

- AI output is visibly labeled and linked to source records.
- No autonomous client sign-off, structural approval, payment confirmation, contractual commitment, schedule promise, or private-calendar disclosure.
- Record model/version, prompt/context reference, output, user edits, and acceptance/rejection where appropriate.
- Project and personal data cannot be used for model training unless separately authorized.
- Low-confidence or conflicting output must be escalated rather than stated as fact.

---

## 19. Reporting and Metrics

### 19.1 Operational reports

- Project stage and milestone report.
- Studio vs Site blockers.
- Pending client, consultant, reviewer, and accounts actions.
- Overdue tasks and escalation aging.
- Site visits, inspections, failed checks, open non-conformances, and snag aging.
- Drawing/package status and superseded-document access.
- Change requests and approved time/cost impact.
- Calendar load and client-demo schedule without private detail.

### 19.2 Pilot success measures

- Share of project activities recorded in SiteFlow rather than only verbally or through unlinked messages.
- Percentage of client meetings with minutes/actions recorded within the target SLA.
- Percentage of required sign-offs completed against the correct version.
- Site submissions passing mandatory validation on first attempt.
- Review turnaround time and overdue review count.
- Critical issue detection-to-assignment and assignment-to-closure time.
- Number of post-freeze changes with approved impact assessment before work starts.
- Drawing errors caused by using superseded revisions.
- On-time client demos and milestones.
- User adoption by role and active project.

Targets must be agreed after baseline measurement; the PRD does not invent target percentages.

---

## 20. Acceptance Criteria

The Phase 1 release is acceptable when the following end-to-end scenario passes:

1. Admin publishes a residential workflow template and creates a project with Studio and Site workstreams.
2. Project Architect records at least two client discovery meetings, consolidates requirements, and obtains client sign-off on the baseline.
3. Site Engineer completes a pre-design visit, records a well or black cotton soil finding, and the system creates/blocks on the required investigation.
4. Studio uploads tentative elevations clearly marked not frozen.
5. Studio publishes the centerline/grid, foundation basis, and column-position package; Architect and Structural Consultant complete the configured freeze/sign-off before structural design is released.
6. Structural, architectural, and MEP activities proceed according to configured parallel dependencies and resolve a coordination issue.
7. Client signs off the complete elevation package; a later request creates a cost/schedule-assessed change request rather than overwriting the baseline.
8. Accounts receives an automatically created 50% payment milestone, and detailed drawings remain blocked until clearance or an authorized exception.
9. Detailed drawings are reviewed, issued, revised, and superseded with correct notifications and history.
10. Site team completes line-out with dimensions and diagonal evidence; a failed result blocks progress until rework is approved.
11. Formwork and reinforcement-cover checks require evidence; a critical failure creates and escalates an issue.
12. Civil completion releases interiors; tile selection receives client approval before procurement/installation activity.
13. A client demo appears on the shared/project calendar while a personal appointment appears only as busy to permitted schedulers.
14. Portfolio dashboard shows the project's blockers, next action, pending sign-offs, payment gate, and critical issues among 20 projects.
15. Every significant action is visible in the audit trail, and an unauthorized user cannot access another project or private calendar details.
16. A verbally agreed client demo is quick-added on mobile, appears on the project calendar, and its outcome creates follow-up actions.
17. An in-progress project is imported at the structural-design stage with earlier gates shown as historical, and normal gates apply from that point.
18. A tile selection that misses its derived deadline raises a red flag before the dependent site stage.

---

## 21. Delivery Plan

### Release A — Workflow foundation

- Authentication, users/roles, project membership, template/version model.
- Project setup, Studio/Site workflow graph, assignment, dependencies, gates, review/rework.
- Requirements meetings, baselines, sign-offs, documents/revisions, notifications, and audit.

### Release B — Design and commercial control

- Site-condition visit and investigations.
- Tentative/frozen drawing statuses, centerline/foundation/column freeze.
- Structural, architectural, and MEP coordination; RFIs/issues.
- Elevation sign-off, change control, payment milestone, detailed drawing issue.

### Release C — Site quality, interiors, calendar, and portfolio

- Line-out and configurable construction-stage checklists.
- Civil completion, snags, interior selections, tile approval, handover.
- Shared/private calendars, client demos, reminders, and escalations.
- 20-project dashboard, workload, exports, security hardening, and pilot.

### Phase 2 release

Delivered as V4 releases V4.1 to V4.4, defined in SiteFlow PRD V4 section 21.

- WhatsApp integration.
- AI notes, extraction, missing-information prompts, recommendations, delay-risk alerts, and conversational assistant.
- AI governance, evaluation, feedback, and monitoring.

A pilot should use 2–3 representative residential projects: one early design, one structural/detailed-drawing stage, and one active site. Production rollout follows acceptance, security review, training, and issue closure.

---

## 22. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Workflow becomes too complex | Start from a signed residential template; allow controlled variants and versioning rather than ad hoc changes. |
| Excessive form burden at site | Stage-specific short forms, defaults, offline drafts, voice notes, and evidence reuse where valid. |
| Parvez becomes a review bottleneck | SLA, backup reviewer, delegation, priority queue, and escalation. |
| Client disputes what was approved | Versioned package, named sign-off, timestamp, transmittal, and immutable history. |
| Uncontrolled post-freeze changes | Formal impact-assessed Change Request gate. |
| Staff bypass system through verbal updates | Quick meeting/task capture, reminders, dashboard visibility, and management policy that official decisions require a record. |
| Private calendar information leaks | Private-by-default events, availability-only sharing, field-level permissions, and AI/context exclusion. |
| Wrong drawing used at site | Clear status watermark, superseded warning, transmittal/acknowledgement, and controlled cached files. |
| AI makes unsafe or contractual decisions | Human-in-the-loop, prohibited autonomous actions, source linking, confidence handling, and audit. |

---

## 23. Decisions Required from Parvez

| ID | Decision |
|---|---|
| D-01 | Confirm the exact residential lifecycle and whether legal/statutory approvals are separate gates. |
| D-02 | Confirm terminology and responsibility for centerline, line-out, foundation basis, and column-position freeze. |
| D-03 | Approve mandatory site-condition fields and which conditions trigger soil test, test pit, structural review, or workflow hold. |
| D-04 | Confirm elevation package contents and named client signatory/backup. |
| D-05 | Confirm whether the 50% fee is calculated on total fee, stage fee, or another basis; define partial payment and exception rules. |
| D-06 | Approve drawing package lists and review/sign-off matrix for architectural, structural, and MEP disciplines. |
| D-07 | Approve each stage checklist, tolerances, minimum evidence, reviewer, and blocker severity. |
| D-08 | Confirm civil completion and interior-start criteria, including tile/sample approval and commercial rules. |
| D-09 | Define reminder intervals, review SLAs, escalation thresholds, and backup reviewers. |
| D-10 | Confirm office/project calendar visibility, who can see free/busy, and who may schedule client demos. |
| D-11 | Select 2–3 pilot projects and nominate users for each role. |
| D-12 | Approve data retention, client consent, WhatsApp consent, and media/privacy policies. |
| D-13 | Confirm the list of in-progress projects, their current stage, and who confirms historical gates. |
| D-14 | Set the lead time for each selection category (tiles, sanitary, lighting) before the dependent site stage. |
| D-15 | Confirm who may put a client demo on the office-wide calendar. |

---

## 24. Requirements Traceability

| Architect input | PRD handling |
|---|---|
| Studio and site are current work areas | Dual synchronized workstreams in Sections 6–7. |
| Multiple client requirement meetings | Repeatable meetings, requirement register, actions, and baseline in 7.3–7.4. |
| Preliminary requirements need client sign-off | Versioned client sign-off gate in 7.4. |
| Elevations tentative / not frozen | Explicit tentative status and warning in 7.6. |
| Site conditions: well, black cotton soil, outstation test pit | Configurable findings and investigation blockers in 7.5. |
| Foundation and column position freeze/sign-off before structural consultant | Coordinated freeze gate in 7.7, followed by structural design in 7.8. |
| Architectural and structural drawings submitted | Package/revision/submission controls in 7.8–7.10. |
| All elevations need client sign-off | Mandatory all-elevation package freeze in 7.10. |
| 50% upfront before detailed drawings | Configurable commercial blocker in 7.11. |
| Changes are costly | Cost/schedule impact change control in Section 9. |
| Line-out | Site hold point and evidence checklist in 7.13. |
| MEP and structural coordination | Parallel package workflow and issues in 7.9 and 7.14. |
| Diagonal, formwork, cover, steel not exposed | Stage-specific mandatory checks in 7.13–7.14. |
| Civil completion then interiors, including tile selection | Release gate and selection schedule in 7.15–7.16. |
| Around 20 projects | Portfolio dashboard and scale requirements in Sections 12 and 17. |
| Office and personal calendars differ | Four calendar/privacy modes in Section 10. |
| Personal details shared only at discretion | Private-by-default, full/partial/busy-only disclosure in 10.2. |
| Client demos must be shared | Project/office event rule in Section 10 and FR-19. |

---

## 25. Immediate Next Steps

1. Conduct a two-hour workflow workshop with Parvez, one Project Architect, one Site/Civil Engineer, one Structural Consultant, Accounts, and Office Coordinator.
2. Resolve D-01 through D-10 and approve the baseline residential workflow and permission matrix.
3. Convert the stage checks into signed checklist templates with tolerances and evidence rules.
4. Update the existing prototype navigation and data model to show Studio/Site workstreams, client meetings, sign-offs, blockers, and calendar privacy.
5. Test the acceptance scenario with sample records before development estimates are finalized.
6. Select pilot projects and finalize Release A–C backlog, owners, estimates, and target dates.

---

**Version 3.0 update note**

This version makes the Parvez workflow sequence explicit, strengthens the structural freeze-to-consultant handoff, formalizes the all-elevation freeze and payment gate, and clarifies personal-calendar privacy versus shared client-demo visibility.

**Version 3.2 update note**

Links this core PRD to the separate SiteFlow PRD V4, marks the Phase 2 goals, section 18, and the Phase 2 release as detailed in V4, and keeps all v3.1 requirement numbers unchanged. V4 requirements use the `V4-FR-` prefix to avoid numbering conflicts.

**Version 3.1 update note**

Adds client demo capture for verbally agreed demos (7.18, FR-26), legacy onboarding for the roughly 20 in-progress projects (7.19, FR-27), derived selection deadlines for tile and other selections (7.16, FR-28), Studio ownership of the centerline package, acceptance scenarios 16 to 18, and decisions D-13 to D-15.

**Approval record**

| Role | Name | Decision | Date | Comments |
|---|---|---|---|---|
| Business owner | Architect Parvez | Pending |  |  |
| Product / Delivery | TAN GLOBUS AI | Pending |  |  |
| Structural representative |  | Pending |  |  |
| Site/Civil representative |  | Pending |  |  |
| Accounts representative |  | Pending |  |  |