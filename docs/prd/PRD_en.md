# Product Requirements Document
## Buddy Booking App

**Version:** 0.3 (MVP)
**Last Updated:** 2026-04-18
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
| **Trainee** | Approved, currently in training — not yet eligible to book or lead tours |
| **Active** | Cleared to book and lead tours |
| **Suspended** | Temporarily or permanently deactivated |

Status is set manually by admin. Typical progression: Pending → Trainee → Active.

Buddies are never deleted from the database. Suspended accounts remain in the DB with all history intact.

**Trainee access:** Trainees can log in and view the tour list (including status counts and remaining seats) but cannot make bookings.

### 5.2 Internal Tier (admin-managed, hidden from buddies)

Once Active, an internal tier is assigned and updated manually by admin:

| Tier | Description |
|---|---|
| **Junior** | Recently activated, limited experience |
| **Mid** | Comfortable with regular tours |
| **Senior** | Experienced, handles complex groups |
| **Expert** | Top-tier, can mentor others |

Tier is for internal reference only — buddies have no visibility.

### 5.3 Self-Managed Fields (edited by buddy)

| Field | Type | Notes |
|---|---|---|
| Display name / nickname | Text | Chosen by buddy |
| Real name | Text | For admin reference |
| Profile photo | Image upload | Stored in GCP Cloud Storage |
| Bio | Long text | Free description |
| Contact info | Text / Email | Preferred contact method |
| Languages spoken | Multi-select enum | e.g. Japanese, English, Korean… |
| Skills & interests | Multi-select + free text | e.g. history, sports, music… |
| Availability | Free text | General availability notes (v1); structured input in future |

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
| Cancellation deadline | Date | Set per tour; overridable per buddy by admin |
| Maybe confirmation deadline | Date | Deadline for "Maybe" buddies to confirm or decline |
| Notification schedule | List of offsets | Days-before-tour offsets; default: 3 days before and 1 day before; configurable per tour |
| Status | Enum | Draft / Published / Cancelled / Completed |

### 7.2 Tour Status Lifecycle

- **Draft:** Editable, not visible to buddies. Can be published or deleted.
- **Published:** Visible to and bookable by Active buddies. Can be edited, cancelled, or completed.
- **Cancelled:** Booking closed. All buddies with status Confirmed, Maybe, or Waitlist are notified automatically. No further edits.
- **Completed:** Booking closed. Admin is prompted to submit evaluations for participating buddies.

### 7.3 Rules
- Only admins can create, edit, cancel, or complete tours
- Tours must be **Published** before Active or Trainee buddies can see them
- Only **Active** buddies can book tours

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

### 8.4 Status Transition Matrix

| From \ To | Confirmed | Maybe | Waitlist | Declined |
|---|---|---|---|---|
| Confirmed | — | ✅ | ✅ | ✅ (until deadline) |
| Maybe | ✅ | — | ✅ | ✅ |
| Waitlist | ✅ | ✅ | — | ✅ |
| Declined | ✅ | ✅ | ✅ | — |

All transitions allowed before cancellation deadline. After deadline, only admin can change status.

### 8.5 Maybe Flow

1. Buddy selects "Maybe"
2. Admin sets a **Maybe confirmation deadline** per tour (default offset: 3 days before tour if not set; configurable globally)
3. Buddy receives reminder as deadline approaches
4. Buddy must update to **Confirmed** or **Declined** before deadline
5. If no action taken by deadline, admin is notified to follow up

### 8.6 Waitlist Flow

1. Buddy selects "Waitlist"
2. When a cancellation opens a seat, all Waitlisted buddies are notified simultaneously
3. Buddy manually updates to **Confirmed** to claim the seat
4. First to confirm gets the seat — no automatic assignment

> **Note:** Tiebreaker policy for simultaneous claims is TBD. The server must handle concurrent confirmation attempts atomically to prevent overbooking. See Open Questions.

### 8.7 Cancellation & Cancellation Reasons

- Buddies can cancel (change status to Declined) up to the cancellation deadline
- When any status changes **to Declined from Confirmed** — whether initiated by the buddy or by an admin — a **cancellation reason** must be recorded
- Cancellation reason fields:

| Field | Type | Notes |
|---|---|---|
| Reason category | Enum | Physical condition (illness / injury) / Personal / Work conflict / Other |
| Free text | Text | Required when category is "Other"; optional otherwise |
| Unavoidable flag | Boolean | Driven by category; admin can override |
| Recorded by | User ref | Auto-filled (buddy or admin) |

- **Physical condition** (illness, injury) is automatically flagged as unavoidable and excluded from reliability metrics
- Admin can manually override the unavoidable flag for any reason
- Cancellation reason categories are TBD (placeholders above); to be finalised before development

After deadline, only admin can change status. Reason recording applies in all cases.

### 8.8 Booking History

