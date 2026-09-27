# SiteFlow progress log

## Sprint status

| Sprint | State | Where |
|---|---|---|
| v1 | Done: the three-step loop on FastAPI | `sprints/v1/` (with WALKTHROUGH.md) |
| v2 | 20 of 21 tasks done. The Android build and device check are open (no JDK or SDK on the build machine) | `sprints/v2/` |
| v3 | In progress: stage tracker, client sign-off and customer app | `sprints/v3/` |

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
