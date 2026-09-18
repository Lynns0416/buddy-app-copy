# Azure cost reference — Japan East

Revised **2026-09-12** after the two-environment decision. Rates verified the
same day against the [Azure Retail Prices API](https://prices.azure.com/api/retail/prices)
(`armRegionName eq 'japaneast'`, USD) and Microsoft product documentation.
The derivation behind `deploy-plan.md` §7, which quotes the same totals. The
figures both replace came from a third-party pricing table and counted
networking as free.

Re-verify by querying the API directly. Every rate below is quoted as the API
returned it, so the arithmetic is checkable without a portal login.

## The whole stack

Covers **prod and staging**, each on its own Postgres server and its own storage
account, sharing one VNet, one Container Apps environment and one registry.

| Component | Rate | Per year |
|---|---|---|
| Prod Postgres B1ms, always on | $0.026 / hr | $228 |
| Prod storage, 32 GiB | $0.138 / GiB / mo | $53 |
| Staging Postgres B1ms, started by hand | $0.026 / hr | ~$13 at 500 hrs |
| Staging storage, 32 GiB | $0.138 / GiB / mo | $53 |
| Container registry Basic | $0.1666 / day | $61 |
| Two static public IPv4 | $0.005 / hr each | $88 |
| Private DNS zone | $0.50 / mo | $6 |
| Blob storage — buddy photos and nightly dumps | $0.02 / GB / mo | ~$2 |
| Jump VM disk, Standard HDD S4 | $1.536 / mo | $18 |
| Jump VM B2pts_v2, started by hand | $0.0108 / hr | ~$1 at 100 hrs |
| Bastion Developer | free | $0 |
| Load balancer — **unresolved** | $0.025 / hr or $0 | $0 to $219 |
| Web app, api app, cron job, nightly backup job | free grant | $0 |
| Container Apps environment | no management fee | $0 |
| VNet and subnets | — | $0 |
| Database backups to 32 GiB | included | $0 |
| Log Analytics under 5 GB/mo | free tier | $0 |
| **Total** | | **$523 to $742** |

Against a **$2,000/yr** grant whose unused balance does not roll over.

Staging storage is $53 of that and bills whether the server runs or not, so the
only variable in the whole table is staging's hours at $0.026 each. **Every
staging figure below is a total** — compute plus that $53 — so the options
compare like for like. At 500 hours staging is $13 + $53 = **$66/yr**; left
running it is $228 + $53 = **$281/yr**.

Outside this number, because it is not Azure and the grant does not touch it:
**Firebase Auth**, on its own free tier. **Cloudflare R2** leaves the stack
entirely once photos have moved — the nightly `pg_dump` goes to Blob as well,
30 daily snapshots under a lifecycle rule, which is under $0.50/yr and is
already inside the Blob line above.

### Blob storage rates, Japan East Hot LRS

| Meter | Rate |
|---|---|
| Data stored | $0.02 / GB / mo |
| Write operations | $0.065 / 10K |
| Read operations | $0.005 / 10K |
| Delete operations | $0 |

At ~70 profile photos this is pennies. Even at 5 GB and 10M reads a year it
lands near $6. Because a storage account costs nothing to create and bills only
for what it holds, there is no cost argument for sharing one between
environments, which is why each gets its own.

## Why the free lines are free

- **Container Apps compute.** 180,000 vCPU-seconds, 360,000 GiB-seconds and
  2M HTTP requests per subscription per calendar month. Estimated load is
  ~8,400 vCPU-seconds and ~56k requests, so ~17,000 across both environments —
  under 10% of the grant. The nightly backup job adds ~900 vCPU-seconds and
  ~1,800 GiB-seconds a month at 1 vCPU / 2 GiB, assuming ~30 seconds a night —
  an estimate, not a measurement, and two orders of magnitude below the grant
  either way. A revision scaled to zero replicas incurs no resource
  charge at all. **This line is free only while every app scales to zero**: one
  app left at `--min-replicas 1` bills around the clock and costs 648,000
  vCPU-seconds a month at 0.25 vCPU, 3.6× the whole grant on its own. The
  `az containerapp create` default is 0; do not raise it to hide cold starts.
- **No environment management fee.** Microsoft's billing doc: *"You aren't
  billed any plan management charges unless you use a Dedicated workload
  profile in your environment."* The Consumption profile stays clean. Private
  endpoints and planned maintenance would trigger the fee, and neither is used.
- **Backups.** Two different things, both near zero. Azure's own Flexible
  Server backups are free up to 100% of provisioned storage, so 32 GiB of
  backup against 32 GiB provisioned costs nothing; excess is $0.095/GB/mo. The
  nightly `pg_dump` into Blob is separate: 30 snapshots of a dump that is
  currently under a megabyte is ~$0.01/yr of storage, plus 365 writes a year at
  $0.065/10K, and the lifecycle rule's deletes are free. It stays under $0.50/yr
  even if a dump grows to 50 MB.
- **VNet injection.** Free. Private endpoints are not, and are not used.

## The one unresolved line

The managed load balancer that Container Apps creates in its `ME_` resource
group. Microsoft's networking doc states you are billed for *"one standard
load balancer"* plus two public IPs for an external workload-profiles
environment. The standard rules meter returns **$0.025/hr ($219/yr)**, but a
**$0.00 "Standard Included LB Rules and Outbound Rules - Free"** variant of the
same meter also exists, and nothing in the pricing data says which one a managed
Container Apps load balancer draws on.

**Settle it by reading the first real bill.** Do not spend more time on the
pricing API for this.

Two smaller lines are absent because they should fall inside free allowances at
this volume, without a guarantee: Log Analytics ingestion above 5 GB/mo, and
outbound bandwidth above the free allowance.

## Settled by this analysis

**Separate B1ms servers for prod and staging.** Sharing one server was costed
and briefly recommended here on 2026-09-12; it was rejected the same day.
Against the design actually chosen it saves **$66/yr** — staging's entire line,
$13 of compute plus $53 of storage — because staging's server is stopped most of
the year anyway. The $281/yr quoted while it was under discussion assumed an
always-on staging server, a baseline that no longer exists. $66 is a saving
against a grant balance that expires unused, and in exchange it couples prod and
staging to one CPU credit budget and one 35-connection ceiling. It is also not
how these environments are run anywhere. Cost was the only argument for it and
cost is not binding.

**Staging compute is started by hand, not scheduled.** **$66/yr** — $13 of
compute at 500 hours plus $53 of storage. A cron-driven daily window of 4–6
hours is $91–$110/yr on the same basis and always-on is $281/yr. The window was
rejected for paying for hours nobody uses during the weeks between feature
cycles, not for the $25–$44 it adds.

**Separate storage accounts per environment.** Free, so nothing to trade.

**A jump VM through Bastion Developer, for querying the databases.** ~$19/yr:
the S4 disk bills at $1.536/mo whether the VM runs or not, and B2pts_v2 compute
is $0.0108/hr while started. Checked 2026-09-17 against the Retail Prices API.
B1s ($0.0136/hr) isn't offered to this subscription in Japan East. Rejected:
Bastion Basic at $0.19/hr (~$1,660/yr), a VpnGw1 gateway at $0.19/hr, and a
public IP on the VM at $0.005/hr (~$44/yr). See `decisions.md` 2026-09-17.

**Azurite for local photo upload.** `mcr.microsoft.com/azure-storage/azurite` in
the existing compose file. Speaks the real Blob API, so local development
exercises the same SDK path as prod rather than a stub, and needs no Azure
account.

**Rejected — sleeping staging on a seven-day cycle.** About $54/yr, so $227/yr
off an always-on server — a saving against a grant that expires unused, and it
costs a weekly re-stop automation plus full price the month it is forgotten.
Superseded by the manual model at $66/yr, which accepts the auto-restart rather
than automating around it.

**Rejected — downsizing the database.** B1ms is the smallest tier Azure sells
(1 vCore, 2 GiB) and 32 GiB is the storage floor. Nothing left to trim.

**Rejected — running Postgres in a Container App instead of the managed
service.** Ephemeral container storage means mounting Azure Files, and Postgres
on an SMB share risks corruption through fsync semantics. One replica only,
which rules out scale to zero. Gives up automated backups, PITR and patching.
Lands at $120–$360/yr plus Azure Files, so not reliably cheaper than the
$281/yr managed prod server it would replace.

**Rejected — keeping photos on R2.** Cloudflare supports EU, US and FedRAMP
jurisdictions only, with no Japan option, and states that location hints are
best-effort rather than a guarantee. Photos would keep the APPI 外的環境の把握
burden that moving the database to Japan East was meant to remove. Blob also
drops five long-lived `R2_*` access keys in favour of managed identity, and
those keys already caused one silent photo-upload failure in staging.

## Caveats that are not about cost

- **Burstable is not a production tier by Microsoft's own description.** The
  compute doc: *"Not recommended for production workloads"*, *"does not qualify
  for 24/7 support, and root cause analysis (RCA) may not be provided."*
  Exhausting CPU credits can make the server unreachable. Monitor
  **CPU Credits Remaining** and alert on it.
- **Staging auto-restarts after seven days.** With no scheduler enforcing the
  stopped state, staging silently comes back during dormant stretches and bills
  compute until someone notices. The staging server budget below is the only
  thing that will catch it, which makes it load-bearing rather than optional.
- **B1ms allows 35 user connections** of 50 total, and Burstable has no
  PgBouncer. Container Apps replicas across two apps share that ceiling, so cap
  the Prisma pool in both `DATABASE_URL`s.
- **Give each database its own role** so a misdirected connection string cannot
  reach prod data.

## Cost alerts

Created 2026-09-13 by `scripts/azure-cost-alerts.sh`. All email
`COST_ALERT_EMAIL` from `microsoft-noreply@microsoft.com`.

| Alert | Scope | Amount | Fires at |
|---|---|---|---|
| `budget-peace-buddy-annual` | subscription | ¥160,000/yr (~$1,000) | 80% actual, 100% actual, 100% forecast |
| `budget-psql-peace-buddy-stg-monthly` | staging server only | ¥1,600/mo (~$10) | 100% actual, 100% forecast |
| `dailyAnomalyPeaceBuddy` | subscription | — | a daily cost outside the expected range |

**Amounts are in yen.** Cost Management reports this subscription in JPY, and a
budget takes the billing currency. Azure's own conversion is **¥159.3 per
dollar**, read off the Retail Prices API on 2026-09-13 by pricing the same meter
in both currencies: B1ms compute is $0.026 and ¥4.1423 an hour, the registry
$0.1666 and ¥26.5427 a day.

**Why a staging budget of its own.** Staging left running adds ~$19/mo of
compute to a subscription spending $42–60/mo, which the annual total would not
flag for months. Against staging's own month — ~¥700 of storage plus a few
hundred yen of hand-started hours — the same compute trips the forecast
threshold within days and the actual one inside about nine.

**What these cannot do.**

- **They are days late, not hours.** Usage reaches Cost Management a day or
  more after it happens, so staging waking on day 7 is seen on day 8 at best.
- **The anomaly alert is blind until ~2026-11-10.** It trains on 60 days of
  history and billing began 2026-09-10.
- **It expires.** Azure caps an anomaly alert's end date at five years; the
  script sets 31 December four years on, and a re-run pushes it out.
- **Nothing stops spend.** A budget only emails.

**The subscription's offer is on Microsoft's unsupported list.** Quota
`Sponsored_2016-01-01`, Microsoft Azure Sponsorship, is listed under offers
Cost Management does not support. Cost data is nonetheless flowing — daily JPY
rows from 2026-09-10 — and budgets and the anomaly rule were accepted. If an
alert that should have fired never arrives, this is the first suspect; the
fallback is watching the sponsorship balance by hand.

## Why the estimate moved

It moved for two independent reasons, in opposite directions.

| Stage | Figure | What changed |
|---|---|---|
| `deploy-plan.md` §7 | $257/yr | B1ms rate taken from a third-party table; networking counted as $0 |
| After verification | $716–$935/yr | Real B1ms rate is ~53% higher; two public IPs, a load balancer and a private DNS zone are billed |
| After consolidation | $435–$654/yr | One database server instead of two, costed while staging was still assumed always-on — **reverted** |
| Current | $504–$723/yr | Separate servers restored; staging compute is manual; photos added |

Verification pushed it up. A design change pushed it down, then was reverted
because it traded an architecture norm for a saving that the grant makes
meaningless.

## Before the grant ends

The whole analysis assumes credit. If it lapses, the levers in order of value
are: delete staging entirely, server and storage ($66/yr), drop the registry for
a free external one ($61/yr), and only then reconsider the database. Stopping
staging between uses is **not** on this list — it is already the design, and its
saving is already inside the $504.

## Sources

[Retail Prices API](https://prices.azure.com/api/retail/prices) ·
[Container Apps billing](https://learn.microsoft.com/en-us/azure/container-apps/billing) ·
[Container Apps custom VNet — managed resources](https://learn.microsoft.com/en-us/azure/container-apps/custom-virtual-networks) ·
[Postgres compute and storage](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-compute-storage) ·
[Postgres backup and restore](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-backup-restore) ·
[Postgres limits](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-limits)
