# SiteFlow progress log

## Sprint status

| Sprint | State | Where |
|---|---|---|
| v1 | Done: the three-step loop on FastAPI | `sprints/v1/` (with WALKTHROUGH.md) |
| v2 | 20 of 21 tasks done. The Android build and device check are open (no JDK or SDK on the build machine) | `sprints/v2/` |
| v3 | Done: all 23 tasks (stage tracker, client sign-off, customer app, demo parity) | `sprints/v3/` |

## Done
- **Sprint v3, Task 1:** the reference documents are in `docs/reference/`. Added the repo `CLAUDE.md`, decisions 0001 and 0002, and the v3 configuration. Undecided values now carry `TBD_PARVEZ`.

## Deviations from the reference plan
- The existing stack is kept; the React rebuild is not started (decision 0001).
- A client app is added, although PRD v3.1 §3.3 excluded a client portal unless approved (decision 0002).
- The 18-stage flow is a fixed configuration (`stage_config.py`), not the template builder of plan S02.

## Open questions for Parvez
| Ref | Question | Where it is used |
|---|---|---|
| 0002 | Confirm the client app and client sign-off in the app (amends PRD §3.3 and plan S05). | Whole of v3 |
| D-01 | Is Legal Approval the gate for stage 14, Site line-out? v3 assumes it is. | `stage_config.py` |
| D-04 | The named client signatory and backup for each project. | Client invite and sign-off |
| — | The sign-off confirmation wording (needs legal review). | `SIGNOFF_CONFIRMATION_TEXT` |
| D-09 | The client decision SLA before "Client decision overdue" is raised. | `CLIENT_SIGNOFF_SLA_DAYS` |
| — | How long a client invite code stays valid. | `INVITE_CODE_TTL_DAYS` |
| — | The size limit for sign-off attachments. | `MAX_SIGNOFF_ATTACHMENT_MB` |
| — | Which site updates clients see by default. v3 shows only updates the Architect shares. | Shared updates |
| D-02, D-03 | Stage weights, checklists, photo counts, review SLA and visit interval (from v1 and v2). | `template_config.py`, `workflow_config.py` |

## 2026-09-28: V4 readiness check
- **Result:** not ready for V4 step V01. None of core steps S00 to S18 is Done: 12 are Partial (S00 to S05, S09, S12, S13, S15, S16, S17) and 7 are Not started (S06, S07, S08, S10, S11, S14, S18). Status comes from code and tests at commit `40a1e36`, not from this log. Evidence and gaps are in `docs/V4_EXECUTION_PLAN.md` section 2.
- **Blocks V01 directly:**
  - S01: no Accounts role or approver authority, no sessions or revocation, no field-level rules.
  - S05 and S06: no publishable meetings or documents.
  - S10: no payment actions.
  - S17: Android never built.
  - S18: no pipeline.
  - S00: CI runs no tests.
  - S15: no email or scheduled worker.
- **Documents added to `docs/`:**
  - `SiteFlow-PRD-v3.2.md` (from `Inputs/Claude PRd V3.1.md`, which is version 3.2).
  - `SiteFlow-PRD-V4.md` (from `Inputs/Claude SiteFlow-PRD-V4.md`, the version with section 11.4A).
  - `V4_IMPLEMENTATION_PLAN.md`.
  - `IMPLEMENTATION_PLAN.md` (the reference plan).
  - `reference/CLAUDE-reference-v4.md`.
  - The repository `CLAUDE.md` is unchanged; the merge is part of step 1.
- **Next step:** step 1, S00 complete (prompt in `docs/V4_EXECUTION_PLAN.md` section 7). No feature code was written in this session.
- **Open questions:**
  - V4-D01 to V4-D16 are all open.
  - Confirm decision 0002 (client app) together with V4-D01.
  - Ask for V4-D16 (pilot projects) with the V4.1 decisions, not V4.4.
  - Decide whether to keep the strict core-first order or approve an early V4.1 start (`docs/V4_EXECUTION_PLAN.md` section 4 and R-18).

