# API Routes

All routes are served by the Hono API (`apps/api`). Every request must include a Firebase ID token in the `Authorization: Bearer <token>` header unless marked **public**.

## Auth Guards

| Guard | Description |
|---|---|
| `buddy` | Active buddies only |
| `trainee+` | Trainee or above (any authenticated buddy) |
| `admin` | Admin or Super Admin |
| `super_admin` | Super Admin only |
| `self` | Authenticated user accessing their own resource |
| `self\|admin` | Owner or any admin |

---

## Auth

### `POST /auth/register`
Called on first login after Firebase Auth. Creates a User + BuddyProfile in pending state.

**Auth:** Firebase token required (new user, no role yet)

**Request**
```json
{
  "firebaseUid": "string",
  "email": "string"
}
```

**Response `201`**
```json
{
  "id": "uuid",
  "email": "string",
  "role": "buddy",
  "status": "pending"
}
```

---

### `GET /auth/me`
Returns the current user's identity and role. Used by frontend on every load to determine routing.

**Auth:** any authenticated user

**Response `200`**
```json
{
  "id": "uuid",
  "email": "string",
  "role": "buddy | admin | super_admin",
  "buddyProfile": {
    "id": "uuid",
    "status": "pending | trainee | active | suspended",
    "displayName": "string"
  } | null
}
```

---

## Buddy Profile

### `GET /buddies/me`
Returns the authenticated buddy's full self-visible profile.

**Auth:** `trainee+`

**Response `200`**
```json
{
  "id": "uuid",
  "displayName": "string",
  "realName": "string",
  "photoUrl": "string | null",
  "bio": "string | null",
  "contactInfo": "string | null",
  "languages": ["string"],
  "skills": ["string"],
  "availability": "string | null",
  "status": "pending | trainee | active | suspended"
}
```

---

### `PATCH /buddies/me`
Updates the authenticated buddy's self-managed fields.

**Auth:** `trainee+`

**Request** (all fields optional)
```json
{
  "displayName": "string",
  "realName": "string",
  "bio": "string",
  "contactInfo": "string",
  "languages": ["string"],
  "skills": ["string"],
  "availability": "string"
}
```

**Response `200`** — updated profile (same shape as `GET /buddies/me`)

---

### `POST /buddies/me/photo`
Requests a signed GCS URL for profile photo upload.

**Auth:** `trainee+`

**Request**
```json
{
  "contentType": "image/jpeg | image/png | image/webp"
}
```

**Response `200`**
```json
{
  "uploadUrl": "string",
  "objectPath": "string"
}
```

---

### `POST /buddies/me/photo/confirm`
Called by client after successful direct upload to GCS. Saves the object path to DB.

**Auth:** `trainee+`

**Request**
```json
{
  "objectPath": "string"
}
```

**Response `200`**
```json
{
  "photoUrl": "string"
}
```

---

### `GET /buddies` *(admin)*
Returns paginated list of all buddy profiles with admin-visible fields.

**Auth:** `admin`

**Query params:** `?status=pending|trainee|active|suspended`, `?tier=junior|mid|senior|expert|instructor|organizer`, `?page=1`, `?limit=50`

**Response `200`**
```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "displayName": "string",
      "realName": "string",
      "status": "string",
      "tier": "string | null",
      "languages": ["string"],
      "createdAt": "ISO8601"
    }
  ],
  "total": 0,
  "page": 1,
  "limit": 50
}
```

---

### `GET /buddies/:id` *(admin)*
Returns full buddy profile including admin-only fields.

**Auth:** `admin`

**Response `200`**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "displayName": "string",
  "realName": "string",
  "photoUrl": "string | null",
  "bio": "string | null",
  "contactInfo": "string | null",
  "languages": ["string"],
  "skills": ["string"],
  "availability": "string | null",
  "status": "string",
  "tier": "string | null",
  "internalNotes": "string | null",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

---

### `PATCH /buddies/:id` *(admin)*
Updates admin-managed fields on a buddy profile.

**Auth:** `admin`

**Request** (all fields optional)
```json
{
  "status": "pending | trainee | active | suspended",
  "tier": "junior | mid | senior | expert | instructor | organizer",
  "internalNotes": "string"
}
```

**Response `200`** — updated buddy profile (same shape as `GET /buddies/:id`)

---

## Groups

### `GET /groups`
Returns all groups.

**Auth:** `admin`

