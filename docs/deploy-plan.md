# Deploy Plan — migrate to Azure Japan East on the nonprofit grant

Working document, last revised **2026-09-12**. Replaces the 2026-09-07 GCP-first
version, whose repo checklist has shipped.

**Grant activated.** $2,000/yr of Azure Sponsorship credit is live. Provisioning
is underway; see "Progress" below for what actually exists.

## Status

Staging is **live on GCP** — Cloud Run `asia-southeast1`, Neon
`aws-ap-southeast-1`, Firebase `peace-buddy-staging`. Production has never been
built. So this is a migration of one dogfood environment, not a production
cutover, and it is the cheapest moment it will ever be.

**The environment model changed on 2026-09-12.** There is one deployed
environment today — the GCP/Neon stack behind `peace-buddy-staging` — and
non-dev members already use it to check and test work, which is staging's job.
It runs on free tiers nobody maintains. Azure gets **two environments, prod and
staging**, on separate Postgres servers. The GCP/Neon stack's data moves to
Azure staging (§6); the GCP side is then decommissioned as its own task, and
nothing replaces it. Local Docker Compose stays for development. See
`decisions.md` 2026-09-12.

Load, for sizing arguments: **~70 members**, peak season is November at roughly
**one tour every two days**. This is an internal business tool, not a consumer
app. Every capacity number below should be read against that, and every one of
them has one to two orders of magnitude of headroom.

## Decisions taken

| Question | Answer | Reasoning |
|---|---|---|
| Cloud | **Azure** | $2,000/yr grant against a stack listing near $260/yr |
| Region | **Japan East** (Tokyo) | Japan West is ~15ms closer to Kyushu, where nearly all users are, but Japan East is Microsoft's primary Japanese region and gets features first. 15ms is imperceptible on a server-rendered page, and this is an internal tool |
| Compute | **Container Apps, workload-profiles environment, Consumption profile** | Charges nothing scaled to zero. App Service bills hourly whether or not anyone visits, which would drain the grant on an app that is idle most of the month |
| Database | **PG Flexible Server B1ms** | Cheapest real tier. Japan East placement removes the APPI 外的環境の把握 burden for application data |
| DB networking | **Private, VNet-injected** | Costs $0. No public endpoint at all, so a leaked password is not sufficient to reach the data |
| Infra as code | **Shell script now, Bicep later** | Learning Azure's resource model and a templating language at once makes failures ambiguous. Codify once the shape is proven |
| Environments | **prod + staging on Azure, nothing else deployed** | Non-dev members already test on the one deployed environment, `peace-buddy-staging` on GCP free tiers. One maintained environment beats a free one nobody owns. Local Docker Compose covers development |
| DB per environment | **A separate B1ms each** | Sharing one server saves $66/yr against this design — staging's server is stopped most of the year — and was rejected: it couples prod and staging to one CPU credit budget and one 35-connection ceiling, and it is not how anyone runs these |
| Staging uptime | **Started by hand, stopped when done** | Staging is dormant between feature cycles. Storage bills regardless; compute is the only variable and it is $0.026/hr |
| Photo storage | **Azure Blob, Japan East** | R2 has no Japan jurisdiction and location hints are best-effort, so photos kept the APPI burden the database move removed |

## 1. Grant lifecycle

```mermaid
stateDiagram-v2
    [*] --> Approved: nonprofit eligibility validated
    Approved --> Expired: 90 days elapse<br/>with no activation
    Approved --> Active: activated 2026-09-10 ✓
    Active --> Active: usage under $2,000<br/>card on file, not charged
    Active --> Renewed: reply to the renewal email<br/>before the expiry date
    Renewed --> Active: fresh $2,000<br/>unused balance does NOT roll over
    Active --> PayAsYouGo: credit exhausted, or<br/>year ends unrenewed
    Expired --> [*]
    PayAsYouGo --> [*]: real charges begin
```

The credit covers **first-party Azure services only** — no reserved instances,
no marketplace offers, no support plans. It is worth a budget alert set well
under $2,000, because alerts are the only warning before the silent conversion
to pay-as-you-go.

