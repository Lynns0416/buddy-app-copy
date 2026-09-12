# Decisions

Append-only log of decisions and the alternatives rejected. Newest first.

PRD.md, architecture.md, and data-model.md describe **what the system is**. This
file records **why it is that and not something else** — so a settled question
does not get re-litigated in a later session.

Add an entry when a decision closes off an alternative someone might plausibly
re-propose. Link to the doc that holds the resulting current state; do not
duplicate that state here.

---

## 2026-09-12 — `memberType` is non-nullable with a `buddy` default

**Decision:** `BuddyProfile.memberType` is `MemberType` (`buddy` / `plab_member`),
`@default(buddy)`, NOT NULL. The admin buddy detail page shows its dropdown for
every account status, trainees included, unlike the tier dropdown which is
hidden for trainees. `GET /admin/buddies` gained a `?memberType=` filter
alongside `?tier=`.

**Why non-nullable:** #136 left nullable-vs-defaulted open. `tier` is nullable
because a trainee genuinely has no tier yet — the absence is meaningful.
Employment has no such state: everyone on the roster is either a part-time buddy
or on the PLAB team, from the day they apply. A nullable column would invite
"unknown" to mean "buddy" at every call site and eventually disagree with
itself. The default also makes the pre-release `prisma db push` backfill every
existing row correctly, since every existing profile is a buddy.

**Why the dropdown is shown to trainees:** employment does not depend on account
status. A PLAB member can be a trainee. Hiding the field until promotion would
force the admin to remember to come back.

**Rejected — deriving memberType from tier, or keeping a single enum:** settled
on 2026-09-10 in the BuddyTier entry below; the whole point is that the two axes
are independent.

**Rejected — 社員 / アルバイト as the Japanese labels:** already rejected on
2026-09-10. Implemented as バディ / PLABメンバー, with メンバータイプ as the field label.

**Rejected — a behavioural hook on memberType:** #136 scoped this out
explicitly. `BookingPool` still splits on `tier === junior` alone, and
eligibility, capacity, permissions and notifications all ignore memberType. If
that has to change, it is a separate issue.

**Current state:** `prisma/schema.prisma`, PRD §5.2.1, `data-model.md`
`BuddyProfile`, `api.md`.

---

## 2026-09-12 — Prisma Migrate replaces db push

**Decision:** Schema changes ship as migration files in `prisma/migrations/`,
applied with `prisma migrate deploy`. `prisma db push` is no longer used, in any
environment. The baseline `0_init` was generated from `schema.prisma` as it stood
after #140 and marked applied on the local databases.

**Why:** `db push` cannot express *how* a change is applied — it only computes a
final state. The `BuddyTier` rename in #140 was the forcing case: push generated
a drop-and-recreate of the enum, and the `USING` cast failed against rows still
holding `senior`. There is no flag that fixes that, because the fix is a
hand-written type swap — create the new enum, remap every column through a
`USING ... CASE`, drop the old type, rename — and `db push` has nowhere to put
it. A migration file holds it as one reviewable artifact; the SQL is in
`DEPLOYMENT.md`. Staging holds data now, so this stopped being theoretical.

**Rejected — wait until first production deploy.** That was the earlier plan
(`memory/project_prerelease.md`, now deleted). It assumed the cost of `db push`
was bounded until real users existed. #140 showed the cost lands as soon as any
database holds rows worth keeping, which staging already does.

**Rejected — hand-written SQL without Prisma Migrate.** Migrate's value here is
not the SQL generation, it is `_prisma_migrations` recording what a given
database has. Without it, "does staging have this change" stays a question
answered from memory.

**Deferred — where `migrate deploy` runs on release.** The production image
ships no Prisma CLI and `scripts/deploy.sh` applies no DDL, so a one-shot
migration job is real work, and `scripts/deploy.sh` is being replaced by the
Azure Container Apps move. Decide it there, `docs/deploy-plan.md` §6. Until
then it is a manual step, as `db push` was.

**Enforced in CI, not by convention.** A schema edit with no migration file
would otherwise pass every check and only fail at a query after deploy, so
`.github/workflows/ci.yml` replays `prisma/migrations/` into a throwaway
Postgres and fails the branch if the result differs from `schema.prisma`.
`CLAUDE.md` carries the matching rule.

**Not verified:** `migrate resolve --applied` against Neon, and staging's actual
enum state. Staging is not reachable from the dev machine. It still needs the
enum remap in `DEPLOYMENT.md` before the baseline diff comes back clean, and it
must not be baselined before it does. The CI drift check has not run yet — it
was written without a local Docker daemon.

**Current state:** `DEPLOYMENT.md` "Schema Changes", `README.md` "Schema
changes", `docs/architecture.md`, `.github/workflows/ci.yml`.

