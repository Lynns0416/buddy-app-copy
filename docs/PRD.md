# Product Requirements Document
## Buddy Booking App

**Version:** 0.4 (MVP)
**Last Updated:** 2026-04-26
**Author:** [Your Name]
**Status:** Draft

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Users & Roles](#3-users--roles)
4. [Authentication](#4-authentication)
5. [Buddy Profile](#5-buddy-profile)
6. [Group Management](#6-group-management)
7. [Tour Management](#7-tour-management)
8. [Booking System](#8-booking-system)
9. [Evaluation System](#9-evaluation-system)
10. [Notifications](#10-notifications)
11. [Admin Dashboard](#11-admin-dashboard)
12. [Internationalisation](#12-internationalisation)
13. [Tech Stack](#13-tech-stack)
14. [Data Migration](#14-data-migration)
15. [Future Roadmap](#15-future-roadmap)
16. [Out of Scope (v1)](#16-out-of-scope-v1)
17. [Open Questions](#17-open-questions)

---

## 1. Overview

A web-first internal booking application for managing group tour assignments. The app serves two user types: **Buddies** (tour guides) and **Admins** (our team). Buddies can view upcoming tours, book themselves with a status, manage their profile, submit self-evaluations, and track their history. Admins manage tours, groups, approve buddies, configure rules, and evaluate buddy performance.

**Primary language:** Japanese
**Supported languages:** Japanese, English (i18n from day one)

---

## 2. Goals & Non-Goals

### Goals
- Replace the existing Google Sheets workflow with a structured, reliable web app
- Give buddies a self-service experience for booking and profile management
- Give admins full visibility, control, and notification coverage
- Build a clean foundation that can grow without a rewrite

### Non-Goals (v1)
- Participant-facing features (tour participants do not use this app)
- Travel agency integration
- Native mobile apps (web-first PWA; native post-v1.5)
- Advanced analytics or reporting dashboards
- Peer evaluation between buddies
- Payment handling
- Calendar integration (planned for v1.5)

---

## 3. Users & Roles

| Role | Description |
|---|---|
| **Buddy** | Tour guide. Can book tours, manage own profile, submit self-evaluations, view history. |
| **Admin** | Regular admin. Can manage tours, groups, buddies, bookings, and evaluations. |
| **Super Admin** | All admin capabilities plus admin account management and system configuration. |

**Scale:**
- Launch: ~50 buddies
- Maximum expected: ~200 buddies
- Admins: small team (5–6 non-dev members)

---

## 4. Authentication

- **Social login:** Google and Apple (OAuth 2.0) via Firebase Auth
- **Signup flow:**
  1. Buddy signs up via Google or Apple
  2. Account created in **pending** state
  3. Admin notified of new signup
  4. Admin approves or rejects
  5. Buddy notified of outcome
- **Admin accounts:** Created and managed by Super Admin only (not self-signup)
- **Session management:** Firebase Auth handles token lifecycle

---

## 5. Buddy Profile

### 5.1 Account Status (admin-managed, visible to admins only)

| Status | Description |
|---|---|
| **Pending** | Signed up, awaiting admin approval |
| **Active** | Cleared to log in; tier determines booking eligibility (see §5.2) |
| **Rejected** | Signup rejected by admin — account is closed |
| **Suspended** | Temporarily or permanently deactivated after being active |

Status is set manually by admin. Typical progression: Pending → Active (with tier=trainee). Pending → Rejected is a terminal state for denied signups. Rejected and Suspended are distinct: Rejected means the signup was never approved; Suspended means an active buddy was deactivated.

Buddies are never deleted from the database. Suspended accounts remain in the DB with all history intact.

**Trainee access:** Trainees (status=active, tier=trainee) can log in but cannot see tours or make bookings. A dedicated training schedules section is planned for a future release. Admins manage trainees via `/admin/trainees`; promotion to junior is done through the buddy detail page (tier dropdown), which requires confirmation.

### 5.2 Internal Tier (admin-managed, hidden from buddies)

Once Active, an internal tier is assigned and updated manually by admin:

| Tier | Description |
|---|---|
| **Junior** | Recently activated, limited experience |
| **Mid** | Comfortable with regular tours |
| **Senior** | Experienced, handles complex groups |
| **Expert** | Top-tier, can mentor and guide others |
| **Instructor** | Can teach and train buddies; must reach Expert first |
| **Organizer** | Oversees full sessions, manages time and handles emergencies; must reach Instructor first. Can still participate as a buddy. |

Tier is for internal reference only — buddies have no visibility.

Typical progression: Junior → Mid → Senior → Expert → Instructor → Organizer.

### 5.3 Self-Managed Fields (edited by buddy)

| Field | Type | Notes |
|---|---|---|
| Display name / nickname | Text | Chosen by buddy; editable in profile settings |
| Real name | Text | For admin reference; editable in profile settings |
| Profile photo | Image upload | GCP Cloud Storage — **deferred post-v1** |
| Bio | Long text | Free description |
| Contact info | Text / Email | Preferred contact method |
| Languages spoken | Multi-select enum (`LanguageSchema`) | See enum values below |
| Skills & interests | Free text (one per line) | v1: plain textarea; structured multi-select in future |
| Availability | Free text | General availability notes (v1); structured input in future |

#### Language Enum (`LanguageSchema`)

Ordered for UI display — priority tier shown first:

| Value (code) | Priority |
|---|---|
| `english` | Priority |
| `korean` | Priority |
| `chinese_simplified` | Priority |
| `chinese_traditional` | Priority |
| `arabic` | Standard |
| `french` | Standard |
| `german` | Standard |
| `italian` | Standard |
| `japanese` | Standard |
| `portuguese` | Standard |
| `russian` | Standard |
| `spanish` | Standard |
| `thai` | Standard |
| `vietnamese` | Standard |

`LanguageSchema.options` preserves this order — UI iterates it directly for consistent display without sorting logic.

`UpdateBuddyProfileSchema.languages` validates against `LanguageSchema` (not raw strings). `BuddyProfileResponse.languages` is typed as `Language[]`.

### 5.4 Admin-Managed Fields

| Field | Type | Notes |
|---|---|---|
| Account status | Enum | See §5.1 |
| Internal tier | Enum | See §5.2 — hidden from buddy |
| Internal notes | Free text | Admins only |
| Admin evaluation records | See §9 | Admins only |

### 5.5 Migration
- Existing buddy data imported from Google Sheets at launch
- Admin completes missing fields via dashboard post-import
- Buddies complete their own profiles after first login

---

## 6. Group Management

Groups represent visiting parties — schools, companies, community groups, etc.

### 6.1 Group Fields

| Field | Type | Notes |
|---|---|---|
| Group ID | Auto | |
| Name | Text | e.g. "Sakura High School", "Acme Corp" |
| Type | Enum | School / Company / Community / Other |
| Contact name | Text | Primary contact person |
| Contact email | Email | |
| Contact phone | Text | |
| Notes / history | Long text | Admin-maintained; visit history, special considerations, etc. |

### 6.2 Rules
- Groups created and managed by admins only
- Each tour is linked to exactly one group
- Group history accumulates as tours are completed over time

---

## 7. Tour Management

### 7.1 Tour Fields

| Field | Type | Notes |
|---|---|---|
| Tour ID | Auto | |
| Group | Group ref | Linked to a managed group entity |
| Tour date | Date | |
| Meeting time | Time | |
| Location | Text | |
| Capacity | Integer | Max number of buddies for this tour |
| Description / notes | Long text | Visible to buddies |
| Admin memo | Long text | **Admin-only — not visible to buddies** |
| Cancellation deadline | Date | Default: 7 days before tour; overridable per buddy by admin. Must be set after (closer to tour than) the Maybe deadline. |
| Maybe confirmation deadline | Date | Default: 9 days before tour. Must be set before (further from tour than) the cancellation deadline. |
| Notification schedule | List of offsets | Days-before-tour offsets; default: 3 days before and 1 day before; configurable per tour |
| Status | Enum | Draft / Published / Cancelled / Completed |
| Assigned admins | Admin refs (many) | Optional; admins responsible for this tour |
| Staff in charge | Admin ref (one) | Required if at least one admin is assigned; must be one of the assigned admins |

### 7.2 Tour Status Lifecycle

- **Draft:** Editable, not visible to buddies. Can be published or deleted.
- **Published:** Visible to and bookable by Active buddies. Can be edited, cancelled, or completed.
- **Cancelled:** Booking closed. All buddies with status Confirmed, Maybe, or Waitlist are notified automatically. No further edits.
- **Completed:** Booking closed. Admin is prompted to submit evaluations for participating buddies.

### 7.3 Rules
- Only admins can create, edit, cancel, or complete tours
- Tours must be **Published** before Active or Trainee buddies can see them
- Only **Active** buddies can book tours

### 7.4 Tour Admin Assignment

Each tour can have one or more admins assigned to it.

**Assignment rules:**
- Any admin can assign or unassign admins to a tour
- Assignments can be made at any point — during draft, after publishing, or even post-cancellation for record-keeping
- A tour is not required to have assigned admins (optional)

**Staff in charge:**
- One assigned admin must be designated as **staff in charge**
- Staff in charge is required if at least one admin is assigned; optional otherwise (i.e. if no admins are assigned, the field is empty)
- Staff in charge must be one of the assigned admins
- Staff in charge has no additional system permissions — it is a designation for operational clarity and record-keeping

**Removing an assigned admin who is staff in charge triggers a prompt with two paths:**
1. **Designate a replacement from remaining assigned admins** (if others exist)
2. **Assign a new admin and designate them as staff in charge** (always available)

If the admin being removed is the only assigned admin, removing them leaves the tour with no assigned admins and no staff in charge — which is a valid data state but flagged visually in the admin UI as unresolved.

**Notification routing:**
- Tour-specific notifications (booking changes, cancellations, Maybe deadline events, post-deadline "I can't go" reports) are sent to assigned admins only
- If no admins are assigned to a tour, no tour-specific notifications are sent for that tour

**Data:**
- Assignment stored as a many-to-many relation between admins and tours
- Staff in charge stored as a single foreign key on the tour record
- Visible to all admins in tour detail view
- Not visible to buddies

---

## 8. Booking System

### 8.1 Booking Statuses

| Status | Meaning | Who sets it |
|---|---|---|
| **Confirmed** | Definitely attending | Buddy |
| **Maybe** | Tentative; must resolve by admin-set deadline | Buddy |
| **Waitlist** | Join only if a seat opens | Buddy |
| **Declined** | Opted out or cancelled | Buddy or Admin |

### 8.2 Seat Counts

Buddies can see all status counts per tour (Confirmed / Maybe / Waitlist / Declined) but never see who else has booked.

**Remaining seats** = `capacity − confirmed`. Only Confirmed bookings count against capacity. Maybe and Waitlist do not consume a seat.

### 8.3 Booking Rules

- One booking status per buddy per tour
- Only **Active** buddies can book
- Booking open while tour is Published and cancellation deadline has not passed
- Admin can override cancellation deadline per buddy
- **Cancellation deadline takes precedence:** Once the cancellation deadline passes, the "Maybe" status becomes unavailable (cannot be selected or changed to). Buddies in confirmed status may not transition to maybe. This is because after the cancellation deadline, buddies are expected to attend regardless of their prior maybe status — no cancellation is permitted.
- **Post-deadline "I can't go":** After the cancellation deadline has passed, buddies can still report that they cannot attend via the system. The buddy submits a reason (category + optional free text), and the status is changed to Declined immediately — no admin confirmation required. Assigned admins are notified immediately via all configured channels (no digest delay). This is treated as high-priority due to likely operational impact.

### 8.4 Status Transition Matrix

| From \ To | Confirmed | Maybe | Waitlist | Declined |
|---|---|---|---|---|
| Confirmed | — | ✅ | ✅ | ✅ (until deadline) |
| Maybe | ✅ | — | ✅ | ✅ |
| Waitlist | ✅ | ✅ | — | ✅ |
| Declined | ✅ | ✅ | ✅ | — |

All transitions allowed before cancellation deadline. After deadline, buddies can only transition to Declined (via "I can't go" report). All other status changes after deadline require admin action.

### 8.5 Maybe Flow

1. Buddy selects "Maybe" (only available before cancellation deadline)
2. Admin sets a **Maybe confirmation deadline** per tour (default offset: 9 days before tour if not set; configurable globally)
3. Buddy receives reminders at **3 days** and **1 day** before the deadline (configurable globally and per tour)
4. Buddy must update to **Confirmed** or **Declined** before deadline
5. If no action taken by deadline, booking status remains **Maybe** and assigned admins are notified to follow up manually
6. **After cancellation deadline:** The maybe deadline becomes irrelevant. The "Maybe" status is no longer available, and buddies in confirmed status cannot transition to maybe (they are committed to attending). Buddies in maybe status who have not resolved must attend.

### 8.6 Waitlist Flow

1. Buddy selects "Waitlist"
2. When a cancellation opens a seat, all Waitlisted buddies are notified simultaneously
3. Buddy manually updates to **Confirmed** to claim the seat
4. First to confirm gets the seat — server handles concurrent attempts atomically; the second attempt fails and that buddy remains on Waitlist (promoted to first position in queue)

### 8.7 Cancellation & Cancellation Reasons

- Buddies can cancel (change status to Declined) up to the cancellation deadline
- After the cancellation deadline, buddies can still submit an "I can't go" report — status changes to Declined immediately; assigned admins are notified urgently
- When any status changes **to Declined from Confirmed** — whether initiated by the buddy or by an admin, before or after deadline — a **cancellation reason** must be recorded
- Cancellation reason fields:

| Field | Type | Notes |
|---|---|---|
| Reason category | Enum | `health` / `emergency` / `personal` / `work` / `other` |
| Free text | Text | Optional — buddy's own explanation |
| Unavoidable flag | Boolean | Set by admin only; no auto-logic |
| Recorded by | User ref | Auto-filled (buddy or admin) |

- No category is automatically flagged as unavoidable — it is always a human (admin) judgement
- Buddies may provide a free-text explanation when cancelling; this is optional
- Admin reviews context and sets the unavoidable flag accordingly; admin can update it at any time

### 8.8 Booking History

- All past bookings stored permanently per buddy — records are never deleted
- History grows steadily — DB design must account for this
- Admins view full booking history for any buddy
- Buddies view their own history only

### 8.9 Tier-Based Booking System

Buddies book tours via the tier-based seat pool system. The system auto-assigns a `confirmed` booking or creates a `waitlist` booking based on pool availability.

There is no separate Application entity — a `Booking` row is created immediately on signup, with status `confirmed` or `waitlist`.

#### Eligibility

- Only **Active** buddies with a tier assigned can book
- **Trainee** tier cannot book (they cannot participate in tours yet)
- Only when tour is **Published** and `bookingOpen = true`

#### Seat Pools

Total tour capacity is split into three pools:

| Pool | Who fills it | Default % |
|---|---|---|
| **Junior** | `junior` tier only | 20% |
| **Non-junior** | `mid`, `senior`, `expert`, `instructor`, `organizer` | 30% |
| **Anyone** | Any eligible tier (overflow from either pool) | 50% |

Percentages default to 20/30/50 for all tours. Per-tour overrides are supported via the `TierCapacity` table (`pool: BookingPool, percent: Int`). Override rules:

- Either use all defaults (no `TierCapacity` rows for the tour), or provide all three pools explicitly
- All three percentages must sum to 100% — partial overrides are not allowed
- The `anyone` pool is the shared overflow — both junior and non-junior buddies can fill from it once their respective pools are full

#### Assignment Logic

When a buddy books, the system immediately determines their slot:

1. **Junior buddy**: check junior pool → if full, check anyone pool → if full, `waitlist`
2. **Non-junior buddy**: check non-junior pool → if full, check anyone pool → if full, `waitlist`

A `Booking` row is created with the result. `Booking.buddyTier` is frozen at booking time to ensure pool counts remain stable even if the buddy's tier changes later.

#### Booking Statuses

| Status | Meaning |
|---|---|
| `confirmed` | Got a slot in a pool. |
| `waitlist` | All relevant pools were full. Buddy waits. |
| `maybe` | Buddy marked themselves as uncertain (post-booking). |
| `declined` | Buddy cancelled. Row is kept and reused on re-book. |

#### Cancellation

- Buddy can cancel at any time while `waitlist` or `confirmed`
- Cancelling a `confirmed` booking frees a pool slot and triggers promotion
- After cancel, re-book is allowed if any vacancy exists in the buddy's pool or the anyone pool
- Status is set to `declined` on cancel; the booking row is reused on re-book (upsert)

#### Promotion

When a `confirmed` booking is cancelled:

1. The freed pool slot is identified by the cancelled buddy's tier
2. The earliest `waitlist` booking from the same pool is promoted to `confirmed`
3. If no waitlisted buddy exists in that pool, the anyone pool is checked

#### UI Entry Point

- `/dashboard/tours/[id]` — the tour detail page
- When no booking exists and tour is published and `bookingOpen`: show Book button
- When `waitlist`: show waitlist status badge and cancel option
- When `confirmed`: show confirmed status, cancel and set-maybe options
- No separate booking history page — buddy reaches history via tour list

---

## 9. Evaluation System

### 9.1 Overview

There are two distinct evaluation types: **admin evaluations** (internal, hidden from buddies) and **buddy self-evaluations** (visible to admins and the buddy themselves).

### 9.2 Admin Evaluations

#### Types

| Type | Trigger | Notes |
|---|---|---|
| **Per-tour evaluation** | After a specific tour | Linked to a tour record |
| **General profile evaluation** | Anytime | Not tied to a specific tour |

#### Fields

All score fields use the scale: **1 = Needs Improvement / 2 = Developing / 3 = Proficient / 4 = Advanced / 5 = Exceptional**. All text fields are optional.

| Field | Score | Text | Notes |
|---|---|---|---|
| Overall rating | 1–5 | ✅ | |
| Reliability | 1–5 | ✅ | Admin eval only |
| Communication | 1–5 | ✅ | |
| Group engagement | 1–5 | ✅ | |
| Memory | 1–5 | ✅ | Remembering names, details, preferences |
| Knowledge | 1–5 | ✅ | Content accuracy and depth |
| Dedication | 1–5 | ✅ | Effort and commitment |
| Dialogue | 1–5 | ✅ | **Core differentiating skill** — buddies open a genuine dialogue with participants, not just a one-way tour |
| Adaptability | 1–5 | ✅ | Handling unexpected situations |
| Emotion | — | ✅ | Warmth, empathy, expressiveness — cannot be meaningfully scored |
| Confidence | 1–5 | ✅ | |
| Evaluator | — | — | Auto-filled from submitting admin's email (`createdByEmail`). Display name deferred — see §15. |
| Date | — | — | Auto-filled |

#### Access
- Only admins can create, read, or edit admin evaluations
- Buddies have no visibility into admin evaluations

#### Multi-admin ownership
- Each admin submits their own independent evaluation; uniqueness is `(buddyId, tourId, createdBy)`
- An admin can only edit or delete their own evaluations; other admins see them as read-only
- Display name for evaluator is deferred until admin profile is built (§15); `createdByEmail` is shown in the meantime

#### Post-completion prompt (UX)
- When an admin clicks **Mark Complete**, a single confirmation modal appears showing the list of confirmed buddies
- Admin confirms in that modal; the tour is marked completed and the page refreshes
- The existing evaluation section on the tour detail page serves as the natural prompt to add evaluations — no second modal is shown

### 9.3 Buddy Self-Evaluations

#### Trigger
- When a tour is marked **Completed**, buddies who had **Confirmed** status receive a prompt to submit a self-evaluation for that tour
- Prompt is optional — buddy can skip

#### Fields

Same scale as admin evaluations: **1 = Needs Improvement / … / 5 = Exceptional**. All text fields are optional. Reliability is admin-only and does not appear here.

| Field | Score | Text |
|---|---|---|
| Overall rating | 1–5 | ✅ |
| Communication | 1–5 | ✅ |
| Group engagement | 1–5 | ✅ |
| Memory | 1–5 | ✅ |
| Knowledge | 1–5 | ✅ |
| Dedication | 1–5 | ✅ |
| Dialogue | 1–5 | ✅ |
| Adaptability | 1–5 | ✅ |
| Emotion | — | ✅ |
| Confidence | 1–5 | ✅ |
| Date | — | Auto-filled |

#### Access
- Buddies can submit and view their own self-evaluations
- Admins can view all buddy self-evaluations
- Buddies cannot see other buddies' self-evaluations

---

## 10. Notifications

### 10.1 Buddy Notifications

| Event | Channel | Timing |
|---|---|---|
| New tour published | In-app + email | Immediately on publish |
| Tour details changed (date/time/location) | In-app + email | Immediately on edit; sent to all Confirmed/Maybe/Waitlist buddies |
| Tour reminder | In-app + email | Configurable per tour; default: 3 days before and 1 day before |
| Maybe deadline reminder | In-app + email | Configurable; before Maybe confirmation deadline |
| Waitlist seat opened | In-app + email | Immediately on cancellation |
| Account approved / rejected | Email | On admin decision |

### 10.2 Admin Notifications

Admins independently configure their preferred notification channel(s) and delivery mode per event type. Tour-specific events (booking changes, cancellations, post-deadline reports) are routed to **assigned admins only**. If no admins are assigned to a tour, no tour-specific notifications are sent.

| Event | Available Channels | Default Timing |
|---|---|---|
| New buddy signup (pending) | Email and/or Slack | Immediate |
| New booking | Email and/or Slack | See below |
| Booking cancelled (Confirmed → Declined) — before deadline | Email and/or Slack | Immediate |
| Post-deadline "I can't go" report | Email and/or Slack | **Always immediate — no digest option** |
| Maybe → Confirmed or Declined | Email and/or Slack | Immediate |
| Maybe deadline passed unresolved | Email and/or Slack | On deadline |

**Email delivery modes (configurable per admin per event):**
- **Immediate:** Email sent at time of event
- **Daily digest:** Single email at 9:00 AM JST covering all activity from the previous day; only sent if there was activity

**Default email delivery modes:**
- Cancellations and Maybe resolutions: Immediate
- New bookings and new signups: Daily digest
- Post-deadline "I can't go" reports: Always immediate (not configurable)

Slack notifications are always immediate when enabled.

**Channel config:** Each admin independently sets their preferred channels (email, Slack, or both) and delivery mode (immediate or digest) per event type in account settings.

---

## 11. Admin Dashboard

### 11.1 Buddy Home Screen

When a buddy logs in, they see:
- Upcoming tours with current status counts and remaining seats
- Their current bookings and statuses
- Access to their profile and history

### 11.2 Tour Management
- Create, edit, publish, cancel, complete tours
- View all bookings per tour (buddy name, status, booking time)
- Set / override cancellation deadlines (per tour and per buddy)
- Set Maybe confirmation deadlines
- Configure per-tour notification schedule
- Add / edit admin-only memo
- Assign / unassign admins to a tour
- Designate staff in charge from assigned admins

### 11.3 Group Management
- Create, edit groups
- View group tour history
- Manage contact info and notes

### 11.4 Buddy Management

#### Pages & Routes

**Flat navigation:** Both "Pending Approval" and "Buddies" shown as separate top-level menu items.

| Route | Purpose | Access |
|---|---|---|
| `/admin/buddies/pending` | Approval queue — pending signups awaiting admin decision | Admin only |
| `/admin/buddies` | Buddy roster — all approved (active) buddies with tier management | Admin only |
| `/admin/buddies/:id` | Buddy detail — full profile, tier/notes editor, booking history | Admin only |

#### Pending Approval Page (`/admin/buddies/pending`)

- **Table:** displayName, email, [Approve] [Reject]
- **Sortable by:** name, email
- **Actions:**
  - **Approve** → sets status=active, assigns default tier=trainee, removes from pending queue, adds to buddy roster
  - **Reject** → sets status=rejected, removes from pending queue (terminal state)

#### Buddy Roster (`/admin/buddies`)

- **Table:** displayName, email, tier, [View Detail]
- **Sortable by:** name, email, tier, status
- **Actions:** Click row → navigate to detail page

#### Buddy Detail Page (`/admin/buddies/:id`)

**Display section:**
- Real name
- Email
- Status (active / suspended / rejected)
- Tier (trainee / junior / mid / senior / expert / instructor / organizer)
- Internal notes
- Created date
- Full booking history (table of tours + booking status) — see below

**Edit form:**
- Tier dropdown (nullable; only set when status=active)
- Internal notes textarea
- [Save] [Cancel]

**Booking history table:**
- Columns: Group name (linked to `/admin/tours/:id`), Tour date, Location, Booking status
- Sortable by: group name, tour date, booking status
- Default sort: tour date descending (most recent first)
- Shows all bookings regardless of booking or buddy status — no filter
- Empty state: "No bookings"
- API: `GET /admin/buddies/:id` returns `AdminBuddyDetailResponse` (extends `AdminBuddyResponse` with `bookings: AdminBuddyBookingEntry[]`)

**`AdminBuddyBookingEntry` fields:** `id`, `tourId`, `status` (BookingStatus), `bookedAt`, `tour: { tourDate, location, group: { name }, status }`

#### API Endpoints

Note: frontend page routes and API endpoints are separate layers. `/admin/buddies/pending` is a Next.js page URL; the underlying API call uses query parameters, consistent with the rest of the codebase (e.g. `/admin/tours?status=...`).

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/buddies?status=pending` | List pending buddies (called by the `/admin/buddies/pending` page) |
| `GET` | `/admin/buddies?status=active` | List active buddies (called by the `/admin/buddies` page) |
| `GET` | `/admin/buddies/:id` | Fetch buddy detail |
| `PUT` | `/admin/buddies/:id/status` | Change status (approve/reject/suspend) |
| `PUT` | `/admin/buddies/:id` | Update tier and internalNotes |

#### Business Rules

- **Approval:** Only admins can approve/reject pending buddies
- **Tier assignment:** Tier is set automatically to `trainee` on approval; admin can update anytime thereafter
- **Internal notes:** Admins only; never visible to buddies
- **Status transitions:**
  - Pending → Active (via Approve button)
  - Pending → Rejected (via Reject button, terminal)
  - Active → Suspended (via detail page)
  - Suspended → Active (via detail page)
- **Tier constraints:** Tier values are: trainee, junior, mid, senior, expert, instructor, organizer
- **Typical flow:** Pending → Active (tier: trainee) → Admin updates tier as buddy gains experience
- **Data retention:** Buddies are never deleted; all history retained even after rejection or suspension

### 11.5 System Configuration (Super Admin only)
- Manage admin accounts and roles
- Global defaults (cancellation deadline offset, Maybe deadline offset, notification schedule offsets)
- Notification channel and delivery mode defaults

### 11.6 Buddy Profile Settings

#### Route

`/dashboard/profile` — accessible to all authenticated buddies (any status)

Nav item: "Profile" in buddy shell sidebar (alongside "Dashboard").

#### Page Layout

**Read-only display section** (not editable inline):
- Account status badge
- Tier (hidden — not shown to buddy)
- Member since date

**Edit form** (`PUT /me/profile`):

| Field | Widget | Notes |
|---|---|---|
| Display name | Text input | |
| Real name | Text input | |
| Bio | Textarea | |
| Contact info | Text input | |
| Languages | Checkbox group | Ordered by `LanguageSchema.options`; priority tier (en/ko/zh) shown first |
| Skills & interests | Textarea | One skill per line; split on `\n` before submit; joined with `\n` for display |
| Availability | Textarea | Free text |
| Profile photo | Disabled input | "GCP Cloud Storage — coming soon" placeholder; `photoUrl` not sent in PUT body until upload is wired |

`[Save]` `[Cancel]`

After save: stay on page, refetch profile, show inline success message. Cancel navigates to `/dashboard`.

#### API

Uses existing endpoints — no new API work required:

| Method | Path | Description |
|---|---|---|
| `GET` | `/me/profile` | Fetch own profile |
| `PUT` | `/me/profile` | Update self-managed fields |

#### Module Boundaries

```
apps/web/src/app/[locale]/dashboard/profile/
  dashboard.profile.ts          ← fetchMyProfile, updateMyProfile (thin functions)
  dashboard.profile.test.ts     ← unit tests
  page.tsx                      ← fetch on mount, render <ProfileForm />
  _components/
    profile-form.tsx             ← form state + submit handler
```

New additions:
- `apiClient.getMyProfile` + `apiClient.updateMyProfile` in `api-client.ts`
- `routes.dashboardProfile` in `routes.ts`
- `shell.nav.profile` + `profile.*` + `languages.*` keys in `en.json` and `ja.json`

#### i18n Namespaces

- `profile.*` — all profile page strings (field labels, placeholders, errors, photo coming-soon text)
- `languages.*` — language display names (separate namespace for reuse in admin buddy detail)

---

## 12. Internationalisation

- i18n from day one
- **Default language:** Japanese (`ja`)
- **Languages at launch:** Japanese (`ja`), English (`en`)
- All UI strings in locale JSON files
- Date, time, number formats respect locale
- Language switching in user settings
- Email templates localised

**Implementation:** `next-intl`

---

## 13. Tech Stack

### 13.1 Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js (App Router) | UI only — no business logic; web-first, mobile-responsive PWA |
| Backend | Hono | Dedicated REST API; all business logic, auth middleware, Prisma access |
| Repo | Monorepo (pnpm workspaces) | `apps/web`, `apps/api`, `packages/types`, `prisma/` |
| Hosting | GCP Cloud Run | Both services; via GCP nonprofit credits |
| Database | GCP Cloud SQL (Postgres) | Via GCP nonprofit credits |
| ORM | Prisma | Lives in `apps/api`; schema in `prisma/` |
| Auth | Firebase Auth | Google + Apple OAuth; token validated in Hono middleware |
| File storage | GCP Cloud Storage | Profile photos; via nonprofit credits |
| Scheduled jobs | GCP Cloud Scheduler | Hits Hono API routes for reminders, deadline checks, digest flush |
| Email | Resend or Gmail API (abstracted) | Single `sendEmail()` utility in `apps/api`; decide during build |
| Slack notifications | Slack Incoming Webhooks | Admin notifications; fired from `apps/api` |
| Shared types | Zod + TypeScript (`packages/types`) | Shared between frontend and backend |
| i18n | next-intl | Frontend only |
| CI/CD | GitHub Actions | Via GitHub nonprofit free Team plan |

### 13.2 Nonprofit Programs to Apply For

| Service | Program |
|---|---|
| GCP / Firebase | Google for Nonprofits (via TechSoup) |
| GitHub | GitHub for Nonprofits |
| Twilio / SendGrid | Twilio.org (backup email option) |

### 13.3 Email Abstraction

A single `sendEmail()` utility wraps the email provider. Switching providers requires changes in one file only.

### 13.4 Migration Path

When GCP nonprofit credits run low:
- Cloud Run → small always-on instance (~$5–10/mo)
- Cloud SQL → retain or migrate to Supabase Pro ($25/mo, same Postgres)
- Same Prisma schema throughout — minimal migration effort

### 13.5 Mobile Strategy

| Phase | Approach |
|---|---|
| v1 | Web-first, mobile-responsive PWA (Next.js) |
| v1.5+ | Evaluate Flutter native app against the same Postgres backend via API |
| Future | App Store / Play Store — out of scope until explicitly prioritised |

---

## 14. Data Migration

- **Source:** Google Sheets (buddy profile data)
- **Scope:** Buddy profiles only at launch
- **Process:**
  1. Export Google Sheets to CSV
  2. Map fields to Prisma schema
  3. Run one-time import script
  4. Admin reviews and fills missing fields via dashboard
  5. Buddies complete profiles after first login

---

## 15. Future Roadmap

| Version | Feature |
|---|---|
| v1.5 | Calendar integration (Google Calendar, Apple Calendar) |
| v1.5 | PWA improvements |
| v2+ | Native mobile app (Flutter) |
| v2+ | Reporting / export for admins |
| v2+ | Advanced evaluation analytics |
| v2+ | Structured availability input for buddy profiles |
| v2+ | Admin profile page (display name, avatar) — enables showing evaluator name instead of email in evaluation records |

---

## 16. Out of Scope (v1)

- Participant-facing features
- Travel agency integration
- Calendar integration (v1.5)
- Native mobile apps (post-v1.5)
- Advanced analytics or reporting
- Peer evaluations
- Automated waitlist assignment
- Payment or compensation tracking
- Structured availability input (free text in v1)

---

## 17. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Final enum values for evaluation fields (admin and self-evaluation) | Team | **Resolved** — see §9 |
| 2 | Exact fields to migrate from Google Sheets | Team | Open |
| 3 | Slack workspace / webhook setup | Admin | Open |
| 4 | Apple Developer account for Apple login | Dev | Open |
| 5 | Default Maybe confirmation deadline offset (days before tour) | Team | **Resolved** — 9 days before tour; reminders at 3 days + 1 day before deadline. Cancellation deadline defaults to 7 days before (always after Maybe deadline). |
| 6 | Cancellation reason category enum values | Team | **Resolved** — `health` / `emergency` / `personal` / `work` / `other` |
| 7 | Group type enum values — School / Company / Community / Other sufficient? | Team | **Resolved** — confirmed as-is |
| 8 | Internal tier names | Team | **Resolved** — `junior` / `mid` / `senior` / `expert` / `instructor` / `organizer` |
| 9 | When no admins are assigned to a tour, should post-deadline "I can't go" reports notify all admins as a fallback? | Team | **Resolved** — no fallback; notification only goes to assigned admins. Tours without assigned admins flagged visually in UI as unresolved. |
| 10 | Tier-based booking pool split percentages | Team | **Resolved** — junior 20%, non-junior 30%, anyone 50%. See §8.9. |
| 11 | Can a buddy re-book after cancelling? | Team | **Resolved** — yes, if a vacancy exists in their pool or the anyone pool. See §8.9. |
| 12 | What happens when `mentorshipBalanced = false` and a buddy books? | Team | **Resolved** — `mentorshipBalanced` flag removed entirely. All tours always use the 3-pool system. Default percentages (20/30/50) apply when no `TierCapacity` rows exist for the tour. |
| 13 | Should per-tour pool percentage overrides be partial or all-or-nothing? | Team | **Resolved** — all-or-nothing. A tour either uses all defaults (no rows) or provides all 3 pools summing to 100%. |
