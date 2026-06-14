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
Called on first login. Validates the Firebase ID token (no DB user required yet) and upserts a `User` (role `buddy`) + `BuddyProfile` in `pending` state. `firebaseUid` and `email` come from the verified token, not the body.

**Auth:** Firebase ID token (`firebaseAuthMiddleware` only — no DB user yet)

**Request** — `RegisterRequestBodySchema` (all fields optional; falls back to email prefix if `displayName` missing)
```json
{
  "displayName": "string",
  "realName": "string",
  "languages": ["english", "japanese"],
  "photoUrl": "string",
  "bio": "string"
}
```

**Response `200`** — `UserResponse` (identity + nested `buddyProfile`)
```json
{
  "id": "uuid",
  "firebaseUid": "string",
  "email": "string",
  "role": "buddy | admin | super_admin",
  "buddyProfile": {
    "id": "uuid",
    "status": "pending | trainee | active | rejected | suspended",
    "displayName": "string",
    "realName": "string",
    "photoUrl": "string | null",
    "bio": "string | null",
    "contactInfo": "string | null",
    "languages": ["string"],
    "skills": ["string"],
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  } | null
}
```

`tier` and `internalNotes` are never included in buddy-side responses. There is no `GET /auth/me` — buddies use `GET /me/profile`, admins use `GET /admin/profile`.

---

## Buddy Profile

Buddy-side endpoints sit under `/me/profile`. Admin reads/writes use `/admin/buddies/*`. The buddy-side response shape (`BuddyProfileResponse`) never includes `tier`, `internalNotes`, or the underlying `userId`.

### Buddy: `GET /me/profile`
Fetch own profile.

**Auth:** any authenticated buddy