---

## 2026-09-12 — Four apps in one Container Apps environment, not two environments

**Decision:** Prod and staging share the single `cae-peace-buddy` environment
and get their own apps inside it: `ca-api` / `ca-web` for prod, `ca-api-stg` /
`ca-web-stg` for staging, matching the `-stg` suffix already used for the
staging Postgres server.

**Why:** App count is free. Container Apps bills per vCPU-second and
GiB-second actually consumed, and a revision scaled to zero incurs no resource
charge, so four idle apps cost exactly what two cost. Estimated load across both
environments is ~17,000 vCPU-seconds a month against a 180,000 grant.

**Rejected — a separate Container Apps environment per stack:** this is the
textbook prod/non-prod isolation and it is the one thing here that actually
costs money. A second environment means a second VNet, a second pair of static
public IPs at ~$88/yr, and a second managed load balancer on the unresolved
meter. Rejected for ~70 members on an internal tool.

**Accepted consequence:** apps in one environment share the VNet and can reach
each other over internal ingress, so a misconfigured staging api could in
principle open a connection to the prod database. The mitigations are the
per-environment database roles already required in `azure-costs.md`, and giving
staging's api only the staging `DATABASE_URL`.

**Current state:** `deploy-plan.md` §4 and §5.

---

## 2026-09-12 — Nightly `pg_dump` to Azure Blob, 30 daily snapshots

**Decision:** The nightly dump lands in Azure Blob Storage in the prod storage
account, under its own container, with a lifecycle rule deleting blobs older
than **30 days**. Retention is 30 daily snapshots, not 7. Cloudflare R2 is
dropped from the stack altogether once photos have moved.

**Why:** 30 days costs nothing worth measuring — this database is ~70 members
and a few thousand rows, so a compressed dump is megabytes, and even a generous
50 MB × 30 is 1.5 GB at $0.02/GB/mo, under $0.50/yr. Since the length is free,
take the length: a corruption or a bad migration noticed three weeks late is
still recoverable. The lifecycle rule does the deleting, so longer retention is
not more code.

**Accepted consequence:** the backups live in the same subscription as the thing
they back up, so losing the Azure subscription loses both. Accepted explicitly —
if the subscription is lost the app stops. Azure's own Flexible Server backups
remain the first line; this dump is the one that survives a bad migration or a
delete, and keeps a future hosting move possible while the subscription is live.

**Rejected — keeping R2 as an off-cloud backup target:** it preserves genuine
provider independence, which was the original argument in `deploy-plan.md` §9.
Rejected because it keeps two long-lived `R2_*` access keys alive for one cron
job after the photo migration removed the rest, and R2 has no equivalent of a
lifecycle rule to expire old dumps, so retention becomes code to write and get
wrong. Blob is reached by the same managed identity the photo service already
uses. The independence is real but is not worth a second provider and a second
credential for ~70 members.

**Rejected — 7 daily snapshots:** proposed as sufficient. It is, but 30 costs the
same to within cents and the extra three weeks is free insurance.

**Current state:** `deploy-plan.md` §9.

---

## 2026-09-12 — Two Azure environments, prod and staging; nothing else deployed

**Decision:** Azure gets **prod** and **staging**, each with its own Postgres
B1ms server and its own Blob storage account, sharing one resource group, VNet,
Container Apps environment and registry. The GCP/Neon stack — Cloud Run, Neon
and the `peace-buddy-staging` Firebase project, the only environment deployed
today — has its data moved to Azure staging and is then decommissioned, as its
own task after this plan. Nothing replaces it. Local Docker Compose remains for
development.

**Why:** Non-dev members were already checking and testing work on that stack,
which is staging's job, on free tiers nobody maintains. Verified costs put the
whole two-environment Azure stack at $504–$723/yr against a $2,000/yr grant, so
a maintained staging environment is affordable and the free tier was buying
nothing.

**Rejected — prod and staging sharing one Postgres server with two databases:**
proposed and briefly recommended on 2026-09-12 on cost grounds, then withdrawn
the same day. Against the design actually chosen it saves **$66/yr** —
staging's entire line, $13 of compute plus $53 of storage — because staging's
server is stopped most of the year anyway. The $281/yr quoted while it was under
discussion assumed an always-on staging server, a baseline that no longer
exists. It couples the two environments to one CPU credit budget and one
35-connection ceiling. Cost was its only argument and cost is not the binding
constraint here.

**Rejected — keeping the free GCP tier alongside Azure staging:** it exists
today only because a paid staging environment was assumed unaffordable. That
assumption did not survive the cost verification, and two half-maintained
environments are worse than one trustworthy one.

**Current state:** `deploy-plan.md` §7, `azure-costs.md`.

---

## 2026-09-12 — Staging compute is started by hand, not scheduled

