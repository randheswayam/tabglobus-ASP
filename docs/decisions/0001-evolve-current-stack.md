# 0001 — Evolve the current stack instead of the React rebuild

- **Date:** 27 September 2026
- **Status:** Accepted for sprint v3 (TAN GLOBUS AI). Open to review.

## Context
`docs/reference/SiteFlow-Implementation-Plan-for-Claude-Code.md` assumes a new repository with a React, TypeScript and Vite web app, Redis and arq workers, MinIO, and a modular-monolith layout (`backend/app/modules/*`), built from step S00.

Sprints v1 and v2 already deliver a working FastAPI and PostgreSQL backend with Alembic migrations, a vanilla JavaScript web app wrapped by Capacitor, and a client demo. The backend has 234 tests, including a run on PostgreSQL, and there are 15 Playwright tests.

## Decision
Sprint v3 builds on the existing codebase and moves toward PRD v3.1 step by step. It does not restart at plan step S00.

## Consequences
- The customer app and milestone sign-offs ship in sprint v3, instead of waiting for a rebuild.
- The plan's module layout, React front end, background worker (Redis and arq) and MinIO are not adopted yet. Timed checks, such as red flags, run when data is read or changed, not on a schedule.
- Revisit this before the pilot. The trigger is the drawing register and change control (plan S06 and S09): once the single-file front end becomes hard to change, a React migration becomes worthwhile.
