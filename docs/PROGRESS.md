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
- **Client demo (published v3 Artifact): not updated, as requested on 28 September 2026.** It doesn't show v4 features: stage files, exceptions, the Team and Import screens, the fee plan, or the dashboard icons and callout. A later demo update is possible if asked. `web-src/build.py` still gives the demo its v3 stage shape, so the demo build and its E2E test keep passing.
- **Found, not fixed (the demo is frozen):** `demo-api.js` `uploadSignoffAttachment` strips only `/` from file names, not `\` as intended.
- **Open question:** should the client app show the project image (the 3D view) on the client's own project? It doesn't yet (Task 31).
- **Open question:** may more than one person be the principal architect? The build allows one or more; the seed marks only Parvez (Task 32).
- **Follow-up for S05 (from Task 38):** wire `modules/workflow/states.py` into ProjectStage. Store the activity state, drive the stage engine through `transition()` and migrate the stored statuses with `from_stored()`. Today it is a pure module with tests only.
