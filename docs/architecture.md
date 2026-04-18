# Architecture

## System Overview

```
Browser / PWA
     │
     ▼
Next.js (App Router) — GCP Cloud Run   ← frontend only; no business logic
     │
     └── REST API calls
          │
          ▼
     Hono API — GCP Cloud Run           ← all business logic, DB access, auth validation
          │
          ├── Firebase Auth         (identity: Google / Apple OAuth)
          ├── GCP Cloud SQL         (Postgres via Prisma ORM)
          ├── GCP Cloud Storage     (profile photos)
          ├── Resend / Gmail API    (email — abstracted via sendEmail())
          └── Slack Incoming Webhooks (admin notifications)

GCP Cloud Scheduler
     └── Hits Hono API routes for scheduled jobs
```

## Repo Structure

Monorepo managed with pnpm workspaces:

```
/
├── apps/
│   ├── web/        ← Next.js (frontend only — UI, routing, rendering)
│   └── api/        ← Hono backend (all business logic, Prisma, auth middleware)
├── packages/
│   └── types/      ← shared Zod schemas and TypeScript types
└── prisma/         ← shared Prisma schema; migrations live here
```

See PRD §13 for the full tech stack rationale.

## Request Flow

```
1. Browser → Next.js (UI rendering)
2. Next.js → Hono API (REST call with Firebase ID token in Authorization header)
3. Hono middleware verifies Firebase ID token
4. Token claims map to DB user (role: buddy / admin / super_admin)
5. Hono route handler calls service layer
6. Prisma query → Cloud SQL
7. Response returned to Next.js → rendered to browser
```

## Auth Flow

```
1. User clicks "Sign in with Google/Apple"
2. Firebase Auth handles OAuth redirect
3. Firebase issues ID token
4. Next.js stores token; passes it in Authorization header on every API call
5. Hono middleware validates token on every request
6. On first login: user record created in DB with status = pending
7. Admin approves → status updated → buddy notified
```

See PRD §4 for the signup approval business rules.

## File Upload Flow

```
1. Client requests signed upload URL from Hono API
2. API generates GCS signed URL (server-side, no credentials exposed)
3. Client uploads directly to GCS
4. Client notifies Hono API of completion
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
| `development` | Local Next.js dev server + local Hono API; local Postgres (Docker) or Cloud SQL proxy |
| `preview` | Auto-deployed PR previews via GitHub Actions; both services deployed; shared staging DB |
| `production` | Both services on Cloud Run; Cloud SQL production instance |

## CI/CD

```
GitHub PR → GitHub Actions
     ├── Type check (tsc) — web + api + types
     ├── Lint
     └── (Tests — to be added)

Merge to main → GitHub Actions
     ├── Build & deploy web → Cloud Run
     └── Build & deploy api → Cloud Run
```