## 2. Target topology

```mermaid
flowchart LR
    U[["staff, public internet"]]

    subgraph AZ["Azure — Japan East 🇯🇵"]
        direction TB
        ACR["Container Registry<br/>crpeacebuddy, Basic"]
        BLOB[("Blob Storage<br/>buddy photos<br/>one account per environment")]

        subgraph VNET["vnet-peace-buddy 10.0.0.0/16"]
            direction TB
            subgraph SA["snet-apps 10.0.0.0/23"]
                CAE["Container Apps Environment<br/>workload profiles, Consumption<br/>External ingress"]
                W["ca-web · Next.js standalone<br/>min replicas = 0"]
                A["ca-api · Hono<br/>min replicas = 0"]
                J["Container Apps Job<br/>hourly cron"]
            end
            subgraph SD["snet-db 10.0.4.0/24<br/>delegated to Postgres"]
                DB[("psql-peace-buddy · B1ms<br/>no public endpoint")]
            end
        end

        ACR -.->|image pull| CAE
        CAE --- W
        CAE --- A
        CAE --- J
        A -->|private, never leaves the VNet| DB
    end

    FA["Firebase Auth 🇺🇸"]

    U -->|HTTPS| W
    W -->|internal ingress| A
    W -.->|ID token| FA
    A -->|verify token| FA
    A -->|managed identity<br/>no access keys| BLOB
    J -->|"POST /jobs/notifications/*"| A
```

The diagram shows **one** environment. Prod and staging are provisioned to the
same shape, each with its own Postgres server and its own storage account, both
inside the single VNet and the single Container Apps environment. Staging's
server is stopped by default; see §7.

Ingress stays public because staff reach the app from the internet. Only the
database is private. A NAT gateway is **not** required — Container Apps gives
every environment a default outbound public IP, and a NAT gateway buys only a
*static* outbound address, which nothing here needs.

Two constraints from the GCP plan **die here**, and both were shaping the code:

| Old constraint | Status on Azure |
|---|---|
| Cloud Scheduler's free tier is 3 jobs, so consolidate the 4 endpoints in `apps/api/src/routes/jobs.ts` into one hourly tick | **Gone.** Container Apps Jobs bill per execution against the same free grant, with no job-count limit. Keep the four endpoints |
| Neon's free compute allowance cannot absorb four hourly schedules | **Gone.** B1ms is always-on, paid from credit |

Still deliberately omitted: custom domain `buddy.plab.jp` and Apple sign-in. The
staging/prod split is **no longer omitted** — it is the point of this plan now.

## 3. What moves, what is reused

```mermaid
flowchart LR
    subgraph NOW["Live today — GCP"]
        direction TB
        CRW["Cloud Run: web"]
        CRA["Cloud Run: api"]
        AR["Artifact Registry"]
        CB["Cloud Build<br/>apps/*/cloudbuild.yaml"]
        NEON[("Neon 🇸🇬")]
    end

    subgraph NEXT["Target — Azure"]
        direction TB
        CAW["ca-web"]
        CAA["ca-api"]
        ACR2["crpeacebuddy"]
        AZB["az acr build"]
        PG2[("psql-peace-buddy 🇯🇵")]
    end

    DF["Dockerfiles<br/>runner targets"]
    SC["prisma/schema.prisma<br/>plain postgresql provider"]

    CRW ==>|replace| CAW
    CRA ==>|replace| CAA
    AR ==>|replace| ACR2
    CB ==>|rewrite| AZB
    NEON ==>|"pg_dump → pg_restore"| PG2

    DF -->|unchanged| NEXT
    SC -->|"one env var change"| PG2
```

Already shipped, do not redo:

- Both Dockerfiles are multi-stage with production `runner` targets
  (`node dist/index.js` for api, Next standalone for web). Commit `839892c`.
- `apps/web/next.config.ts` emits `output: 'standalone'`.
- `scripts/deploy.sh` and `scripts/deploy.env.example` exist and work for Cloud
  Run. Commit `3dcc21e`.