- All past bookings stored permanently per buddy — records are never deleted
- History grows steadily — DB design must account for this
- Admins view full booking history for any buddy
- Buddies view their own history only

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

#### Fields (v1, to be refined)

| Field | Type | Notes |
|---|---|---|
| Overall rating | Enum | e.g. Excellent / Good / Fair / Poor (placeholder) |
| Reliability | Enum | TBD options |
| Communication | Enum | TBD options |
| Group engagement | Enum | TBD options |
| Free text notes | Long text | Open comments |
| Evaluator | Admin ref | Auto-filled |
| Date | Date | Auto-filled |

> **Note:** Specific enum values to be defined by the team before development begins.

#### Access
- Only admins can create, read, or edit admin evaluations
- Buddies have no visibility into admin evaluations

#### Evaluation Prompt
- When admin marks a tour **Completed**, they are prompted with a list of participating buddies
- Admin selects which buddies to evaluate (can skip any or all)
- Prompt is optional — admin can dismiss entirely

### 9.3 Buddy Self-Evaluations

#### Trigger
- When a tour is marked **Completed**, the buddy receives a prompt to submit a self-evaluation for that tour
- Prompt is optional — buddy can skip

#### Fields (v1, to be refined — placeholder structure)

| Field | Type | Notes |
|---|---|---|
| Overall self-rating | Enum | e.g. Excellent / Good / Fair / Poor (placeholder) |
| What went well | Long text | Free text |
| What could be improved | Long text | Free text |
| Date | Date | Auto-filled |

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
| Tour reminder | In-app + email | Configurable per tour; default: 3 days before and 1 day before |
| Maybe deadline reminder | In-app + email | Configurable; before Maybe confirmation deadline |
| Waitlist seat opened | In-app + email | Immediately on cancellation |
| Account approved / rejected | Email | On admin decision |

### 10.2 Admin Notifications

Admins independently configure their preferred notification channel(s) and delivery mode per event type.

| Event | Available Channels | Default Timing |
|---|---|---|
| New buddy signup (pending) | Email and/or Slack | Immediate |
| New booking | Email and/or Slack | See below |
| Booking cancelled (Confirmed → Declined) | Email and/or Slack | Immediate |
| Maybe → Confirmed or Declined | Email and/or Slack | Immediate |
| Maybe deadline passed unresolved | Email and/or Slack | On deadline |

**Email delivery modes (configurable per admin per event):**
- **Immediate:** Email sent at time of event
- **Daily digest:** Single email at 9:00 AM covering all activity from the previous day; only sent if there was activity

**Default email delivery modes:**
- Cancellations and Maybe resolutions: Immediate
- New bookings and new signups: Daily digest

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

### 11.3 Group Management
- Create, edit groups
- View group tour history
- Manage contact info and notes

### 11.4 Buddy Management
- View all profiles (full detail: status, tier, admin evaluations, self-evaluations)
- Approve / reject pending signups
- Set / update account status and internal tier
- Edit admin-managed fields
- View booking history per buddy
- Submit and view admin evaluations

### 11.5 System Configuration (Super Admin only)
- Manage admin accounts and roles
- Global defaults (cancellation deadline offset, Maybe deadline offset, notification schedule offsets)
- Notification channel and delivery mode defaults

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
| Framework | Next.js (App Router) | Web-first, mobile-responsive PWA |
| Hosting | GCP Cloud Run | Via GCP nonprofit credits |
| Database | GCP Cloud SQL (Postgres) | Via GCP nonprofit credits |
| ORM | Prisma | Type-safe; works cleanly with Postgres + Next.js |
| Auth | Firebase Auth | Google + Apple OAuth; GCP ecosystem |
| File storage | GCP Cloud Storage | Profile photos; via nonprofit credits |
| Scheduled jobs | GCP Cloud Scheduler | Reminders, deadline checks, digest emails |
| Email | Resend or Gmail API (abstracted) | Single `sendEmail()` utility; decide during build |
| Slack notifications | Slack Incoming Webhooks | Admin notifications |
| i18n | next-intl | |
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
| 1 | Final enum values for evaluation fields (admin and self-evaluation) | Team | Open |
| 2 | Exact fields to migrate from Google Sheets | Team | Open |
| 3 | Slack workspace / webhook setup | Admin | Open |
| 4 | Apple Developer account for Apple login | Dev | Open |
| 5 | Default Maybe confirmation deadline offset (days before tour) | Team | Open |
| 6 | Waitlist tiebreaker policy (timestamp order, claim window, or admin decides) | Team | Open |
| 7 | Auto-escalation when Maybe deadline passes with no action | Team | Open |
| 8 | Cancellation reason category enum values | Team | Open |
| 9 | Group type enum values — School / Company / Community / Other sufficient? | Team | Open |
| 10 | Internal tier names — Junior / Mid / Senior / Expert final? | Team | Open |
