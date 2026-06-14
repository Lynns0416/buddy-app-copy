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
          ├── Gmail API             (email — abstracted via sendEmail(); Google Workspace for Nonprofits)
          └── Slack Incoming Webhooks (admin notifications; single shared channel)

GCP Cloud Scheduler
     └── Hits Hono API routes for scheduled jobs (auth: X-Scheduler-Secret header)
```

## Repo Structure

Monorepo managed with pnpm workspaces:

```
/
├── apps/
│   ├── web/                    ← Next.js (frontend only — UI, routing, rendering)
│   │   ├── src/
│   │   │   ├── app/            ← Next.js App Router pages + globals.css
│   │   │   ├── components/
│   │   │   │   ├── ui/         ← shadcn/ui components (Button, Input, Table, Badge, …)
│   │   │   │   └── app-shell.tsx ← sidebar layout (variant: admin | buddy)
│   │   │   └── lib/
│   │   │       └── utils.ts    ← cn() utility (clsx + tailwind-merge)
│   │   └── components.json     ← shadcn config
│   └── api/                    ← Hono backend (all business logic, Prisma, auth middleware)
├── packages/
│   └── types/                  ← shared Zod schemas and TypeScript types
└── prisma/                     ← shared Prisma schema; migrations live here
```

## UI Stack

- **Tailwind CSS v4** — CSS-first config via `postcss.config.mjs`; no `tailwind.config.js`
- **shadcn/ui** — component source lives in `apps/web/src/components/ui/`; owned by the project, not a package dependency
- **Radix UI** — accessible primitives underlying shadcn components
- **Theming** — CSS variables defined in `globals.css`:
  - Default (buddy-facing): warm zinc palette
  - Admin: slate/cool blue — applied via `.theme-admin` class on the `AppShell` wrapper
  - Dark mode: enabled; toggled via `.dark` class
- **`AppShell`** — shared sidebar layout used by admin and buddy pages. Accepts `variant: 'admin' | 'buddy'` to apply the correct theme and nav items.

See PRD §13 for the full tech stack rationale.

## Responsive Layout Convention

Admin data tables follow a **card-on-mobile, table-on-desktop** pattern with a consistent breakpoint:

- **Below `lg:` (< 1024px):** card list — each row rendered as a tappable card, all fields visible
- **At `lg:` and above (≥ 1024px):** full table with sortable column headers

Implementation: two sibling elements in the same component — `<div className="lg:hidden …">` (cards) and `<div className="hidden lg:block …">` (table). Sort state is shared; sort controls appear above the card list on mobile.

**All new admin list/detail tables must use `lg:` as the breakpoint.** Using `md:` creates an inconsistent switch point across pages.

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

## Admin Profile System

### Identity Model
Admins are users with `role = 'admin' | 'super_admin'`. Each admin has a corresponding `AdminProfile` record storing:
- `name`: Human-readable name (required, used for evaluation attribution)
- `deletedAt`: Soft-delete timestamp (null = active)

Admin creation flow:
1. Super-admin creates User via admin API (`role = 'admin'`)
2. Admin logs in via Google/Apple (Firebase OAuth)
3. System detects `role = 'admin'`, auto-creates AdminProfile with name from Firebase displayName
4. Name fallback: if Firebase provides no displayName, use email prefix (e.g., "john" from "john@example.com")

### Soft-Delete Visibility
Soft-deleted admins (`deletedAt IS NOT NULL`) are **completely invisible**:
- `GET /admin/profiles` excludes deleted admins
- `GET /admin/profile` (for a deleted admin) returns 404
- Evaluations created by deleted admins still reference them (immutable audit trail), but admin's name won't appear in current roster

Only non-deleted admins and system operations can see the roster.

### Auth Enforcement
Admin-only endpoints enforce role checks explicitly in route handlers:
```
if (user.role !== 'admin' && user.role !== 'super_admin') {
  return c.json({ error: 'Forbidden' }, 403)
}
```

This applies to: `GET /admin/profile`, `PATCH /admin/profile`, `GET /admin/profiles`.

Super-admin-only endpoints check:
```
if (user.role !== 'super_admin') {
  return c.json({ error: 'Forbidden' }, 403)
}
```

This applies to: `POST /admin/profiles` (create), `DELETE /admin/profiles/:userId` (soft-delete).

### API Conventions
- **Create**: `POST /admin/profiles` — requires super_admin
- **Read**: `GET /admin/profile` (own), `GET /admin/profiles` (roster) — requires admin
- **Update**: `PATCH /admin/profile` — update own name, requires admin
- **Delete**: `DELETE /admin/profiles/:userId` — soft-delete (set `deletedAt`), super_admin only, prevents self-deletion

## File Upload Flow

```
1. Client requests signed upload URL from Hono API
2. API generates GCS signed URL (server-side, no credentials exposed)
3. Client uploads directly to GCS
4. Client notifies Hono API of completion
5. API stores GCS object path in DB
```

## Notification Flow

> **⚠ Planned (not shipped).** Foundations in code: `Notification` / `NotificationPreference` / `DigestQueue` tables, `Tour.notificationOffsets` field, `schedulerAuthMiddleware`, env vars (`SCHEDULER_SECRET`, `SLACK_WEBHOOK_URL`, Gmail credentials). No dispatch code wired yet.

```
Event occurs (booking, cancellation, tour edit, etc.)
     │
     ├── In-app: write Notification row for each recipient (buddies + admins)
     ├── Email:
     │     ├── Immediate? → sendEmail() now, via Gmail API, in recipient's locale
     │     └── Digest?    → insert DigestQueue row; flushed daily at 09:00 JST
     └── Slack: post to shared channel webhook now (if admin recipient is opted in)
```

Scheduled jobs (hourly, plus 09:00 JST digest) all enter via `/jobs/*` endpoints guarded by `X-Scheduler-Secret`. Reminder idempotency is handled via a dispatch-log table (added during implementation — see PRD §10.5).

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
     └── Tests (Vitest — api)

Merge to main → GitHub Actions
     ├── Build & deploy web → Cloud Run
     └── Build & deploy api → Cloud Run
```
