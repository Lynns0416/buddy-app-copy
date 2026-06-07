# Deployment Architecture

## Context
Peace Buddy is an internal app for ~200–250 buddies (coworkers). The org is a Google-verified non-profit on Google Workspace Business Standard. Deployment must:
- Avoid surprise billing / subscription creep
- Stay cheap or free at this scale, indefinitely
- Single production environment (staging optional, only if free)

## Recommended Stack

### Web — Firebase Hosting
- Hosts the Next.js frontend
- Free tier: 10 GB storage, 360 MB/day egress — far above internal-app needs
- Integrates with the existing Google Workspace identity
- No team-account ToS issues like Vercel Hobby

### API — Google Cloud Run
- Hosts the Hono backend (container deploy)
- **Scale-to-zero**: pays nothing when idle (internal apps idle most of the time)
- Generous always-free tier: 2M requests/month, 360k GB-seconds, 180k vCPU-seconds
- For 250 internal users, real cost is ~$0–5/month even without credits

### Database — Neon (serverless Postgres)
- **NOT Cloud SQL** — Cloud SQL's smallest tier is ~$10–15/month for capacity we won't use
- Neon free tier: 0.5 GB storage, autosuspend when idle, point-in-time restore (7 days)
- Paid: $19/month for 10 GB if outgrown (years away — see capacity analysis below)
- Branching (free DB-per-PR) useful for staging without cost

### Auth — Firebase Authentication
- Already integrated
- Free tier covers far more than 250 users

### Domain & Email — Google Workspace Business Standard (existing)
- Non-profit pricing already in place
- Org domain is `plab.jp`, registered and DNS-hosted on **Xserver** (managed jointly with a partner org)
- For the app subdomain: delegate a subdomain (e.g. `buddy.plab.jp`) to **Cloudflare DNS** via a single NS record in Xserver — one-time setup, then all app DNS records are managed in Cloudflare
- Firebase Hosting and Cloud Run both support custom domains via CNAME; TLS is provisioned automatically by each service

## Storage Capacity Analysis (Neon 0.5 GB free)

Estimated DB growth based on current `prisma/schema.prisma`:

| Category | 1 year | 5 years |
|----------|--------|---------|
| Users / profiles / groups | ~500 KB | ~600 KB |
| Tours / sessions / bookings | ~5 MB | ~25 MB |
| Evaluations (3 tables, text-heavy) | ~30 MB | ~150 MB |
| Notifications / digest queue | ~8 MB | ~40 MB |
| Indexes (~40% overhead) | ~17 MB | ~85 MB |
| **Total** | **~60 MB** | **~300 MB** |

**Assumptions**: 250 buddies, 50–100 tours/year, 2 sessions/tour, 15 bookings/session, 70% of bookings get evaluations across 3 tables.

**Conclusion**: 500 MB free tier comfortably covers 3–5 years. Worst case (every note field filled, more tours/year) could hit ~500–600 MB by year 5 → upgrade to Neon paid at that point, or archive old years.

**Storage drivers to watch**:
- `AdminEvaluation` / `AdminProfileEvaluation` / `SelfEvaluation` — 11 `xxxNote` fields each. Most will be null/short, but bloat possible if evaluators write essays.
- `Notification.payload` / `DigestQueue.payload` — keep JSON payloads lean (no full embedded objects).
- Don't store binary data in Postgres — `photoUrl` references should point to object storage (Firebase Storage free tier handles this).

## Google Cloud Nonprofit Credits

Google Cloud credits for nonprofits exist but **amounts are opaque** on official Google pages:
- Official help page confirms eligibility but doesn't state credit amounts
- Third-party sources cite "up to $10,000/year"
- A community thread title references "$500 yearly"
- Actual amount appears to depend on application approval

**Apply via**: [google.com/nonprofits](https://www.google.com/nonprofits) admin console → look for "Google Cloud" in offerings. Or post on the [Google for Nonprofits Community](https://support.google.com/nonprofits/community).

Even any credit amount (including $500) covers Cloud Run + Firebase usage for years at our scale. Without credits, the stack still costs <$5/month.

## Why Not Alternatives

### Vercel (web)
- Free Hobby plan is for personal use; org-owned apps technically need Pro at $20/user/month
- Many small orgs use Hobby informally, but ToS gray area

### Fly.io (API + DB)
- Moved to pay-as-you-go in late 2024 — no longer the "generously free" platform
- Postgres pricing increased; less predictable than Neon

### Supabase (DB)
- Free tier (500 MB) similar to Neon, but bundles auth/realtime/edge functions we don't use
- Free → paid jump is steeper ($25/month vs Neon's $19/month for 10 GB)

### Cloud SQL (DB)
- Managed Postgres but smallest tier ~$10–15/month for capacity we won't use
- Overkill for 250 internal users

### Self-hosted (any)
- Ops burden too high for a small internal app

## Cost Projection

| Service | Now | 1 year | 5 years |
|---------|-----|--------|---------|
| Firebase Hosting | $0 | $0 | $0 |
| Cloud Run | $0 | $0–5/mo | $0–10/mo |
| Neon | $0 | $0 | $0 (likely; $19/mo worst case) |
| Firebase Auth | $0 | $0 | $0 |
| **Total** | **$0** | **$0–5/mo** | **$0–30/mo** |

Nonprofit credits (if approved) cover the Google services portion.

## Schema Changes (Pre-release)

- Use `prisma db push` — no migration framework needed
- Delete `memory/project_prerelease.md` on first prod deploy and switch to `prisma migrate deploy`

## Deployment Flow (when ready)

1. Apply for Google Cloud Nonprofit credits via Google for Nonprofits admin console
2. Create Firebase project (web hosting + auth + storage)
3. Create Cloud Run service for the Hono API (deploy via `gcloud run deploy` or GitHub Actions)
4. Create Neon project + database; set `DATABASE_URL` in Cloud Run env
5. Configure custom domain: add NS record in Xserver delegating `buddy.plab.jp` to Cloudflare; add CNAME records in Cloudflare for Firebase Hosting (web) and Cloud Run (API)
6. Set env vars: Firebase service account, API URL, Neon connection string
7. Run `prisma db push` to initialize schema
8. Deploy & smoke test

## Fallback: Truly Free Stack (no credits needed)

If nonprofit Cloud credits don't materialize:
- **Web**: Cloudflare Pages (free, unlimited, no team ToS restriction)
- **API**: Cloud Run (still cheap without credits) or Cloudflare Workers (free 100k req/day — requires Prisma adapter changes)
- **DB**: Neon free tier (same as primary plan)
- **Auth**: Firebase (same)

This stack also stays free for years at internal-app scale.

## Monitoring & Ops

At 250 internal users:
- **Uptime target**: 99% (not 99.99% — this isn't public SaaS)
- **Backups**: Neon point-in-time restore (7 days, free)
- **Logs**: Cloud Run + Firebase built-in logging is sufficient
- **Alerts**: Cloud Run can email on errors; configure for production only

## Open Questions

- Exact Google Cloud nonprofit credit amount — confirm via admin console application
- Whether to host API on Cloud Run vs Cloudflare Workers (deferred until deploy time; Prisma support on Workers requires adapter changes)