**Decision:** Staging's Postgres server is stopped by default and started
manually when a feature needs review. No cron, no automation. Its storage and
storage account persist; only compute is switched off.

```
az postgres flexible-server start -g rg-peace-buddy -n psql-peace-buddy-stg
az postgres flexible-server stop  -g rg-peace-buddy -n psql-peace-buddy-stg
```

**Why:** Staging is dormant between feature cycles, so a fixed daily window pays
for hours nobody uses. Storage bills either way at $53/yr; compute is $0.026/hr,
so ~500 hours a year is ~$13 and the environment totals **$66/yr**. Every figure
in this entry is a total — compute plus that $53 — so the options compare like
for like. The team shares a tight-budget norm and can be told when staging is
up.

**Accepted consequence:** Azure restarts a stopped Flexible Server after seven
days. With nothing enforcing the stopped state, staging will quietly come back
during dormant stretches and bill compute until someone notices. This makes the
budget alert load-bearing rather than optional.

**Rejected — a scheduled daily window of 4–6 hours:** $91–$110/yr, so $25–$44
more than the manual model, and it also
disposes of the seven-day auto-restart, because a daily start never lets the
counter reach seven. Rejected because the usage pattern is bursty rather than
daily, and the schedule would bill for dormant weeks.

**Rejected — always-on staging at $281/yr:** argued on the grounds that non-dev
testers will not work to a schedule and a dead environment reads as a broken
tool. Overruled: the team can be told, and budget discipline is a shared value.

**Current state:** `deploy-plan.md` §7.

---

## 2026-09-12 — Buddy photos move from Cloudflare R2 to Azure Blob

**Decision:** Photo storage moves to Azure Blob Storage in Japan East, one
storage account per environment, reached from Container Apps by **managed
identity** rather than access keys. Local development uses **Azurite**
(`mcr.microsoft.com/azure-storage/azurite`) in the compose file. Sequenced
**after** the Azure cutover, not as part of it.

**Why:** Residency, not cost. Cloudflare supports EU, US and FedRAMP
jurisdictions only, with no Japan option, and states that location hints are
best-effort rather than a guarantee. Member photographs therefore kept the APPI
外的環境の把握 burden that moving the database to Japan East was meant to remove.
Blob in Japan East closes that and leaves Firebase Auth as the only US piece.

Two secondary gains: the five long-lived `R2_*` keys disappear, and those keys
already caused one silent photo-upload failure in staging (see the 2026-09-10
entry below); and photos can be served through short-lived SAS URLs instead of
an anonymous public bucket URL, which for personal data beats relying on
unguessable paths.

Cost is not a factor either way: Hot LRS is $0.02/GB/mo, so ~70 profile photos
run under $2/yr.

**Rejected — staying on R2:** it works today and its zero-egress pricing is
genuinely better, but egress is irrelevant at this volume and Azure's first
100 GB/mo is free regardless. The residency gap is not fixable on R2.

**Rejected — migrating photos during the Azure cutover:** the cutover already
carries unverified steps and photos are not on its critical path. The surface is
small and contained (`apps/api/src/services/buddyPhoto.service.ts` at 172 lines,
its test, `deploy.sh`, `deploy.env.example`, and `next.config.ts` remote
patterns), so it is cheap to do separately.

The `pg_dump` backup target was the last thing holding R2 open. Settled by
*Nightly `pg_dump` to Azure Blob, 30 daily snapshots* (2026-09-12): backups go
to Blob too, so R2 leaves the stack entirely.

**Current state:** `deploy-plan.md` §2 and §8, `azure-costs.md`.

---

## 2026-09-10 — Hosting is Azure Japan East, funded by the nonprofit grant

**Decision:** The permanent stack is **Azure Container Apps (workload-profiles
environment, Consumption profile) + Azure Database for PostgreSQL Flexible
Server B1ms, both in Japan East**. The live GCP staging environment (Cloud Run
`asia-southeast1` + Neon `aws-ap-southeast-1`) migrates there. Firebase Auth is
unaffected and stays.

**Why:** The Microsoft for Nonprofits application was approved on 2026-09-10.
The grant is $2,000/yr of Azure credit against a stack that lists at roughly
$200/yr, and Japan East puts the database in Japan — which removes the APPI
外的環境の把握 paperwork the Singapore Neon region required. `deploy-plan.md`
had made this conditional on the grant landing. It landed.

**Why Container Apps and not App Service:** Container Apps publishes the same
monthly free grant as Cloud Run (180,000 vCPU-seconds, 360,000 GiB-seconds,
2M requests, per subscription) and charges nothing for a revision scaled to
zero. The environment is created with workload profiles enabled, which is what
requires the `Microsoft.App/environments` subnet delegation. No management fee
applies while only the Consumption profile is in use; one starts only with a
Dedicated profile. App Service has no scale-to-zero on paid tiers, so it would
consume credit continuously for a workload that is idle most of the month.