**Response `200`**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "type": "school | company | community | other",
      "contactName": "string | null",
      "contactEmail": "string | null",
      "contactPhone": "string | null",
      "createdAt": "ISO8601"
    }
  ]
}
```

---

### `GET /groups/:id`
Returns group detail including notes.

**Auth:** `admin`

**Response `200`**
```json
{
  "id": "uuid",
  "name": "string",
  "type": "string",
  "contactName": "string | null",
  "contactEmail": "string | null",
  "contactPhone": "string | null",
  "notes": "string | null",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

---

### `POST /groups`

**Auth:** `admin`

**Request**
```json
{
  "name": "string",
  "type": "school | company | community | other",
  "contactName": "string",
  "contactEmail": "string",
  "contactPhone": "string",
  "notes": "string"
}
```

**Response `201`** — created group (same shape as `GET /groups/:id`)

---

### `PATCH /groups/:id`

**Auth:** `admin`

**Request** (all fields optional)
```json
{
  "name": "string",
  "type": "school | company | community | other",
  "contactName": "string",
  "contactEmail": "string",
  "contactPhone": "string",
  "notes": "string"
}
```

**Response `200`** — updated group

---

## Tours

### `GET /tours`
Returns tours visible to the caller.
- Buddies (trainee+): Published tours only, no `adminMemo`
- Admins: All tours including Draft, all fields

**Auth:** `trainee+` or `admin`

**Query params:** `?status=draft|published|cancelled|completed`, `?page=1`, `?limit=50`

**Response `200`**
```json
{
  "data": [
    {
      "id": "uuid",
      "groupId": "uuid",
      "groupName": "string",
      "status": "string",
      "tourDate": "YYYY-MM-DD",
      "meetingTime": "HH:MM",
      "location": "string",
      "capacity": 0,
      "remainingSeats": 0,
      "confirmedCount": 0,
      "maybeCount": 0,
      "waitlistCount": 0,
      "declinedCount": 0,
      "description": "string | null",
      "adminMemo": "string | null",
      "cancellationDeadline": "YYYY-MM-DD",
      "maybeDeadline": "YYYY-MM-DD | null",
      "notificationOffsets": [0],
      "createdAt": "ISO8601"
    }
  ],
  "total": 0,
  "page": 1,
  "limit": 50
}
```

> `adminMemo` is omitted for buddy callers.

---

### `GET /tours/:id`
Returns full tour detail. Same field visibility rules as `GET /tours`.

**Auth:** `trainee+` or `admin`

**Response `200`** — single tour object (same shape as above) + for admins, a `bookings` array:

```json
{
  "bookings": [
    {
      "id": "uuid",
      "buddyId": "uuid",
      "buddyDisplayName": "string",
      "status": "confirmed | maybe | waitlist | declined",
      "bookedAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```

---

### `POST /tours`

**Auth:** `admin`

**Request**
```json
{
  "groupId": "uuid",
  "tourDate": "YYYY-MM-DD",
  "meetingTime": "HH:MM",
  "location": "string",
  "capacity": 0,
  "description": "string",
  "adminMemo": "string",
  "cancellationDeadline": "YYYY-MM-DD",
  "maybeDeadline": "YYYY-MM-DD",
  "notificationOffsets": [3, 1]
}
```

**Response `201`** — created tour. Status defaults to `draft`.

---

### `PATCH /tours/:id`
Edits tour fields. Only allowed when status is `draft` or `published`.

**Auth:** `admin`

**Request** (all fields optional)
```json
{
  "groupId": "uuid",
  "tourDate": "YYYY-MM-DD",
  "meetingTime": "HH:MM",
  "location": "string",
  "capacity": 0,
  "description": "string",
  "adminMemo": "string",
  "cancellationDeadline": "YYYY-MM-DD",
  "maybeDeadline": "YYYY-MM-DD",
  "notificationOffsets": [3, 1]
}
```

**Response `200`** — updated tour.

> If `tourDate`, `meetingTime`, or `location` change on a Published tour, notifications are sent to all Confirmed / Maybe / Waitlist buddies.

---

### `POST /tours/:id/publish`
Transitions tour from `draft` → `published`. Sends new-tour notification to all Active buddies.

**Auth:** `admin`

**Response `200`**
```json
{ "status": "published" }
```

---

### `POST /tours/:id/cancel`
Transitions tour to `cancelled`. Notifies all Confirmed / Maybe / Waitlist buddies.

**Auth:** `admin`

**Response `200`**
```json
{ "status": "cancelled" }
```

---

### `POST /tours/:id/complete`
Transitions tour to `completed`. Triggers evaluation prompts for admin and participating buddies.

**Auth:** `admin`

**Response `200`**
```json
{ "status": "completed" }
```

---

### `DELETE /tours/:id`
Hard deletes a tour. Only allowed when status is `draft`.

**Auth:** `admin`

**Response `204`**

---

## Bookings

### `GET /tours/:id/bookings/me`
Returns the authenticated buddy's booking for a specific tour, if it exists.

**Auth:** `buddy`

**Response `200`**
```json
{
  "id": "uuid",
  "tourId": "uuid",
  "status": "confirmed | maybe | waitlist | declined",
  "bookedAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**Response `404`** — no booking exists yet.

---

### `POST /tours/:id/bookings`
Creates a new booking for the authenticated buddy.

**Auth:** `buddy`

**Request**
```json
{
  "status": "confirmed | maybe | waitlist"
}
```

**Response `201`**
```json
{
  "id": "uuid",
  "tourId": "uuid",
  "status": "string",
  "bookedAt": "ISO8601"
}
```

**Errors**
- `409` — booking already exists (use PATCH to update)
- `403` — tour not published, deadline passed, or buddy not active
- `422` — capacity full (for `confirmed` when no seats remain)

---

### `PATCH /tours/:id/bookings/me`
Updates the authenticated buddy's booking status.

**Auth:** `buddy`

**Request**
```json
{
  "status": "confirmed | maybe | waitlist | declined",
  "cancellationReason": {
    "category": "health | emergency | personal | work | other",
    "freeText": "string"
  }
}
```

> `cancellationReason` is required when transitioning **to `declined` from `confirmed`**.

**Response `200`** — updated booking

**Errors**
- `403` — deadline passed (admin override required)
- `409` — concurrent confirmed seat claim lost (retry or stay on waitlist)

---

### `PATCH /tours/:id/bookings/:bookingId` *(admin)*
Admin override for any booking status change, including after deadline.

**Auth:** `admin`

**Request**
```json
{
  "status": "confirmed | maybe | waitlist | declined",
  "cancellationReason": {
    "category": "health | emergency | personal | work | other",
    "freeText": "string",
    "unavoidable": true
  }
}
```

**Response `200`** — updated booking

---

### `GET /buddies/:id/bookings` *(admin)*
Returns full booking history for a buddy.

**Auth:** `admin`

**Query params:** `?page=1`, `?limit=50`

**Response `200`**
```json
{
  "data": [
    {
      "id": "uuid",
      "tourId": "uuid",
      "tourDate": "YYYY-MM-DD",
      "groupName": "string",
      "status": "string",
      "bookedAt": "ISO8601",
      "updatedAt": "ISO8601",
      "cancellationReason": {
        "category": "string",
        "freeText": "string | null",
        "unavoidable": "boolean | null"
      } | null
    }
  ],
  "total": 0,
  "page": 1,
  "limit": 50
}
```

---

### `GET /bookings/me`
Returns the authenticated buddy's own booking history.

**Auth:** `buddy`

**Query params:** `?page=1`, `?limit=50`

**Response `200`** — same shape as above, minus `cancellationReason.unavoidable` (admin-only field)

---

### `PATCH /tours/:id/bookings/:bookingId/cancellation-reason` *(admin)*
Updates the unavoidable flag on an existing cancellation reason.

**Auth:** `admin`

**Request**
```json
{
  "unavoidable": true
}
```

**Response `200`**
```json
{
  "unavoidable": true
}
```

---

### `POST /tours/:id/deadline-overrides` *(admin)*
Sets a per-buddy cancellation deadline override for a tour.

**Auth:** `admin`

**Request**
```json
{
  "buddyId": "uuid",
  "deadline": "YYYY-MM-DD"
}
```

**Response `201`**
```json
{
  "id": "uuid",
  "buddyId": "uuid",
  "tourId": "uuid",
  "deadline": "YYYY-MM-DD"
}
```

---

## Evaluations

### `POST /evaluations/admin`
Submits an admin evaluation for a buddy, optionally linked to a tour.

**Auth:** `admin`

**Request**
```json
{
  "buddyId": "uuid",
  "tourId": "uuid | null",
  "overallRating": 1,
  "overallRatingNote": "string",
  "reliability": 1,
  "reliabilityNote": "string",
  "communication": 1,
  "communicationNote": "string",
  "groupEngagement": 1,
  "groupEngagementNote": "string",
  "memory": 1,
  "memoryNote": "string",
  "knowledge": 1,
  "knowledgeNote": "string",
  "dedication": 1,
  "dedicationNote": "string",
  "dialogue": 1,
  "dialogueNote": "string",
  "adaptability": 1,
  "adaptabilityNote": "string",
  "emotionNote": "string",
  "confidence": 1,
  "confidenceNote": "string"
}
```

> All score and note fields are optional. Score range: 1–5.

**Response `201`** — created evaluation with `id` and `createdAt`

---

### `GET /evaluations/admin/:buddyId`
Returns all admin evaluations for a buddy.

**Auth:** `admin`

**Response `200`**
```json
{
  "data": [
    {
      "id": "uuid",
      "tourId": "uuid | null",
      "evaluatorId": "uuid",
      "evaluatorName": "string",
      "overallRating": 1,
      "overallRatingNote": "string | null",
      "dialogue": 1,
      "dialogueNote": "string | null",
      "emotionNote": "string | null",
      "createdAt": "ISO8601"
    }
  ]
}
```

> Full field list omitted for brevity — all score/note pairs are returned.

---

### `POST /evaluations/self`
Buddy submits a self-evaluation for a completed tour.

**Auth:** `buddy`

**Request**
```json
{
  "tourId": "uuid",
  "overallRating": 1,
  "overallRatingNote": "string",
  "communication": 1,
  "communicationNote": "string",
  "groupEngagement": 1,
  "groupEngagementNote": "string",
  "memory": 1,
  "memoryNote": "string",
  "knowledge": 1,
  "knowledgeNote": "string",
  "dedication": 1,
  "dedicationNote": "string",
  "dialogue": 1,
  "dialogueNote": "string",
  "adaptability": 1,
  "adaptabilityNote": "string",
  "emotionNote": "string",
  "confidence": 1,
  "confidenceNote": "string"
}
```

> All score and note fields are optional. No `reliability` field.

**Response `201`** — created self-evaluation

**Errors**
- `403` — tour not completed, or buddy did not have Confirmed status
- `409` — self-evaluation already exists for this tour

---

### `GET /evaluations/self/me`
Returns the authenticated buddy's own self-evaluations.

**Auth:** `buddy`

**Response `200`**
```json
{
  "data": [
    {
      "id": "uuid",
      "tourId": "uuid",
      "tourDate": "YYYY-MM-DD",
      "overallRating": 1,
      "createdAt": "ISO8601"
    }
  ]
}
```

---

### `GET /evaluations/self/:buddyId` *(admin)*
Returns all self-evaluations for a buddy.

**Auth:** `admin`

**Response `200`** — same shape as above

---

## Notifications

> **⚠ Planned (not shipped).** Route file does not exist yet (`apps/api/src/routes/notifications.ts` is referenced but commented out in `routes/index.ts`). The shapes below describe the intended contract.

### `GET /notifications`
Returns in-app notifications for the authenticated user.

**Auth:** any authenticated user

**Query params:** `?unreadOnly=true`, `?page=1`, `?limit=50`

**Response `200`**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "string",
      "payload": {},
      "readAt": "ISO8601 | null",
      "createdAt": "ISO8601"
    }
  ],
  "unreadCount": 0
}
```

---

### `POST /notifications/read`
Marks one or more notifications as read.

**Auth:** any authenticated user

**Request**
```json
{
  "ids": ["uuid"]
}
```

**Response `200`**
```json
{ "updated": 0 }
```

---

## Notification Preferences *(admin)*

> **⚠ Planned (not shipped).** No route or service implementation exists yet. The `NotificationPreference` table and `NotifEventType` / `EmailMode` enums are defined in schema; per-event `slackEnabled` may be replaced by a single global Slack opt-in on `AdminProfile` pending the §10.3 decision.

### `GET /notification-preferences`
Returns the authenticated admin's notification preferences.

**Auth:** `admin`

**Response `200`**
```json
{
  "data": [
    {
      "eventType": "new_signup | new_booking | cancellation | maybe_resolved | maybe_deadline_missed",
      "emailEnabled": true,
      "emailMode": "immediate | digest",
      "slackEnabled": false
    }
  ]
}
```

---

### `PUT /notification-preferences`
Upserts notification preferences for the authenticated admin. Send the full array.

**Auth:** `admin`

**Request**
```json
{
  "preferences": [
    {
      "eventType": "string",
      "emailEnabled": true,
      "emailMode": "immediate | digest",
      "slackEnabled": false
    }
  ]
}
```

**Response `200`** — updated preferences

---

## Admin — Buddy Approval

### `POST /buddies/:id/approve`
Approves a pending buddy. Sets status to `trainee`. Notifies buddy.

**Auth:** `admin`

**Response `200`**
```json
{ "status": "trainee" }
```

---

### `POST /buddies/:id/reject`
Rejects a pending buddy. Sets status to `rejected`. Notifies buddy.

**Auth:** `admin`

**Request**
```json
{
  "reason": "string"
}
```

**Response `200`**
```json
{ "status": "rejected" }
```

---

## System Configuration *(super_admin)*

### `GET /config`
Returns global system defaults.

**Auth:** `super_admin`

**Response `200`**
```json
{
  "cancellationDeadlineOffsetDays": 7,
  "maybeDeadlineOffsetDays": 9,
  "maybeReminderOffsets": [3, 1],
  "defaultNotificationOffsets": [3, 1]
}
```

---

### `PATCH /config`
Updates global system defaults.

**Auth:** `super_admin`

**Request** (all fields optional)
```json
{
  "cancellationDeadlineOffsetDays": 7,
  "maybeDeadlineOffsetDays": 9,
  "maybeReminderOffsets": [3, 1],
  "defaultNotificationOffsets": [3, 1]
}
```

**Response `200`** — updated config

---

## Admin Account Management *(super_admin)*

### `GET /admins`

**Auth:** `super_admin`

**Response `200`**
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "string",
      "role": "admin | super_admin",
      "createdAt": "ISO8601"
    }
  ]
}
```

---

### `POST /admins`
Creates a new admin account.

**Auth:** `super_admin`

**Request**
```json
{
  "email": "string",
  "role": "admin | super_admin"
}
```

**Response `201`** — created admin user

---

### `PATCH /admins/:id`
Updates an admin's role.

**Auth:** `super_admin`

**Request**
```json
{
  "role": "admin | super_admin"
}
```

**Response `200`** — updated admin

---

### `DELETE /admins/:id`
Removes an admin account. Cannot delete own account.

**Auth:** `super_admin`

**Response `204`**

---

## Admin Profile

### `GET /admin/profile`
Returns the current admin's profile.

**Auth:** `admin`

**Response `200`**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "string",
  "createdAt": "ISO8601"
}
```