Portability was verified and still holds: a plain `postgresql` provider with no
`directUrl`, a bare `PrismaClient` with no driver adapter, and no reference to
Neon anywhere in `apps/`, `packages/`, or `prisma/`. **Keep it that way.**

## 4. Provisioning

Infrastructure is `scripts/azure-provision.sh`, taking an untracked env file
as its argument — `scripts/azure.env` for prod, `scripts/azure.stg.env` for
staging (template: `scripts/azure.env.example`; `azure*.env` is gitignored
alongside the existing `deploy.env`). It is idempotent — every step checks for
existence first, so a partial run resumes by rerunning.

Numbered as the script's own sections are:

```mermaid
flowchart TB
    CONF["0 · confirm the target<br/>coloured banner, red for prod"] --> RG["1 · resource group<br/>the undo button"]
    RG --> PROV["2 · register providers<br/>App · ContainerRegistry<br/>DBforPostgreSQL · OperationalInsights"]
    PROV --> ACR["3 · container registry<br/>Basic"]
    ACR --> VNET["4 · VNet + 2 subnets<br/>+ private DNS zone"]
    VNET --> ENV["5 · Container Apps env<br/>network type fixed at creation"]
    ENV --> PG["6 · Postgres server<br/>VNet-injected, private access is PERMANENT<br/>then the peacebuddy database, its own call"]
```

Two steps are one-way doors. A Container Apps environment's network type cannot
be changed after creation, and a Postgres server cannot be converted between
public and private access. Both are cheap to get right and expensive to undo.

One environment holds **four apps** — `ca-api` / `ca-web` for prod and
`ca-api-stg` / `ca-web-stg` for staging. A second Container Apps environment per
stack would be the textbook isolation, and it is the one thing here that costs:
a second VNet, a second pair of public IPs at ~$88/yr, and a second load
balancer. Four apps in one environment cost the same as two, because idle
revisions scale to zero. See `decisions.md` 2026-09-12.

**The script is run once per environment, with that environment's env file.**
It takes `ENVIRONMENT`, names the target in a coloured confirmation banner — red
for prod, anything else blue — and refuses to create anything until someone
agrees to it. Steps 1 through 5 are the shared resource group, VNet and
Container Apps environment; they are idempotent, so the second run skips them
and only step 6 produces a second server and database.

**The script stops there. It creates no storage account**, for either
environment. The diagram above is the whole of it, so the per-environment Blob
storage that §2 describes and the Progress table tracks has not been created by
anything. That is #151, and it is why the two-environment work is not finished
by the provisioning merge.

## 5. Deploy pipeline

`az acr build` is a direct analogue of `gcloud builds submit` — it builds
server-side, so nothing is pushed from a laptop, which also sidesteps the
ARM-versus-x86 mismatch on an Apple Silicon machine. The ordering in
`scripts/deploy.sh` survives the rewrite, because it exists to solve a real
problem: the web image bakes `NEXT_PUBLIC_API_URL` at build time, so the api
needs a URL before web can build, and the api's CORS origin is only known once
web is deployed.

```mermaid
flowchart LR
    L["scripts/deploy.sh"] --> B1["az acr build — api"]
    B1 --> D1["az containerapp update — api"]
    D1 --> URL["read api FQDN"]
    URL --> B2["az acr build — web<br/>NEXT_PUBLIC_API_URL baked in"]
    B2 --> D2["az containerapp update — web"]
    D2 --> CORS["az containerapp update — api<br/>CORS_ORIGIN = web FQDN"]
```

`prisma migrate deploy` has to land somewhere in this sequence, before the api
serves traffic against a changed schema. The Prisma Migrate adoption deferred
that choice to this rewrite; see §6.

Rewrite work, not yet started:

- [ ] `scripts/deploy.sh` — `gcloud builds submit` → `az acr build`,
      `gcloud run deploy` → `az containerapp create/update`,
      `gcloud run services describe` → `az containerapp show`.