**Rejected — staying on Neon:** Neon has no Tokyo region, so it keeps the APPI
paperwork permanently, and it costs real money ($25–48/yr estimated at ~70
members) against a credit that expires unused each year.

**Rejected — staying on Cloud Run:** No credit applies. Google Cloud publishes
no nonprofit credit amount. Egress from Tokyo is billed from the first byte.

**Rejected — Prisma Postgres Starter (Tokyo, $120/yr) and a Japanese VPS
(~$60–85/yr):** Both were priced as the best options *without* the grant. With
$2,000/yr of credit, paying anything for hosting is strictly worse.

**Rejected — Azure Reserved Instances for the database:** The sponsorship credit
explicitly excludes reserved instances, marketplace offers, and support plans.
A reservation would be billed to a real card.

**Not solved by this:** Firebase Auth remains US-only and still holds every
member's email and display name in the United States. "Full Japan residency" is
a separate and much larger decision about dropping Google as the identity
provider — see the 2026-08-15 auth entry.

**Rejected — Japan West (Osaka), despite being closer to users:** Nearly all
members are in Kyushu, and Osaka is roughly 15ms closer than Tokyo. Container
Apps went generally available in Japan West in March 2025, so the region is
viable. Rejected because 15ms is imperceptible against a server-rendered page
load of hundreds of milliseconds, this is an internal business tool rather than
a consumer app, and Japan East is Microsoft's primary Japanese region — it
receives new capabilities first and Japan West lags it.

**Rejected — public network access for the database:** The first proposal was
`--public-access 0.0.0.0`, Azure's "allow other Azure services" mode, on the
assumption that private networking required a NAT gateway for outbound traffic
and would therefore cost around $400/yr. That assumption was wrong. Container
Apps gives every environment a default outbound public IP, and a NAT gateway
only buys a *static* outbound address, which nothing here needs. VNet
integration for Postgres is free and private endpoints are not required. Private
access therefore costs $0 and is strictly safer, since the database has no
public endpoint and a leaked password alone cannot reach it.

**Note — this choice is permanent.** A Postgres Flexible Server cannot be
converted between public and private access after creation, and a Container Apps
environment's network type is fixed at creation. Changing either later means
rebuilding the resource and restoring from a dump.

**Current state:** `docs/deploy-plan.md`, `scripts/azure-provision.sh`,
`scripts/azure.env.example`.

---

## 2026-09-10 — Provisioning is a shell script; Bicep deferred, Terraform still rejected

**Decision:** Azure infrastructure is created by `scripts/azure-provision.sh`
reading an untracked `scripts/azure.env`. It mirrors the existing
`scripts/deploy.sh` + `scripts/deploy.env` pattern, and is idempotent so a
partial run resumes by rerunning. Provisioning and deploying stay two separate
scripts, because one runs rarely and the other runs constantly.

**Why not infrastructure-as-code first:** Starting in a templating language
means learning Azure's resource model and the tool at the same time, so a
failure is ambiguous between the two. Doing it by hand first means each resource
teaches what it is, and the commands that work become the script.

**Rejected for now — Bicep:** It is the right eventual target, and preferred
over Terraform for this project because it needs no state file and no storage
account to hold that state. Revisit once the resource shape is proven and the
staging/prod split is real.

**Rejected — Terraform:** Still rejected, but the reasoning has changed. The
2026-09-08 entry rejected it because GCP infrastructure code would be discarded
in the Azure move; that reason has now expired. The current reason is that
Terraform requires provisioning a state backend before it can provision
anything, which is overhead Bicep does not carry on a solo project.

**Current state:** `scripts/azure-provision.sh`, `scripts/azure.env.example`.

---

## 2026-09-10 — BuddyTier is four role values; employment is a separate axis

**Decision:** `BuddyTier` is `junior` / `buddy` / `star` / `blackstar`. `mid` and
`senior` collapse into `buddy`, `expert` becomes `star`, `instructor` and
`organizer` become `blackstar`. 浮き and 統括 are capabilities the tier grants, not
values and not a per-tour role assignment: a star can act as 浮き, a blackstar as
統括 including 浮き. `BookingPool` deliberately stays `junior` / `non_junior` /
`anyone` — the split reads `tier === junior` and nothing else, so the pool enum
has no reason to track the role enum.

**Why:** The old six values mixed two questions. `junior` through `instructor`
answered "what can this person do"; `organizer` answered "who employs this
person". The requirements for the blackstar role are identical whether the person
is a part-time buddy or a PLAB member, so a PLAB member meeting them had no
representable value — `organizer` occupied the slot on the wrong axis.

