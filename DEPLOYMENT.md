# Deployment Architecture

> **Only "Schema Changes" is current.** Everything else in this file is the
> 2026-08 GCP/Neon/R2 plan, superseded on 2026-09-10 by
> [`docs/deploy-plan.md`](docs/deploy-plan.md) — Azure Japan East, two
> environments, Postgres Flexible Server, Azure Blob. Verified costs are in
> [`docs/azure-costs.md`](docs/azure-costs.md); the reasoning and the rejected
> alternatives are in [`docs/decisions.md`](docs/decisions.md) (2026-09-10 and
> 2026-09-12). Kept as the record of what was considered before the grant, and
> because the Neon capacity analysis is still the only sizing work done.
>
> Two figures below are stale beyond the hosting change: the user count is
> **~70 members**, not 250, and the environment model is **prod + staging**, not
> one environment.

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
- Neon Free plan (verified 2026-08-13): 0.5 GB storage/project, **100 CU-hours/project/month**, history retention **6 hours** (1 GB limit)
- ⚠️ **7-day point-in-time restore is the paid Launch plan, not Free.** Free gives 6 hours. If we want a real backup window, that is a paid line item, not a free-tier feature
- Launch plan rates: $0.35/GB-month storage, $0.106/CU-hour compute (usage-based; any fixed base fee not verified)
- Compute hours, not storage, are the binding free-tier constraint — see analysis below
- Branching (DB-per-PR) useful for staging

### Auth — Firebase Authentication
- Already integrated
- Free tier covers far more than 250 users

### Object Storage — Cloudflare R2
- Stores buddy profile photos
- Free tier: 10 GB storage, zero egress fees (unlike Firebase Storage which charges per GB out)
- Custom domain via `photos.buddy.plab.jp` once the `buddy.plab.jp` Cloudflare zone is set up; or use the built-in `r2.dev` URL

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
- Don't store binary data in Postgres — `photoUrl` references point to **Cloudflare R2** (free egress vs Firebase Storage's paid egress at scale).

## Compute Hours Analysis (Neon 100 CU-hours free)

Storage is not what we run out of first — **compute hours are**. Neon's minimum
compute size is 0.25 CU, so 100 CU-hours/month buys ~400 hours of wall-clock
uptime. A month is ~730 hours, meaning the database can only be awake ~55% of
the month on the Free plan.

This interacts badly with our scheduled jobs. `apps/api/src/routes/jobs.ts`
exposes four dispatch endpoints (`dispatch`, `reminders`, `maybe-reminders`,
`maybe-deadlines`). Each invocation wakes Neon, which then stays up for the
autosuspend window (default 5 min) before scaling back down:

| Cron frequency | Approx. uptime | CU-hours/month | Free tier? |
|---|---|---|---|
| 1 consolidated tick/hour | ~10% | ~18 | ✅ comfortable |
| Every 15 min | ~40% | ~73 | ⚠️ tight, before user traffic |
| Every 5 min | ~always on | ~182 | ❌ exceeds free tier |

**Design rule**: run **one consolidated hourly tick** that fans out to all four
notification services, rather than four independent schedules. This keeps Neon
inside the free tier *and* stays within Cloud Scheduler's free allowance (below).

## Google Cloud Nonprofit Credits

**Plan as if there is no Google Cloud nonprofit credit.** (Verified 2026-08-13.)

Google for Nonprofits is strong on Workspace, Ad Grants, and Maps credits, and
effectively absent on compute:

