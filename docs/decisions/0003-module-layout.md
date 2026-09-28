# 0003 — Module layout for new domain code

- **Date:** 28 September 2026
- **Status:** Accepted for sprint v4 (TAN GLOBUS AI). Open to review.

## Context
`docs/IMPLEMENTATION_PLAN.md` and `docs/V4_IMPLEMENTATION_PLAN.md` place domain code in `backend/app/modules/<domain>/`: identity, workflow, projects, and later scheduling, fees, channels, ai and others.

The repository was built in sprints v1 to v3 with a flat layout: `backend/app/routers/` for HTTP routes and `backend/app/services/` for rules. Decision 0001 keeps the existing stack rather than rebuilding it. `docs/V4_EXECUTION_PLAN.md` risk R-01 asks where new code should live, so that every V4 prompt's paths make sense.

## Decision
- **New domain code** goes in `backend/app/modules/<domain>/`. Each module holds its models' service functions, its router, and its rules, and exposes a small interface to other modules.
- **Existing code** in `services/` and `routers/` stays where it is. It moves into a module only when a task changes it for a real reason, never as a standalone reshuffle.
- **Models** stay in `backend/app/models.py` for now, so that Alembic autogeneration and the flush guards keep working unchanged. A module may later own a models file once the number of tables makes the single file hard to work with.
- **Identifiers** stay integers for now. UUID identifiers and an `organization_id` on project records (PRD v3.2 section 16) are planned before V08, the integration framework. That is where external systems and signed links start to reference records (R-14).
- **Roles** keep their stored values. The mapping to PRD v3.2 section 5 is:

| Stored role | PRD role |
|---|---|
| `admin` | Principal Architect / Admin |
| `architect` | Project Architect / Project Manager, and Architect / Designer |
| `team_lead` | Reviewer / Team Lead |
| `civil_engineer` | Civil / Site Engineer |
| `client` | Client / External Reviewer |

Sprint v4 Task 7 added the remaining PRD roles, stored as `structural_consultant`, `mep_consultant`, `interior_designer`, `accounts` and `office_coordinator`. They are staff roles. Like the Civil Engineer, they see only the projects they are members of.

**The principal architect** (sprint v4 Task 32) is a designation on a staff user (`users.is_principal`), not a separate role. The person keeps their role's permissions (Parvez stays Team Lead for reviews) and adds the principal-only views. Only an Admin sets it, and only on an active staff user.

The role column is a 32-character string with no database check constraint, so adding a role needs no migration.

## Consequences
- The paths in the V4 implementation-plan prompts resolve as written.
- For a while, two layouts exist side by side. A reader looks in `modules/` for v4 code and in `services/` and `routers/` for v1 to v3 code.
- Revisit this when models move out of `models.py`, or when the first module needs a public interface used by more than one other module.