**Rejected — a five-value enum keeping `organiser`:** the original plan in #121.
It preserves the conflation and leaves "blackstar PLAB member" unrepresentable.
Employment moves to a `memberType` field (`buddy` / `plab_member`) in #136.

**Rejected — modelling 浮き / 統括 as a per-tour role on `Booking`:** they are not
assigned per tour. They are things a tier is qualified to do. A column would
duplicate the tier and drift from it.

**Rejected — 管理者 as the Japanese label for the top tier:** the app already uses
管理者 for Admin (`担当管理者`, `管理者一覧`, `adminMemo`). Two unrelated concepts
would read identically. 社員 and アルバイト are rejected too — the team's own
vocabulary is バディ and PLABメンバー, and that is what #136 will use.

**Current state:** PRD §5.2, `data-model.md` `BuddyProfile`, `api.md`.

---

## 2026-09-10 — A buddy may see their own tier

**Decision:** Tier is no longer admin-only. A buddy may see which of the four
roles they hold. They still cannot see another buddy's tier, and `internalNotes`
and `adminMemo` remain admin-only. The API does not expose it yet; #137 carries
the change, including dropping `tier` from the CLAUDE.md never-expose rule.

**Why:** The roles now have clear published requirements, so hiding a buddy's own
role hides the thing they are working toward.

**Rejected — exposing it in #121:** #121 is a rename. Changing an API contract
and a standing project rule in the same commit makes the diff unreviewable and
the revert unscopable.

**Current state:** PRD §5.2, #137.

---

## 2026-09-10 — Tier descriptions live in i18n, not the database

**Decision:** The public page describing what each tier can do is planned but not
built. When it lands, its copy lives in `apps/web/messages/en.json` and
`ja.json`, like every other UI string.

**Why:** Nobody has written that copy yet. A table, an endpoint, and an admin
editor for it are speculative, and JSON to database later is a migration and a
seed while database to JSON is a migration, a seed, a deleted endpoint, and dead
admin UI.

**Rejected — a `TierDescription` table with per-locale rows:** revisit only if
the team needs to edit that copy without a deploy. That is the single condition
that flips this.

**Current state:** `apps/web/messages/*.json`, PRD §5.2.

---

## 2026-09-10 — Buddy onboarding is one redirect, stamped in the database

**Decision:** `BuddyProfile.onboardingSeenAt` is a nullable timestamp. The first
time an approved buddy (`trainee` or `active`) loads `/buddy`, the page sends
them to `/buddy/profile?onboarding=1` and calls
`POST /me/profile/onboarding-seen`, which stamps the column. Arriving on the page
is the whole flow. Whether they change their name or add a photo is their
decision, and the tour list is theirs from then on either way.

**Why:** `upsertUser` seeds `displayName` from the email local part and
`realName` as an empty string, and nothing prompted a buddy to correct either, so
admin tables showed a machine-generated string as a person's identity (#116). A
redirect that happens once needs a record that it happened once, and nothing in
the existing data carried that.

**Rejected — infer "not onboarded" from `realName === ''`:** the signal is
implicit and disagrees with the rule. A buddy who deliberately leaves their real
name blank is finished by the rule above but unfinished by the inference, so they
would be redirected on every visit to the tour list.

**Rejected — remember the visit in `localStorage`:** per-device and per-browser.
The same buddy is sent to the profile again from their phone, and again after
clearing site data.

**Rejected — a wizard with per-step progress stored:** the team may add steps
later, but there is one step now. A steps table or a step column written by a
one-step flow is schema and service code maintained for a design nobody has
agreed on. `onboardingSeenAt` does not block that later — it keeps meaning what
it means, and a step column can be added beside it.

**Naming:** `onboardingSeenAt`, not `onboardingCompletedAt`. It records that we
sent them, not that they filled anything in.

---

## 2026-09-10 — Tour list search and filtering stay client-side

**Decision:** `/admin/tours` filters and searches the already-loaded list in the
browser. `filterTours` in `admin.tour.ts` is a pure function next to `sortTours`,
and the active filters live in the URL query string.

**Why:** The list endpoint already returns every tour in one response, so the
data is in memory before the user can type. A server round trip per keystroke
would be slower than filtering an array, and it would need a new query contract
for a list that is currently a few hundred rows at most.

**Rejected — server-side search or pagination:** No endpoint change, no new
query parameters, no cursor. Revisit when tour volume makes the full list
response itself the problem; that is the same trigger for pagination, so the two
should land together rather than one at a time.

**Rejected — fuzzy or kana/romaji-insensitive matching:** Plain case-insensitive
substring only. Kana/romaji folding needs a transliteration table and gets the
edge cases wrong quietly, and admins searching their own tours know the group
name they are looking for.

