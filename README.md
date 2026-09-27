# SiteFlow MVP — Android app and web prototype

Prototype by TAN GLOBUS AI for the Architecture Workflow Platform (Phase 1 MVP).

One codebase runs as both the web console and the Android field app. On a phone-width screen it switches to the mobile layout with a bottom tab bar and a focused, full-screen site visit capture.

## What the MVP covers

| Capability | Where to see it |
|---|---|
| Configure | Workflow templates → Configure. Edit steps, roles, SLA days, required fields, minimum photos, GPS, video, voice, site checklist, milestones and invoice trigger %. Saving creates a new version; running projects stay on the version they started with. |
| Create project | Projects → New project. Pick a template, assign the team, launch. The first activity is assigned immediately. |
| Dashboard | Open activities by role, awaiting review, overdue and escalated, milestones and triggers, notifications. |
| Steps | Five-step workflow: Client Requirement → Site Visit → Site Visit Review → Survey and Civil Assessment (parallel) → Concept Design. |
| Site visit capture | Visit details, camera photos stamped with date, time and coordinates, GPS capture (or project pin or manual entry), video, voice note, documents, site checklist, observations and next steps. |
| Validate | Submit is blocked until every mandatory item is present, with a list of what is missing. |
| Review | Approve starts the next step. Send back for rework returns it to the assignee with the comment. |
| Trigger next work | Parallel branches, automatic next-activity assignment, milestones that raise an invoice request, a client update and a review meeting. |
| Escalate | Activities past their SLA due date escalate to the project manager. |
| Audit trail | Every assignment, submission, decision and milestone on the project page. |

Use the "Viewing as" selector to switch between Principal Architect, Project Manager, Architect, Site Engineer, Civil Engineer and Accounts. The Android app opens as the Site Engineer.

Data is demo data stored on the device (browser storage in the web version, app storage on Android). There is no server in this prototype; "Reset demo data" restores the seeded projects.

## Build the APK

### Option A: GitHub Actions (no local setup)

1. Create a new GitHub repository and push this folder to the `main` branch.
2. Open the repository's **Actions** tab. The "Build Android APK" workflow runs on every push (or run it manually with "Run workflow").
3. When it finishes, download **SiteFlow-debug-apk** from the run's Artifacts section, unzip it and copy `app-debug.apk` to the phone.
4. On the phone, allow "Install unknown apps" for your file manager or browser, then open the APK.

### Option B: Android Studio

Requirements: Node.js 20 or newer, Android Studio (Ladybug or newer) with JDK 21 and Android SDK 35.

```
npm install
npx cap sync android
npx cap open android
```

In Android Studio: wait for Gradle sync, connect a phone with USB debugging (or start an emulator), press Run. For an APK file: Build → Build App Bundle(s) / APK(s) → Build APK(s).

### Option C: Command line

```
npm install
npm run apk
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

## Editing the app

The app source is `web-src/app.html` (layout and styles) and `web-src/app.js` (workflow engine, views, seed data). After editing, run:

```
python3 web-src/build.py
npx cap sync android
```

## Android permissions

Camera (site photos and video), fine and coarse location (GPS capture), microphone (voice notes), media read (attach from gallery). Android asks for each the first time it is used.

## Suggested next phases

- **Build**: backend API and PostgreSQL per the architecture overview, sign-in with roles, file storage for photos and documents, real email and push delivery, offline sync queue.
- **Deploy**: signed release build, Play Store internal testing track, hosted web console.
- **Evaluate**: pilot on live projects with one studio, measure submission completeness and review turnaround.
- **Maintain**: template versioning governance, Phase 2 AI features (auto-summary of site notes, missing-information detection, WhatsApp capture, delay risk alerts).