## Sprint v4 notes (in progress)
- **Client demo: updated to sprint v4 on 28 September 2026 (Task 42), at the user's request. This supersedes the note that the demo was frozen at v3.** The republished Artifact (same link, version 4) shows the phase icons and the workflow callout, sample 3D images, stage completion with files (Sathe House), the placeholder gates with recorded exceptions (Gokhale's 50% gate), the Accounts fee ledger (Vikram Mehta), the principal overview (Parvez), and the Admin Team and CSV Import screens. The demo doesn't cover server-only behaviour: sessions, password reset, delegation, flow versions and XLSX. Downloads inside the Artifact viewer (the import template, stage files) do nothing, because the viewer doesn't allow downloads. The reset button's two-tap confirmation now survives a sidebar refresh.
- **Found, not fixed (the demo is frozen):** `demo-api.js` `uploadSignoffAttachment` strips only `/` from file names, not `\` as intended.
- **Open question:** should the client app show the project image (the 3D view) on the client's own project? It doesn't yet (Task 31).
- **Open question:** may more than one person be the principal architect? The build allows one or more; the seed marks only Parvez (Task 32).
- **Follow-up for S05 (from Task 38):** wire `modules/workflow/states.py` into ProjectStage. Store the activity state, drive the stage engine through `transition()` and migrate the stored statuses with `from_stored()`. Today it is a pure module with tests only.

## 28 September 2026 — Sprint v4 closed

**Done (Tasks 1 to 43).**
- **Foundations:** tooling and CI configuration, the module layout (decision 0003), and every PRD role.
- **Identity:** sessions with refresh tokens, Admin screens for users and memberships, and field-level rules for commercial data.
- **Workflow:** the gate registry with placeholder gates and recorded exceptions, domain events, and stage completion with a note plus photo, video, PDF and AutoCAD files.
- **Dashboard:** workflow health with phase icons and the hover callout.
- **Finishing:** the Finishing package and the 80% fee gate.
- **Projects:** clients, contacts and sites, the fee plan, CSV and XLSX import, and project images (a 3D view).
- **Principal architect:** the designation, the interim fee ledger for Accounts, and the principal overview.
- **Later tasks:** the password reset stub, approval delegation, the pure activity state machine, flow version pinning, the PRD stage mapping, and the client demo refreshed to show all of the above.

**Suites at close.** 842 backend tests pass on SQLite and PostgreSQL. 52 Playwright E2E tests pass. semgrep, pip-audit and npm audit are clean.

**Not done.**
- CI has never run on GitHub, because nothing has been pushed.
- v2 Task 20 (Android build) is still blocked: it needs JDK 21 and the Android SDK.
- The state machine isn't wired into ProjectStage (S05).
- The password reset sends nothing.
- Delegation covers site-visit review only, and the web review queue still shows only for Team Leads.

**Deviations.**
- Migration numbers in the task list were stale; the real ones are 0019 to 0022.
- Flow versions snapshot `stage_config` rather than an editable template.
- The demo, frozen at v3 by the PRD, was refreshed at the user's request (Task 42).

**Open questions for Parvez (seeded as TBD_PARVEZ).**
- Stage owners.
- The field visibility matrix (FIELD_RULES).
- The exception roles.
- Stage evidence rules and file size limits.
- Stage delay thresholds (STAGE_DELAYED_AFTER_DAYS).
- The basis of the 50% and 80% fee percentages.
- Principal-only views: more than one principal, and who else may read fees.
- The major milestones list.
- Overall completion weights.
- The resolved-issues window and the password reset TTL.
- The delegation maximum length.
- Whether the client app should show the project image.
- The D-13 data.

**Next sprint.** Execution-plan step 6 onwards, starting with S05: meetings, requirements, the baseline and sign-off. It includes wiring the activity state machine into ProjectStage.