**Response `200`** — `BuddyProfileResponse`
```json
{
  "id": "uuid",
  "status": "pending | trainee | active | rejected | suspended",
  "displayName": "string",
  "realName": "string",
  "photoUrl": "string | null",
  "bio": "string | null",
  "contactInfo": "string | null",
  "languages": ["string"],
  "skills": ["string"],
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**Errors**
- `404` — buddy profile not found

---

### Buddy: `PUT /me/profile`
Update self-managed fields.

**Auth:** any authenticated buddy

**Request** — `UpdateBuddyProfileSchema` (all fields optional)
```json
{
  "displayName": "string",
  "realName": "string",
  "photoUrl": "string",
  "bio": "string",
  "contactInfo": "string",
  "languages": ["english", "japanese"],
  "skills": ["string"]
}
```

`languages` must be unique values from `LanguageSchema`. `availability` is not currently in the update schema — the field is unused in the shipped form.

**Response `200`** — `BuddyProfileResponse`

---

### Buddy: `POST /me/profile/photo`
Direct upload to Cloudflare R2. Single-step — no signed-URL flow.

**Auth:** any authenticated buddy

**Request** — `multipart/form-data` with one field `photo` (File)

Server validation:
- ≤ 2 MB
- MIME ∈ `image/jpeg` / `image/png` / `image/webp`
- Magic bytes verified against declared MIME (rejects spoofed types)

The previous photo (if any) is deleted from R2 asynchronously after the DB row updates.

**Response `200`** — updated `BuddyProfileResponse`

**Errors**
- `400` — invalid MIME type or magic-byte mismatch
- `404` — buddy profile not found
- `413` — payload too large (> 2 MB)

---

### Buddy: `DELETE /me/profile/photo`
Remove the current profile photo. Sets `photoUrl = null` and deletes the R2 object.

**Auth:** any authenticated buddy

**Response `200`** — updated `BuddyProfileResponse`

---

### Admin: `GET /admin/buddies`
List buddies. Returns `AdminBuddyResponse[]` (includes `tier`, `internalNotes`, `email`).

**Auth:** `admin`

**Query params:** `?status=pending|trainee|active|rejected|suspended`, `?tier=junior|mid|senior|expert|instructor|organizer`

**Response `200`** — array of `AdminBuddyResponse`

---

### Admin: `GET /admin/buddies/:id`
Buddy detail with bookings and aggregations.

**Auth:** `admin`

**Response `200`** — `AdminBuddyDetailResponse` (extends `AdminBuddyResponse` with):
```json
{
  "buddyProfile": {
    "bio": "string | null",
    "contactInfo": "string | null",
    "languages": ["string"],
    "skills": ["string"]
  } | null,
  "bookings": [
    {
      "id": "uuid",
      "tourId": "uuid",
      "sessionId": "uuid",
      "sessionOrder": 1,
      "sessionLabel": "string | null",
      "status": "confirmed | maybe | waitlist | declined",
      "bookedAt": "ISO8601",
      "cancellationReason": { "...": "CancellationReasonResponse" } | null,
      "tour": {
        "tourDate": "YYYY-MM-DD",
        "location": "string",
        "group": { "name": "string" },
        "status": "draft | published | cancelled | completed"
      }
    }
  ],
  "cancellationSummary": {
    "total": 0,
    "unavoidable": 0,
    "avoidable": 0,
    "unreviewed": 0
  },
  "absenceSummary": { "absentWithoutReport": 0 }
}
```

**Errors**
- `404` — buddy not found

---

### Admin: `PUT /admin/buddies/:id`
Update admin-managed fields. Both fields optional; pass `null` to clear.

**Auth:** `admin`

**Request** — `UpdateAdminBuddyProfileSchema`
```json
{
  "tier": "junior | mid | senior | expert | instructor | organizer | null",
  "internalNotes": "string | null"
}
```

**Response `200`** — `AdminBuddyResponse`

---

### Admin: `PUT /admin/buddies/:id/status`
Change buddy account status. The API accepts only `trainee` / `active` / `rejected`. `→ active` server-side auto-sets `tier = junior`.

**Auth:** `admin`

**Request** — `UpdateBuddyStatusSchema`
```json
{ "status": "trainee | active | rejected" }
```

**Response `200`** — `AdminBuddyResponse`

> **⚠ Planned:** Setting status to `suspended` is not exposed via this endpoint. The enum value exists in `BuddyStatus`, but no API path transitions to it yet.

---

## Admin Profiles

Admin profile management. `AdminProfile` is auto-created on first admin login via `ensureAdminProfile` middleware (uses Firebase `name` or email prefix as default).

### Admin: `GET /admin/profile`
Fetch the requesting admin's own profile. Returns 404 if soft-deleted.

**Auth:** `admin`

**Response `200`** — `AdminProfileResponse`
```json
{
  "id": "uuid",
  "userId": "uuid",
  "name": "string",
  "createdAt": "ISO8601"
}
```

---

### Admin: `GET /admin/profiles`
List all active admin profiles (excludes soft-deleted).

**Auth:** `admin`

**Response `200`** — array of `AdminProfileResponse`

---

### Admin: `PATCH /admin/profile`
Update own display name.

**Auth:** `admin`

**Request**
```json
{ "name": "string" }
```

**Response `200`** — `AdminProfileResponse`

---

### Super-admin: `POST /admin/profiles`
Create a new admin profile (provisions a new admin user from an existing `User` row).

**Auth:** `super_admin`

**Request** — `CreateAdminProfileSchema`
```json
{ "userId": "uuid", "name": "string" }
```

**Response `201`** — `AdminProfileResponse`

**Errors**
- `409` — admin profile already exists for that user

---

### Super-admin: `DELETE /admin/profiles/:userId`
Soft-delete an admin profile (sets `deletedAt`). The admin's evaluations remain attributed to them as an immutable audit trail, but they vanish from `GET /admin/profiles`.

**Auth:** `super_admin`

**Response `200`** — soft-deleted `AdminProfileResponse`

**Errors**
- `400` — cannot soft-delete own profile
- `409` — admin still has draft / published tour assignments (`HasActiveTourAssignmentsError`)

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

Bookings are scoped to a **session** (one booking per `(buddyId, sessionId)`). All buddy-facing endpoints sit under tour-shaped paths; admin overrides live under `/admin/bookings`. There is no separate booking-create vs status-change endpoint shape — `POST` creates, `PUT /me` updates the caller's own.

### Buddy: `POST /tours/:id/bookings`
Create a booking for one session of the tour. The server decides `confirmed` vs `waitlist` from the session's tier pool state (see PRD §8.9).

**Auth:** any authenticated active buddy with a tier assigned

**Request** — `CreateBookingBodySchema`
```json
{ "sessionId": "uuid" }
```

**Response `201`** — `BookingResponse`
```json
{
  "id": "uuid",
  "tourId": "uuid",
  "sessionId": "uuid",
  "buddyTier": "junior | mid | senior | expert | instructor | organizer",
  "status": "confirmed | waitlist",
  "bookedAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

A previously declined booking is reused (upsert) — re-booking returns a fresh status based on current pool state.

**Errors**
- `404` — tour, session, or buddy not found
- `409` — `ALREADY_BOOKED` (a non-declined booking exists)
- `403` — `NOT_ELIGIBLE` (buddy is trainee or inactive)
- `422` — `NOT_BOOKABLE` (tour not published, `bookingOpen = false`, or tour date passed)

---

### Buddy: `PUT /tours/:tourId/sessions/:sessionId/bookings/me`
Update the caller's own booking status for a session.

**Auth:** any authenticated active buddy

**Request** — `UpdateBookingBodySchema`
```json
{
  "status": "confirmed | maybe | waitlist | declined",
  "reason": {
    "category": "health | emergency | personal | work | other",
    "freeText": "string"
  }
}
```

`reason` is required when transitioning **`confirmed → declined`**; ignored otherwise. See §8.4 for the full transition matrix and the gating rules.

**Response `200`** — `BookingResponse`

**Errors**
- `404` — booking not found
- `400` — `REASON_REQUIRED` (`confirmed → declined` without `reason`)
- `409` — `TOUR_FULL` (transitioning to `confirmed` but no pool slot remains)
- `422` — `DEADLINE_PASSED` (cancellation deadline has passed; use `/cant-go`), `MAYBE_DEADLINE_PASSED` (transitioning to `maybe` after `maybeDeadline`), or `BUDDY_NOT_FOUND`

---

### Buddy: `POST /tours/:tourId/sessions/:sessionId/bookings/me/cant-go`
Post-deadline "I can't go" report. Only available after `cancellationDeadline` has passed. Status moves to `declined` and a `CancellationReason` row is recorded with `recordedBy = caller`, `unavoidable = null` (unreviewed). Waitlist auto-promotion runs if the prior status was `confirmed`.

**Auth:** any authenticated active buddy

**Request** — `CancellationReasonBodySchema`
```json
{
  "category": "health | emergency | personal | work | other",
  "freeText": "string"
}
```

`freeText` optional.

**Response `200`** — `BookingResponse`

**Errors**
- `404` — booking or buddy not found
- `422` — `DEADLINE_NOT_PASSED` (cancellation deadline still in the future — use the regular update endpoint instead), or `INVALID_STATUS` (booking is already `declined`)

---

### Buddy: `GET /me/bookings`
List the caller's own bookings. **Declined bookings are excluded.** Results are grouped by tour and ordered by tour date descending.

**Auth:** any authenticated active buddy

**Response `200`** — array of `MyTourBookingEntry`
```json
{
  "data": [
    {
      "tourId": "uuid",
      "tourDate": "YYYY-MM-DD",
      "location": "string",
      "status": "draft | published | cancelled | completed",
      "group": { "name": "string" },
      "bookings": [
        {
          "bookingId": "uuid",
          "sessionId": "uuid",
          "sessionOrder": 1,
          "sessionLabel": "string | null",
          "meetingTime": "HH:MM",
          "bookingStatus": "confirmed | maybe | waitlist",
          "bookedAt": "ISO8601"
        }
      ]
    }
  ]
}
```

---

### Admin: `PATCH /admin/bookings/:bookingId/status`
Override a booking's status directly. **No capacity or deadline checks** — admins are trusted to choose the correct status. Does not create or update a `CancellationReason` row; use the cancellation-reason endpoint separately if a reason should be recorded.

**Auth:** `admin`

**Request** — `AdminUpdateBookingStatusSchema`
```json
{ "status": "confirmed | maybe | waitlist | declined" }
```

**Response `200`** — `AdminBookingStatusResponse`
```json
{ "id": "uuid", "status": "..." }
```

**Errors**
- `404` — booking not found

---

### Admin: `PATCH /admin/bookings/:bookingId/cancellation-reason`
Update the `unavoidable` flag on an existing `CancellationReason`. Setting `null` returns the row to "unreviewed".

**Auth:** `admin`

**Request** — `AdminUpdateCancellationSchema`
```json
{ "unavoidable": true }
```

`unavoidable` can be `true`, `false`, or `null`.

**Response `200`** — `CancellationReasonResponse`
```json
{
  "id": "uuid",
  "category": "health | emergency | personal | work | other",
  "freeText": "string | null",
  "unavoidable": "boolean | null",
  "recordedBy": { "email": "string" },
  "createdAt": "ISO8601"
}
```

**Errors**
- `404` — no `CancellationReason` exists for this booking

---

> **⚠ Planned (not shipped):** per-buddy cancellation-deadline override. `BuddyCancellationDeadlineOverride` schema model exists and is consulted by `updateBooking` when present, but no admin API endpoint creates or manages these rows yet.

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

> **⚠ Planned (not shipped).** Neither `GET /config` nor `PATCH /config` is wired — no route file, no service, no DB model. Per-tour deadlines (`cancellationDeadline`, `maybeDeadline`, `notificationOffsets`) live on the `Tour` row; reminder offsets used by the future scheduler are baked into code constants. The shapes below describe intended contract.

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

> **Admin account management** lives under `/admin/profiles*` — see the dedicated **Admin Profiles** section above for the shipped endpoints (`GET /admin/profile`, `GET /admin/profiles`, `PATCH /admin/profile`, `POST /admin/profiles`, `DELETE /admin/profiles/:userId`). There is no `/admins` namespace.

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