- [ ] `scripts/deploy.env.example` — `PROJECT`/`REGION`/`REPO` become the Azure
      names. The 12 application secrets are unchanged.
- [ ] Delete `apps/api/cloudbuild.yaml` and `apps/web/cloudbuild.yaml`.
- [ ] `--min-instances=0` becomes `--min-replicas 0`. **This flag is the
      difference between $0 and burning credit.**

### Cold starts

Scale-to-zero means a request arriving after hours of silence waits for a
container to boot, a few seconds for a Node image. At one tour every two days,
most requests will be cold. For staff who know what the tool is, that is
acceptable. Raising `--min-replicas` to 1 removes it and costs tens of dollars a
year at idle rates, which the grant absorbs. Start at 0, change it only if it
actually annoys people. It is one flag and reversible.

## 6. Database cutover

**Prod and staging cut over differently**, because only one of them has data.

The server does not arrive with the application database on it. az 2.90 accepts
`--database-name` on `flexible-server create` only for elastic clusters, so
`peacebuddy` is created by its own `flexible-server db create` call, the tail of
step 6 in §4, and it is that database rather than the server's defaults that
`DATABASE_URL` points at.

**Prod has never existed.** Build it with `prisma migrate deploy` from
`0_init` against an empty server. No dump, no baseline, no enum problem.

**Staging carries Neon's data**, and that data is the reason the cutover is not
just a restore:

- [x] Run the enum remap against Neon **first** — the technique is in
      `DEPLOYMENT.md`, the SQL actually executed is
      `scripts/staging-enum-remap.sql`. Done 2026-09-12 in #142, together with
      the remaining drift and the baseline itself, so Neon now matches
      `schema.prisma` and carries a `_prisma_migrations` table with both
      directories marked applied.
- [ ] `pg_dump` from Neon, `pg_restore` into Azure. `psql` and `pg_dump` are
      **not installed** on this machine — run them from a Postgres container.
- [ ] The private hostname resolves only inside the VNet, so the restore must
      run from something inside it, not from a laptop.
- [ ] Reconcile migration history on the restored server. A full `pg_dump` and
      `pg_restore` carries `_prisma_migrations` across, since it is an ordinary
      table in the public schema, so this should be a check rather than work:
      run `migrate status` against the Azure server and expect no pending
      migrations. `DATABASE_URL` is only repointed in the next step, so pass it
      inline for this one check. Only if the Azure database is built some other
      way does it need baselining, and then for every directory in
      `prisma/migrations/`, not just `0_init`.
- [ ] Point `DATABASE_URL` at Azure, redeploy the api, smoke test.
- [ ] Keep the Neon project for a week, then delete it.

Schema changes go through `prisma migrate deploy` (see `DEPLOYMENT.md`,
"Schema Changes"). Run it by hand once against each new server, never from a
container `CMD` — Container Apps runs multiple replicas and concurrent DDL is
unsafe.

**Open, and owned by this move:** whether release runs a one-shot Container Apps
Job for `migrate deploy` or keeps the manual step. Deferred here by the Prisma
Migrate adoption because `scripts/deploy.sh` is being replaced anyway. Decide it
with the deploy rewrite in §5, not after.

## 7. Cost against the credit

Verified **2026-09-12** against the Azure Retail Prices API for Japan East.
`azure-costs.md` holds the full derivation, the rates each figure came from, and
the alternatives that were costed and rejected.

| Line item | Rate | Annual |
|---|---|---|
| Prod Postgres B1ms, always on | $0.026/hr | $228 |
| Prod storage, 32 GiB | $0.138/GiB/mo | $53 |
| Staging Postgres B1ms, started by hand | $0.026/hr | ~$13 at 500 hrs |
| Staging storage, 32 GiB | $0.138/GiB/mo | $53 |
| Container Registry Basic | $0.1666/day | $61 |
| Two static public IPv4 | $0.005/hr each | $88 |
| Private DNS zone | $0.50/mo | $6 |
| Blob storage — buddy photos and nightly dumps | $0.02/GB/mo | ~$2 |
| Container Apps, scaled to zero | free grant | $0 |
| VNet and subnets | — | $0 |
| Database backups to 32 GiB | included | $0 |
| Load balancer | **unresolved** | $0 to $219 |
| **Total** | | **$504 to $723 of $2,000** |

