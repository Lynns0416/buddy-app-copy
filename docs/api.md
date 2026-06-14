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

All group endpoints are admin-only and mounted under `/admin/groups`. No public or buddy-facing group routes. Groups cannot be deleted in v1.

### `GET /admin/groups`
List all groups, ordered by `name` ascending.

**Auth:** `admin`

**Response `200`** — array of `GroupResponse`
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
      "notes": "string | null",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```

---

### `GET /admin/groups/:id`
Group detail including the linked tour history.

**Auth:** `admin`

**Response `200`** — `GroupDetailResponse` (= `GroupResponse` + nested `tours[]`)
```json
{
  "id": "uuid",
  "name": "string",
  "type": "school | company | community | other",
  "contactName": "string | null",
  "contactEmail": "string | null",
  "contactPhone": "string | null",
  "notes": "string | null",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "tours": [
    {
      "id": "uuid",
      "status": "draft | published | cancelled | completed",
      "tourDate": "YYYY-MM-DD",
      "bookingOpen": true,
      "location": "string",
      "participantCount": 0,
      "description": "string | null",
      "sessions": [{ "...": "TourSessionResponse" }],
      "createdAt": "ISO8601"
    }
  ]
}
```

`tours` is ordered by `tourDate` descending. Each session in `tours[].sessions` carries a `belowMinimum` flag (`minBuddies != null && participantCount < minBuddies`).

**Errors**
- `404` — group not found

---

### `POST /admin/groups`
Create a new group.

**Auth:** `admin`

**Request** — `CreateGroupSchema`
```json
{
  "name": "string (min 1)",
  "type": "school | company | community | other",
  "contactName": "string",
  "contactEmail": "string (email format)",
  "contactPhone": "string",
  "notes": "string"
}
```

`name` and `type` required; all other fields optional. `contactEmail` is validated as an email if provided.

**Response `201`** — `GroupResponse`

---

### `PUT /admin/groups/:id`
Update an existing group. All fields optional; nullable fields can be cleared by passing `null`.

**Auth:** `admin`

**Request** — `UpdateGroupSchema`
```json
{
  "name": "string (min 1)",
  "type": "school | company | community | other",
  "contactName": "string | null",
  "contactEmail": "string (email format) | null",
  "contactPhone": "string | null",
  "notes": "string | null"
}
```

**Response `200`** — `GroupResponse`

**Errors**
- `404` — group not found

---

## Tours

Capacity, meeting time, and per-tier seat pools live on `TourSession` rows under the tour — a tour has 1 or 2 sessions. Buddy-facing routes are mounted under `/tours`; admin routes under `/admin/tours`. Field projections differ: buddies never receive `adminMemo`, `assignedAdmins`, `staffInChargeId`, or per-buddy booking details.

### Buddy: `GET /tours`
List tours visible to the caller. Trainee buddies are excluded server-side.

**Auth:** any authenticated active buddy

**Query params:** `?status=draft|published|cancelled|completed` (defaults to `published`), `?from=YYYY-MM-DD`, `?to=YYYY-MM-DD`

**Response `200`** — array of `TourResponse`
```json
{
  "data": [
    {
      "id": "uuid",
      "groupId": "uuid",
      "group": { "id": "uuid", "name": "string", "type": "school | company | community | other" },
      "status": "draft | published | cancelled | completed",
      "tourDate": "YYYY-MM-DD",
      "bookingOpen": true,
      "location": "string",
      "participantCount": 0,
      "description": "string | null",
      "cancellationDeadline": "YYYY-MM-DD",
      "maybeDeadline": "YYYY-MM-DD | null",
      "notificationOffsets": [3, 1],
      "sessions": [
        {
          "id": "uuid",
          "order": 1,
          "label": "string | null",
          "meetingTime": "HH:MM",
          "startTime": "HH:MM | null",
          "endTime": "HH:MM | null",
          "capacity": 0,
          "minBuddies": 0,
          "participantCount": 0,
          "belowMinimum": false
        }
      ],
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```

---

### Buddy: `GET /tours/:id`
Tour detail with per-session seat counts and the caller's tier-aware capacity. Returns `null` / `404` if the tour is not visible to the caller.

**Auth:** any authenticated active buddy

**Response `200`** — `TourDetailResponse` (= `TourResponse` with `sessions[]` upgraded to `TourSessionDetailResponse`):
```json
{
  "...": "TourResponse fields",
  "sessions": [
    {
      "...": "TourSessionResponse fields",
      "seatCounts": { "confirmed": 0, "maybe": 0, "waitlist": 0, "declined": 0 },
      "remaining": 0,
      "myCapacity": 0,
      "myRemaining": 0,
      "myBookingStatus": "confirmed | maybe | waitlist | declined | null"
    }
  ]
}
```

`myCapacity` / `myRemaining` reflect the caller's tier pool (junior vs non-junior vs overflow into anyone).

---

### Admin: `GET /admin/tours`
List all tours, including drafts.

**Auth:** `admin`

**Query params:** `?status=draft|published|cancelled|completed` (optional)

**Response `200`** — array of `AdminTourSummaryResponse` (= `TourResponse` + `capacity`, `confirmedCount`)

---

### Admin: `POST /admin/tours`
Create a tour. Status is initialised to `draft`.

**Auth:** `admin`

**Request** — `CreateTourSchema`
```json
{
  "groupId": "uuid",
  "tourDate": "YYYY-MM-DD",
  "bookingOpen": false,
  "location": "string",
  "description": "string",
  "adminMemo": "string",
  "cancellationDeadline": "YYYY-MM-DD",
  "maybeDeadline": "YYYY-MM-DD",
  "notificationOffsets": [3, 1],
  "sessions": [
    {
      "label": "string",
      "meetingTime": "HH:MM",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "capacity": 0,
      "minBuddies": 0,
      "participantCount": 0
    }
  ]
}
```

- `sessions` is required, length 1 or 2; additional sessions are added later via the session endpoints
- Server validates `maybeDeadline < cancellationDeadline` when both are set

**Response `201`** — `AdminTourDetailResponse`

---

### Admin: `GET /admin/tours/:id`
Tour detail with admin-only fields.

**Auth:** `admin`

**Response `200`** — `AdminTourDetailResponse`
```json
{
  "...": "TourResponse fields",
  "adminMemo": "string | null",
  "capacity": 0,
  "confirmedCount": 0,
  "bookings": [
    {
      "id": "uuid",
      "buddyId": "uuid",
      "sessionId": "uuid",
      "displayName": "string",
      "status": "confirmed | maybe | waitlist | declined",
      "bookedAt": "ISO8601",
      "cancellationReason": {
        "category": "health | emergency | personal | work | other",
        "freeText": "string | null",
        "unavoidable": true,
        "recordedByEmail": "string"
      }
    }
  ],
  "assignedAdmins": [{ "adminId": "uuid", "name": "string" }],
  "staffInChargeId": "uuid | null"
}
```

**Errors**
- `404` — not found

---

### Admin: `PUT /admin/tours/:id`
Update a tour. All fields optional; nullable fields can be cleared with `null`.

**Auth:** `admin`

**Request** — `UpdateTourSchema` (same fields as create, no `sessions`)

**Response `200`** — `AdminTourDetailResponse`

**Errors**
- `404` — not found
- `409` — `TourImmutableError`: tour is `cancelled` or `completed` and cannot be edited
- `400` — `maybeDeadline >= cancellationDeadline`

---

### Admin: `PATCH /admin/tours/:id/status`
Transition the tour status. Allowed transitions per §7.2 PRD: `draft → published`, `draft → cancelled`, `published → cancelled`, `published → completed`.

**Auth:** `admin`

**Request** — `TourStatusActionSchema`
```json
{ "action": "publish | cancel | complete" }
```

**Response `200`** — `AdminTourDetailResponse`

**Errors**
- `404` — not found
- `409` — transition not allowed from the current status

---

### Admin: `DELETE /admin/tours/:id`
Hard-delete. Only permitted while the tour is in `draft`.

**Auth:** `admin`

**Response `204`**

**Errors**
- `404` — not found
- `409` — `TourNotDraftError`: tour is not in `draft` status

---

### Admin: Sessions

#### `POST /admin/tours/:id/sessions`
Add a session to an existing tour. Tour must already exist with one session; the second one is added here.

**Auth:** `admin`

**Request** — `CreateTourSessionSchema` (`label?`, `meetingTime`, `startTime?`, `endTime?`, `capacity`, `minBuddies?`, `participantCount?`)

**Response `201`** — `AdminTourDetailResponse`

**Errors**
- `404` — tour not found
- `409` — `TourImmutableError` (cancelled / completed) or `TooManySessionsError` (already 2 sessions)

---

#### `PUT /admin/tours/:id/sessions/:sessionId`
Update a session.

**Auth:** `admin`

**Request** — `UpdateTourSessionSchema` (all fields optional)

**Response `200`** — `AdminTourDetailResponse`

---

#### `DELETE /admin/tours/:id/sessions/:sessionId`
Delete a session. Remaining sessions are reordered. Blocked if the session has bookings or is the only session.

**Auth:** `admin`

**Response `200`** — `AdminTourDetailResponse`

**Errors**
- `404` — session not found
- `409` — `SessionHasBookingsError` or `LastSessionError`

---

### Admin: Tier Capacities

Per-session percentages controlling pool allocation (`junior`, `non_junior`, `anyone`). Defaults `{ junior: 20, non_junior: 30, anyone: 50 }`.

#### `GET /admin/tours/:id/sessions/:sessionId/tier-capacities`

**Auth:** `admin`

**Response `200`**
```json
{ "junior": 20, "non_junior": 30, "anyone": 50 }
```

---

#### `PATCH /admin/tours/:id/sessions/:sessionId/tier-capacities`
Upsert all three pools. The three percentages must sum to 100 — the server rejects partial overrides.

**Auth:** `admin`

**Request** — `TierCapacitiesSchema`
```json
{ "junior": 20, "non_junior": 30, "anyone": 50 }
```

**Response `200`** — same shape

**Errors**
- `400` — percentages do not sum to 100

---

### Admin: Admin Assignment

#### `POST /admin/tours/:id/admins`
Assign an admin to the tour.

**Auth:** `admin`

**Request** — `AssignTourAdminSchema`
```json
{ "adminId": "uuid" }
```

**Response `200`** — `AdminTourDetailResponse`

**Errors**
- `404` — `AdminNotFoundError` (admin does not exist or is soft-deleted)
- `409` — `AdminAlreadyAssignedError`

---

#### `DELETE /admin/tours/:id/admins/:adminId`
Unassign an admin. If the admin being removed is the current `staffInCharge` and other admins are still assigned, the request fails — the staff-in-charge must be reassigned first.

**Auth:** `admin`

**Response `200`** — `AdminTourDetailResponse`

**Errors**
- `409` — `StaffInChargeRequiresReplacementError`

---

#### `PUT /admin/tours/:id/staff-in-charge`
Set or clear the staff-in-charge designation.

**Auth:** `admin`

**Request** — `SetStaffInChargeSchema`
```json
{ "adminId": "uuid | null" }
```

- Passing a UUID requires that admin to already be assigned to the tour
- Passing `null` is allowed only when no admins are assigned

**Response `200`** — `AdminTourDetailResponse`

**Errors**
- `409` — `StaffInChargeNotAssignedError` (the named admin is not on the tour) or `StaffInChargeRequiredError` (clearing while admins remain)

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

Backed by three distinct database models (see data-model.md): `AdminEvaluation` (per-tour), `AdminProfileEvaluation` (overall profile), `SelfEvaluation` (buddy self). Routes are namespaced by audience: admin-authored evaluations live under `/admin/*`, buddy-authored self-evaluations under `/me/*`. Admin read-only access to self-evaluations lives under `/admin/self-evaluations`.

Score range for all `*Rating` / score fields: **1–5** (`EvaluationScoreSchema`). Note fields are optional strings. `emotionNote` is text-only (no score).

### Admin Per-Tour Evaluations

#### `POST /admin/evaluations`
Submits a per-tour evaluation. One per `(buddyId, tourId, createdBy)`.

**Auth:** `admin` (requires `AdminProfile`)

**Request** — `CreateAdminEvaluationSchema`
```json
{
  "buddyId": "uuid",
  "tourId": "uuid",
  "absentWithoutReport": false,
  "overallRating": 1, "overallRatingNote": "string",
  "reliability": 1, "reliabilityNote": "string",
  "communication": 1, "communicationNote": "string",
  "groupEngagement": 1, "groupEngagementNote": "string",
  "memory": 1, "memoryNote": "string",
  "knowledge": 1, "knowledgeNote": "string",
  "dedication": 1, "dedicationNote": "string",
  "dialogue": 1, "dialogueNote": "string",
  "adaptability": 1, "adaptabilityNote": "string",
  "emotionNote": "string",
  "confidence": 1, "confidenceNote": "string"
}
```

All score / note / `absentWithoutReport` fields are optional except `buddyId` and `tourId`.

**Response `201`** — `AdminEvaluationResponse` (see below)

**Errors**
- `404` — buddy or tour not found
- `409` — evaluation already exists for `(buddyId, tourId, createdBy)`

---

#### `GET /admin/evaluations`
Lists admin per-tour evaluations. Filter by buddy and/or tour.

**Auth:** `admin`

**Query params:** `?buddyId=uuid`, `?tourId=uuid` (both optional)

**Response `200`** — array of `AdminEvaluationResponse`, ordered by `createdAt` descending

```json
{
  "data": [
    {
      "id": "uuid",
      "buddyId": "uuid",
      "buddyDisplayName": "string",
      "tourId": "uuid",
      "tourDate": "YYYY-MM-DD",
      "tourGroupName": "string",
      "createdBy": "uuid",
      "createdByName": "string",
      "absentWithoutReport": false,
      "overallRating": 1, "overallRatingNote": "string | null",
      "reliability": 1, "reliabilityNote": "string | null",
      "...": "all other score/note pairs",
      "emotionNote": "string | null",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```

---

#### `GET /admin/evaluations/:id`
Fetch a single admin evaluation.

**Auth:** `admin`

**Response `200`** — `AdminEvaluationResponse`

**Errors**
- `404` — not found

---

#### `PUT /admin/evaluations/:id`
Update an admin evaluation. Only the original creator can edit; other admins receive 403.

**Auth:** `admin` (must equal `createdBy`)

**Request** — `UpdateAdminEvaluationSchema` (partial; same fields as create, minus `buddyId` / `tourId`)

**Response `200`** — `AdminEvaluationResponse`

**Errors**
- `403` — requester is not the creator
- `404` — not found

---

#### `DELETE /admin/evaluations/:id`
Delete an admin evaluation. Only the original creator can delete.

**Auth:** `admin` (must equal `createdBy`)

**Response `204`** — no content

**Errors**
- `403` — requester is not the creator
- `404` — not found

---

### Admin Profile Evaluations

Profile evaluations are profile-level (not tied to a tour). One per `(buddyId, createdBy)` — upsert semantics.

#### `PUT /admin/profile-evaluations/:buddyId`
Upsert the requester's profile evaluation for a buddy.

**Auth:** `admin`

**Request** — `UpsertAdminProfileEvaluationSchema` (same score / note fields as admin per-tour, **no** `absentWithoutReport`, **no** `tourId`)

**Response `200`** — `AdminProfileEvaluationResponse`
```json
{
  "id": "uuid",
  "buddyId": "uuid",
  "createdBy": "uuid",
  "createdByName": "string",
  "overallRating": 1, "overallRatingNote": "string | null",
  "...": "all other score/note pairs",
  "emotionNote": "string | null",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**Errors**
- `404` — buddy not found

---

#### `GET /admin/profile-evaluations/:buddyId/mine`
Fetch the requester's own profile evaluation for a buddy.

**Auth:** `admin`

**Response `200`** — `AdminProfileEvaluationResponse` or `404` if not yet submitted

---

#### `GET /admin/profile-evaluations/:buddyId`
List all admins' profile evaluations for a buddy.

**Auth:** `admin`

**Response `200`** — array of `AdminProfileEvaluationResponse`, ordered by `createdAt` ascending

---

### Buddy Self-Evaluations

#### `POST /me/self-evaluations`
Buddy submits a self-evaluation for a completed tour.

**Auth:** `buddy`

**Request** — `CreateSelfEvaluationSchema` (same shape as admin per-tour minus `buddyId`, `reliability`, `reliabilityNote`, `absentWithoutReport`)

**Response `201`** — `SelfEvaluationResponse`
```json
{
  "id": "uuid",
  "buddyId": "uuid",
  "tourId": "uuid",
  "overallRating": 1, "overallRatingNote": "string | null",
  "...": "all other score/note pairs (no reliability)",
  "emotionNote": "string | null",
  "locked": false,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**Errors**
- `403` — buddy did not have a `confirmed` booking, or tour is not in `completed` status
- `409` — self-evaluation already exists for this tour

---

#### `GET /me/self-evaluations`
List the authenticated buddy's own self-evaluations.

**Auth:** `buddy`

**Query params:** `?tourId=uuid` (optional)

**Response `200`** — array of `SelfEvaluationResponse`, ordered by `createdAt` descending

---

#### `PUT /me/self-evaluations/:id`
Edit own self-evaluation within the 7-day edit window.

**Auth:** `buddy` (must equal owner)

**Request** — `UpdateSelfEvaluationSchema` (partial; same fields as create, no `tourId`)

**Response `200`** — `SelfEvaluationResponse`

**Errors**
- `403` — requester is not the owner
- `404` — not found
- `409` — edit window (7 days from creation) has closed

---

### Self-Evaluations (admin read access)

#### `GET /admin/self-evaluations`
Admins read all buddy self-evaluations.

**Auth:** `admin`

**Query params:** `?buddyId=uuid` (optional)

**Response `200`** — array of `AdminSelfEvaluationResponse` (includes buddy display name), ordered by `createdAt` descending

---

#### `GET /admin/self-evaluations/:id`
Fetch a single self-evaluation.

**Auth:** `admin`

**Response `200`** — `AdminSelfEvaluationResponse` or `404`

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