- The [official Google for Nonprofits page on Cloud credits](https://support.google.com/nonprofits/answer/16245748?hl=en)
  **names no credit amount**. It largely restates the standard Google Cloud Free
  Tier and the ordinary $300 trial that *every* signup receives.
- The "up to $10,000/year" figure circulating online traces to third-party blogs,
  **not to any Google source**. The earlier version of this doc cited it; that was
  unsourced and has been removed.
- A [community thread](https://support.google.com/nonprofits/thread/348662291/are-non-profit-organization-eligible-for-500-yearly-credits-for-google-cloud-engine?hl=en)
  asking about $500/year never received an authoritative answer.

Our Workspace for Nonprofits discount does **not** imply any Cloud entitlement —
they are separate programs.

### Nonprofit programs that do publish numbers

| Program | Amount | Catch |
|---|---|---|
| [Azure for Nonprofits](https://learn.microsoft.com/en-us/industry/nonprofit/microsoft-for-nonprofits/nonprofit-offerings-products) | $2,000/yr credits | Renews annually, no rollover |
| [AWS via TechSoup](https://www.techsoup.global/aws-faq) | $1,000–2,000/yr | Gated on US 501(c)(3) status — **does not apply to us** |
| [Cloudflare Project Galileo](https://www.cloudflare.com/galileo/) | Free enterprise-grade protection | At-risk orgs only, requires partner nomination |

**Japan routing**: AWS's program runs on US 501(c)(3) determination, which we
don't have. The relevant validation body for a Japanese nonprofit is
[TechSoup Japan](https://www.techsoupjapan.org/about-pngoprogramme) (日本NPOセンター),
which offers Azure and M365 at ~4–10% of retail as an admin fee. Eligibility
depends on legal form (NPO法人 / 社会福祉法人 / 公益社団・財団法人) — confirm ours before applying.

### Decision: don't chase credits

Azure's $2,000/yr is ~30× our projected annual bill (~$60). Re-architecting the
stack — swapping Neon for Azure Postgres, moving auth off Firebase, rewriting the
container deploy — to capture a credit worth more than the thing it pays for is a
bad trade. A credit is only worth taking if it lands on the stack we were already
going to build.

**The real exposure is the missing spending ceiling, not the missing credit.** See
Monitoring & Ops.

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

> ⚠️ **"Free tier" ≠ "cannot be charged."** Cloud Run does not exist on Firebase's
> free Spark plan. Choosing it means enabling GCP billing — card on file,
> pay-as-you-go. Google Cloud provides budget *alerts*, not hard caps. Every $0
> below assumes nothing loops, misfires, or gets scraped.

| Service | Now | 1 year | 5 years | Note |
|---------|-----|--------|---------|------|
| Firebase Hosting (static assets) | $0 | $0 | $0 | |
| Next.js SSR | $0 | $0–5/mo | $0–10/mo | App Router + middleware + cookie auth = **not static**; served by Cloud Run/Functions, Blaze-only |
| Cloud Run (API) | $0 | $0–5/mo | $0–10/mo | |
| Cloud Scheduler | $0 | $0 | $0 | 3 jobs free/billing account; **4 endpoints today** → consolidate to 1 tick, else $0.10/job/31d |
| Artifact Registry | $0 | ~$0–1/mo | ~$0–1/mo | 0.5 GB free/billing account, $0.10/GB after; Node monorepo images exceed this without a cleanup policy |
| Neon | $0 | $0 | $0–20/mo | Free = 6h retention only. Real backups or >100 CU-hours ⇒ paid Launch |
| Firebase Auth | $0 | $0 | $0 | |
| Cloudflare R2 (photos) | $0 | $0 | $0 | Zero egress fees |
| Email (Gmail API) | $0 | $0 | $0 | Existing Workspace service account — no ESP bill |
| **Total** | **$0** | **~$0–10/mo** | **~$0–40/mo** | |

Assume **no** Google Cloud nonprofit credit offsets this (see above).

## Schema Changes

Every schema change ships as a migration file in `prisma/migrations/`, applied
with `prisma migrate deploy`. `prisma db push` is no longer used anywhere — see
`docs/decisions.md`, "Prisma Migrate replaces db push".

- Edit `prisma/schema.prisma`, run `prisma migrate dev --name <change>`, review
  the generated SQL, and commit the migration file with the schema change.
- Hand-write the SQL when the generated version would lose data. Enum renames
  are the standard case; the pattern is below.
- The dev container runs `migrate deploy` on start, so a fresh local database is
  built from the migration history, never from the schema directly.
- CI replays `prisma/migrations/` against a throwaway Postgres and fails the
  branch if the result differs from `schema.prisma`, so a schema edit without a
  migration cannot merge.

### No deploy step applies DDL

`scripts/deploy.sh` builds images and runs `gcloud run deploy`. It issues no
schema command, and the production `runner` stage in `apps/api/Dockerfile` does
not ship the Prisma CLI. So a deploy never alters the database: someone runs
`prisma migrate deploy` by hand against the target, never from a container
`CMD`, because Cloud Run and Container Apps both run several replicas at once.

The consequence is that code and schema move independently. A release whose
code expects a schema the server does not have will run, and fail at the rows
that disagree rather than at boot. `prisma migrate status` against the target
answers whether that gap exists.

**Open:** where `migrate deploy` runs on release. Deferred until the move to
Azure Container Apps lands (`docs/deploy-plan.md`), because the answer is
host-specific and `scripts/deploy.sh` is being replaced.

### Baselining an existing database

A database that predates `prisma/migrations/` is not empty and has no migration
history, so `migrate deploy` refuses it with `P3005`. Confirm the database
already matches the schema, then mark every migration applied:

```
prisma migrate diff --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma --exit-code   # 0 = in sync, 2 = differs
prisma migrate resolve --applied 0_init                    # once per directory
```

The diff is not optional. `migrate resolve --applied` asserts that the database
already has everything that migration creates; run it against a database that
differs and every later migration applies on a false assumption.

**Resolve every directory in `prisma/migrations/`, not just `0_init`.** The diff
above compares against `schema.prisma`, which is the *end* of the migration
history. A database that passes it already has the effects of every migration,
so leaving the later ones unresolved means `migrate deploy` re-applies them.
There are two directories as of 2026-09-12 — `0_init` and
`20260912032858_add_member_type` — so this is no longer hypothetical. Read the
directory, do not work from this list.

Local databases were baselined on 2026-09-12. Staging was not — it is not
reachable from the dev machine, and it still needs the enum remap below before
the diff comes back clean.

### Renaming enum values on a populated database

Postgres cannot drop an enum value, so the type has to be rebuilt, and the
generated migration's `USING` cast fails against rows still holding the old
value. Write the rebuild by hand instead.

Do **not** reach for `ALTER TYPE ... ADD VALUE` followed by a backfill in the
same file. Postgres documents that a value added inside a transaction block
"cannot be used until after the transaction has been committed", so the backfill
fails wherever the migration runner wraps the file in one. Swapping the type
avoids the question — every statement below is safe in a single transaction:

```sql
-- 1. the new type, with the dead values already gone
CREATE TYPE "BuddyTier_new" AS ENUM ('junior', 'buddy', 'star', 'blackstar');

-- 2. every column of the old type — here BuddyProfile.tier and
--    Booking.buddyTier. Miss one and the DROP in step 3 fails.
--    The CASE is the rename; NULL stays NULL.
ALTER TABLE "BuddyProfile" ALTER COLUMN "tier" TYPE "BuddyTier_new"
  USING (CASE WHEN "tier"::text IN ('mid', 'senior') THEN 'buddy'
              ELSE "tier"::text END)::"BuddyTier_new";
ALTER TABLE "Booking" ALTER COLUMN "buddyTier" TYPE "BuddyTier_new"
  USING (CASE WHEN "buddyTier"::text IN ('mid', 'senior') THEN 'buddy'
              ELSE "buddyTier"::text END)::"BuddyTier_new";

-- 3. retire the old type and take its name
DROP TYPE "BuddyTier";
ALTER TYPE "BuddyTier_new" RENAME TO "BuddyTier";
```

Neither `BuddyTier` column carries a default. One that did would need
`ALTER COLUMN ... DROP DEFAULT` before step 2 and the default re-added after
step 3, because a default typed as the old enum blocks the column swap.

For a database holding only seed data, dropping it and running `pnpm seed` is
faster.

## Deployment Flow (when ready)

1. Apply for Google Cloud Nonprofit credits via Google for Nonprofits admin console
2. Create Firebase project (web hosting + auth)
3. Create Cloud Run service for the Hono API (deploy via `gcloud run deploy` or GitHub Actions)
4. Create Neon project + database; set `DATABASE_URL` in Cloud Run env
5. Create Cloudflare R2 bucket; enable public access (`r2.dev` URL or custom domain under `buddy.plab.jp`); set `R2_*` env vars in Cloud Run
6. Configure custom domain: add NS record in Xserver delegating `buddy.plab.jp` to Cloudflare; add CNAME records in Cloudflare for Firebase Hosting (web) and Cloud Run (API)
7. Set env vars: Firebase service account, API URL, Neon connection string
8. Run `prisma migrate deploy` to initialize schema
9. Deploy & smoke test

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
- **Backups**: Neon Free gives a **6-hour** history window, not 7 days. That is not a
  backup strategy. Either accept 6h, add a scheduled `pg_dump` to R2, or pay for Launch
- **Logs**: Cloud Run + Firebase built-in logging is sufficient
- **Alerts**: Cloud Run can email on errors; configure for production only
- **Billing kill-switch** (do this before first prod deploy): GCP budget alert →
  Pub/Sub → Cloud Function that disables the billing account. Costs nothing.
  Budget alerts alone only notify; they do not stop spend. This is the single
  highest-value ops task, and it matters more than any credit application

## Open Questions

- ~~Exact Google Cloud nonprofit credit amount~~ — **resolved 2026-08-13**: no amount is
  officially published; plan for zero
- Whether to host API on Cloud Run vs Cloudflare Workers (deferred until deploy time; Prisma support on Workers requires adapter changes)
- Whether plab's legal form qualifies for TechSoup Japan validation
- Whether a 6-hour restore window is acceptable, or we need scheduled `pg_dump` → R2
- R2 free-tier Class A/B operation limits — **not yet verified**
