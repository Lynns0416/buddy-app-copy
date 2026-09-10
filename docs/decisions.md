# Decisions

Append-only log of decisions and the alternatives rejected. Newest first.

PRD.md, architecture.md, and data-model.md describe **what the system is**. This
file records **why it is that and not something else** — so a settled question
does not get re-litigated in a later session.

Add an entry when a decision closes off an alternative someone might plausibly
re-propose. Link to the doc that holds the resulting current state; do not
duplicate that state here.

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