---

### `PATCH /admin/profile`
Updates the current admin's name.

**Auth:** `admin`

**Request**
```json
{
  "name": "string"
}
```

**Response `200`** — updated profile

---

### `GET /admin/profiles`
Lists all active (non-deleted) admin profiles. Used for displaying who evaluated a buddy.

**Auth:** `admin`

**Response `200`**
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "name": "string",
    "createdAt": "ISO8601"
  }
]
```

---

### `POST /admin/profiles`
Creates a new admin profile.

**Auth:** `super_admin`

**Request**
```json
{
  "userId": "uuid",
  "name": "string"
}
```

**Response `201`** — created profile

**Errors**
- `409` — Admin already exists for this user

---

### `DELETE /admin/profiles/:userId`
Soft-deletes an admin profile (sets `deletedAt`). Cannot delete own profile.

**Auth:** `super_admin`

**Response `200`** — deleted profile (with `deletedAt` timestamp)

**Errors**
- `400` — Cannot delete own profile

---

## Scheduled Job Endpoints *(internal)*

> **⚠ Planned (foundations only).** The `schedulerAuthMiddleware` (validates `X-Scheduler-Secret` against `SCHEDULER_SECRET` env var) exists in `apps/api/src/middleware/schedulerAuth.ts`, but no `/jobs/*` route file is mounted yet (commented out in `routes/index.ts`).

Called by GCP Cloud Scheduler. Protected by a shared secret in the `X-Scheduler-Secret` header, not Firebase tokens.

| Method | Path | Cadence | Description |
|---|---|---|---|
| `POST` | `/jobs/notifications/reminders` | Hourly | Send tour reminder notifications for offset matches |
| `POST` | `/jobs/notifications/maybe-reminders` | Hourly | Send pre-deadline Maybe reminders |
| `POST` | `/jobs/notifications/maybe-deadlines` | Hourly | Notify admins of expired unresolved Maybe |
| `POST` | `/jobs/notifications/digest` | Daily 09:00 JST | Flush daily admin digest emails |