Container Apps' free grant is per subscription per calendar month: 180,000
vCPU-seconds, 360,000 GiB-seconds, 2M HTTP requests, shared across both
environments. Estimated load is ~8,400 vCPU-seconds and ~56k requests — 20–35×
headroom.

The load balancer is the only unresolved line. Microsoft's networking doc says a
custom-VNet external environment bills one standard load balancer, the standard
rules meter returns $0.025/hr, and a $0.00 variant of the same meter also
exists. **Read the first real bill rather than the pricing API.**

### Staging is started by hand

Staging holds a real database and storage account permanently; only its compute
is switched off. Storage is $53/yr whether it runs or not, so the hours cost
$0.026 each and nothing else — **$66/yr** all in at 500 hours, against $281/yr
if it simply stayed on. A scheduled 4–6 hour daily window would be $91–$110/yr
on the same basis; `azure-costs.md` has the comparison.

```
az postgres flexible-server start -g rg-peace-buddy -n psql-peace-buddy-stg
az postgres flexible-server stop  -g rg-peace-buddy -n psql-peace-buddy-stg
```

**Azure restarts a stopped server by itself after seven days.** With no
scheduler enforcing the stopped state, staging will quietly come back during
every dormant stretch and bill compute until someone notices. It was stopped on
**2026-09-12**, so it comes back on its own around **2026-09-19** unless stopped
again. That is the accepted cost of not building a scheduler. The budget alert
in §9 is the only thing that will catch it, which makes that checklist item
load-bearing rather than nice to have.

Starting takes minutes, not seconds, so start it before people need it.

About $1,300/yr goes unused and does not roll over. That is headroom for
backups, monitoring, and a custom domain. It is **not** a reason to upsize the
database.

## 8. Data residency — half solved

```mermaid
flowchart TB
    subgraph JP["Japan 🇯🇵 — after both steps of the Azure move"]
        PG[("Postgres<br/>tours, bookings,<br/>evaluations, internal notes")]
        BL[("Blob Storage<br/>buddy photos")]
        CA["Container Apps"]
    end
    subgraph US["United States 🇺🇸 — unchanged"]
        FB["Firebase Auth<br/>email + display name<br/>of every member"]
    end
    CA --> PG
    CA --> BL
    CA -->|verify ID token| FB

    APPI["APPI Art. 23<br/>外的環境の把握"]
    APPI -.->|"no longer applies<br/>to the database"| PG
    APPI ==>|"still owed<br/>for Firebase"| FB
```

**The diagram is the end state, and it takes two steps to get there.** The
cutover moves the database; photos follow afterwards as a separate piece of work
(§2, and the checklist below). Between the two, the database is in Japan East
and member photographs are still on R2, so the photo gap stays open until the
second step lands.

Moving the database **and then the buddy photos** to Japan East removes the
外的環境の把握 disclosure burden for application data. Photos were the gap:
Cloudflare R2 supports EU, US and FedRAMP jurisdictions only, with no Japan
option, and its location hints are explicitly best-effort rather than a
guarantee, so member photographs had no residency story at all. It does **not**
remove the burden for Firebase Auth, which is US-only. Auth is settled as Firebase in `docs/decisions.md` (2026-08-15), so
"full Japan residency" means dropping Google as the identity provider — a much
larger decision, and not this one. *Not legal advice; the PPC Q&A is the
authority.*

## 9. Before real buddies — unchanged by the grant