**Rejected — debouncing the search input:** There is no request to debounce, and
a timer interacts badly with IME composition timing.

**Rejected — saved filter presets:** No one has asked, and the URL is already
shareable and bookmarkable.

**Current state:** `apps/web/src/app/[locale]/admin/tours/admin.tour.ts` and
`_components/tour-filters.tsx`.

---

## 2026-09-10 — Below-minimum stays a display-only signal

**Decision:** `minBuddies` only ever produces a `belowMinimum` flag: the badge on
the admin tours list and detail page, and the "below minimum only" filter. It
never affects a status transition. This closes #87.

**Why:** The threshold is an operational heads-up for the staff member running
the tour, not a rule of the system. A tour below its minimum a month out is
normal and gets published anyway; the number that matters is the one on the
morning of the tour. Everything #87 asked for beyond the open question was
already delivered — the schema field, the `minBuddies <= capacity` refinement,
both form inputs, the badge.

**Rejected — block publish below minimum:** Publishing is exactly how a tour
gets buddies, so blocking it below minimum blocks the fix for being below
minimum. It also needs a new API error code and a server-side check for a rule
staff would immediately want to override.

**Rejected — warn the admin on publish:** A confirmation dialog that fires on
almost every publish teaches people to dismiss it, and the badge already carries
the same information without interrupting.

**Revisit when** staff report publishing tours they would not have published had
they noticed the count. The badge and the filter are the cheap version of that
signal; measure whether they are being used first.

**Current state:** `docs/PRD.md` §"Tour session fields", `docs/data-model.md`
`minBuddies` row.

---

## 2026-09-10 — R2 credentials are required at deploy time, not optional

**Decision:** `scripts/deploy.sh` asserts all five `R2_*` variables before it
builds anything, and `uploadBuddyPhoto` reads them through a single `r2Config()`
that throws `PhotoStorageUnconfiguredError` naming the missing ones. The route
logs that name list and answers 500.

**Why:** Staging api revisions before `api-00005-szp` (2026-09-09) ran with no
`R2_*` variables. `deploy.sh` emitted each key only when it was already set and
never asserted them, and `deploy.env.example` said "leave blank unless testing
photo upload", so a blank config was the documented default. Every buddy photo
upload on those revisions reached the AWS SDK with `Bucket: undefined` and died
with `No value provided for input HTTP label: Bucket`, logged 2026-09-08 14:43
and 2026-09-09 16:14. That error names neither the service nor the deploy step,
and `app.onError` flattened it into a bare 500, so issue #113 chased magic-byte
and mime hypotheses instead.

**Rejected — keep R2 optional and skip photo upload when unset:** photo upload is
reachable from `/buddy/profile` in every environment, with no flag guarding it.
An environment where the button is present and guaranteed to fail is worse than a
deploy that refuses to start.

**Rejected — validate R2 at API startup and crash the process:** it takes the
whole api down for a feature that is one route, and Cloud Run would serve nothing
at all rather than everything except photo upload.

**Rejected — `staging-buddy-photos.plab.jp` / `buddy-photos.plab.jp` as
`R2_PUBLIC_URL`:** both resolve to an Xserver host presenting a `*.xserver.jp`
certificate, so they fail TLS. They are listed in `apps/web/next.config.ts`
`images.remotePatterns` for a future binding; until Cloudflare actually serves
them, `R2_PUBLIC_URL` stays on the bucket's `pub-*.r2.dev` URL.

**Current state:** `scripts/deploy.sh`, `scripts/deploy.env.example`,
`apps/api/src/services/buddyPhoto.service.ts`.

---

## 2026-09-10 — Missing avatars render initials, not a placeholder image file

**Decision:** `BuddyAvatar` and `ProfilePhoto` render an `AvatarPlaceholder` —
the first letter of the first and last word of the display name, on the existing
`bg-muted` circle — whenever `photoUrl` is null. No image is requested at all in
that case.

**Why:** Both components pointed at `/images/default-avatar.png`, and
`apps/web/public/` does not exist, so every buddy without a photo rendered a
broken image. Initials are a single component that is sharp at all three
`BuddyAvatar` sizes and at the 80px profile header, needs no i18n (the aria
label reuses the alt text the callers already pass), and distinguishes buddies
from one another in the admin lists, which a shared silhouette does not.

**Rejected — commit a default avatar PNG:** creates `apps/web/public/` for one
asset, ships bytes on every no-photo render, and needs 2x/3x variants to stay
crisp across the 32/48/64/80px range. It also makes every avatar-less buddy look
identical in the admin tables.

**Current state:** `apps/web/src/components/avatar-placeholder.tsx`.

---

## 2026-09-09 — Trainees get a training message and a Profile-only nav

