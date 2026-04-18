# Data Model

See PRD §5–9 for field definitions and business rules. This document covers DB-level schema design: entity relationships, constraints, indexes, and infrastructure-only entities not described in the PRD.

## Entity Overview

```
User (role: buddy / admin / super_admin)
 │
 ├── BuddyProfile [1:1, buddy only]
 │     ├── Booking ──────────────────── Tour ──── Group
 │     │     ├── CancellationReason       │
 │     │     └── BuddyCancellationDeadlineOverride
 │     ├── SelfEvaluation ───────────────┘
 │     └── AdminEvaluation (subject)
 │
 ├── AdminEvaluation (evaluatorId) [admin only]
 ├── NotificationPreference       [admin only]
 ├── Notification
 └── DigestQueue                  [admin only]
```

## Schema

### User
Not in PRD. Core identity record shared by buddies and admins.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| firebaseUid | String | Unique |
| email | String | |
| role | Enum | `buddy` / `admin` / `super_admin` |
| createdAt | Timestamp | |

### BuddyProfile

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| userId | UUID | FK → User, Unique |
| status | Enum | `pending` / `trainee` / `active` / `suspended` |
| tier | Enum? | `junior` / `mid` / `senior` / `expert` |
| displayName | String | |
| realName | String | |
| photoUrl | String? | |
| bio | Text? | |
| contactInfo | String? | |
| languages | String[] | |
| skills | String[] | |
| availability | Text? | |
| internalNotes | Text? | |
| createdAt | Timestamp | |
| updatedAt | Timestamp | |

### Group

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| name | String | |
| type | Enum | `school` / `company` / `community` / `other` |
| contactName | String? | |
| contactEmail | String? | |
| contactPhone | String? | |
| notes | Text? | |
| createdAt | Timestamp | |
| updatedAt | Timestamp | |

### Tour

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| groupId | UUID | FK → Group |
| status | Enum | `draft` / `published` / `cancelled` / `completed` |
| tourDate | Date | |
| meetingTime | Time | |
| location | String | |
| capacity | Int | |
| description | Text? | |
| adminMemo | Text? | |
| cancellationDeadline | Date | |
| maybeDeadline | Date? | |
| notificationOffsets | Int[] | |
| createdAt | Timestamp | |
| updatedAt | Timestamp | |

### Booking

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| buddyId | UUID | FK → BuddyProfile |
| tourId | UUID | FK → Tour |
| status | Enum | `confirmed` / `maybe` / `waitlist` / `declined` |
| bookedAt | Timestamp | |
| updatedAt | Timestamp | |

**Unique:** `(buddyId, tourId)`

Waitlist seat claim uses a DB transaction with row lock on the Tour capacity count to prevent overbooking.

### CancellationReason

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| bookingId | UUID | FK → Booking, Unique |
| category | Enum | `physical` / `personal` / `work` / `other` — TBD |
| freeText | Text? | |
| unavoidable | Boolean | |
| recordedBy | UUID | FK → User |
| createdAt | Timestamp | |

### AdminEvaluation

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| buddyId | UUID | FK → BuddyProfile |
| tourId | UUID? | FK → Tour |
| evaluatorId | UUID | FK → User |
| overallRating | Enum | TBD |
| reliability | Enum? | TBD |
| communication | Enum? | TBD |
| groupEngagement | Enum? | TBD |
| notes | Text? | |
| createdAt | Timestamp | |

No unique constraint on `(buddyId, tourId, evaluatorId)` — multiple admin evaluations per buddy per tour are allowed.

### SelfEvaluation

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| buddyId | UUID | FK → BuddyProfile |
| tourId | UUID | FK → Tour |
| overallRating | Enum | TBD |
| wentWell | Text? | |
| improve | Text? | |
| createdAt | Timestamp | |

**Unique:** `(buddyId, tourId)`

### BuddyCancellationDeadlineOverride
Not in PRD. Stores per-buddy overrides of a tour's cancellation deadline.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| buddyId | UUID | FK → BuddyProfile |
| tourId | UUID | FK → Tour |
| deadline | Date | |
| setBy | UUID | FK → User (admin) |
| createdAt | Timestamp | |

**Unique:** `(buddyId, tourId)`

### NotificationPreference
Not in PRD. Per-admin, per-event channel and delivery mode configuration.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| adminId | UUID | FK → User |
| eventType | Enum | `new_signup` / `new_booking` / `cancellation` / `maybe_resolved` / `maybe_deadline_missed` |
| emailEnabled | Boolean | |
| emailMode | Enum | `immediate` / `digest` |
| slackEnabled | Boolean | |

**Unique:** `(adminId, eventType)`

### Notification
Not in PRD. In-app notifications for buddies and admins.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| userId | UUID | FK → User |
| type | Enum | |
| payload | JSON | |
| readAt | Timestamp? | |
| createdAt | Timestamp | |

### DigestQueue
Not in PRD. Pending items for admin daily digest emails.

| Field | Type | Constraints |
|---|---|---|
| id | UUID | PK |
| adminId | UUID | FK → User |
| eventType | Enum | |
| payload | JSON | |
| flushedAt | Timestamp? | |
| createdAt | Timestamp | |

## Indexes

| Table | Index | Reason |
|---|---|---|
| Booking | `(tourId, status)` | Seat count queries |
| Booking | `(buddyId, tourId)` | Covered by unique constraint |
| Booking | `(tourId, status, updatedAt)` | Waitlist queue ordering |
| Notification | `(userId, readAt)` | Unread count |
| DigestQueue | `(adminId, flushedAt)` | Pending digest fetch |
| Tour | `(status, tourDate)` | Published upcoming tours |

## Soft Delete Policy

| Entity | Policy |
|---|---|
| BuddyProfile | Never hard-deleted — use `status = suspended` |
| Booking | Never hard-deleted |
| Tour | Draft → hard delete allowed; Published/Cancelled/Completed → never deleted |
| Group | No delete in v1 |
| Evaluations | No delete in v1 |
