# 0002 — A client-facing app for tracking and milestone sign-off

- **Date:** 27 September 2026
- **Status:** Requested by TAN GLOBUS AI on 27 September 2026. Confirmation from Architect Parvez is pending.

## Context
PRD v3.1 §3.3 lists "public client portal in the first pilot unless separately approved" as a non-goal. Plan step S05 has internal users capture client sign-off on the client's behalf, with the method recorded, "since there is no client portal".

## Decision
Sprint v3 adds a client-facing app in the same web and Android codebase, under a new Client role:
- The Architect invites a client to a project with a one-time code, shared by hand. Nothing is sent automatically yet.
- The client sees only their own projects: phases, current stage, official progress, sign-off requests and updates the Architect shares.
- The client signs off four milestones after reviewing the exact package: requirements baseline (stage 4), design freeze of all elevations (11), tile and material selection (17) and handover (18).
- A client cannot approve until every attachment in the package has been opened. Approval records the typed full name, the confirmation statement, the time, the method `client_app` and a request fingerprint.

## Consequences
- This amends PRD v3.1 §3.3 and plan step S05. Recording a sign-off on the client's behalf is not built in v3.
- The client API is separate (`/client/*`), with allow-listed responses. Every staff route rejects the Client role, and a test enumerates all routes.
- Still open for Parvez:
  - The named client signatory and backup per project (D-04).
  - The confirmation wording, which needs legal review.
  - The client decision SLA.
  - How long invite codes last.
  - Which site updates clients may see.