**Decision:** A buddy with `status = trainee` sees `tour.traineeMessage` on
`/buddy` and only the Profile item in the buddy nav. `tour.notRegistered` is now
reserved for rejected and suspended buddies.

**Why:** Approval sets `pending` → `trainee` and the `account_approved` email
links to `/buddy`, so every newly approved buddy was told they are not
registered as a buddy (#117). Tour and History have nothing to show a trainee.

**Rejected — keep all three nav items:** Two of the three dead-end, and the
approval email is the first thing a trainee follows.

**Open — whether `trainee` belongs in the signup flow at all.** Training
schedules are run manually on spreadsheets, and trainees may never register in
the first place; if so, the first approval should mean `active` + `junior` and
`trainee` stops being a status a signed-in user can hold. Settle this before
building anything else on the trainee status.

**Current state:** PRD.md §5.1 "Trainee access".

---

## 2026-09-09 — Outbound email sends from an alias on an existing staff seat

**Decision:** Two env vars, not one. `GMAIL_IMPERSONATE` is the mailbox
domain-wide delegation impersonates; `GMAIL_SENDER` is the `From:` address,
which may be an alias. `GMAIL_IMPERSONATE` defaults to `GMAIL_SENDER` when
unset, so the single-address case still works.

**Why:** Aliases are free (30 per user), a Workspace seat is not, and the budget
does not have room for a dedicated sending seat. Splitting the two means the
impersonation can move to another seat later without changing the sender address
recipients have already seen. Staging runs both as `team-dev@plab.jp`; a token
exchange against that address confirmed delegation resolves an alias to its
underlying account, so the single-value case is not a special case.

**Rejected — a dedicated Workspace seat for the sender:** ~$5/month for an
account whose only job is to be impersonated. Correct once there is budget, and
the split above is what makes that migration a config change rather than a
visible change of sender.

**Rejected — sending as the `hello@` contact address, or an alias on it:** An
alias routes into the same mailbox, so every bounce and autoresponder from
notification traffic would land in the inbox people use to reach the org.

**Current state:** `apps/api/src/lib/email.ts`, `scripts/deploy.env.example`.

---

## 2026-09-08 — Deploy is a shell script, not Terraform

**Decision:** `scripts/deploy.sh` drives the Cloud Run deploy. Configuration is a
single untracked env file (`scripts/deploy.env.example` is the template).

**Why:** The permanent hosting decision is deferred and the stated intent is to
move the whole stack to Azure. GCP Terraform written now would be discarded at
that migration. The surface is two Cloud Run services, one Artifact Registry
repo, and three IAM grants.

**Rejected — Terraform:** Adds a state backend, provider pinning, and another
tool to install, against a target that is expected to change. Revisit when the
real staging/prod split is built before real buddies — that is when codifying
the IAM grants and having one `apply` per environment starts to pay.

**Rejected — `gcloud run services replace service.yaml`:** Declarative without
the state file, but it covers only the service definition, not the build and
the ordering between the two services, which is where the actual complexity is.

**Current state:** `scripts/deploy.sh`, `docs/architecture.md` deploy section.

---

## 2026-08-15 — Admin notifications go to one Slack channel; admin email dropped

**Decision:** Slack replaces email for admin notifications entirely. One open
channel via incoming webhook — not per-admin DMs. Admins default to
`emailEnabled: false`, `slackEnabled: true`.

**Why:** All 5–6 admins are already in Slack, and a channel is the right medium
for high-volume low-urgency operational events. The whole immediate-vs-digest
tension exists only because email handles volume badly: eight booking
notifications scroll past harmlessly in a channel and clog an inbox. A channel
*is* the digest.

**Rejected — build the admin email path** (templates for `new_signup` /
`new_booking` in two locales, an `enqueueEmailForAllAdmins` helper, flipping both
default tables): strictly more work than the Slack sender, and it would have
shipped digest mode as a selectable UI option with no flush job behind it — a
silent-failure trap for whoever picked it.

**Rejected — per-admin DMs:** hides operational state from the team and makes
individuals bottlenecks. A shared channel is the safer default even though it
deviates from the PRD §10.2 "assigned admins" targeting for
`maybe_deadline_missed` — at 5–6 admins, broadcast is acceptable and arguably
better.

**Open:** splitting into multiple channels by event type. Start with one; revisit
if the single channel proves noisy.

**Consequence:** a channel post has no recipient user, so these jobs carry
`recipientUserId: null` and one job row is written per event rather than one per
admin. Per-admin `NotificationPreference` rows stop being load-bearing for
admin delivery.

**Current state:** PRD §10.2–§10.4, `docs/roadmap.md`.

---

## 2026-08-15 — Auth stays Firebase + Google + Apple; Slack rejected as identity provider

**Decision:** Identity remains Firebase Auth with Google and Apple as the OAuth
providers. Slack is not an identity provider.

**Why:** Buddies graduate. Workspace membership is temporary by design, but a
buddy's access to their own history and evaluations should outlive it. Slack-only
auth would revoke access to every buddy as the normal end of their lifecycle, not
as an edge case.

**Rejected — Slack-only:** Initially attractive because every current buddy is
already in the workspace, and because it would sidestep Apple's setup. Killed by
graduation, above.

**Rejected — Slack + Google:** Redundant. Slack workspace sign-in itself accepts
Google, so both routes lead to the same credential.

**Also considered:** coupling app access to workspace membership would mean
routine Slack admin actions (offboarding, member cleanup) silently revoke app
access while `BuddyStatus` still reads `active`, leaving confirmed bookings held
by users who cannot cancel them. Judged low-likelihood on Slack's free plan
(unlimited free members, so no seat-cost pressure to remove anyone) and secondary
to the graduation problem — but it is the reason to not revisit Slack-as-identity
without solving reconciliation first.

**Slack is still in scope for admin notifications** — PRD §10.3, unbuilt. That is
delivery, not identity.

**Current state:** PRD §4, `docs/architecture.md` "Auth Flow".

---

## 2026-08-15 — Apple sign-in completed rather than dropped

**Decision:** Finish the Apple provider setup rather than remove the button.

**Why:** Apple granted nonprofit registration, so the $99/yr fee is waived. The
client code already exists (`apps/web/src/lib/auth.tsx`,
`apps/web/src/components/apple-sign-in-button.tsx`, login page, i18n keys) —
removing it is also work. Japan has one of the highest iPhone shares in the
world, so Apple-preferring users are a real segment of a Nagasaki volunteer base,
and Hide My Email covers privacy-minded buddies.

Remaining work is Firebase console config (Service ID + key) only. Firebase
generates and rotates the client secret itself, so there is no recurring key
chore.

**Open risk:** Firebase defaults to one account per email. A buddy who signs in
with Google and later with Apple + Hide My Email gets a different email, so a
second `User` and duplicate `BuddyProfile`. Review `upsertUser`
(`apps/api/src/services/auth.service.ts`) before launch.

---

## 2026-08-15 — Email login deferred

**Decision:** No email/password or email-link sign-in for now.

**Why:** No buddy has asked for it. It is the most expensive option on the table
— a new callback route with no analogue in the current OAuth-popup flow,
cross-device link handling, a `apps/web/src/middleware.ts` exemption, and a
deliverability dependency whose failure mode is a login link in spam and a buddy
who cannot get in.

**Revisit when** a real person needs an account without a Google or Apple
identity. Build it then, against their actual constraints. Firebase email-link
(passwordless) is the cheaper of the two options — no password storage, no reset
flow.

---

## 2026-08-15 — Docs diagrams are mermaid, not ASCII

**Decision:** All diagrams in `docs/` are mermaid fenced blocks. Directory trees
stay plain ASCII (mermaid has no tree primitive).

**Why:** GitHub renders mermaid natively, and ASCII diagrams drift silently — the
`data-model.md` entity diagram had pointed `SelfEvaluation` and `AdminEvaluation`
at `TourSession` when the schema says `Tour`, and nested
`BuddyCancellationDeadlineOverride` under `Booking` when it has no Booking FK.

**Rejected — CI validation:** A parse check catches syntax, not staleness, and
staleness was the actual defect. All 10 blocks were verified to parse at the time
of conversion. Revisit if diagrams start breaking in review.

**Current state:** CLAUDE.md "Diagrams" pattern and the "Docs to update when
implementing" table.

---

## 2026-09-12 — Group type labels live in a top-level `groupType` namespace

**Decision:** The four `GroupType` values are translated through a top-level
`groupType` namespace, read via `getGroupTypeLabel` in
`apps/web/src/lib/status-display.ts`. Every site that displays a group type uses
it: the tour form's group summary and filters, the group list, detail, create
and edit pages.

**Why:** The values were rendered raw, so `/ja` showed "school". The labels
already existed under `adminTours.filters.groupTypeOption`, owned by one
component in another feature's namespace. Enum labels already have a convention
here — `tourStatus`, `buddyStatus`, `bookingStatus` are top-level namespaces with
`get*Label` helpers — and group type is the same shape of thing.

**Rejected — keeping the keys under `adminTours.filters`:** the group pages would
have had to reach into the tours namespace for their own field, or the four
labels would have been duplicated per namespace and drifted.

**Not changed — sort order.** The group list still sorts the type column by the
raw enum, matching every other status column in the app
(`admin.tour.ts`, `admin.buddy.ts`). In `ja` the sort order therefore does not
follow the displayed labels. Revisit for all enum columns together, not just
this one.