- [ ] Nightly `pg_dump` → **Azure Blob**, prod storage account, its own
      container, lifecycle rule expiring blobs older than **30 days** — and
      **one tested restore**. **Prod only**: staging is stopped most of the year
      and holds nothing that is not reproducible. It runs as a **second
      Container Apps Job**, separate from the hourly notification cron in §2,
      because the same two constraints as the cutover apply — the private
      hostname resolves only inside the VNet, so the job must sit in
      `snet-apps`, and `pg_dump` has to come from the image, so it cannot be
      the api image. Azure's built-in Flexible Server backups are the belt; this
      is the braces against a bad migration or a delete. It is not off-cloud:
      losing the subscription loses both, accepted on the grounds that if the
      subscription is lost the app stops anyway. ~$0.50/yr at 30 snapshots.
      Decided 2026-09-12, see `decisions.md`.
- [ ] Budget alert and a cost anomaly alert. **Load-bearing**, see §7: nothing
      else will tell you staging auto-restarted after seven days.
- [ ] Container Registry image cleanup policy.
- [ ] Custom domain, Apple sign-in.
- [x] Delete `memory/project_prerelease.md`, switch to `prisma migrate deploy`. Done 2026-09-12; where `migrate deploy` runs on release is still open, see §6.

## Progress

| Step | State |
|---|---|
| Grant activated | ✅ 2026-09-10 |
| `az` CLI installed, signed in | ✅ |
| Resource group `rg-peace-buddy`, Japan East | ✅ |
| Providers registered | ✅ |
| Registry `crpeacebuddy`, Basic | ✅ |
| Costs verified against the Retail Prices API | ✅ 2026-09-12, see `azure-costs.md` |
| VNet, subnets, private DNS | ✅ 2026-09-12 — `snet-apps` `10.0.0.0/23`, `snet-db` `10.0.4.0/24`, zone `peace-buddy.private.postgres.database.azure.com` |
| Container Apps environment | ✅ 2026-09-12 — VNet-injected into `snet-apps` |
| Postgres — **staging** | ✅ 2026-09-12 — `psql-peace-buddy-stg`, B1ms, 32 GiB, public access disabled, HA disabled. Stopped by hand after creation |
| Database `peacebuddy` on staging | ✅ 2026-09-12 — its own `flexible-server db create` step, see §6 |
| Postgres — **prod** | ⬜ not provisioned, deliberately — the server does not exist; see `decisions.md` 2026-09-12, "Staging is provisioned first" |
| Application database role, replacing the admin account in `DATABASE_URL` | ⬜ both servers |
| Storage accounts, one per environment | ⬜ |
| Photo service ported from the S3 SDK to Azure Blob | ⬜ `apps/api/src/services/buddyPhoto.service.ts`, its test, `deploy.sh`, `deploy.env.example`, `next.config.ts` remote patterns |
| Azurite in `docker-compose` for local photo upload | ⬜ |
| `scripts/deploy.sh` rewritten for Azure, parameterised by environment | ⬜ |
| Neon baselined onto Prisma Migrate — enum remap, then drift, then `migrate resolve` for both directories | ✅ 2026-09-12, #142 |
| Prod built from `0_init` with `migrate deploy` | ⬜ |
| Staging migration history reconciled after restore | ⬜ |
| Where `migrate deploy` runs on release, decided | ⬜ deferred here by the Prisma Migrate adoption |
| Data migrated off Neon | ⬜ staging only; prod has no data to move |
| Photos migrated off R2 | ⬜ sequence **after** the cutover; not on its critical path |
| Nightly `pg_dump` job + 30-day lifecycle rule, prod | ⬜ second Container Apps Job, in `snet-apps`, image carrying `pg_dump` |
| One tested restore from a dump | ⬜ the checklist item that actually proves the backup |
| R2 account torn down — bucket, the five `R2_*` keys, `deploy.env.example` | ⬜ after photos move; R2 leaves the stack entirely |
| GCP/Neon stack decommissioned — Cloud Run, Neon, the `peace-buddy-staging` project | ⬜ own task after this plan; only once Azure staging is trusted by the non-dev members |

