# Architecture

## System Overview

```
Browser / PWA
     │
     ▼
Next.js (App Router) — GCP Cloud Run
     │
     ├── Firebase Auth         (identity: Google / Apple OAuth)
     ├── GCP Cloud SQL         (Postgres via Prisma ORM)
     ├── GCP Cloud Storage     (profile photos)
     ├── Resend / Gmail API    (email — abstracted via sendEmail())
     └── Slack Incoming Webhooks (admin notifications)

GCP Cloud Scheduler
     └── Hits Next.js API routes for scheduled jobs
```

See PRD §13 for the full tech stack rationale and migration path.

## Request Flow

```
1. Browser → Next.js
2. Next.js middleware verifies Firebase ID token (from cookie/header)
3. Token claims map to DB user (role: buddy / admin / super_admin)
4. API route / Server Action executes with user context
5. Prisma query → Cloud SQL
6. Response returned
```

## Auth Flow

```
1. User clicks "Sign in with Google/Apple"
2. Firebase Auth handles OAuth redirect
3. Firebase issues ID token
4. Next.js middleware validates token on every request
5. On first login: user record created in DB with status = pending
6. Admin approves → status updated → buddy notified
```

See PRD §4 for the signup approval business rules.

## File Upload Flow

```
1. Client requests signed upload URL from Next.js API
2. API generates GCS signed URL (server-side, no credentials exposed)
3. Client uploads directly to GCS
4. Client notifies API of completion
5. API stores GCS object path in DB
```

## Notification Flow

```
Event occurs (booking, cancellation, tour edit, etc.)
     │
     ├── In-app: written to notifications table in DB
     └── External:
           ├── Immediate? → sendEmail() / Slack webhook fired now
           └── Digest?    → written to digest queue; Cloud Scheduler flushes at 9:00 AM JST
```

See PRD §10 for event types, channels, and delivery mode defaults.

## Environments

| Env | Description |
|---|---|
| `development` | Local Next.js dev server; local Postgres (Docker) or Cloud SQL proxy |
| `preview` | Auto-deployed PR previews via GitHub Actions; shared staging DB |
| `production` | Cloud Run; Cloud SQL production instance |

## CI/CD

```
GitHub PR → GitHub Actions
     ├── Type check (tsc)
     ├── Lint
     └── (Tests — to be added)

Merge to main → GitHub Actions
     └── Build & deploy to Cloud Run
```
