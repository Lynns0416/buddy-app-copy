# Decisions

Append-only log of decisions and the alternatives rejected. Newest first.

PRD.md, architecture.md, and data-model.md describe **what the system is**. This
file records **why it is that and not something else** — so a settled question
does not get re-litigated in a later session.

Add an entry when a decision closes off an alternative someone might plausibly
re-propose. Link to the doc that holds the resulting current state; do not
duplicate that state here.

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