The provisioning script prints a `DATABASE_URL` built from the server admin
account, because a restricted role can only be created with `psql` from inside
the VNet, which does not exist until the script has run. Create that role as the
first step of the deploy work and put the restricted credentials in the deploy
config. The admin account should not end up in `DATABASE_URL`.

Left over in `rg-peace-buddy` from a VNet-less Container Apps environment
attempted before 2026-09-11 and since deleted: a Log Analytics workspace named
`workspace-rgpeacebuddyyg8h`. Creating the environment on 2026-09-12 made a new
one, so the old workspace is now orphaned and can be deleted. Not yet checked
against the subscription.

## Unverified — check these before trusting the plan

Written down explicitly because they are the load-bearing assumptions. Struck
entries are settled — 1 and 2 against the Azure Retail Prices API, 3 and 4
against the live subscription. The rest are still open.

1. ~~**B1ms and storage pricing for Japan East.**~~ **Resolved 2026-09-12.**
   $0.026/hr and $0.138/GiB/mo from the Retail Prices API. The old $12.41/mo
   figure was ~35% low.
2. ~~**Container Registry Basic at ~$5/mo.**~~ **Resolved 2026-09-12.**
   $0.1666/day, so $5.07/mo. The estimate was right.
3. ~~**`scripts/azure-provision.sh` has never been executed.**~~ **Resolved
   2026-09-12.** Run end to end against staging, #165. Still no `shellcheck` on
   this machine, and the prod path has not been run.
4. ~~**Private DNS zone naming.**~~ **Resolved 2026-09-12.**
   `peace-buddy.private.postgres.database.azure.com` was accepted and the
   staging server is linked to it.
5. **Cold start duration.** "A few seconds" is an estimate for a Node image, not
   a measurement of these images.
6. **Regionalized Firebase Auth**, roadmapped for end-2025, status still
   unchecked.
7. **Whether the managed load balancer is billed.** $0/yr or $219/yr; the
   pricing API carries both a $0.025/hr standard rules meter and a $0.00
   variant, and nothing says which one a Container Apps managed load balancer
   draws on. Settled by the first invoice, not by more research.
8. **Blob read volume for photos.** Costed at ~$2/yr assuming browser caching
   holds. If every avatar render became a blob read it would still be single
   digits, so this is noted for completeness rather than as a risk.

Removed from this list on 2026-09-11: subnet delegation. Microsoft's networking
documentation states that a workload-profiles environment requires the
`Microsoft.App/environments` delegation and a `/27` or larger subnet, while a
legacy consumption-only environment must not be delegated and needs `/23` or
larger. The script creates a workload-profiles environment, delegates, and uses
a `/23`, which satisfies both constraints.

## Machine state — 2026-09-10

| Tool | State |
|---|---|
| `az` | installed and signed in |
| `psql`, `pg_dump` | **not installed** — needed for the cutover, run via Docker |
| `docker` 29.4.0 | ok |
| `firebase` 15.15.0 | ok |
| `gh` 2.51.0 | ok |

## Sources

[Azure grant activation](https://learn.microsoft.com/en-us/industry/nonprofit/microsoft-for-nonprofits/claim-activate-nonprofit-azure-grant) ·
[Container Apps billing](https://learn.microsoft.com/en-us/azure/container-apps/billing) ·
[Container Apps networking](https://learn.microsoft.com/en-us/azure/container-apps/networking) ·
[Container Apps pricing](https://azure.microsoft.com/en-us/pricing/details/container-apps/) ·
[Container Apps GA in Japan West](https://www.azalio.io/launched-generally-available-azure-container-apps-in-australia-se-france-south-japan-west-and-spain-central/) ·
[Postgres private access](https://learn.microsoft.com/en-us/azure/postgresql/network/concepts-networking-private) ·
[Azure PG B1ms](https://www.bytebase.com/dbcost/azure-flexible/instance/B1ms/) ·
APPI [クラウド例外](https://digitalforensic.jp/2024/06/10/column825/) ·
[越境移転と外的環境の把握](https://www.ushijima-law.gr.jp/topics/appi_crossborder_transfer/)
