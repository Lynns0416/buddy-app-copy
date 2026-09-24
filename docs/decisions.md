# Decisions

Append-only log of decisions and the alternatives rejected. Newest first.

PRD.md, architecture.md, and data-model.md describe **what the system is**. This
file records **why it is that and not something else** — so a settled question
does not get re-litigated in a later session.

Add an entry when a decision closes off an alternative someone might plausibly
re-propose. Link to the doc that holds the resulting current state; do not
duplicate that state here.

---

## 2026-09-24 — Every session field is editable after creation

**Decision:** the tour edit form shows every field of an existing session —
place, label, meeting time, capacity, min buddies, participant count — and
saves each session's changed fields in one `PUT /admin/tours/:id/sessions/:sessionId`.
Adding and removing sessions stays on the detail page. Lowering capacity below
the session's Confirmed bookings is rejected (`CapacityBelowConfirmedError`,
409; the form checks it first). A `meetingTime` change on a published tour
fires `tour_details_changed`, like a place change. Closes #247.

**Why:** the edit form hid these fields (`hideSessionManagement`, #71) although
the API accepted them and nothing recorded them as fixed, so a changed group
size or buddy count could not be corrected.

**Rejected — allow capacity below Confirmed and keep the excess confirmed:**
the session would sit over capacity, and its `remaining` seat count assumes
Confirmed ≤ capacity. A single tier pool may still end up over its share; the
pool math clamps at zero and overflows into `anyone`, so that pool only reads
as full.

**Rejected — a distinct error code for each session 409:** the place lock and
the capacity lock both answer `conflict`, and the edit form names the lock from
which fields it sent. When one save changes both place and capacity it shows
the generic conflict message; a new `AppErrorCode` for that rare case is not
worth widening the shared enum.

**Rejected — keep label and meeting time fixed:** a changed meeting time is
routine; forcing delete-and-recreate is blocked once a session has bookings.

---

## 2026-09-24 — Production releases are semver tags on `main`

**Decision:** production is released by tagging a commit on `main` and pushing
the tag; the tag push triggers the prod deploy. Versions are semver starting at
`v1.0.0` for the first production release, bumped by a fixed rule:

- **patch** (`v1.4.1`) — a hotfix only
- **minor** (`v1.5.0`) — every normal release
- **major** (`v2.0.0`) — a milestone (production launch, a large redesign); rare

Release notes are GitHub Releases generated from the squash-merge PR titles.
Rollback is redeploying the previous tag — images are already tagged by commit
and the registry prune keeps the newest five. Migrations are forward-only, so
rolling back past a schema change needs the migration to be safe for the older
code. A hotfix is normally a fix on `main` plus a patch tag; a short-lived
`hotfix/*` branch cut from the last tag is used only when `main` holds work
that cannot ship yet, and is merged back after.

Not built yet: deployment is still manual (`scripts/deploy.sh`). This records
the process the pipeline will implement once production is live.

**Why:** one developer, one production deployment, branches squash-merged to
`main`. Tags mark what is in prod and give a rollback target; nothing else is
needed.

**Rejected — release branches (git-flow style):** they pay off when several
versions are supported at once or a release stabilises while `main` moves on.
Neither applies; they would add a branch to keep in sync and back-ports for
every fix.

**Rejected — date versions (`v2026.09.24`):** two releases on one day collide
and need a suffix, and the date duplicates what git already records on the tag.

**Rejected — plain incremental (`v1`, `v2`):** simpler and fully adequate, but
semver is the familiar format, and its patch number separates hotfixes from
feature releases at almost no cost.

**Rejected — a GitHub Environment approval gate on prod:** with one developer,
pushing the tag is the approval.

**Rejected — `CHANGELOG.md`:** generated GitHub Release notes are enough.

**Open — auto-deploy staging on push to `main`:** staging compute is started by
hand and off most of the time, so a push-triggered deploy would fail against
it. Decide between deploying staging on demand (`workflow_dispatch`) or keeping
staging running before building the pipeline.

---

## 2026-09-24 — Admin sidebar grouped by task

**Decision:** the admin nav in `AppShell` is `{ labelKey, items[] }` sections
instead of a flat list: Home, then ツアー運営 (Tours, Groups, Places), then
バディ管理 (Pending Approval, Buddies, Trainees). Personal items (My Profile,
Notifications, Admin Roster — still super_admin only) move to the footer with
language and sign-out. Headings are plain text, never collapsed, and label a
`role="group"`. Each section sits under a divider, its heading in bold
foreground text (not muted — a heading fainter than its links read as
nothing), its links indented behind a left rule; the active link carries `aria-current="page"`. The desktop
sidebar and mobile drawer render the same sections. Closes #243.

**Why:** ten same-looking links in no task order meant reading every label,
with personal settings mixed into daily work and Tours seventh.

**Rejected — collapsible accordion sections:** under ~15 items, collapsing only
hides destinations and adds a click. Revisit if the nav grows past that.

**Rejected — folding Pending Approval and Trainees into tabs/filters on the
Buddies page:** pending approval is an inbox-style task that deserves its own
entry (and a future count badge).

**Rejected — a top bar with settings under an avatar menu:** desktop has no top
bar, so it is a larger layout change for the same separation the footer gives.

**Deferred:** a pending count on Pending Approval (needs a count endpoint) and
per-item icons. Both were optional in #243.

---

## 2026-09-24 — A place belongs to a session, not a tour

**Decision:** `TourPlace` (the tour↔place many-to-many from the 2026-09-23
entry below) is dropped. Each `TourSession` has exactly one required
`placeId`, and a tour's `places` in every response is derived — its sessions'
places, each once, in session order. The tour form picks a place with a
dropdown on each session row instead of a checkbox list for the tour.
Supersedes the parts of the 2026-09-23 entry that assume tour-level places:
the `placeIds` array, the removal lock, the multi-place reflection fallback,
and the joined ICS `LOCATION`.

**Why:** creating a tour with two places left no way to say which session
went where. The two sessions of one tour can go to different places, and one
session never goes to more than one — so the place is a property of the
session.

**Rejected — keep tour-level many-to-many:** it can't say which session goes
where, which is the problem this entry fixes.

**Rejected — a single place on the tour (`Tour.placeId`, a dropdown):**
sessions of one tour go to different places, so a tour-level place is still
wrong for some tours.

**Rejected — many-to-many at session level:** a session goes to exactly one
place, so a join table would allow a shape that never happens.

**A session's place stays editable after creation**, locked only while a
`TourReflectionMoment` on that session references a spot of the current place
(`PlaceInUseError`, 409, in `updateSession`). Edits are rare, but that's no
reason to rule out correcting a wrong pick. **Rejected — fixed at creation:**
the only gain is dropping the lock.

**A moment's `spotId` must be a spot of its session's place** (was: of any of
the tour's places) — the lock above relies on it, the same way the old removal
lock relied on the tour-level check.

**A session's place change on a published tour fires `tour_details_changed` to
every booked buddy on the tour**, via the existing tour-wide
`enqueue*ForBookedBuddies` helpers. **Accepted:** buddies on the other session
get a notice they didn't strictly need. Narrowing it would mean
session-scoped variants of those helpers for an edit that rarely happens.

**The ICS `LOCATION` is the event's own session's place**, in the recipient's
locale, as before — no more joining several names.

**The edit form shows the per-session place dropdown** even though it hides
the rest of session management, and it saves a changed place through
`PUT /admin/tours/:id/sessions/:sessionId`. A 409 from that call means the
lock, so the form shows a specific message rather than the generic conflict
text (#241 still applies to `PUT /admin/tours/:id`).

**The migration backfills** each existing session with its tour's first place
by `sortOrder` before dropping `TourPlace`. Nothing is in production; the
backfill just lets development databases migrate without a reset.

**Current state:** `prisma/schema.prisma` `TourSession.placeId`,
`docs/data-model.md`, `docs/api.md` Tour + Sessions sections, `docs/PRD.md`
§7.1, §7.5, §9.3, §10.1.

---

## 2026-09-23 — Places and spots replace free-text location

*Tour-level places (`TourPlace`, `placeIds`, the removal lock, the
multi-place reflection fallback) are superseded by the 2026-09-24 entry above.*

**Decision:** `Tour.location` (free text) is dropped, replaced by a many-to-many
`TourPlace` join to a new admin-managed `Place`/`Spot` pair — a `Place` (e.g. a
park) contains `Spot`s (e.g. a monument inside it), both bilingual
(`nameJa`/`nameEn`), ordered (`sortOrder`) and retired via `active: false`,
never deleted. `TourReflection.memorableMoment` (free text, #236) is dropped
the same way, replaced by 0..n `TourReflectionMoment` rows, each with a
required `description` and exactly one of `spotId` or free-text `placeNote`.
Nothing was in production, so no data migration for either column. Closes
#239.

**Why:** a buddy writing "Peace Park", "Urakami Cathedral" or "Atomic bomb
Museum" for the same tour location made nothing countable. The org's actual
seed data (`prisma/seed.ts`) has four places — 平和公園 (Peace Park), 浦上天主堂
(Urakami Cathedral), 原爆資料館 (Atomic Bomb Museum), VOICE — and only Peace Park
has named spots (nine of them, from an opening to a closing along the walking
route). The other three places are expected to stay spot-less.

**Rejected — a Prisma enum for places or spots:** changing one needs a
migration and a deploy, so admin cannot manage it day to day. Same reasoning
already applied to every other admin-configurable list in this codebase.

**Rejected — free-text place or spot:** cannot be analysed — the exact problem
this closes.

**Rejected — a combined place row for multi-place tours** (e.g. one row for
"Peace Park + Urakami Cathedral"): would duplicate every spot of its parts
under a synthetic combined identity and split per-spot analytics across two
untraceable buckets instead of joining cleanly through `TourPlace`.

**Rejected — translations in `messages/*.json`:** those files hold UI copy;
places and spots are data, alongside `nameJa`/`nameEn` columns like every other
bilingual entity in this schema (`Group.name` is the one exception, and it
isn't bilingual either).

**`TourPlace` is an array field on `CreateTourSchema`/`UpdateTourSchema`
(`placeIds: string[]`), not a separate sub-resource** like the existing
`TourAdminAssignment` (`POST/DELETE /admin/tours/:id/admins`, a standalone
assign/unassign panel on the tour detail page, after the tour exists).
**Rejected — mirroring `TourAdminAssignment`'s pattern:** admin staffing is
naturally a post-creation concern (you assign people once the tour is real);
a tour's places are core, required-at-creation metadata replacing what used to
be a single required text field — picking them belongs in the create form
itself, as a plain checkbox list of active places, not a second trip to a
detail-page panel.

**A place cannot be removed from a tour while a `TourReflectionMoment` on that
tour references one of its spots** (`PlaceInUseError`, 409, checked in
`updateTour` before the sync). Adding a place is always allowed. **Rejected —
no lock at all:** would silently orphan a moment's `spot` relation to a place
the tour no longer claims to cover, which is worse than refusing the edit.
**Known gap:** the tour edit page shows only the generic conflict message for
this 409, because the web client drops the API's `detail` (#241).

**A moment's `spotId` must be a spot of one of the tour's places**, checked in
`createReflection`/`updateReflection` (`InvalidSpotError`, 400) — the removal
lock above holds only if moments cannot name another tour's spot. A retired
spot is accepted: a PUT resends every moment, including one tagged before its
spot was retired, and the reflection form keeps such a spot selectable, the
same way the tour form keeps a retired place. **Rejected — requiring an active
spot:** an edit inside the window would then fail for a buddy who changed
nothing about that moment.

**The ICS `LOCATION` bakes in one language, chosen from the recipient's own
`User.locale`** — `nameJa` for `ja`, `nameEn` for `en`, multiple places joined
`、`-separated for `ja` and `, `-separated for `en`. This is the one place a
locale choice happens server-side rather than being left to the web layer:
every other reader of place/spot data gets both `nameJa` and `nameEn` raw and
picks at render time (matching the 2026-09-19 entry's "the API is
locale-agnostic" precedent for the ICS session label) — but a downloaded
`.ics` file has no later render step to pick a language at, unlike a JSON
response consumed by the web app. **Rejected — always `nameJa`:** the same
2026-09-19 entry rejected a UI-string fallback on the same grounds (no
built-in preference for either language); honouring `User.locale` costs one
`User` lookup per download, since the auth middleware's `DbUser` does not
carry it.

**When none of a tour's places have any spots, the reflection form collapses
to a single textarea instead of the add/remove/reorder moment picker** — the
common case today, since three of the four seeded places have no spots.
Submitting it produces one `TourReflectionMoment` with `placeNote`
auto-filled from the tour's place name (not typed by the buddy) when the tour
has exactly one place; with two or more spot-less places, a plain place radio
(no spot level) precedes the same textarea. The Zod rule itself
(`spotId` XOR `placeNote`, always exactly one) is unchanged — the fallback
path fills `placeNote` itself rather than relaxing the schema. **Rejected —
always show the full moments UI, with the spot control simply reading "Other"
when the tour's places have no spots:** true to the literal per-moment rule,
but forces the add/remove/reorder chrome onto a case with nothing to add
around, for no analytical benefit over the pre-#239 single free-text prompt.
**Rejected — save with both `spotId` and `placeNote` null:** simplest, but a
moment from a spot-less tour would carry no place information at all, even
when the tour has exactly one (fully identifiable) place.

**The textarea is used only when it can hold what was already saved** — no
saved moments, or exactly one whose `placeNote` is one of the tour's place
names (`usesSingleMoment` in `reflection-form-state.ts`, decided from the saved
reflection, not the live form state, so editing never flips the layout). A
reflection written while the tour had spots can carry several moments, or an
Other note in the buddy's own words; once those spots are retired, or their
place is taken off the tour (allowed — the removal lock covers only moments
with a `spotId`), such a reflection keeps the full picker with Other as its only
choice. **Rejected — the textarea regardless:** it shows only the first moment
and rewrites its `placeNote` to a place name, so the first keystroke silently
drops every other moment and the buddy's own note.

**The auto-filled `placeNote` is the place's `nameJa`, whatever the buddy's UI
language**, so one place is stored under one name. Reading a note back, the
form matches it against either name. **Rejected — the name in the buddy's UI
language:** the same place would be stored as 浦上天主堂 by one buddy and
Urakami Cathedral by another, the uncountable free text this entry closes.
**Rejected — a `placeId` column on `TourReflectionMoment` for these moments:**
it would survive a rename, but it reopens the `spotId` XOR `placeNote` rule
settled above. **Accepted:** after a place is renamed (a correction, never a
repurposing), older notes match neither name, so the edit form shows such a
note as an Other moment in the full picker rather than the textarea.

**Admin UI is a new `/admin/places` list + `/admin/places/:id` spot list**,
following `Group`'s sortable-list-with-create/edit-dialog pattern
(`SortIcon`, no detail-page nested history since there's nothing analogous to
show). No delete action anywhere, matching `Group`'s "no delete in v1"
convention. **Reordering is a plain editable `sortOrder` number per row, not
drag-and-drop:** no such interaction exists anywhere else in this codebase,
and introducing one here would be new UI surface for a config screen five
admins use occasionally.

**Current state:** `prisma/schema.prisma` `Place`/`Spot`/`TourPlace`/
`TourReflectionMoment`, `docs/data-model.md`, `docs/api.md` "Places and
Spots" + Tour/Reflection sections, `docs/PRD.md` §7.5, §9.3.

---

## 2026-09-23 — The buddy writes a reflection, not a self-evaluation

**Decision:** `SelfEvaluation` is gone. In its place `TourReflection` holds five
free-text prompts — `didWell`, `couldImprove`, `memorableMoment`,
`notesForOthers`, `openQuestions` — all `String?`, with **at least one
non-empty** required to submit. The nine 1–5 scores, their nine notes and the
emotional note are dropped outright: nothing is in production, so there is no
data migration. Admin evaluations are untouched and still scored;
`EvaluationScoreField` and `evaluation-score-grid` now serve the admin forms
only. Closes #236.

**Why free text, not scores.** The old form was the admin appraisal form minus
`reliability` and `absentWithoutReport` — same component, same "Poor →
Excellent" legend pulled from the `adminEvaluations` namespace. It asked a
volunteer to grade themselves on nine abstract traits across 19 inputs, and
produced numbers nobody acted on. What the org actually wants back from a tour
is what happened. **Rejected — keeping a single overall score alongside the
prompts:** one number nobody uses is still one number nobody uses, and its
presence reinstates the "you are being appraised" frame the rest of the change
removes.

**Rows are per session; the obligation is per tour.** `TourReflection` is keyed
on `sessionId` with `@@unique([buddyId, sessionId])`, so a buddy who worked a
tour's 1st and 2nd half may write each up separately if the groups felt
different. They are only ever *asked* once: any row on any session of the tour
silences `self_eval_prompt` and sets `reflectionSubmitted` on `GET /me/bookings`.
`Tour.tourDate` is a single date, so a tour is one day and its sessions are time
slots within it — per-tour would flatten two genuinely different groups into one
box, and per-session-obligation would nag a buddy twice for one afternoon.
**Rejected — keying on `tourId` as before:** it is the shape that forced the
flattening.

**No denormalised `tourId` column.** The tour is reachable through
`session.tourId`; storing it too would be a partial dependency on the key, and
there is no measured query that needs the join removed — `listMyBookings` reads
it back with one extra `tourReflection.findMany` scoped to the tours already
listed. `Booking` carries both `tourId` and `sessionId` only because
`@@index([tourId, status])` serves per-tour capacity queries; reflections have
no equivalent. **Rejected — mirroring `Booking`:** consistency with a table that
has a reason is not itself a reason.

**`PUT /me/reflections/:id` replaces all five prompts rather than patching
them.** The five are one document, and a replacement lets the "at least one
non-empty" rule live in the Zod schema, where it is checked at the boundary,
instead of in the service after reading the stored row back and merging.
**Rejected — the old `!== undefined` partial-update pattern:** with a partial
payload the schema cannot tell "leave this alone" from "clear this", so it
cannot enforce the rule at all, and clearing the last filled prompt would slip
through.

**Not changed — a reflection still requires the tour to be `completed`.** #236's
validation list names only the confirmed-booking check, but dropping the status
check would let a buddy write up a tour that has not happened. Same bar as
before, now applied to the session's tour.

**The reflection is its own page,** `/{locale}/buddy/tours/{tourId}/reflection`,
with one form per session the buddy holds a confirmed booking on; tour detail
links to it instead of hosting the form. This is also where past reflections are
read back, which absorbs the self-evaluation recall half of #215. **Rejected —
keeping the form inline on tour detail:** with per-session rows that page would
carry two or three forms below the booking cards, on a screen whose job is the
booking.

**Renamed with the model,** so that no name in the codebase still says
"evaluation" for something the buddy writes: `SELF_EVAL_EDIT_WINDOW_DAYS` →
`REFLECTION_EDIT_WINDOW_DAYS`, `SELF_EVAL_PROMPT_DAYS` →
`REFLECTION_PROMPT_DAYS`, `MyTourBookingEntry.selfEvaluationSubmitted` →
`reflectionSubmitted`, the `selfEvaluation` action-item kind → `reflection`,
`/me/self-evaluations` → `/me/reflections`, `/admin/self-evaluations` →
`/admin/reflections`. The `self_eval_prompt` notification event keeps its name:
it is a persisted Prisma enum value with rows and preferences potentially keyed
to it, and renaming it buys a word at the cost of a data migration.

**Out of scope, needs its own issue:** surfacing `notesForOthers` and
`openQuestions` to *other* buddies. Both prompts are named for sharing, but
access is unchanged — the buddy's own rows, plus admin.

**Current state:** `prisma/schema.prisma` `TourReflection`, `docs/data-model.md`,
`docs/api.md` "Buddy Tour Reflections", PRD §9.3.

---

## 2026-09-23 — Local seed runs on every api container start

**Decision:** the api `dev` image's CMD runs `prisma db seed` right after
`prisma migrate deploy`. A seed failure logs a warning and the api starts
anyway.

**Why:** `prisma/seed.ts` writes only through `upsert` on fixed keys, so a
re-run never duplicates rows. Running it after `migrate deploy` in the same
command guarantees the schema is current first. The seed reads
`.firebase/emulators/auth_export/accounts.json`, which is gitignored, so on a
fresh clone it fails — that must not keep the api down.

**Rejected — a separate one-shot `seed` compose service that the api waits on
(`service_completed_successfully`):** it would need its own `pnpm install`,
`prisma generate` and node_modules volumes, and it would still have to wait for
the api's `migrate deploy`. That puts migrate/seed ordering across two
containers for what is one extra command in a CMD that already migrates.

**Trade-off:** the seed's non-empty `update` clauses (user email/role, buddy
profile fields, `bookingOpen` on two tours, a `percent`) reset those fields on
every start, so local edits to them do not survive a restart. Seed tour dates
are set only on create and do not move forward.

**Current state:** `apps/api/Dockerfile` (`dev` stage), `README.md`.

---

## 2026-09-23 — Long-text fields take limited Markdown, written through a toolbar

**Decision:** `Group.notes`, `Tour.adminMemo` and `Tour.description` are stored
as Markdown in the existing plain-text columns. The admin forms edit them with
`MarkdownEditor` (`apps/web/src/components/markdown-editor.tsx`): a Textarea
with bold / bulleted list / numbered list / link buttons and a Write/Preview
toggle. Every page that shows them renders through `MarkdownText`
(`react-markdown` + `remark-breaks`), which allows only `p`, `br`, `strong`,
`em`, `ul`, `ol`, `li` and `a`; anything else renders as its text, and raw HTML
is never rendered. Single newlines stay line breaks, so rows written before
this render as they did (#127) — unless a line happens to be Markdown syntax.

**Why:** #127 started as newlines collapsing in group notes, and the reporter
asked for more readable notes. Members can use Google Docs but should not have
to learn Markdown syntax — the toolbar inserts it for them, and the preview
shows the result.

**Rejected — WYSIWYG editor (Tiptap) storing HTML:** every render needs a
sanitiser, the API has to validate HTML input, and existing plain-text rows
need converting. Heaviest option for a few formatting marks.

**Rejected — WYSIWYG editor storing Markdown:** no storage change, but several
dependencies, a heavier admin bundle, and Markdown conversion that can drop
formatting it does not model. The toolbar gets most of the benefit for one
small component.

**Rejected — bare Markdown with a syntax hint:** members are not expected to
know Markdown.

**Rejected — an in-house Markdown parser:** our own code to maintain for a
problem `react-markdown` already solves safely.

**Known cost:** the calendar export (`apps/api/src/lib/tourIcs.ts`) and any
other non-web consumer get the Markdown source, so `**bold**` and `[text](url)`
show as typed there. An existing plain-text row whose lines happen to be
Markdown syntax changes on screen: a `---` line disappears, a leading `#` or
`>` is dropped, `*a*` becomes italics. No rows were migrated for this; the
admin sees it and can edit the row.

**Current state:** `docs/PRD.md` §6.1 and §7.1 field tables.

---

## 2026-09-20 — Every date in the UI is `yyyy/MM/dd` in Japan time, in both locales

**Decision:** `apps/web/src/lib/format-date.ts` holds the only two date
formatters the web app uses: `formatDate` renders `yyyy/MM/dd` and
`formatDateTime` renders `yyyy/MM/dd HH:mm`, for the two places that show when
something happened (the tour bookings table and the notification row). Every
display call site goes through them. Both read the calendar date **in Japan**,
via the `JST_OFFSET_MS` that `getTodayJst` already uses, so a `@db.Date` value
(UTC midnight) keeps its day and a timestamp shows the day it happened there.
Closes #129.

**Why one format in both `ja` and `en`, not one per locale.** The app is used in
Japan by both languages' readers, and `yyyy/MM/dd` is unambiguous to both —
unlike `9/10/2026`, which two readers date two months apart. Rejected:
`toLocaleDateString(locale)`, which gives `2026/9/10` in `ja` and `9/10/2026` in
`en` for the same tour, so the same list read differently depending on who
opened it.

**Rejected — leaving the format to the browser.** Four of the call sites called
`toLocaleDateString()` or `toLocaleString()` with no locale at all, so the output
followed the viewer's device rather than the app. Two more built an
`Intl.DateTimeFormat` inline. That is what produced four different date renderings
across the app, which is what #129 reported.

**Rejected — `Intl.DateTimeFormat` with `timeZone: 'Asia/Tokyo'`.** Same answer
as the fixed offset, because Japan has no daylight saving, but it depends on the
runtime's ICU data being present and matching between server render and client
hydration. The offset is arithmetic and cannot come out differently. Same
reasoning as the 2026-09-15 entry below.

**A `YYYY-MM-DD` string that is already the right day still goes through the
formatter**, so that the today divider on the admin tours list and the calendar's
mobile agenda headings read `2026/09/20` like the rows around them, not
`2026-09-20`. The formatter is what the format is; no call site renders a raw
date, however correct its day already is.

**Not changed:** `slice(0, 10)` stays where it is not a rendering — date
comparisons, `input[type=date]` values in the tour form, the calendar's
`data-date` attributes, and the map keys in `admin.tour.ts` and `buddy.home.ts`.
Those need `YYYY-MM-DD`, not a display string. So do the API's notification
payloads (`payloadTourDate`), which feed Slack and email and cannot import from
the web app; they carry the same day, only a different separator. The tour
calendar's weekday and month headings stay locale-formatted: they are names, not
dates.

**Current state:** `apps/web/src/lib/format-date.ts` and its test.

---

## 2026-09-19 — `.ics` download is one VEVENT per session, hand-rolled, confirmed-only for buddies

**Decision:** `GET /tours/:id/calendar.ics` (buddy) and `GET /admin/tours/:id/calendar.ics`
(admin) return a static iCalendar file: one `VEVENT` per session, not one
event for the whole tour. The buddy endpoint includes only sessions the
caller holds a **confirmed** booking on — not maybe or waitlist — and `404`s
if there are none; the admin endpoint includes every session, since an admin
has no personal booking to filter by. RFC 5545 encoding (escaping, 75-octet
line folding, VCALENDAR/VEVENT assembly) is hand-rolled in
`apps/api/src/lib/ics.ts`, generic and tour-agnostic; the tour→event mapping
lives in `apps/api/src/lib/tourIcs.ts` and is shared by both routes' services
so the two endpoints cannot drift on field mapping, escaping or the UID
scheme. Closes #199.

**One VEVENT per session, not one per tour.** Sessions carry distinct
`meetingTime`s (a school visit can have a 1st and 2nd half), so a single
tour-level event would either pick one session's time arbitrarily or span a
misleadingly long block. The download is still one file — most calendar apps
happily import a `.ics` containing several `VEVENT`s from one drag-and-drop or
one URL fetch.

**Buddy scope is confirmed sessions only, not every session in the tour.**
The problem this issue names is "get a tour date into their own calendar" —
their own, meaning what they actually committed to. Putting a session the
buddy never signed up for on their personal calendar would be actively wrong,
not just unnecessary. This matches the "confirmed = commitment" bar used
everywhere else (2026-09-15, "Buddy home is an obligations screen"). A buddy
with zero confirmed sessions gets `404` — there is nothing to download.
**Rejected — every session in the tour, matching admin:** simpler (one
code path, no filter), but wrong for a personal calendar.

**Hand-rolled RFC 5545 encoding, no new dependency.** No `ical-generator`/`ics`
package was installed, and this is the first non-JSON response the API has
ever returned. `apps/api/src/lib/ics.ts` follows the same shape as the
`escapeSlack`/`escapeHtml`/`escapePlain` channel-escaper pattern already in
`templateRender.ts` (2026-09-13, "Notification payloads snapshot the names
they display"): a shared control-character strip plus a channel-specific
escape map, here also handling comma/semicolon/backslash and the `\n`
newline encoding RFC 5545 TEXT values require. Line folding is byte-based
(UTF-8 octets, not JS string length) and backs off to the nearest character
boundary rather than cutting mid-character — Japanese group/location names
are mostly 3-byte characters, so a naive `slice(0, 75)` would corrupt one.
Both are covered directly in `apps/api/src/lib/ics.test.ts`, including a
multi-byte-boundary case. **Rejected — the `ics` npm package:** more
battle-tested RFC 5545 compliance out of the box, but it would be the first
runtime dependency in `apps/api` that isn't an infra SDK or Zod, for logic
that fits in under 100 lines and is fully unit-testable on its own.

**Timezone: UTC instants (`Z` suffix), no `VTIMEZONE` block.** `TourSession`'s
`meetingTime`/`startTime`/`endTime` (`@db.Time`) are written by
`adminTour.service`'s `parseTime` via `setUTCHours` directly on the admin's
entered `HH:MM` — so the stored UTC hour/minute already *is* the intended JST
wall-clock hour/minute, not a real UTC time (this was true before this
change and is unrelated to it; recorded here because generating a correct
calendar event depends on knowing it). Building the real instant means
combining that HH:MM with the tour's JST calendar date and subtracting the
fixed 9h offset — the same offset `getTodayJst` uses (2026-09-15, "'Today' is
the date in Japan everywhere") — rather than pulling in `Asia/Tokyo` through
`Intl` or a timezone library. Emitting the result as a `Z`-suffixed UTC
instant is unambiguous on its own; a full `VTIMEZONE` component would be
boilerplate for a zone with no DST.

**`UID` is `session-<sessionId>@peace-buddy.internal`, stable across
re-download.** `peace-buddy.internal` is not a resolvable hostname — RFC 5545
only requires a UID to be a globally unique token, never a live address. Per
session, not per tour, so re-downloading after a time change updates the same
calendar entry instead of creating a duplicate.

**`STATUS` carries the tour's status, and a cancelled tour is still served.**
`cancelled` → `CANCELLED`, `draft` → `TENTATIVE`, `published`/`completed` →
`CONFIRMED`. This exists because `transitionTourStatus` does not touch
`Booking` rows: after a cancellation the buddy still holds a `confirmed`
booking, so the download stays available and the first version of this feature
would have handed them a dead event that still read as live.
**Rejected — refusing to serve a cancelled tour (404), or hiding the button:**
that leaves the buddy who *already* downloaded the file with the stale event
and no way to clear it. Serving it with `STATUS:CANCELLED` under the same UID
is what turns a re-download into a retraction, which is the whole point of the
stable UID. **Known gap:** no `SEQUENCE` is emitted — there is no revision
counter on `TourSession` to derive one from — so a strict client may not apply
the retraction without the user re-importing.

**`DTEND` falls back to `DTSTART` + 1 hour unless `endTime` resolves to after
`DTSTART`.** RFC 5545 requires `DTEND > DTSTART`. `startTime` and `endTime` are
independent optional fields: `CreateTourSessionSchema` and
`UpdateTourSessionSchema` only `.refine` on `minBuddies <= capacity`, and
`adminSession.service.ts` adds no ordering check, so the API accepts an
`endTime` with no `startTime` (measured here against `meetingTime`) or an
`endTime` before `startTime`. Unreachable through the admin UI, which renders
neither field (PRD §7.1), but reachable through the endpoints.
**Rejected — validating the ordering in the schema instead:** correct, and a
better fix, but it changes what `POST /admin/tours` accepts, which is a
separate decision from how a calendar file is generated. The generator must not
emit an invalid event either way.

**Default event duration is 1 hour when `endTime` is unset.** `startTime`/
`endTime` are schema-only fields the create/edit form does not render (PRD
§7.1), so in practice almost every session has only `meetingTime`. `DTSTART`
prefers `startTime` over `meetingTime` when both are set; `DTEND` prefers
`endTime`, defaulting to `DTSTART` + 1 hour otherwise. An arbitrary but
easily-changed choice — `DEFAULT_DURATION_MS` in `apps/api/src/lib/tourIcs.ts`.

**Fields:** `SUMMARY` is the group name, plus the session's `label` in
parentheses when set (no i18n fallback to "1st Half"/"2nd Half" — that
translation is a web-layer concern via `session.defaultLabel.*`, and the API
is locale-agnostic). `LOCATION` is `Tour.location`. `DESCRIPTION` is
`Tour.description`, never `adminMemo` — the same buddy/admin field boundary
every other tour response already enforces.

**Auth is the existing bearer-token middleware, no separate download
mechanism.** The endpoint sits behind the same `authMiddleware` (buddy) /
`adminAuthMiddleware` (admin) chain as every other route — no signed link, no
public token. The consequence is that a plain `<a href>` can't carry the
token, so the web side fetches the file as a blob with the bearer header and
triggers the save itself (`apps/web/src/lib/api.ts`'s `apiDownload` +
`triggerBlobDownload`) rather than linking directly to the API URL.

**Current state:** `apps/api/src/lib/ics.ts`, `apps/api/src/lib/tourIcs.ts`,
`apps/api/src/services/tour.service.ts` (`getTourIcs`),
`apps/api/src/services/adminTour.service.ts` (`getAdminTourIcs`),
`docs/api.md` `GET /tours/:id/calendar.ics` and
`GET /admin/tours/:id/calendar.ics`, `docs/PRD.md` §15/§16.

---

## 2026-09-18 — The nightly dump runs as `pb_app` from a `postgres:16` image, and retention is a lifecycle rule

**Decision:** `caj-backup`, a scheduled Container Apps Job in `snet-apps`, runs
`pg_dump | gzip` at 18:00 UTC (03:00 JST) and PUTs one block blob,
`peacebuddy-YYYY-MM-DD.sql.gz`, into the prod storage account's `backups`
container. It connects to Postgres as **`pb_app`** and authenticates to Blob as
**`id-peace-buddy-blob`**, the identity the api already uses for photos. Its
image is `postgres:16` plus `curl` and `jq`, built from
`scripts/backup/Dockerfile`. Retention is the storage account's **lifecycle
rule**, deleting blobs under `backups/` 30 days after creation.
`scripts/azure-backup.sh` installs all of it; `scripts/azure-backup-verify.sh`
loads a dump into a scratch database and asserts it is usable — a test, not a
recovery tool, and the job it runs refuses any target not named
`*_restore_test`. Implements
the 2026-09-12 decision below; closes #159. Current state:
`architecture.md` "Backups".

**Why `pb_app` and not `pb_migrate`:** `pg_dump` needs `SELECT` on every table
and sequence, which `azure-db-roles.sql` already grants `pb_app`, and nothing
more. `pb_migrate`'s password was deliberately kept out of any running
container (2026-09-12); a job scheduled forever is the most running container
there is. The cost is that the backup job's secret goes stale when
`azure-db-roles.sh` rotates the password — re-running `azure-backup.sh` is what
puts the new one in, and the script says so on exit.

**Why `postgres:16` and not `:18`:** a dump taken by `pg_dump` 18 emits `SET
transaction_timeout`, which a 16 server rejects on restore —
`azure-db-restore.sh` has to filter that line and `CREATE SCHEMA public` out of
the stream as it loads. Matching the server's major version means the stored
dump loads into it unedited, which is the only property a backup is for. The
restore job drops `public` in the scratch database before loading, for the same
reason: the fix belongs on the empty target, not in the file.

**Rejected — install `curl` in the job at runtime:** it would make every night's
backup depend on a Debian mirror being reachable, to save building an image
once. The layer adds ~3 MB to `postgres:16`'s ~160 MB, measured locally on
arm64, in a registry that includes 10 GB.

**Rejected — a second managed identity for backups:** it would add a name to
remember and no isolation. Storage Blob Data Contributor is granted at account
scope either way — that is where a user delegation key is issued — so a backup
identity would hold exactly the rights the photo identity already holds on the
same account.

**Rejected — retention in the job:** 30 days is one rule on the account,
evaluated daily by Azure, with deletes that cost nothing. In the job it would
be a list-and-delete loop that only runs when the backup runs, and that deletes
nothing on the nights it fails.

**Rejected — one script that both checks a dump and recovers from one:** the
check writes a scratch database and can be run against prod any day; a recovery
overwrites the live one and should have a person and a `psql` prompt in front
of it. **Recovery itself is not wired up**: the jump VM reaches Postgres but
cannot read Blob, a laptop is the other way round, and which of the three ways
round that closes it has not been decided or tried. Written up as a gap in
`architecture.md` "Recovering the database".

**Rejected — extending `azure-db-restore.sh` to read a blob:** that script
moves one live database into another and asserts the two ends agree row for
row. A restore test has neither a live source nor a reason to expect equal
counts — the dump is up to a day old. Sharing the file would have meant two
modes in one script and an assertion that is right for one of them.

**Accepted consequences:**
- The job holds `pb_app`'s password as a secret for as long as it exists, which
  is the price of running unattended at 03:00.
- Row counts are reported, not asserted, by the restore test. What is asserted
  is the table set and the migration history.
- A dump taken while a migration is mid-flight is a dump of that state.
  `migrate deploy` runs in seconds during a deploy, and deploys are not at 03:00.

---

## 2026-09-18 — Buddy home cards show one section per session, with the minimum buddy number

**Decision:** each card under "Tours looking for buddies" is a tour-level header
(group, date, location) plus one section per session, and the buddy number in a
section is `minBuddies ?? capacity` for that session. PRD §11.1 held the
opposite and the code followed it. See §11.1 for the resulting layout.

**Rejected — one buddy number per card, summed across sessions:** buddy numbers
are per session, so a tour with a 1st and 2nd half of 5 each read 10, a number
no session ever needs. Nothing on the card is a tour-level quantity except the
location.

**Rejected — showing `capacity`:** it is the *maximum* (admin label
「最大バディ数」). A volunteer deciding whether to sign up needs the minimum the
session asks for; the maximum answers a question they are not asking.

**Rejected — two labels, one for the minimum and one for the capacity
fallback:** the fallback only fires when the admin left `minBuddies` empty, and
a label that changes meaning between two cards costs the reader more than the
precision is worth. One label (`tour.buddyCount` / 「バディ数」) covers both,
worded so it claims neither.

---

## 2026-09-18 — The tour calendar is a view of `/admin/tours`, not its own page

**Decision:** `/admin/tours` toggles between the list and a month calendar via
`?view=calendar`, with `?month=YYYY-MM` for the month. The calendar ignores the
list's filters and hides the filter bar; the filter params stay in the URL so
switching back to the list restores what was being looked at. A day cell shows
one chip per tour — status dot, group name, `confirmed/capacity`, and a
below-minimum marker — three chips before the rest collapse into a count. All
four statuses appear, distinguished by dot colour, with cancelled struck
through. The grid's leading and trailing padding days are structural only and
carry no chips, so the grid, the mobile agenda and the "no tours this month"
notice all read the same `inMonth` rule. Closes #212.

**Why:** list and calendar are two shapes of the same question about the same
collection, and every product that offers both (Asana, Notion, Linear, Jira)
attaches the switch to the resource rather than to a separate route. The data is
already on the page: `listAdminTours` is unpaginated, so the month grid is a
client-side view over an array the list already holds. No API change.

**Rejected — a separate `/admin/calendar` route:** it was argued for on the
grounds that nobody wants meticulous filtering on a calendar, which is true and
is why the filter bar is hidden. But that is an argument about controls, not
about location. A second route would fetch the same unpaginated list again and
give an admin who filtered in the list a calendar showing everything, with no
visible control explaining the change. Duplicate-fetch cost specifically is
*not* the reason — 2–3 admins and a few tours a month make it negligible.

**Rejected — putting the calendar on the admin home screen:** `/admin` is a
worklist of five sections, every item something to clear (pending approvals,
overdue maybes, underfilled tours, missing evaluations, notifications). A
calendar never clears and answers "what is happening", not "what needs me".
Stacking it there pushes the action queue below the fold and makes one screen do
two jobs.

**Rejected — hiding `draft` and `cancelled` tours:** proposed as noise
reduction. An admin scanning a month needs to see a draft that was never
published and a cancellation that freed a date; silently omitting them makes the
month lie. Colour carries the distinction instead.

**Current state:** `docs/PRD.md` §11.2,
`apps/web/src/app/[locale]/admin/tours/page.tsx`,
`apps/web/src/app/[locale]/admin/tours/_components/tour-calendar.tsx`,
`apps/web/src/app/[locale]/admin/tours/admin.tour.ts`.

**Revisit when** the buddy side gets the same view over `GET /tours` (#212 notes
it as a follow-up), or when a week/day view is wanted — the month grid is
currently the only zoom level.

---

## 2026-09-18 — Buddy notification preferences share the admin table; four events cannot be muted

**Decision:** `NotificationPreference.adminId` is renamed to `userId` and the
`NotifEventType` enum is widened with the four buddy events a buddy may turn
off: `tour_published`, `tour_details_changed`, `tour_reminder`,
`maybe_reminder`. Buddies read and write them at
`GET / PUT /me/notification-preferences`, surfaced as a section of
`/buddy/profile`. Every buddy email enqueue path now consults the table.
Closes #213.

**Why:** `enqueueEmail` consulted no preference of any kind on the buddy side.
`tour_published` mails every Active buddy on every publish, with no opt-out — at
~50 volunteers, the setting most likely to get the app's own mail marked as
spam.

**Rejected — a second table for buddies,** which #213 offered as the
alternative. Two tables modelling one concept drift, and the
defaults-derived-from-delivery discipline in `notificationDefaults.ts` (the
table that decides what sends is the table the screen renders) is worth sharing.
The cost is `emailMode` and `slackEnabled` sitting unused on buddy rows; they
are written `immediate` / `false` and never read for a buddy.

**The unmutable set is enforced by the absence of an enum value, not by the
UI.** `tour_cancelled`, `waitlist_promoted`, `account_approved` and
`account_rejected` have no `NotifEventType` value, so no row can be stored and
`PUT` rejects a request naming one. The enqueue path additionally ignores any
row for them, so a value added to the enum later does not silently make them
mutable.

**Rejected — `tour_details_changed` as unmutable.** It was argued for on the
same ground as `tour_cancelled`: a buddy who mutes it turns up at the old time
or place. Tour details change often enough that the mail is a volume problem of
its own, and the tour page still shows the current date and location. Muted, it
still arrives in-app.

**`waitlist_promoted` is unmutable,** against the same volume argument: it fires
once, for one buddy, and muting it means not knowing you hold a seat — a
no-show.

**Rejected — making in-app delivery configurable.** The preference is about what
lands in an inbox. A muted event stays in `GET /me/notifications`, so nothing is
lost, only unsent.

**Defaults are all-on.** A buddy with no rows receives exactly what they
received before preferences existed. Admin defaults stay all-off (2026-08-15) —
the two audiences default in opposite directions because Slack covers admins and
nothing covers buddies.

**Not in scope: Slack to buddies.** Still deferred — it needs per-user Slack IDs
and a bot token rather than the incoming webhook (2026-08-15,
`docs/roadmap.md`).

**Accepted consequences:**
- `waitlist_opened` and `self_eval_prompt` get no toggle at all: neither has an
  email template, so there is nothing to mute. Shipping an email for either
  means deciding then whether it is mutable.
- The migration renames the column rather than dropping and adding it, which is
  what `prisma migrate diff` emits. Existing admin preferences survive.

**Current state:** `docs/PRD.md` §10.1 and §10.6, `docs/api.md`,
`docs/data-model.md`.

---

## 2026-09-17 — The databases are queried from a jump VM reached through Bastion Developer

**Decision:** An operator reaches either Postgres server from `vm-peace-buddy-jump`,
a VM in `snet-jump` (`10.0.7.0/24`) inside `vnet-peace-buddy`. It has no public
IP. The operator opens a shell on it through `bas-peace-buddy`, a Bastion
Developer host, in the Azure portal. cloud-init installs `postgresql-client-16`.
The VM stays deallocated unless someone is using it, and it deallocates itself
at 21:00 JST every day. One VM serves prod and staging, because they share the
VNet. `scripts/azure-provision.sh` step 8 creates it. That step also runs a
check on the VM that the server hostname resolves and port 5432 answers.
Closes #226.

**Why:** both servers are private to the VNet, which stays (2026-09-10). Nothing
gave a person a way in. The portal has no query editor for a private server,
the hostname doesn't resolve from a laptop, and the api image has no `psql`. The
only route was a throwaway Container Apps job or `node -e` through Prisma, which
is too much for "update one record in staging".

**Bastion Developer is offered in Japan East.** Checked on 2026-09-17 against
Microsoft's SKU comparison page, which lists its regions. It is free and needs
neither an `AzureBastionSubnet` nor a public IP. Accepted limits: it only works
in the portal, it allows one session at a time, and the portal client only takes
an RSA private key in PEM form. Microsoft says Developer "isn't suitable for
production workloads". That warning is about Bastion carrying traffic for an
application. Here it carries one operator's occasional session.

**No network security group.** The VM has no public IP, so nothing outside the
VNet can open a connection to it. The default rules already allow the traffic
it needs inside the VNet: SSH in from Bastion and 5432 out to `snet-db`. An NSG
would add rules and change nothing.

**Default outbound access is turned on for the subnet on purpose.** cloud-init
needs Ubuntu's package mirror, and Azure is moving new subnets to no outbound
access by default.

**Rejected — SSH on a public IP, with port 22 limited to the operator's IP:**
this was the issue's fallback. It costs $0.005/hr for the IP, and it opens a
port on the internet. The allow rule would also break whenever the operator's
home or office IP changes.

**Rejected — Bastion Basic:** $0.19/hr, about $1,660/yr, most of the grant.

**Rejected — point-to-site VPN:** VpnGw1 is $0.19/hr. The ~$27/mo in #226 is
the legacy Basic gateway, which the Retail Prices API no longer lists for Japan
East.

**Rejected — public access or IP firewall rules on the database:** already
rejected on 2026-09-10.

**Rejected — B1s,** which #226 named. The subscription gets
`NotAvailableForSubscription` for B1s, B1ls, B1ms and B2ats_v2 in Japan East.
B2pts_v2 is allowed and costs $0.0108/hr against B1s's $0.0136. It is Arm64, so
the image is Ubuntu 24.04's arm64 build.

**Rejected — Microsoft Entra ID sign-in to the VM:** it would remove the SSH
key, but portal sign-in with Entra needs Bastion Basic.

**Rejected — `az vm run-command` as the way to query:** it has no interactive
session, and each call waits on the VM agent. The provisioning check uses it,
because a check doesn't need a session.

**Not compared on 2026-09-10 — VNet integration against a private endpoint.**
That entry said private networking was permanent without comparing the two. A
server behind a private endpoint can be switched to public access later. A
VNet-integrated server can't. A private endpoint is billed, and #226 found that
neither option gives terminal access on its own. Nothing is rebuilt for this.
It is recorded so the comparison isn't taken as having been made.

**Accepted consequences:**
- The VM's disk bills while it is deallocated: an S4 Standard HDD at $1.536/mo,
  so ~$18/yr.
- Starting the VM doesn't start staging's server. Outside 08:45–20:45 JST,
  start that too.
- The operator pastes the password into the browser session. `psql` prompts for
  it and doesn't store it. `~/.psql_history` on the VM keeps the queries.

**Current state:** `docs/architecture.md` "Querying the database",
`docs/azure-costs.md`, `scripts/azure-provision.sh` step 8.

---

## 2026-09-17 — Buddy history shows attended tours only, grouped before filtered

**Decision:** `/buddy/history` opens with a summary line and year-grouped past
tours. It has two filters: past tours with no self-evaluation submitted, and a group
name search. Past tours the buddy did not attend are not shown on the page at all. Closes #214.

**Cancellations are hidden, not de-emphasised.** A tour counts as attended when
it was not cancelled and the buddy held a confirmed seat on at least one session.
There is no attendance record. Declined bookings were already excluded by the API.
Rejected: a "show not attended" toggle, and listing them dimmed. Either keeps the
buddy's own page a record of what they missed, and a one-click view of that is a
self-surveillance surface. Admins already track cancellations and `unavoidable`
separately (PRD §8.7), and the tour detail page is still reachable by URL.

**Grouping and counting come before filtering.** A buddy doing a few tours a
year has a history that fits on one screen, so a filter bar mostly gets in the
way. The summary line answers "how much have I done" and year headers replace a
date filter. Rejected: filters for location (most tours are in the same place)
and tour status (an admin lifecycle concept a buddy doesn't think in terms of).

**Rejected — a group-type filter,** which #214 proposed as the one meaningful
narrowing axis. About 95% of tours are for schools, so it narrows almost nothing.
Group name search answers "have I had this group before?" instead.

**The self-evaluation filter hides itself when there are no unevaluated past
tours.**

**Current state:** `docs/PRD.md` §8.8, `docs/api.md` `GET /me/bookings`.

---

## 2026-09-17 — Staging runs 08:45–20:45 JST on an Azure Automation schedule until 2026-10-31

**Decision:** During dogfooding, `psql-peace-buddy-stg` is started at 08:45 and
stopped at 20:45 JST every day. `aa-peace-buddy-stg` does this: an Azure
Automation account whose runbook `rb-staging-power` calls ARM as the account's
system-assigned identity. That identity holds a custom role, *Peace Buddy
Postgres Start Stop* (read, start, stop), assigned on the server alone. Both
schedules expire on 2026-10-31, so the window ends by itself. A failed job sends
an email through a metric alert. For the same period the staging server budget
rises from ¥1,600 to ¥2,600. For these dates this supersedes 2026-09-12,
"Staging compute is started by hand, not scheduled". #208.

**Why:** The 2026-09-12 entry rejected a daily window because use was bursty.
Use is no longer bursty: staging is in daily dogfooding and was being left on
around the clock. Nobody tests overnight. Twelve hours up costs ~$114/yr of
compute, or $167/yr including storage, against $281/yr always on. A daily start
also means the seven-day auto-restart can't happen during the window.

**Why the budget is raised rather than removed:** At 12 hours a day a correct
month is ~¥2,200, and a month with the stop job silently broken is ~¥3,700.
¥2,600 sits between the two, so it still catches a server stuck on, days late.
Left at ¥1,600 it would fire every month by design, and people would learn to
ignore it.

**Rejected — keep starting it by hand:** that model assumed bursty use, which no
longer holds. In practice staging was left running.

**Rejected — a GitHub Actions scheduled workflow:** recommended at first,
because a temporary schedule should be cheap to remove and a workflow file is a
single deletion. Its costs: it needs an Entra app registration and a federated
credential that give GitHub rights inside the tenant. GitHub cron is UTC-only
and runs late under load, and a 09:00 JST start falls on 00:00 UTC, its busiest
slot. Overturned once the extra setup counted as worth doing rather than as a
cost. Automation needs no credential, runs on time, and takes `Asia/Tokyo`
directly.

**Rejected — `Contributor` on the server:** it would also let the scheduler
delete the server. The custom role's `AssignableScopes` is `rg-peace-buddy`
because a custom role can't name a single resource; the assignment narrows the
grant to the server.

**Rejected — PowerShell 7.2:** the CLI extension creates `PowerShell` runbooks,
which run on 5.1, and choosing 7.2 needs the separate runtime-environment API.
The runbook only uses `Connect-AzAccount` and `Invoke-AzRestMethod`, both in
5.1's preinstalled `Az.Accounts`, and it will exist for six weeks.

**Rejected — a Consumption Logic App:** it has fewer parts, but its definition is
workflow JSON. A runbook keeps the logic in a script file in `scripts/`, like
every other Azure change in this repo.

**Accepted consequences:**
- Running `azure-db-roles.sh` outside the window starts staging, and it stays up
  until 20:45.
- The :45 minutes are kept because they're easy to remember. They were first
  moved off the hour to avoid GitHub cron congestion, which Automation doesn't
  have.
- After the 20:45 stop on 2026-10-31, staging is left stopped and the seven-day
  auto-restart applies again, unless the schedules are extended or the manual
  model returns along with its ¥1,600 budget.

**Not decided here:** three notification cron routes have had no caller since
2026-09-13 (PRD §10.5). This account could call them, but that's a separate
decision.

**Current state:** `docs/staging-schedule.md`.

---

## 2026-09-17 — A first booking can be a Maybe, created by `POST /tours/:id/bookings`

**Decision:** On a session the buddy has not booked, the tour detail page shows
Join (「参加を希望」, was "Book" / 「予約する」) and Maybe (「未定」). Maybe calls
`POST /tours/:id/bookings` with `status: "maybe"`, which creates the booking as
`maybe` without consulting the tier pools. It is refused after the Maybe or
cancellation deadline, the same rules as `→ maybe` on the update endpoint.
Closes #219.

**Rejected — booking, then changing to Maybe:** the first call takes a
confirmed seat, which can put the next buddy on the waitlist for a moment, and
the admins get a booking notification for a status the buddy never meant.

**Rejected — `PUT …/bookings/me` creating the row when none exists:** that
endpoint is "update my booking" and answers `404` when there is none. Making it
an upsert for one status blurs which endpoint owns eligibility and
`bookingOpen` checks, which only `createBooking` does.

**Maybe is offered on an unbooked session only.** Rejected for #219: also on a
declined or waitlisted session, which the transition matrix already allows but
the issue did not ask for.

**Current state:** `docs/api.md` `POST /tours/:id/bookings`, `docs/PRD.md` §8.5.

---

## 2026-09-17 — Buddy home has a tour-day state, built from `GET /tours/:id`

**Decision:** When the buddy's next confirmed tour is today in Japan, `/buddy`
replaces the next-tour card with a tour-day panel: meeting time and place,
participant count, how many other buddies are confirmed, the staff in charge by
name, and `Tour.description` as the brief. The page gets it from
`GET /tours/:id`, which gained `staffInCharge: { name } | null`. Closes #211.

**Why no `GET /me/dashboard` after all:** #211 asked whether a chunkier set of
fields, wanted on one screen on one day, reopens #206's rejection. It does not:
the tour detail response already carried the description, group type,
participant counts and per-session confirmed counts. The only missing value was
one name, and a buddy-facing tour response is where it belongs.

**Other buddies are a count, not names.** Rejected: names, which is a privacy
call nobody needs made for the buddy to turn up. Rejected: names and tiers,
which would also reverse "A buddy may see their own tier" (2026-09-10) and its
"never another buddy's tier" rule.

**The staff in charge is shown by name only.** Rejected: their email, which
exposes an admin's contact details to every confirmed buddy. Rejected: a phone
number, which needs a new `AdminProfile` field, a migration and an admin form
for it.

**`Tour.description` is the brief.** It was already buddy-visible on the tour
detail page; `adminMemo` is the admin-only note. Rejected: a separate brief
field on `Tour`, which would duplicate `description`. Rejected: making
`Group.notes` buddy-visible, since it holds admin visit history.

**The rest of the page stays, below the panel.** Action items and open tours
still matter on a tour day, and hiding them would make the page change shape
for no gain.

**Current state:** `docs/PRD.md` §11.1, `docs/api.md` `GET /tours/:id`.

---

## 2026-09-15 — "Today" is the date in Japan everywhere; a tour closes for booking on its own day

**Decision:** Every rule that compares a tour or deadline date with today uses
`getTodayJst()`, the date in Japan as `YYYY-MM-DD`, and compares calendar-date
strings. This covers the tour detail page, the booking card, `/buddy/history`,
`isBookingAllowed`, the admin tours list, the API's booking checks and the
notification jobs (`jstStartOfDayUtc`). Tour and deadline dates are Japanese
calendar dates (`@db.Date`). Until now the app judged them by four clocks: UTC,
the browser, the server and JST. Between 00:00 and 09:00 JST those clocks
disagreed every day. Closes #209.

**A tour cannot be booked on its own day.** Bookable means `tourDate > today`,
both on the web (`isBookingAllowed`) and in the API (`createBooking`,
`NOT_BOOKABLE`). Before this change the API accepted bookings all day, and the
web closed booking at 09:00 JST. Rejected: booking open all day on the tour day,
which would leave the Book button showing after the tour has started.

**A deadline counts as passed from 00:00 JST on its own date**, the rule
`isPastDeadline` and the API already applied. Only the clock they read changed.

**The helper lives in `packages/types`.** It is the only export there that is
not a schema or a type. Rejected: a new `packages/date` package, which needs its
own package manifest, a build step in both Dockerfiles and CI wiring, all for
about ten lines. The package has no test runner, so its tests are in
`apps/web/src/lib/today-jst.test.ts`.

**A fixed +9h offset, not `Asia/Tokyo` through `Intl` or a timezone library.**
Japan has no daylight saving time, so all three give the same answer. The offset
needs no dependency and cannot come out differently across runtimes.

**Not changed:** the self-evaluation edit lock (`SELF_EVAL_EDIT_WINDOW_DAYS`). It
is a duration measured from `createdAt`, not a calendar-date rule.

**Current state:** `docs/PRD.md` §7.2, §8.4 and §11.1; `docs/api.md` booking
endpoints.

---

## 2026-09-15 — Admin home is a worklist; each queue's query lives with its owner

**Decision:** `/admin` renders five queues (PRD §11.7) instead of redirecting to
`/admin/buddies`. `GET /admin/dashboard` aggregates four of them by calling one
function in each owning service — `listBuddies`, `listOverdueMaybeTours`
(`maybeDeadline.service`), `listUnderfilledTours` (`adminTour.service`) and
`listToursMissingEvaluations` (`adminEvaluation.service`). The fifth, unread
notifications, the page reads from `GET /me/notifications`. Closes #198.

**Why the queries sit in the owning services:** #198's design note — a query
copied into a dashboard service drifts from the page it links to.
`listOverdueMaybeTours` shares `unresolvedMaybeWhere` with the
`maybe-deadlines` cron for the same reason.

**Rejected — notifications inside `GET /admin/dashboard`:** #198 names one
endpoint for everything. The bell already polls `/me/notifications`, and the
feed needs mark-as-read, which `useNotifications` already provides by
refetching `/me/notifications`. A copy in the dashboard response would stay
stale after an item is marked read unless the whole worklist were refetched.
The page's `useNotifications` is its own instance, not the bell's, so marking
read here leaves the bell badge stale until its next 60s poll — the same as
`/notifications` already does.

**Overdue Maybes are past deadline on a tour not yet held.** **Rejected — the
cron's window exactly** (deadline fell yesterday): an unresolved Maybe would
leave the worklist after one day while still unresolved. **Rejected — any tour
date:** a Maybe on a tour already held is not actionable. The cron's
assigned-admin filter is dropped: every admin reads the worklist, so a tour
nobody is assigned to is more reason to show it, not less.

**Short of buddies means confirmed bookings below `minBuddies`, next 14 days.**
**Rejected — reusing `belowMinimum`:** that flag compares `participantCount`,
the visiting group's size, to `minBuddies`, so it never counts buddies. The
badge on `/admin/tours` is unchanged; whether it compares the right numbers is
not settled here (see "Below-minimum stays a display-only signal").
**Rejected — confirmed below capacity**, #198's own wording: a tour short of
full is normal, so nearly every upcoming tour would be listed.

**Missing evaluations means no `AdminEvaluation` from any admin.** **Rejected —
per viewing admin:** per-admin ownership (PRD §9.2) decides who may edit, while
the queue asks whether the tour has been reviewed. **Rejected — counting
missing self-evaluations:** they are optional for the buddy, and no admin
action resolves them.

**Known residual:** the missing-evaluations queue has no date bound. A
completed tour nobody ever evaluated stays listed until someone does.

**Current state:** PRD §11.7, `docs/api.md` `GET /admin/dashboard`,
`apps/api/src/services/adminDashboard.service.ts`,
`apps/web/src/app/[locale]/admin/page.tsx`.

---

## 2026-09-15 — Buddy home is an obligations screen built from `GET /me/bookings`

**Decision:** `/buddy` now leads with the buddy's next confirmed tour. Under it
is "Needs your action": Maybe bookings with their deadline, missing
self-evaluations and waitlist entries. The tours open for booking come last.
`MyTourBookingEntry` gained `maybeDeadline` and `selfEvaluationSubmitted`, and
the page builds every section client-side. Closes #206.

**Rejected — a `GET /me/dashboard` endpoint,** the other option #206 offered.
The page lacked two fields, not a response shape. A dashboard endpoint would be
a second response built from the same booking rows, one more thing to test and
document, and `/buddy/history` would not get the fields.

**Self-evaluations are asked for until 30 days after the tour.** Submission has
no deadline, so without a window every completed tour the buddy never evaluated
would stay listed for good. Thirty is a chosen number, not policy: if the team
settles on a policy, change `SELF_EVAL_PROMPT_DAYS`. Also rejected: no cutoff,
and prompting for the most recent tour only.

**Every Maybe is listed, however far off its deadline.** Rejected: listing a
Maybe only once `maybe_reminder`'s 3-day offset arrives. Any Maybe is still
unresolved, and hiding it until then hides something the buddy could settle now.

**Tours looking for buddies are filtered through `isBookingAllowed`. This reverses
#197's "Rejected — hiding tours with `bookingOpen` off"** (entry below). That
rejection's reason was that a buddy booked on a closed tour would lose it from
the home page. The new information is that the home page is no longer just that
list, and booked tours are a separate concern from bookable ones. The next
confirmed tour and every Maybe and Waitlist booking have sections of their own.
Confirmed tours after the next one are reached through "My bookings"
(`/buddy/history`).

**Three are shown, and "Show all" expands the list in place.**
Rejected: pointing "see all" at `/buddy/history`, which lists tours the buddy has
booked, not tours they can book, so every tour after the third would be on no
page. Rejected: a separate `/buddy/tours` page, which adds a route and a page
for a list that is short enough to expand in place at ~50 buddies.

**"Next tour" means a confirmed booking.** A Maybe or Waitlist booking is not a
commitment yet, and those tours are listed under Needs your action.

**"Today" on `/buddy` is the date in Japan, not the UTC date.** Tours run in
Japan and every tour and deadline date is a Japanese calendar date. With a UTC
"today", from 00:00 to 09:00 JST yesterday's tour showed as the next one and a
Maybe still read as open on its deadline day. Rejected: the browser's own date
(`getTodayLocal`), which ties the page to the viewer's device settings rather
than to where tours happen. Rejected for this PR: moving the tour detail page,
history, `isBookingAllowed` and the API at the same time. They use UTC, the
server clock or a 09:00 JST cut-off, and changing booking rules is a change of
its own (#209). Until #209 lands, this page can disagree with the tour detail
page between 00:00 and 09:00 JST. "Tours looking for buddies" keeps
`isBookingAllowed`, because listing a tour the detail page would refuse to book
is worse than dropping it at 09:00 JST.

**Excluded, as #206 specified:** attendance counts, hours and tier progress.

**Current state:** `docs/PRD.md` §11.1, `docs/api.md` `GET /me/bookings`.

---

## 2026-09-14 — Buddy home cards show the caller's booking status, per session

**Decision:** `GET /tours` carries `myBookingStatus` on each session
(`TourListSessionResponse`), and `/buddy` shows it as a badge beside that
session's meeting time. This reverses PRD §11.1's earlier "per-buddy booking
statuses are not shown on this page": the first thing a volunteer asks on
opening the app is whether they are in, and answering it took a trip to
`/buddy/history`. Every listed session is resolved in one `booking.findMany`,
not one query per tour.

**Rejected — one status per tour on `TourResponse`:** bookings are per session
(`@@unique([buddyId, sessionId])`), so a buddy can be confirmed at 09:00 and
waitlisted at 13:00. A single field has to pick one by precedence and hides the
other. Per session also matches `TourSessionDetailResponse` and `/buddy/history`.

**Rejected — adding the field to `TourSessionResponse`:** that type is also the
session shape of the admin tour and group responses, where "my booking" means
nothing.

**`declined` is returned but not shown on the card:** it means the buddy
cancelled and can book the session again, so on the card it reads as not
booked. The API keeps the raw value so another view can choose differently.

**The tour status badge is removed from these cards.** The page never passes
`status`, so `listTours` returns only `published` tours and every card read
"Published". It carried no information, and it used the same `default` fill as
the Confirmed badge beside it, so the two read as one signal. The page title
says what the list is instead: "Tours looking for buddies" /
「バディ募集中のツアー」. "Published" / 「公開中」 was tried first and dropped:
it did not make sense to the reader.

`bookingOpen` is a separate flag, so a listed tour can be closed for booking
while the title says buddies are wanted. Accepted: the title names the page's
purpose, and the tour detail page is where booking is gated.

**Rejected — hiding tours with `bookingOpen` off so the title is always true:**
a buddy already booked on a tour whose booking has closed would lose it from
the home page, which is the "am I in?" answer this change exists to give.
*Superseded 2026-09-15 — see "Buddy home is an obligations screen".*

**Rejected — a separate colour set for booking statuses:** it would fix the
clash but keep a badge that says nothing. Revisit if the home page ever lists
tours in more than one status.

**Current state:** `docs/PRD.md` §11.1, `docs/api.md` `GET /tours`. Closes #197.

---

## 2026-09-13 — A second auth provider is linked from the profile page, not at sign-in

**Decision:** A buddy who wants both Google and Apple on one account links the
second provider from their own profile page, while signed in, via Firebase
`linkWithPopup`. Firebase keeps the same `uid`, so `User.firebaseUid` still
resolves to the one row and no second `User` or `BuddyProfile` is created.
Either direction links — whichever provider the buddy signed up with is the one
the other gets added to.
`apps/web/src/app/[locale]/buddy/profile/_components/linked-accounts.tsx`.

**Why not link at sign-in** (catch `auth/account-exists-with-different-credential`
and link the credential): it is unreachable for the case that actually motivates
this. Apple's Hide My Email returns a `…@privaterelay.appleid.com` address that
never equals the Google one, so before authentication there is no shared key to
match the two identities on. Linking from a live session needs no key — identity
is already proven.

**Why not match on email:** `email` is mutable and not unique per person;
OIDC treats the provider subject as the only stable identifier. Silently merging
two accounts because their addresses match is also the pre-account-takeover
attack — an attacker registers the victim's address at a provider with weak
verification and the victim's real sign-in merges into it. `User.email` stays
non-unique metadata, refreshed from the token but never used as identity.

**Rejected — admin-side account merge:** covers every case including a duplicate
that already exists, but bookings, evaluations, tier, notifications and
preferences all have to move, and it adds an admin operation to own. Products
that support multiple providers generally treat merge as a support chore rather
than a product surface. Revisit if duplicates actually appear; until then the
buddy is told to contact an admin (`profile.linkedAccounts.error.alreadyInUse`).

**Rejected — prompting the buddy at signup** ("do you already have an account?"):
correctness depends on the buddy answering right, and it puts the question at the
moment they have least context.

**Rejected — a local `Identity` table** (`User 1—N Identity(provider, subject)`),
which is how teams that own their identity layer model this: redundant here.
Firebase already holds the provider list on one `uid`, so duplicating it in
Postgres buys nothing and adds a migration plus two lookup sites to keep in step.

**Also fixed here:** `upsertUser` passed `update: {}`, so `User.email` kept
whatever it held at account creation. It now refreshes on every sign-in — that
address is what notification delivery and the admin UI resolve to. The refresh
is guarded on a non-empty value: `verifyFirebaseToken` falls back to `''` when
the ID token carries no email claim, and `update: {}` used to make it impossible
for that to reach the row.

**Current state:** `docs/architecture.md` "Second provider on one account",
`docs/api.md` `POST /auth/register`. Closes #194.

---

## 2026-09-13 — Notification payloads snapshot the names they display

**Decision:** `buddyName`, `groupName` and `tourDate` are copied into
`NotificationJob.payload` at enqueue time and rendered from there. The renderers
never look the tour or the buddy up again. A buddy who renames themselves after
a message is queued — or after it is sent — does not retro-change what the
message says.

**Why:** a notification is a record of what was true when the event happened.
"Aya cancelled" should keep saying Aya even if that profile is later renamed;
re-resolving would rewrite history in the ops channel and in an already-sent
email, which cannot be rewritten anyway. Snapshotting also keeps rendering free
of DB access, so the dispatcher can render a queued job without a second round
trip and a deleted tour does not break an unsent message.

**Rejected — resolve at render time from the IDs already in the payload:** the
payload carries `tourId` and `buddyId`, so the dispatcher could join. It would
make every render a query, on the hot path of a queue drain, to produce a value
that is *less* correct for this use.

**Consequence — old rows have no snapshot.** The payload columns are persisted
Json and rows written before this change lack the fields. Each template
therefore has two variants: a `detail` one naming the buddy and the tour, and
the pre-existing generic one. Substitution is all-or-nothing — if any
placeholder in `detail` has no non-empty string value, the whole message falls
back to the generic variant rather than emitting a sentence with a hole in it.
The same rule already governed deep links (a half-resolved `/admin/tours/` is a
404). This also means no backfill was needed and none is planned.

**Consequence — interpolated values are untrusted.** `displayName` is set by the
buddy at registration, and group names by admins. Before this change `entry.text`
and `bodyHtml` were template-authored and emitted raw. Now every substituted
value is escaped for its channel at the substitution boundary: `escapeSlack` for
Slack message text, `escapeHtml` for the email HTML body, `escapePlain` for the
subject and text body. A buddy named `<http://evil|click>` renders as literal
text in the ops channel.

Markup is not the only thing an interpolated value can forge. `displayName` has
no charset constraint (`RegisterRequestBodySchema`), so a name full of newlines
would render in the channel as several apparent messages, and would split an
email subject line. `escapeSlack` and `escapePlain` therefore also collapse
control characters and the Unicode line separators — a value may never
introduce line structure of its own. `escapeHtml` needs no equivalent: a stray
newline inside a `<p>` renders as whitespace.

**Not done — per-event validation on read.** `packages/types` gained a schema
per event kind, but it types what the enqueue sites *write*; nothing parses a
payload on the way out. Parsing would reject exactly the old rows the fallback
above is designed to serve.

**Current state:** `packages/types/src/index.ts` (`NotifPayloadSchemas`),
`apps/api/src/lib/templateRender.ts`, `apps/api/src/services/slackTemplates/`,
`apps/api/src/services/notificationTemplates/`, PRD §10.3.

---

## 2026-09-13 — GCP staging is retired now; the `peace-buddy-staging` project stays

**Decision:** The GCP/Neon staging stack is torn down on 2026-09-13, without
waiting for a review cycle on Azure staging. Inside the `peace-buddy-staging`
GCP project, the Cloud Run services are deleted — the only thing running there —
along with the images and source uploads their deploys left behind and their
`run.app` hostname in Firebase Auth's authorized domains. They never had a
custom domain, so there was no DNS record to remove. The Neon project is deleted outright. The GCP project itself and its
Firebase Auth stay.

**Why now:** Azure staging already serves the app on the data #153 moved, and
the non-dev members — three or four people — did not review anything over the
weekend. The review-cycle gate in "Two Azure environments, prod and staging"
guarded work people might still do on GCP; there is none to lose.

**Why the project stays:** a Firebase project is a GCP project, and Cloud Run
ran in this one. Azure staging signs in through it, and `users.firebaseUid` is
unique to it, so a replacement project would give every member a new UID and
orphan their row. This supersedes the 2026-09-12 entry where it lists the
project among what gets decommissioned.

**Rejected — deleting the project:** takes Firebase Auth, and so sign-in on
Azure staging, with it.

**Rejected — keeping Neon for a week as the rollback:** the week covered a data
move going wrong. The move was verified by the restore job and Azure staging
runs on it; nothing will be restored from GCP.

**Rejected — copying photos off R2 again before Cloud Run stops:** the second
copy was for photos uploaded on GCP after the first. Such an upload is
referenced only by a Neon row, which is discarded, so Azure's database would
never point at it. This supersedes "Photos are copied off R2" on that point. R2
can go once Cloud Run is deleted, since Cloud Run holds its keys.

**Not replaced — Cloud Scheduler:** it was what called `/jobs/*`. Nothing on
Azure does, so notification jobs run nowhere; notifications are to be
re-planned rather than re-pointed.

**Current state:** `deploy-plan.md` Progress, `architecture.md` Environments.

---

## 2026-09-13 — Photos are copied off R2 by name from the dev machine; R2 goes last

**Decision:** `scripts/r2-to-blob.sh` copies every object under `buddy-photos/`
in the staging R2 bucket into `stpeacebuddystg`'s `photos` container under the
same name, and fails unless each arrives with the same MD5 and a content type
matching its extension. It runs from the dev machine: rclone in a container
downloads, `az --auth-mode login` uploads. Staging only — prod never had a
working bucket, and its account (#175) starts empty. The database is not
touched: the photo_key migration already turned stored URLs into these names.

**Why re-runnable, and R2 torn down last:** GCP staging, still what non-dev
members use, reads and writes the bucket until it is switched off (#156).
Deleting the bucket or revoking the keys before then breaks photos in the app
people use, and a photo uploaded there after a copy would be lost. So the copy
runs again just before GCP staging stops, and teardown follows that.
*Superseded on the second copy, 2026-09-13 — see "GCP staging is retired now".*

**Rejected — a Container Apps job, like the database restore:** the restore
needed the VNet; Blob has a public endpoint. A job would hold the R2 keys as
secrets and need a Blob role of its own, for ~70 files.

**Rejected — azcopy straight from R2:** its S3 source takes Amazon S3 URLs, not
R2's endpoint.

**Rejected — copying only the objects a row references:** the rows are reachable
only inside the VNet, so reading them takes a job. A profile holds more than one
object only when the api's best-effort delete of a replaced photo failed; the
script names any such profile rather than guessing which object is current.

**Current state:** `scripts/r2-to-blob.sh`, `docs/deploy-plan.md` Progress.

---

## 2026-09-13 — The deploy script prunes the registry; web images are tagged per environment

**Decision:** The last step of `scripts/deploy.sh` deletes images from the
`api`, `migrate` and `web` repositories. It keeps every image an active revision
or a job in `rg-peace-buddy` references, from either environment, and the newest
five tagged images per repository. Everything else goes, untagged manifests
included. Web images are tagged `<commit>-<environment>` and no longer also
`latest`; api and migrate keep the bare commit tag.

**Why:** Basic includes 10 GB. Three staging deploys had used 1.34 GB by
2026-09-13, so the limit is roughly twenty deploys away. Images are added only
by a deploy, so the deploy is where they are removed.

**Why "referenced", not age or count alone:** prod and staging push to the
same repositories and every app scales to zero, so a cold replica pulls its
image again. A purge by age or count deletes prod's live image once staging
has deployed enough times since prod last did, and prod then fails at its next
cold start, long after the purge ran. The prune refuses to delete anything
unless the images it just deployed appear in the referenced list, so a failed
or partial query cannot read as "nothing is running".

**Why the web tag changed:** the web image has `NEXT_PUBLIC_API_URL` baked in,
so the same commit gives a different image per environment. Under a shared
`web:<commit>` tag, deploying a commit to the second environment took the tag
from the first, and the first environment's next cold start would pull a bundle
calling the other api. Prod had never been deployed, so it had not happened.
The referenced-image check also depends on a tag naming exactly one image.
`latest` was dropped because, with two environments pushing to one repository,
it named neither.

**Rejected — the ACR retention policy, which is what #160 names:** it is
Premium-only and deletes untagged manifests only, so it would not remove old
tagged builds at all.

**Rejected — a scheduled ACR Task running `acr purge`:** works on Basic, but it
filters on repository, tag, age and count only, so it cannot see which images
are running. It would also be another scheduled resource to provision, for
growth that only happens during a deploy.

**Known residual:** rebuilding an existing tag (a second `-dirty` deploy of one
commit, or api built again for the other environment) moves the tag to a new
digest. The old digest becomes untagged and is deleted. Replicas already
running are unaffected, and new ones pull the rebuilt image from the same
source. The five are counted per repository across both environments, so
after five staging deploys prod may have no earlier image left; rolling back
then means deploying that commit again.

**Current state:** `scripts/deploy.sh` step 7, `docs/deploy-plan.md` §5 and §9,
`docs/architecture.md` "Deploy".

---

## 2026-09-13 — Blob is reached by one identity per environment, with shared-key auth off

**Decision:** `scripts/azure-provision.sh` step 7 creates, per environment, a
StorageV2 Hot LRS account in Japan East (`stpeacebuddy`, `stpeacebuddystg`), a
private `photos` container, and a user-assigned identity
(`id-peace-buddy-blob`, `id-peace-buddy-blob-stg`) holding Storage Blob Data
Contributor on that account alone. The account has shared-key auth and
anonymous blob access disabled, TLS 1.2 minimum, and a public endpoint.

**Why per environment:** prod's and staging's apps share one Container Apps
environment, so the identity is the isolation. Staging's api holding only
staging's identity cannot read prod's photos, the same way it holds only
staging's `DATABASE_URL`.

**Why shared-key auth off:** #151 says managed identity, not access keys. With
keys merely unused, a leaked key still reads every photo; disabled, it
authorises nothing. The cost is that people and scripts authenticate with
Entra (`--auth-mode login`, and a data role for anyone browsing blobs), which
#155's copy off R2 and #159's dump job have to follow. Azurite locally is
unaffected.

**Rejected — reusing `id-peace-buddy-acrpull`:** one identity is shared by every
app in both environments, so staging could write prod's account.

**Rejected — a system-assigned identity on the api:** the api does not exist
when provisioning runs, so the role grant would move into `deploy.sh` and race
the app's first revision — the failure the pull identity was created to
remove.

**Rejected — scoping the role to the container:** photos are to be served by
user delegation SAS, and `generateUserDelegationKey` is granted only at account
scope or above.

**Rejected — a private endpoint:** browsers fetch photos through SAS URLs, so
the endpoint has to be reachable from the internet, and private endpoints are
billed. Disabled anonymous access is what keeps it closed.

**Found on the way:** `Microsoft.Storage` was not registered on the
subscription, although the Progress table marked providers done. Step 2 now
registers and waits for it. And step 6 could not be rerun against staging: on
a stopped server `db show` fails, the script took that for a missing database,
and `db create` hung to a gateway timeout, so step 7 was never reached. Step 6
now skips the database check unless the server is `Ready`. **Rejected —
starting the server in the script:** bills compute on every rerun and leaves
staging running, which is what the manual start/stop model exists to avoid.

**Current state:** `scripts/azure-provision.sh` step 7,
`scripts/azure.env.example`, `docs/deploy-plan.md` §4 and Progress.

---

## 2026-09-13 — Photos are stored as blob names and served by signed links pinned to the day

**Decision:** `BuddyProfile.photoUrl` is renamed `photoKey` and holds only the
blob name — `buddy-photos/<profileId>/<uuid>.<ext>` — in the environment's
private `photos` container. Every response that carries a photo still exposes
`photoUrl`, which is now a read-only user delegation SAS link signed by
`apps/api/src/lib/photoStorage.ts`, identical all UTC day and expiring at the
end of the next day. The Google
profile picture is no longer saved at sign-up, so a buddy who has not uploaded a
photo renders initials.

**Why blob names, not URLs:** the stored value stops depending on where photos
are served from. R2 URLs embedded the host, which is why leaving R2 means
rewriting rows. A name survives a new account, a custom domain, or a later
decision to serve publicly, with one function changed and no data migration.
The migration turns existing R2 URLs into names by keeping everything from
`buddy-photos/`, so #155 copies the objects under the same names.

**Why signed links:** #190 already made the container private, with anonymous
access and shared-key auth off. Other members still see photos — the api hands
links only to signed-in users — but a link copied out of the app stops working
within two days instead of working forever.

**Rejected — a public container with permanent URLs:** the simplest option,
caches perfectly, and the UUID paths are unguessable. Rejected because a URL
copied out of the app — into chat, a log, a former member's browser history —
keeps working without login and cannot be revoked short of deleting the photo.
For member photographs under APPI, "only signed-in members get working links"
is the easier position, and it would reverse #190's account settings.

**Why pinned to the day:** browsers and the next/image optimizer cache by URL.
Signed fresh on every response, the link changed every time, so the web
container (0.5 vCPU) downloaded and resized every avatar again — ~70 originals
of up to 2 MB on the admin buddies list — on every page load. With no start
time and the expiry pinned to the end of tomorrow, every link signed on one UTC
day is identical, so each photo is resized once a day. First written as a
rejected option, as cleverness the next person would have to understand;
reversed the same day once that cost was spelled out.

**Rejected — keeping the column named `photoUrl`:** no migration, but the name
would lie, and the Google picture URLs already in it would need a "pass through
anything starting with https" branch for good.

**Rejected — keeping the Google `picture` as a fallback photo:** it did not
render — `next.config.ts` never allowed Google's image host, so those avatars
were broken images — and storing it would mix external URLs with blob names in
one column. Better-looking initials are a design task on `AvatarPlaceholder`.

**Rejected — Azurite with OAuth, so local signing also uses a delegation key:**
it needs Azurite served over HTTPS with a certificate. Locally the same SDK
signs with Azurite's published development key instead; that is one branch in
`photoStorage.ts`, and shared-key auth is off on the Azure accounts, so it
cannot be taken there by accident.

**Local development:** the api reaches Azurite as `azurite:10000` and hands the
browser links on `localhost:10000`; the signature does not cover the host.
next/image is `unoptimized` in development only, because the web container
cannot reach `localhost:10000`.

**Current state:** `apps/api/src/lib/photoStorage.ts`, `docs/architecture.md`
"File Upload Flow", `scripts/deploy.sh`, `docker-compose.yml`.

---

## 2026-09-13 — `ci`'s path filter lives on the steps, not on `on:`

**Decision:** `.github/workflows/ci.yml` keeps an unfiltered `on:`. A first
step, `dorny/paths-filter@v4`, sets `code` on pull requests, and every step
from *Install dependencies* down is guarded on
`github.event_name != 'pull_request' || steps.changes.outputs.code == 'true'`.
*Notify Slack* guards on `!= 'false'` instead, so that an unset `code` — the
filter step or anything ahead of it having failed — still notifies rather than
going red in silence. The job always reports; on a PR that changes nothing it
checks, it runs no check and reports success. See `docs/architecture.md`
§CI/CD.

**Why not `on: pull_request: paths:`** — a workflow skipped by a path filter
reports **no status at all**, not a passing one, so it can never satisfy a
required status check. The `shellcheck` entry below reaches the opposite
conclusion from the same mechanism — but note that its stated reason repeats
the same unverified premise corrected here; its decision to stay un-required
is unaffected.

**The gate is not actually armed today.** Ruleset `main` (id 15242620) is
`enforcement: active` and names `ci` as its one required check, with
`strict_required_status_checks_policy` and `do_not_enforce_on_create` both
`false` — but `conditions.ref_name.include` is empty, so it matches no refs. As
of 2026-09-13 `GET /repos/plab-nagasaki/peace-buddy/rules/branches/main`
returns `[]` and `GET .../branches/main` reports `protected: false`; the
`deletion` and `required_linear_history` rules are equally inert. `on: paths:`
would therefore work right now. The filter sits on the steps anyway, because a
workflow that always reports is correct both before and after anyone repairs
the ref condition, where `on: paths:` stops being mergeable the moment they
do. **Arming the ruleset is an open question this
entry does not settle.**

**The filter is a denylist, not an allowlist:** `'**'` minus `docs/**`,
`**/*.md`, `docker-compose.yml` and `apps/*/Dockerfile`, under
`predicate-quantifier: some-with-excludes`. An allowlist would silently skip a
new top-level directory nobody remembered to add; a denylist over-runs instead,
which is the status quo. The Dockerfiles are safe to skip because `ci` runs
pnpm directly on the runner and never builds an image.

**`scripts/**` is not excluded**, so the saving is narrower than it looks: it
applies to a PR that is purely docs and markdown, and most infra PRs touch
`scripts/**` as well as `docs/**` and still run in full. Kept that way because
`ci` is not where shell coverage is decided — `shellcheck.yml` is — and
shrinking `ci`'s must-run set on that argument is a separate call from this one.

**Gated to `pull_request`; pushes to `main` always run in full.** The action
resolves a base differently for a push (the before-commit, with fetch
fallbacks), and a post-merge run on `main` is the last check before anyone
deploys. Not worth the ambiguity to save a run per merge.

**Rejected — splitting the migration drift check into its own path-filtered
workflow** so `services: shadow-db` could leave `ci`. Services start before the
first step and cannot be conditioned, so a docs-only PR still pays a Postgres
container start nothing connects to. Accepted, because the alternative makes
the only check catching a schema edit with no migration non-required — i.e.
ignorable — and the container is a fraction of what a full run costs.

**Rejected — dropping `ci` from the ruleset** and filtering `on:` freely.
Simplest change available, and it discards the merge gate `main` was meant to
have rather than repairing it.

**Rejected — a companion no-op job also named `ci`** with inverted
`paths-ignore`, so exactly one of the two always reports. It works, but two
workflows then have to keep the same job name forever or merges silently break.

**Rejected — pinning `paths-filter` to a commit SHA.** Actions take job-level
`permissions`, not per-step, so the new action inherits the
`pull-requests: write` that exists for the coverage comment when it needs only
read. A SHA would bound a compromised release, at the cost of being the one
action in the repo not on a major tag and needing manual bumps.
`davelosert/vitest-coverage-report-action@v2` already holds the same grant, so
the pin would harden one of two identical exposures.

**Not included — `concurrency` with `cancel-in-progress`.** Worth having, but
it solves superseded runs, not irrelevant ones. Different change.

---

## 2026-09-13 — `shellcheck` runs as its own un-required workflow

**Decision:** `.github/workflows/shellcheck.yml` runs
`koalaman/shellcheck:v0.11.0` over every `.sh` found under `scripts/`, on pull
requests that touch `scripts/**` or the workflow itself. It is not a required
status check.

**Known blind spot:** shellcheck does not analyse heredoc bodies, so the bash
payload `azure-db-restore.sh` assembles — the script its restore job actually
executes, and the largest single block of bash in `scripts/` — is not covered.
Linting it would mean extracting it to its own file, which is a change to how
the job ships, not a CI change.

**Why:** ~1500 lines of bash provision the infrastructure and deploy prod, and
nothing checked any of it. The prod path of `azure-provision.sh` can only be
exercised against a real subscription, so the one class that can be caught
without running anything — quoting, unset expansions, typo'd variable names —
is worth catching. Two SC1090 hits were fixed to make it green: `deploy.sh`'s
directive bound to the first command of a `;` list rather than the `.`, and
`azure-db-restore.sh`'s subshell source had none.

**Pinned, and found by `find` rather than a glob:** `:stable` moves, so a
shellcheck release could redden a branch that changed no shell; and
`scripts/*.sh` would miss `scripts/<subdir>/x.sh` while still reporting green.

**Rejected — a step in `ci`:** that job starts a Postgres service and installs
pnpm before it would reach a linter. A standalone job reports in seconds and
needs no database, no credentials and nothing running.

**Rejected — making it a required check:** ruleset `main` requires only `ci`,
and a path-filtered job that is skipped reports no status at all, so every PR
touching no shell would sit pending forever. Un-required means a red X on
shell PRs that informs without blocking. Requiring it later means either
always running the job with the path filter moved onto the steps, or a
companion no-op job of the same name.

**Rejected — `hadolint` on the two Dockerfiles:** mostly style nags across two
files.

**Rejected — `docker compose config`:** one local dev file; a syntax error
surfaces the moment anyone runs it.

**Deferred — env-example drift** between the `: "${VAR:?}"` lists in
`deploy.sh`/`azure-provision.sh` and the keys in
`deploy.env.example`/`azure.env.example`. A real failure class — a revision
deployed without `R2_*` 500s on every upload — but both pairs agree today, so
it would be a pure regression guard. Left out to keep the first version to one
tool.

**Current state:** `.github/workflows/shellcheck.yml`,
`docs/architecture.md` "CI/CD".

---

## 2026-09-13 — Staging gets a budget of its own, in yen

**Decision:** `scripts/azure-cost-alerts.sh` creates three alerts: an annual
subscription budget of ¥160,000 (~$1,000, half the grant), a monthly budget of
¥1,600 filtered to `psql-peace-buddy-stg` by `ResourceId`, and a daily anomaly
alert on the subscription. It is a script like the other `azure-*.sh`, reading
the same env file, and a non-prod env file is what adds the server budget.

**Why the server budget:** #157 exists to catch staging restarting itself after
seven days. A month of that is ~$19 against a subscription running $42–60, which
a subscription-level threshold would not notice until long after the fact.
Filtered to the one server, the same cost is roughly double a normal month.

**Rejected — a subscription budget only:** what the issue names. Rejected
because it does not do the job the issue says makes it load-bearing.

**Rejected — amounts in dollars:** budgets take the billing currency, which Cost
Management reports as JPY. Converted at Azure's own ¥159.3, not a market rate,
so the figures line up with what the portal shows.

**Rejected — a monthly subscription budget:** the grant is annual and does not
roll over, so an annual budget measures the thing that runs out. The staging
budget covers the month-scale signal.

**Rejected — creating them by hand in the portal:** nothing would record the
amounts or recipients, and the anomaly rule's five-year expiry would need
remembering. A re-runnable script matches how everything else on Azure is made.

**Current state:** `scripts/azure-cost-alerts.sh`, `scripts/azure.env.example`,
`docs/azure-costs.md` "Cost alerts", `docs/deploy-plan.md` §9.

---

## 2026-09-13 — Custom hostnames come from config, not from Azure

**Decision:** `scripts/deploy.sh` takes two optional keys, `WEB_HOSTNAME` and
`API_HOSTNAME`. When either is set it is used for that app's URL; when blank
the script falls back to the hostname Container Apps generates, which is what
both environments run on today. The URLs feed three things: the api's
`CORS_ORIGIN` and `WEB_BASE_URL`, and `NEXT_PUBLIC_API_URL`, which is baked
into the web bundle at build time.

**Why:** a custom domain is bound to an app but is not what the ingress
reports, so it cannot be discovered the way the generated name can. Without
config the script would rediscover the generated hostname on every run and
overwrite a correct `CORS_ORIGIN` with it, which fails as a blocked
cross-origin request from the real domain rather than as a deploy error.

**Rejected — reading the bound custom domain off the app instead:** it is in
`properties.configuration.ingress.customDomains`, so discovery is technically
possible. Rejected because an app can carry several bound hostnames and
nothing in the resource says which one is canonical, so the script would be
guessing at exactly the value that decides whether the browser's requests are
allowed. Naming it in config is one line and removes the guess.

**Rejected — dropping the generated hostname once a domain exists:** would
simplify the script to one path. Rejected because the generated name is what
every environment starts on, before any DNS exists, and it stays the fallback
that makes a fresh environment deployable with no records at all.

**Current state:** `scripts/deploy.sh`, `scripts/deploy.env.example`,
`docs/deploy-plan.md` §5.

---

## 2026-09-13 — Images are pulled with a user-assigned identity

**Decision:** One user-assigned managed identity, `id-peace-buddy-acrpull`,
created once by `scripts/azure-provision.sh` and granted `AcrPull` on the
registry once. Both container apps and the migration job authenticate to the
registry with it. No resource gets a system-assigned identity for this.

**Why:** A system-assigned identity is created together with the resource that
holds it, so its role assignment is seconds old when the platform first
validates the image pull — and the platform validates before the assignment has
propagated. `az containerapp job create --registry-identity system` fails with
`unable to pull image using Managed identity system`, leaving a job behind that
still carries the CLI's placeholder image. The first staging deploy died there.

Retrying does not help, and this is the part that makes it a design bug rather
than a flake: the migration job is deleted and recreated on **every** deploy, so
its identity is new every time and the race never stops being fresh. An identity
that outlives the resources using it has the race exactly once, at provisioning,
against nothing.

**Rejected — retry the image patch until the assignment propagates:** keeps the
system-assigned identity and adds a poll loop. Rejected because it pays one to
five minutes of waiting on every single deploy, for a job whose actual work is a
few seconds of `migrate deploy`, and because it makes the deploy script's
slowest step a sleep.

**Rejected — the registry's admin user and a password in the deploy config:**
the one option with no propagation question at all. Rejected for the reason the
whole design keeps coming back to: a long-lived credential that can pull every
image, stored in a file and copied into every app's secrets, replacing an
identity that stores nothing.

**Consequence:** `ACR_PULL_IDENTITY` is now a required key in both config files,
the Azure one that provisions it and the deploy one that references it.

**Current state:** `scripts/azure-provision.sh` step 3.1, `scripts/deploy.sh`,
`docs/deploy-plan.md` §5.

---

## 2026-09-13 — `noindex` keeps the app out of search results; robots.txt allows crawling

**Decision:** Every page carries `robots: { index: false, follow: false }` from
`apps/web/src/app/[locale]/layout.tsx`, `apps/web/next.config.ts` sends
`X-Robots-Tag: noindex, nofollow` on every path, and
`apps/web/src/app/robots.ts` serves `Allow: /`. The meta tag and the header are
the mechanism; robots.txt exists only to record that *not* blocking crawlers is
deliberate.

**Why not both:** they cancel. Google's documentation is explicit — "For the
`noindex` rule to be effective, the page or resource must not be blocked by a
robots.txt file... the crawler will never see the `noindex` rule, and the page
can still appear in search results, for example if other pages link to it."
A `Disallow: /` therefore buys the weaker of the two outcomes: no snippet, but
a URL that can still be listed once anyone links to it.

**Rejected — `Disallow: /` as well, which is what #180 asked for.** Its only
remaining benefit is suppressing crawler traffic against `/login`, and #180
itself puts that out of scope as a WAF and rate-limit question. Paying for it
with the deindex signal is the wrong trade.

**Why the header as well as the meta tag:** the meta tag reaches only HTML
rendered under `app/[locale]/layout.tsx`. A route handler, a `public/` file, or
a page that exports its own `metadata.robots` would silently drop the signal.
`X-Robots-Tag` is set once at the edge of every response and cannot be
overridden per-page. Neither replaces the other: the header does not appear in
the HTML, so anything reading the markup alone still needs the tag.

**Rejected — no `robots.ts` at all.** `Allow: /` is a no-op to a crawler, so
the file is documentation. It is kept because the failure mode is someone
adding `Disallow: /` back without knowing it disables the meta tag.

**Not a security control.** Firebase Auth plus the `__session` guard in
`apps/web/src/middleware.ts` is what protects the app; scrapers ignore both
mechanisms here. Only `/login` and `/pending` are reachable without the cookie,
so that is the entire crawlable surface either way.

**Current state:** `apps/web/src/app/robots.ts`,
`apps/web/src/app/[locale]/layout.tsx`, `apps/web/next.config.ts`. All three are
asserted by `apps/web/src/app/robots.test.ts`.

---

## 2026-09-13 — `migrate deploy` runs as a one-shot Container Apps Job

**Decision:** `scripts/deploy.sh` applies pending migrations itself, between
building the images and updating the api. It builds a second image from a new
`migrate` stage in `apps/api/Dockerfile` — the `deps` layer, which already
carries the Prisma CLI and `prisma/migrations/` — creates a Manual Container
Apps Job from it, runs it as `pb_migrate`, and deletes the job afterwards. A
non-zero exit stops the deploy with nothing updated. This closes the question
deferred by "Prisma Migrate replaces db push" below.

**Why a job at all — this part is not a choice.** The Postgres server has no
public endpoint and its hostname resolves only inside the VNet, so anything
that touches the schema has to run from inside `snet-apps`. Nothing already in
there can: the api's `runner` image ships no Prisma CLI, and a container `CMD`
is unsafe because Container Apps runs several replicas and concurrent DDL is
not. So "keep it manual" and "run it on release" need the **same** job. The
only question left is who starts it.

**Why the deploy script starts it:** the failure being guarded against is a
release whose code expects a schema the database does not have. It boots fine
and fails later, at the rows that disagree. A step that has to be remembered
does not prevent that; a step in the script does. `migrate deploy` is a no-op
when nothing is pending, so an ordinary deploy pays one job execution of a few
seconds.

**Rejected — gate the deploy with `migrate status`, apply by hand.** This was
option 3 in #152, and it assumed the check could run from the laptop. It
cannot, for the networking reason above: `migrate status` needs a job in the
VNet exactly as the apply does. The gate therefore costs what applying costs,
and still leaves the apply to be remembered.

**Rejected — keep the job between deploys.** It would save recreating the job
and its `AcrPull` role assignment on every run, at the price of leaving
`pb_migrate`'s password in a job's secrets permanently. The role that can drop
every table holding buddy personal data gets no resting place;
`scripts/azure-db-roles.sh` set that precedent and this follows it. The cost is
real and accepted: a fresh identity means a fresh role assignment, and a first
execution can fail to pull the image while it propagates. Rerunning the deploy
is safe.

**Rejected — `migrate deploy` in the api container's `CMD`.** Several replicas
start at once, so it races by construction. The dev container does exactly this
and that stays correct, because Compose runs one.

**Consequence for the deploy config:** it now carries two connection strings,
`DATABASE_URL` as `pb_app` and `MIGRATE_DATABASE_URL` as `pb_migrate`, and
`scripts/deploy.sh` refuses a file where the two are equal. The file was
owner-only by convention; the script now enforces it, as the other two Azure
scripts do.

**Current state:** `scripts/deploy.sh`, `scripts/deploy.env.example`,
`apps/api/Dockerfile` (`migrate` stage), `DEPLOYMENT.md` "Schema Changes",
`docs/deploy-plan.md` §5.

---

## 2026-09-13 — Staging's data moves in one piped job, loaded as `pb_migrate`

**Decision:** `scripts/azure-db-restore.sh` moves a database between servers as
a single `pg_dump | psql` pipe inside a one-shot Container Apps job, connected
to the target as `pb_migrate`, with the dump never written to disk at either
end. The job then asserts three things before it will report success: per-table
row counts agreeing on both ends, `_prisma_migrations` matching
`prisma/migrations/`, and `pb_app` holding read and write on every restored
table and sequence.

**Why:** Loading as the migration role is what removes a documented step. Tables
arrive owned by whoever loads them, so loading as the server admin leaves them
outside the default privileges `azure-db-roles.sh` granted for `pb_migrate`, and
`pb_app` then gets `permission denied` until that script is re-run as a catch-up
grant — which is what `deploy-plan.md` §6 assumed would be necessary. Loading as
`pb_migrate` instead gives the tables the owner `prisma migrate deploy` needs
anyway and brings the default privileges with it. Verified against a local
Postgres 16 before the job ran against Azure.

The pipe is not a micro-optimisation. There is nowhere good to put a dump file:
the storage accounts do not exist yet (#151), the dev machine is outside the
VNet, and a dump of member data sitting on a laptop is the kind of copy nobody
remembers to delete. Neon stays alive for a week after the move, which is the
rollback.

**Rejected — `prisma migrate status` for the history check:** what #153 asked
for, and it is the tool that owns this question. Rejected because running it
inside the VNet means a second job on a Node image with `schema.prisma` and
every migration directory shipped in as a secret, to read one table. The SQL
assertion compares the same two things — directories against rows — and fails
with the same three verdicts: pending, drift, and unfinished. If Prisma ever
needs to run in there for its own sake, the job exists to be written then.

**Rejected — dumping with `postgres:16` to match the target:** it cannot be
done. Neon runs Postgres 18 and `pg_dump` refuses to read a server newer than
itself. The client is therefore `postgres:18` dumping for a 16 target, which is
not a supported direction; the two lines of output 16 rejects are filtered in
the pipe and named there. Verified against a real 16 server, not assumed.

**Rejected — upgrading the Azure server to 18 to match Neon:** removes the
unsupported direction entirely. Rejected because `docker-compose.yml` runs
Postgres 16 and local development matching the deployed server is worth more
than avoiding a two-line filter on a migration that happens once.

**Rejected — `pg_dump --data-only` onto a schema built by `migrate deploy`:**
avoids the version-mismatch question, since Prisma would author the DDL.
Rejected because a data-only load has no ordering that satisfies foreign keys
without disabling triggers, and `session_replication_role` needs the admin
account — trading a filtered pipe for a privilege escalation and a topological
sort.

**Current state:** `deploy-plan.md` §6.1. Run against Azure staging on
2026-09-13: 20 tables, row counts agreeing on both ends, history matching, and
`pb_app` able to read and write everything restored.

---

## 2026-09-12 — Two database roles per server, neither of them the admin

**Decision:** Each Postgres server gets **two** login roles, created by
`scripts/azure-db-roles.sh` running `scripts/azure-db-roles.sql` as the server
admin, once per server, immediately after provisioning.

- `pb_migrate` holds `CREATE` on schema `public` and therefore owns every table
  Prisma creates. It runs `prisma migrate deploy` and nothing else.
- `pb_app` holds `USAGE` on the schema and `SELECT`/`INSERT`/`UPDATE`/`DELETE`
  on its tables. It cannot `CREATE`, `ALTER` or `DROP`. This is the role in
  `DATABASE_URL` on the deployed api.

`CONNECT` on `peacebuddy` is revoked from `PUBLIC` and granted to those two
plus the admin. Neither role has `SUPERUSER`, `CREATEDB`, `CREATEROLE` or
`BYPASSRLS`, and neither is a member of `azure_pg_admin`. The admin account is
now only used to rotate them.

**Why two and not one:** the api and the migration step need different powers,
and that is the only axis worth splitting on. A single restricted role would
still hand the always-running, internet-facing api the ability to drop the
tables holding buddy personal data. Splitting costs one extra password per
environment and one line of setup, `ALTER DEFAULT PRIVILEGES FOR ROLE
pb_migrate`, which is what stops the next migration from shipping a table the
api gets `permission denied` on.

**Why not more than two:** a third role is standard only for a read-only
consumer such as analytics, which does not exist here. A role per service or
per feature multiplies credentials and buys nothing.

**Rejected — keeping the admin account in `DATABASE_URL`:** what
`azure-provision.sh` prints, because a restricted role cannot be created until
the VNet exists. It is the whole of #150. That account can administer every
database on the server, so a leaked container environment variable would be a
server compromise rather than an application one.

**Rejected — one application role owning its own schema:** simpler to operate,
one credential, and a real improvement on the admin account. Rejected because
it leaves DDL in the hands of the process most likely to be compromised, and
the ongoing cost of the split turned out to be one password rather than a
workflow change.

**Consequence — every migration must run as `pb_migrate`.** `ALTER DEFAULT
PRIVILEGES FOR ROLE` applies to objects that role creates, not to objects
anyone else creates. A migration or a restore run as the admin produces tables
`pb_app` cannot read. Section 4 of the SQL grants on whatever already exists,
so re-running the script is the fix, and that is why it is idempotent.

**Known residual — `pb_app` can still connect to the `postgres` maintenance
database** and read the catalog there. It cannot reach application data. Left
alone rather than revoked, because revoking `CONNECT` on `postgres` from
`PUBLIC` risks Azure's own management connections on a server with no public
endpoint, against a benefit that is close to nil.

**How it reaches the server.** The server has no public endpoint, its hostname
resolves only inside the VNet, nothing is deployed yet to `exec` into, and
`psql` is not on the dev machine. The script creates a Manual Container Apps
Job in `cae-peace-buddy` running `postgres:16`, runs it, and deletes it, since
the job holds all three passwords as secrets for as long as it exists. This is
the same shape the deferred question about where `migrate deploy` runs on
release will need, so it is now proven rather than theoretical.

**Current state:** `scripts/azure-db-roles.sh`, `scripts/azure-db-roles.sql`,
`scripts/azure.env.example`, `deploy-plan.md` §4.1 and the Progress table,
`DEPLOYMENT.md` "Schema Changes".

---

## 2026-09-12 — Group prefill on the tour form is a separate `initialGroupId` prop

**Decision:** `/admin/tours/new` accepts `?groupId=`, and `TourForm` takes
`initialGroupId?: string` alongside its existing `defaultValues?:
AdminTourDetailResponse`. `defaultValues` wins when both are present. Arriving
with a `groupId` also changes where the screen exits to: back link and Cancel
return to that group, and the post-submit redirect returns to the group the tour
was actually created for, which is not the same thing once the picker has been
changed. With no `groupId`, all three go to the tour list as before.

**Why:** #172 adds "new tour for this group" buttons to the group list and detail
pages. The only thing prefilled is the group, which is not a tour.

**Rejected — widening `defaultValues` to a partial tour:** every field read off
it (`defaultValues?.tourDate.slice(0, 10)`, the session mapping) would have to
become optional-aware, and the edit page, which passes a real tour, would carry
that looseness for a case it never hits.

**Rejected — sending Cancel to the tour list while Save returns to the group:**
the issue only named the success redirect, but two exits from the same screen
landing in different places is a bug waiting to be filed.

**Rejected — resolving the id against the loaded group list before prefilling:**
groups load after mount, so the form would have to re-seed itself. An id that
matches nothing simply leaves the picker empty, which is the same state as not
passing one.

**Current state:** `apps/web/src/lib/routes.ts`,
`apps/web/src/app/[locale]/admin/tours/new/page.tsx`,
`apps/web/src/app/[locale]/admin/tours/_components/tour-form.tsx`.

---

## 2026-09-12 — Staging's baseline repair is hand-run SQL, not a migration

**Decision:** The SQL that brought Neon staging up to `schema.prisma` before
baselining it — the `BuddyTier` remap and the missing-column drift — lives in
`scripts/staging-enum-remap.sql` and `scripts/staging-drift.sql`, run once by
hand. It is not in `prisma/migrations/`.

**Why:** the two constraints are circular. `migrate resolve --applied 0_init`
asserts the database already contains everything `0_init` creates, including
`BuddyTier` with its four final values, so it cannot run before the remap. And
`migrate deploy` refuses a non-empty database with no `_prisma_migrations`
table with `P3005`, so a migration file cannot reach that database before it is
baselined. Something has to run outside Migrate to break the circle.

**Rejected — writing the remap as a Prisma migration.** Beyond the circularity,
a migration is replayed on every database forever. Local databases were
baselined already holding the correct enum and the Azure servers are fresh, so
on all of them this is a no-op that permanently records one database's
historical drift as if it were a schema change. `prisma/migrations/` is a linear
rebuild from empty, checked as such by the CI drift replay in
`.github/workflows/ci.yml`, not a log of repairs.

**Rejected — running it straight from the terminal with no file.** Nothing then
records what was executed against a live database. The `_prisma_migrations`
table covers the migrations, but not the repair that preceded them.

**What the files are not:** they are the reviewable artifact, not proof of
execution. That is the progress row in `docs/deploy-plan.md` and the database's
own state.

**Current state:** `DEPLOYMENT.md` "Baselining an existing database",
`docs/deploy-plan.md` §6.

---

## 2026-09-12 — Tier value labels live in a shared `buddyTier` namespace

**Decision:** The four tier labels moved from `adminBuddies.tier{Junior,Buddy,Star,Blackstar}`
to a top-level `buddyTier` namespace keyed by the enum value, read through
`getBuddyTierLabel` in `lib/status-display.ts`. `adminBuddies` keeps `tier`,
`tierPlaceholder` and `tierNone` — those are form chrome, not value labels.

**Why:** #137 puts tier on a buddy-facing screen. The labels already existed;
matching the `buddyStatus` / `tourStatus` / `bookingStatus` namespaces gives one
set both sides read, and replaces the `tier${capitalize(value)}` key-building
that was duplicated in two admin files.

**Rejected — having the buddy profile page call `useTranslations('adminBuddies')`:**
no admin churn, but a buddy-facing screen reading the admin namespace invites the
next person to put buddy-facing copy there.

**Current state:** `apps/web/messages/*.json`, `apps/web/src/lib/status-display.ts`.

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

**Settled 2026-09-13 — where `migrate deploy` runs on release.** Deferred here
to the Azure move, and answered by it: `scripts/deploy.sh` runs a one-shot
Container Apps Job as `pb_migrate` before the api is updated, and the
production image still ships no Prisma CLI. See the entry at the top of this
file, "`migrate deploy` runs as a one-shot Container Apps Job".

**Enforced in CI, not by convention.** A schema edit with no migration file
would otherwise pass every check and only fail at a query after deploy, so
`.github/workflows/ci.yml` replays `prisma/migrations/` into a throwaway
Postgres and fails the branch if the result differs from `schema.prisma`.
`CLAUDE.md` carries the matching rule.

**Since verified:** staging was baselined on 2026-09-12 in #142; see the entry
above. The drift replay has been observed passing — on `main` in Actions run
`34683242242`, the first run after #144 merged, and again on #142's branch in
`34693275555`.

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

## 2026-09-12 — Staging is provisioned first; prod waits until release

**Decision:** The Azure staging server was created first and prod was left
unprovisioned. Steps 1 through 5 — resource group, providers, registry, VNet and
Container Apps environment — are shared and exist already, so prod's database is
one `scripts/azure-provision.sh` run against `scripts/azure.env`, the restricted
application role created with `psql` from inside the VNet, and `prisma migrate
deploy`, done whenever release is actually wanted. Everything else prod needs
before release — the storage account (#151), a deploy script that can target it
(#152) — is tracked in the Progress table.

**Why:** Staging is where the work is — it carries Neon's data and the whole
cutover in `deploy-plan.md` §6. Prod has no data, no cutover, and nothing to
deploy yet, so provisioning it early buys nothing and adds a resource to mind.
The money is not the argument — `deploy-plan.md` §7 costs the plan with prod
running and still leaves most of the grant unspent, so waiting saves no credit.
Nor is parking it stopped better: storage bills either way, and Azure restarts a
stopped server after seven days (§7), so an environment nobody uses would need
the same manual minding as staging.

**Rejected — provisioning both servers in one sitting:** the tidier reading of
#150, which is scoped to both servers. Rejected because the shared one-way door
— the Container Apps environment's network type, step 5 — is already taken and
proven. Prod's own one-way door is the Postgres server's private access, step 6,
which is per-server and identical whenever it is taken, so nothing about
creating prod later is harder than creating it now. #150 therefore stays open
after the staging provisioning merge, holding the prod server and the restricted
application roles for both.

**Current state:** the Progress table in `deploy-plan.md`.

---

## 2026-09-12 — Two Azure environments, prod and staging; nothing else deployed

**Decision:** Azure gets **prod** and **staging**, each with its own Postgres
B1ms server and its own Blob storage account, sharing one resource group, VNet,
Container Apps environment and registry. The GCP/Neon stack — Cloud Run, Neon
and the `peace-buddy-staging` Firebase project, the only environment deployed
today — has its data moved to Azure staging and is then decommissioned, as its
own task after this plan. Nothing replaces it. Local Docker Compose remains for
development. *Superseded on the Firebase project, which stays, and on waiting
for a review cycle, 2026-09-13 — see "GCP staging is retired now".*

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

**Decision:** Azure infrastructure is created by `scripts/azure-provision.sh`,
reading an untracked env file passed as its argument. It mirrors the existing
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
and `adminMemo` remain admin-only. Shipped in #137: `BuddyProfileResponse`
carries `tier`, the buddy profile page shows it, and `tier` is dropped from the
CLAUDE.md never-expose rule.

**Why:** The roles now have clear published requirements, so hiding a buddy's own
role hides the thing they are working toward.

**Rejected — exposing it in #121:** #121 is a rename. Changing an API contract
and a standing project rule in the same commit makes the diff unreviewable and
the revert unscopable.

**Current state:** PRD §5.2, `api.md`, `buddy.service.ts`, `profile-header.tsx`.

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

**Open risk — resolved 2026-09-13:** a buddy who signed in with Google and later
with Apple + Hide My Email would have got a second `User` and a duplicate
`BuddyProfile`. Settled by linking the second provider from the profile page
rather than at sign-in — see the 2026-09-13 entry.

**Superseded in part by 2026-09-13:** the decision to finish rather than drop
still stands, but the button is disabled behind a flag until the console config
lands.

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

---

## 2026-09-13 — Apple sign-in held behind `NEXT_PUBLIC_APPLE_SIGN_IN_ENABLED`

**Decision:** The Apple button renders disabled with a "coming soon" label
(`login.appleComingSoon`) unless `NEXT_PUBLIC_APPLE_SIGN_IN_ENABLED` is exactly
`"true"`. Off by default. Re-enabling is a build-arg change, not a code change.

**Why:** The Firebase Apple provider (Service ID + key) is still unconfigured —
blocked on the Apple Developer nonprofit grant, whose terms are under review.
Until then `signInWithApple()` throws and `handleApple` only `console.error`s it,
so the login page's second button silently does nothing. This is the front door
for every user; broken-and-silent is the worst of the available states. A flag
also keeps the launch decoupled from the grant: the config can land on Apple's
timetable rather than ours.

**Rejected — removing the button until the provider is live:** it would have to
be rebuilt, and 2026-08-15 already settled that the code stays. It also tells
Apple-preferring users nothing, where a disabled button says "this is coming".

**Rejected — a runtime config value instead of a build-time flag:** every other
client-side setting here is `NEXT_PUBLIC_*` inlined at build time
(`apps/web/Dockerfile`), and web images are already built per environment. A
runtime channel would be a new mechanism for one boolean. The cost is real and
accepted: flipping the flag needs a web rebuild, not a container restart.

**Current state:** `apps/web/src/lib/flags.ts`, the login page, `apps/web/Dockerfile`,
`scripts/deploy.sh` step 4, `docker-compose.yml`, `apps/web/.env.example`.

**Revisit when** the Apple Developer grant closes and the Service ID + key are in
the Firebase console. Flip the flag, then delete it and the `appleComingSoon`
key.

---

## 2026-09-24 — Japanese UI calls a booking 参加希望, never 予約

**Decision:** Every Japanese string about a booking — web (`ja.json`) and
notification templates (`messages.ja.json`) — uses 参加希望 as the noun and
参加を希望する as the verb (never 参加希望する). A buddy's list that mixes
booked and joined tours is headed ツアー一覧, and a booking's cancel button is
just キャンセル. English keeps "booking". Closes #244.

**Why:** Product owner's call on #244: 予約 is the wrong term for this product.

**Rejected — 予約:** the term used until now.

**Current state:** `apps/web/messages/ja.json`,
`apps/api/src/services/notificationTemplates/messages.ja.json`.
