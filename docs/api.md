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
Called on every popup sign-in, not only the first. A restored session (page reload) rehydrates through `GET /auth/me` instead, so `email` is not refreshed until the buddy next signs in. Validates the Firebase ID token (no DB user required yet) and upserts a `User` (role `buddy`) + `BuddyProfile` in `pending` state. `firebaseUid` and `email` come from the verified token, not the body. On an existing user only `email` is written, so the row tracks the current provider address; it is skipped when the token carries no email claim, so a good address is never replaced by an empty one. The profile fields in the body apply to the create branch only.

**Auth:** Firebase ID token (`firebaseAuthMiddleware` only — no DB user yet)

**Request** — `RegisterRequestBodySchema` (all fields optional; falls back to email prefix if `displayName` missing)
```json
{
  "displayName": "string",
  "realName": "string",
  "languages": ["english", "japanese"],
  "bio": "string"
}
```

**Response `200`** — `UserResponse` (identity + nested `buddyProfile`)
```json
{
  "id": "uuid",
  "email": "string",
  "role": "buddy | admin | super_admin",
  "locale": "ja | en",
  "createdAt": "ISO8601",
  "buddyProfile": {
    "id": "uuid",
    "status": "pending | trainee | active | rejected | suspended",
    "tier": "junior | buddy | star | blackstar | null",
    "displayName": "string",
    "realName": "string",
    "photoUrl": "string | null",
    "bio": "string | null",
    "contactInfo": "string | null",
    "languages": ["string"],
    "skills": ["string"],
    "onboardingSeenAt": "ISO8601 | null",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  } | null
}
```

`memberType` and `internalNotes` are never included in buddy-side responses. `tier` is — a buddy may see their own. There is no `GET /auth/me` — buddies use `GET /me/profile`, admins use `GET /admin/profile`.

---

## Buddy Profile

Buddy-side endpoints sit under `/me/profile`. Admin reads/writes use `/admin/buddies/*`. The buddy-side response shape (`BuddyProfileResponse`) includes `tier` — a buddy may see the role they hold — and never includes `memberType`, `internalNotes`, or the underlying `userId`.

### Buddy: `GET /me/profile`
Fetch own profile.

**Auth:** any authenticated buddy

**Response `200`** — `BuddyProfileResponse`
```json
{
  "id": "uuid",
  "status": "pending | trainee | active | rejected | suspended",
  "tier": "junior | buddy | star | blackstar | null",
  "displayName": "string",
  "realName": "string",
  "photoUrl": "string | null",
  "bio": "string | null",
  "contactInfo": "string | null",
  "languages": ["string"],
  "skills": ["string"],
  "onboardingSeenAt": "ISO8601 | null",
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
  "bio": "string",
  "contactInfo": "string",
  "languages": ["english", "japanese"],
  "skills": ["string"]
}
```

`languages` must be unique values from `LanguageSchema`. `availability` is not currently in the update schema — the field is unused in the shipped form.

**Response `200`** — `BuddyProfileResponse`

---

### Buddy: `POST /me/profile/onboarding-seen`
Stamp `onboardingSeenAt` the first time an approved buddy is sent to their
profile. The web app calls this as it redirects; it does not mean the buddy
edited anything. Idempotent — a profile that already carries a timestamp keeps
the original one.

**Auth:** any authenticated buddy

**Request** — no body

**Response `200`** — `BuddyProfileResponse`

**Errors**
- `404` — buddy profile not found

---

### Buddy: `POST /me/profile/photo`
Upload through the api into the environment's private Azure Blob container. Single-step — no signed-URL upload handoff.

**Auth:** any authenticated buddy

**Request** — `multipart/form-data` with one field `photo` (File)

Server validation:
- ≤ 2 MB
- MIME ∈ `image/jpeg` / `image/png` / `image/webp`
- Magic bytes verified against declared MIME (rejects spoofed types)

The previous photo (if any) is deleted from Blob, best-effort, after the DB row updates.

**Response `200`** — updated `BuddyProfileResponse`

`photoUrl` in this and every other response is a read-only signed link that stays the same for the UTC day and expires at the end of the next day, not a permanent address. Do not store it; fetch the profile again for a fresh one.

**Errors**
- `400` — invalid MIME type or magic-byte mismatch
- `404` — buddy profile not found
- `413` — payload too large (> 2 MB)

---

### Buddy: `DELETE /me/profile/photo`
Remove the current profile photo. Sets `photoKey = null` and deletes the blob.

**Auth:** any authenticated buddy

**Response `200`** — updated `BuddyProfileResponse`

---

### Admin: `GET /admin/buddies`
List buddies. Returns `AdminBuddyResponse[]` (includes `tier`, `memberType`, `internalNotes`, `email`).

**Auth:** `admin`

**Query params:** `?status=pending|trainee|active|rejected|suspended`, `?tier=junior|buddy|star|blackstar`, `?memberType=buddy|plab_member`

`tier` is what the buddy can do; `memberType` is what they are to PLAB. The two are independent — a `plab_member` holds a tier like anyone else, and filtering by one says nothing about the other.

**Response `200`** — array of `AdminBuddyResponse`

---

### Admin: `GET /admin/buddies/stats`
Every buddy's numbers for the stats page (PRD §11.4 "Buddy Stats Page", which defines each count). Every status and member type is returned; the page filters rows.

**Auth:** `admin`

**Query params** (all optional; every number counts only `published` and `completed` tours inside them):
- `from`, `to` — tour date range, `YYYY-MM-DD`, inclusive. Absent = open-ended.
- `groupType` — `school | company | community | other`
- `placeId` — uuid. Scopes bookings and reflections to that session place, and evaluations to tours where the buddy held a session there.

**Response `200`** — `AdminBuddyStatsResponse`:
```json
{
  "places": [{ "id": "uuid", "nameJa": "string", "nameEn": "string" }],
  "buddies": [
    {
      "id": "uuid",
      "displayName": "string",
      "realName": "string",
      "status": "pending | trainee | active | rejected | suspended",
      "tier": "junior | buddy | star | blackstar | null",
      "memberType": "buddy | plab_member",
      "createdAt": "ISO8601",
      "stats": {
        "sessionsAttended": 0, "toursAttended": 0, "noShows": 0, "lateUnexcused": 0, "toursMissed": 0, "attendanceRate": "number | null",
        "upcomingConfirmed": 0, "openMaybe": 0, "openWaitlist": 0,
        "firstTourDate": "YYYY-MM-DD | null", "lastTourDate": "YYYY-MM-DD | null", "daysSinceLastTour": "number | null",
        "minutesOnTour": 0, "sessionsWithoutTimes": 0,
        "bookings": 0, "cancellations": 0, "lateCancellations": 0,
        "cancellationsUnavoidable": 0, "cancellationsAvoidable": 0, "cancellationsUnreviewed": 0,
        "cancellationsByCategory": { "health": 0, "emergency": 0, "personal": 0, "work": 0, "other": 0 },
        "cancellationRate": "number | null",
        "reflections": 0, "reflectionRate": "number | null", "moments": 0,
        "evaluationsReceived": 0, "evaluationsMissing": 0,
        "averageScores": { "overallRating": "number | null", "reliability": "number | null", "...": "one per EVALUATION_SCORE_FIELDS" },
        "scoreCounts": { "overallRating": 0, "reliability": 0, "...": "evaluations that set each criterion" },
        "profileOverallRating": "number | null",
        "placesGuided": 0, "sessionsByPlace": { "<placeId>": 0 },
        "groupTypesServed": 0, "sessionsByGroupType": { "school": 0, "company": 0, "community": 0, "other": 0 },
        "monthsSinceRegistration": 0
      }
    }
  ]
}
```
Rates are `0`–`1`. A rate or average with nothing to divide by is `null`. `toursMissed` and `scoreCounts` let the page pool the attendance rate and criterion averages across buddies. `internalNotes` is never included.

**Errors**
- `400` — a param fails validation (`from`/`to` not `YYYY-MM-DD`, `from` after `to`, unknown `groupType`, `placeId` not a uuid)

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
        "places": [{ "id": "uuid", "nameJa": "string", "nameEn": "string" }],
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
  "absenceSummary": { "absentWithoutReport": 0 },
  "stats": { "...": "BuddyStats, all time — see GET /admin/buddies/stats" }
}
```

**Errors**
- `404` — buddy not found

---

### Admin: `PUT /admin/buddies/:id`
Update admin-managed fields. All fields optional. `tier` and `internalNotes` accept `null` to clear; `memberType` does not — it is non-nullable and defaults to `buddy`.

**Auth:** `admin`

**Request** — `UpdateAdminBuddyProfileSchema`
```json
{
  "tier": "junior | buddy | star | blackstar | null",
  "memberType": "buddy | plab_member",
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

## Admin Dashboard

### Admin: `GET /admin/dashboard`
The admin home worklist (PRD §11.7). Each queue is computed by the service that owns its data.

**Auth:** `admin`

**Response `200`** — `AdminDashboardResponse`
```json
{
  "pendingBuddies": [
    { "id": "uuid", "displayName": "string", "createdAt": "ISO8601" }
  ],
  "overdueMaybeTours": [
    { "id": "uuid", "tourDate": "ISO8601", "group": { "name": "string" }, "maybeDeadline": "ISO8601", "maybeCount": 2 }
  ],
  "underfilledTours": [
    {
      "id": "uuid",
      "tourDate": "ISO8601",
      "group": { "name": "string" },
      "sessions": [{ "id": "uuid", "order": 1, "label": "string | null", "minBuddies": 3, "confirmedCount": 1 }]
    }
  ],
  "underfilledLookaheadDays": 14,
  "toursMissingEvaluations": [
    { "id": "uuid", "tourDate": "ISO8601", "group": { "name": "string" }, "missingCount": 2 }
  ]
}
```

`underfilledTours[].sessions` holds only the sessions below their minimum. Unread notifications are not included — the page reads them from `GET /me/notifications`.

---

## Announcements

お知らせ PLAB members write for buddies' Home (PRD §11.11). Not a notification:
nothing is sent. Dates are JST calendar dates as `YYYY-MM-DD`.

### Admin: `GET /admin/announcements`
Every announcement, in the members' order (`position` ascending).

**Auth:** `admin`

**Response `200`** — `AdminAnnouncementResponse[]`
```json
[
  {
    "id": "uuid",
    "titleJa": "string",
    "bodyJa": "string (limited Markdown)",
    "titleEn": "string | null",
    "bodyEn": "string | null",
    "audience": "rule | selected",
    "statuses": ["trainee | active"],
    "tiers": ["junior | buddy | star | blackstar"],
    "buddies": [{ "id": "uuid", "displayName": "string", "realName": "string" }],
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "position": 0,
    "tour": { "id": "uuid", "tourDate": "ISO8601", "groupName": "string" },
    "createdBy": { "name": "string" },
    "updatedBy": { "name": "string" },
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
]
```

`statuses` and `tiers` are set for `rule` only, `buddies` for `selected` only. `tour` is `null` when none is linked.

### Admin: `GET /admin/announcements/:id`
**Auth:** `admin` · **Response `200`** — `AdminAnnouncementResponse` · **Errors** — `404`

### Admin: `POST /admin/announcements`
Create one. It goes to the top of the order. The caller is recorded as author and last editor.

**Auth:** `admin`

**Request** — `UpsertAnnouncementSchema`
```json
{
  "titleJa": "string",
  "bodyJa": "string",
  "titleEn": "string | null",
  "bodyEn": "string | null",
  "audience": "rule | selected",
  "statuses": ["trainee | active"],
  "tiers": ["junior | buddy | star | blackstar"],
  "buddyIds": ["uuid"],
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "tourId": "uuid | null"
}
```

- `titleJa` and `bodyJa` are required; `titleEn` and `bodyEn` are both set or both `null`
- `endDate` ≥ `startDate`
- `rule`: `statuses` AND `tiers`, an empty list meaning any; `buddyIds` is ignored
- `selected`: at least one `buddyIds`; `statuses` and `tiers` are ignored

**Response `201`** — `AdminAnnouncementResponse`

**Errors**
- `400` — invalid body, or a `tourId` / `buddyIds` entry that does not exist

### Admin: `PUT /admin/announcements/:id`
Replace one, including its picked buddies. The caller becomes the last editor. Silent: nothing is sent.

**Auth:** `admin` · **Request** — `UpsertAnnouncementSchema` · **Response `200`** — `AdminAnnouncementResponse`

**Errors**
- `400` — as for `POST`
- `404` — not found

### Admin: `DELETE /admin/announcements/:id`
Delete one; it leaves buddies' Home at once.

**Auth:** `admin` · **Response `204`** · **Errors** — `404`

### Admin: `PUT /admin/announcements/order`
Set the order.

**Auth:** `admin`

**Request** — `ReorderAnnouncementsSchema`: `{ "ids": ["uuid"] }`, top first, every announcement exactly once.

**Response `200`** — `AdminAnnouncementResponse[]` in the new order

**Errors**
- `409` — `ids` is not every announcement exactly once (one was added or deleted meanwhile)

### Admin: `POST /admin/announcements/audience-count`
How many buddies an audience matches now, for the form's live count.

**Auth:** `admin`

**Request** — `AnnouncementAudienceInputSchema`: `{ "audience", "statuses", "tiers", "buddyIds" }`

**Response `200`** — `{ "count": 0 }`: `trainee` and `active` buddies only. A rule with tiers never counts a buddy without a tier.

### Buddy: `GET /me/announcements`
What the caller sees on Home, in the members' order.

**Auth:** any signed-in user; empty unless the caller is a `trainee` or `active` buddy

**Response `200`** — `MyAnnouncementResponse[]`
```json
[{ "id": "uuid", "titleJa": "string", "bodyJa": "string", "titleEn": "string | null", "bodyEn": "string | null", "tourId": "uuid | null" }]
```

Only announcements with `startDate ≤ today (JST) ≤ endDate` whose audience matches the caller now. The response never carries the audience, so nothing says why the buddy got it.

A tour-linked announcement is left out when no session of the tour is short of buddies (`confirmed < minBuddies`), the tour is not `published`, or its date is before today; and, for this buddy, when no short session has room for them — they already hold a `confirmed`, `maybe` or `waitlist` booking there, or `myRemaining` (`GET /tours/:id`) is 0. A trainee never sees one: `GET /tours/:id` hides tours from them.

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
      "places": [{ "id": "uuid", "nameJa": "string", "nameEn": "string" }],
      "participantCount": 0,
      "description": "string | null",
      "sessions": [{ "...": "TourSessionResponse" }],
      "createdAt": "ISO8601"
    }
  ]
}
```

`tours` is ordered by `tourDate` descending.

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

## Places and Spots

Admin-managed lookup tables replacing the old free-text `Tour.location`. A `Place` (e.g. a park) contains `Spot`s (e.g. a monument inside it) — most places have none. Rows are retired via `active: false`, never deleted; there is no `DELETE` endpoint. All routes are `admin`.

### `GET /admin/places`
List every place, active and inactive, ordered by `sortOrder`.

**Response `200`** — array of `PlaceResponse`
```json
{ "id": "uuid", "nameJa": "string", "nameEn": "string", "sortOrder": 0, "active": true }
```

---

### `POST /admin/places`
**Request** — `CreatePlaceSchema`
```json
{ "nameJa": "string (min 1)", "nameEn": "string (min 1)", "sortOrder": 0, "active": true }
```

**Response `201`** — `PlaceResponse`

---

### `GET /admin/places/:id`
Place detail, with its spots.

**Response `200`** — `PlaceDetailResponse` (= `PlaceResponse` + `spots: SpotResponse[]`, ordered by `sortOrder`)

**Errors**
- `404` — not found

---

### `PUT /admin/places/:id`
All fields optional. Renaming is for corrections only (typos, translations) — a row is never repointed to mean a different place.

**Request** — `UpdatePlaceSchema`

**Response `200`** — `PlaceResponse`

**Errors**
- `404` — not found

---

### `POST /admin/places/:id/spots`
Create a spot under the place.

**Request** — `CreateSpotSchema` (same shape as `CreatePlaceSchema`)

**Response `201`** — `SpotResponse`

**Errors**
- `404` — place not found

---

### `PUT /admin/places/:id/spots/:spotId`
All fields optional. `placeId` is fixed at creation and cannot be changed here — a spot is never reassigned to a different place.

**Request** — `UpdateSpotSchema`

**Response `200`** — `SpotResponse`

**Errors**
- `404` — place or spot not found, or the spot belongs to a different place

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
      "places": [{ "id": "uuid", "nameJa": "string", "nameEn": "string" }],
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
          "minBuddies": 1,
          "participantCount": 0,
          "place": { "id": "uuid", "nameJa": "string", "nameEn": "string" },
          "confirmedCount": 0,
          "myBookingStatus": "confirmed | maybe | waitlist | declined | null"
        }
      ],
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```

`sessions[].place` is the one place that session goes to. The tour-level `places` is derived from it — each session's place once, in session order — so a two-session tour shows one or two places.

`sessions[].myBookingStatus` is the caller's own booking on that session — `null` when they have none or have no buddy profile. All listed sessions are resolved in one booking query.

`sessions[].confirmedCount` is the session's `confirmed` bookings, counted as the admin "short of buddies" list counts them (PRD §11.7). `/buddy` shows `minBuddies − confirmedCount` as "N more buddies needed". `GET /tours/:id` leaves it out; its `seatCounts.confirmed` is the same number.

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
      "place": {
        "id": "uuid",
        "nameJa": "string",
        "nameEn": "string",
        "spots": [{ "id": "uuid", "nameJa": "string", "nameEn": "string" }]
      },
      "seatCounts": { "confirmed": 0, "maybe": 0, "waitlist": 0, "declined": 0 },
      "remaining": 0,
      "myCapacity": 0,
      "myRemaining": 0,
      "myBookingStatus": "confirmed | maybe | waitlist | declined | null"
    }
  ],
  "staffInCharge": { "name": "string" }
}
```

`sessions[].place` on the detail response is richer than on `GET /tours`: it carries the place's **active** spots, sorted by `sortOrder` — this is what feeds the buddy's spot picker when writing a reflection on that session (`POST /me/reflections`).

`myCapacity` / `myRemaining` reflect the caller's tier pool (junior vs non-junior vs overflow into anyone).

`staffInCharge` is the tour's designated admin by name only, or `null` when none is designated or that admin is deleted. It is on the detail response only, not on `GET /tours`.

---

### Buddy: `GET /tours/:id/calendar.ics`
Downloads an iCalendar (`.ics`) file for the tour, with one `VEVENT` per session the caller holds a **confirmed** booking on — not every session in the tour, and not maybe/waitlist. `404` if the tour isn't visible to the caller (same rule as `GET /tours/:id`) or if the caller has no confirmed session on it.

**Auth:** any authenticated active buddy

**Response `200`** — `text/calendar; charset=utf-8`, `Content-Disposition: attachment; filename="tour-:id.ics"`. Each event's `SUMMARY` is the group name (plus the session label in parentheses, if set), `LOCATION` is that session's place name in the **caller's own** `User.locale` — the one place this feature renders a single language server-side, since a static file has no later web render to pick one at. `DESCRIPTION` is `Tour.description` (never `adminMemo`). Times are emitted as UTC instants (no `VTIMEZONE`), computed from the tour's JST calendar date and the session's `meetingTime`/`startTime`/`endTime` via the same fixed +9h offset as `getTodayJst`. `UID` is `session-<sessionId>@peace-buddy.internal`, stable across re-download.

`STATUS` follows the tour: `cancelled` → `CANCELLED`, `draft` → `TENTATIVE`, `published`/`completed` → `CONFIRMED`. Cancelling a tour does not change booking rows, so a buddy keeps their confirmed seat and the file is still served — re-downloading it retracts the event in their calendar rather than leaving a dead one. Note that no `SEQUENCE` is emitted, so a client that requires one may not apply the retraction automatically.

`DTEND` is the session's `endTime` when that resolves to *after* `DTSTART`, otherwise `DTSTART` + 1 hour. The fallback matters because `startTime` and `endTime` carry no ordering constraint in `CreateTourSessionSchema` / `UpdateTourSessionSchema` and none in the session service, so the API accepts an `endTime` on its own or one earlier than `startTime`.

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
      "capacity": 1,
      "minBuddies": 1,
      "participantCount": 0,
      "placeId": "uuid"
    }
  ]
}
```

- `sessions` is required, length 1 or 2; additional sessions are added later via the session endpoints
- Each session's `minBuddies` is required: an integer from 1 to its `capacity`
- Each session's `placeId` is required — exactly one place per session, and the two sessions may differ (see `## Places and Spots`). An unknown `placeId` is not caught as a `400`
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

### Admin: `GET /admin/tours/:id/calendar.ics`
Downloads an iCalendar (`.ics`) file for the tour, with one `VEVENT` per session — every session, not filtered by any booking (an admin has no personal booking to filter by).

**Auth:** `admin`

**Response `200`** — same shape and field mapping as `GET /tours/:id/calendar.ics` (buddy), minus the confirmed-session filter.

**Errors**
- `404` — not found

---

### Admin: `PUT /admin/tours/:id`
Update a tour. All fields optional; nullable fields can be cleared with `null`.

**Auth:** `admin`

**Request** — `UpdateTourSchema` (same fields as create, no `sessions`)

**Response `200`** — `AdminTourDetailResponse`

A tour has no place of its own — a session's place is changed through `PUT /admin/tours/:id/sessions/:sessionId`.

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

**Request** — `CreateTourSessionSchema` (`label?`, `meetingTime`, `startTime?`, `endTime?`, `capacity`, `minBuddies` (1 to `capacity`), `participantCount?`, `placeId`)

**Response `201`** — `AdminTourDetailResponse`

**Errors**
- `404` — tour not found
- `409` — `TourImmutableError` (cancelled / completed) or `TooManySessionsError` (already 2 sessions)

---

#### `PUT /admin/tours/:id/sessions/:sessionId`
Update a session.

**Auth:** `admin`

**Request** — `UpdateTourSessionSchema` (all fields optional, including `placeId`). `minBuddies`, when sent, is at least 1; it cannot be cleared

**Response `200`** — `AdminTourDetailResponse`

Changing `placeId` or `meetingTime` on a published tour fires `tour_details_changed` to every booked buddy on the tour (not only this session's). Resending the current value is not a change.

**Errors**
- `400` — `MinBuddiesExceedsCapacityError`: `minBuddies` would exceed `capacity`, taking the stored value of whichever one is not sent
- `404` — `SessionNotFoundError`: no such session on this tour
- `409` — `PlaceInUseError`: `placeId` changes while a `TourReflectionMoment` on this session references a spot of its current place
- `409` — `CapacityBelowConfirmedError`: `capacity` is lower than the session's Confirmed bookings

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
Create a booking for one session of the tour. Without `status`, the server decides `confirmed` vs `waitlist` from the session's tier pool state (see PRD §8.9). With `status: "maybe"`, the booking is created as `maybe`: it holds no seat, so the pools are not consulted. With `status: "declined"`, the buddy answers 参加不可 up front: the booking is created as `declined`, with no deadline check, no cancellation reason and no admin notification. It is not counted as a cancellation.

**Auth:** any authenticated active buddy with a tier assigned

**Request** — `CreateBookingBodySchema`
```json
{ "sessionId": "uuid", "status": "maybe | declined" }
```
`status` is optional; `maybe` and `declined` are its only accepted values.

**Response `201`** — `BookingResponse`
```json
{
  "id": "uuid",
  "tourId": "uuid",
  "sessionId": "uuid",
  "buddyTier": "junior | buddy | star | blackstar",
  "status": "confirmed | waitlist | maybe | declined",
  "bookedAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

A previously declined booking is reused (upsert) — re-booking returns a fresh status based on current pool state.

**Errors**
- `404` — tour, session, or buddy not found
- `409` — `ALREADY_BOOKED` (a non-declined booking exists)
- `403` — `NOT_ELIGIBLE` (buddy is trainee or inactive)
- `422` — `NOT_BOOKABLE` (tour not published, `bookingOpen = false`, or the tour date is today or earlier in Japan)
- `422` — `DEADLINE_PASSED` (`status: "maybe"` only; the caller's cancellation deadline, after any override, is today or earlier in Japan)
- `422` — `MAYBE_DEADLINE_PASSED` (`status: "maybe"` only; the tour's `maybeDeadline` is today or earlier in Japan)

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
- `422` — `DEADLINE_PASSED` (today in Japan is on or after the cancellation deadline; use `/cant-go`), `MAYBE_DEADLINE_PASSED` (transitioning to `maybe` on or after `maybeDeadline` in Japan), or `BUDDY_NOT_FOUND`

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
- `422` — `DEADLINE_NOT_PASSED` (today in Japan is before the cancellation deadline — use the regular update endpoint instead), or `INVALID_STATUS` (booking is already `declined`)

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
      "tourDate": "ISO8601",
      "places": [{ "id": "uuid", "nameJa": "string", "nameEn": "string" }],
      "status": "draft | published | cancelled | completed",
      "maybeDeadline": "ISO8601 | null",
      "reflectionSubmitted": false,
      "absent": false,
      "group": { "name": "string", "type": "school | company | community | other" },
      "bookings": [
        {
          "bookingId": "uuid",
          "sessionId": "uuid",
          "sessionOrder": 1,
          "sessionLabel": "string | null",
          "meetingTime": "ISO8601",
          "startTime": "ISO8601 | null",
          "endTime": "ISO8601 | null",
          "place": { "id": "uuid", "nameJa": "string", "nameEn": "string" },
          "bookingStatus": "confirmed | maybe | waitlist",
          "bookedAt": "ISO8601"
        }
      ]
    }
  ]
}
```

`maybeDeadline` is the tour's. `startTime`, `endTime` and `place` are the session's: `places` lists every place of the tour, while a session's `place` is where that one session goes, so バディ記録 (`/buddy/record`) counts the buddy's tours by the places of the sessions they held. `absent` is whether the attendance record marks the caller absent from the tour; `/buddy/history` leaves such a tour out (PRD §8.8). `reflectionSubmitted` is whether the caller has written a reflection on **any** session of that tour — reflections are per session, the obligation is per tour. `/buddy` builds its next-tour and needs-your-action sections from these (PRD §11.1).

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

Backed by three distinct database models (see data-model.md): `AdminEvaluation` (per-tour), `AdminProfileEvaluation` (overall profile), `TourReflection` (the buddy's own account of a session, free text, no scores). Routes are namespaced by audience: admin-authored evaluations live under `/admin/*`, buddy-authored reflections under `/me/reflections`. Admin read-only access to reflections lives under `/admin/reflections`.

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

All score / note fields are optional except `buddyId` and `tourId`. Absence is not here: it is on the attendance record (`PUT /admin/tours/:id/attendance/:buddyId`).

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

**Request** — `UpsertAdminProfileEvaluationSchema` (same score / note fields as admin per-tour, **no** `tourId`)

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

### Buddy Tour Reflections

Four free-text prompts plus structured `moments` about a session the buddy guided. No scores — see data-model.md `TourReflection` / `TourReflectionMoment` and PRD §9.3. `memorableMoment` was a fifth free-text prompt until #239 replaced it with `moments`.

#### `POST /me/reflections`
Buddy writes a reflection on one session of a completed tour.

**Auth:** `buddy`

**Request** — `CreateTourReflectionSchema`
```json
{
  "sessionId": "uuid",
  "didWell": "string | null",
  "couldImprove": "string | null",
  "notesForOthers": "string | null",
  "openQuestions": "string | null",
  "moments": [
    { "spotId": "uuid | null", "placeNote": "string | null", "description": "string (min 1)" }
  ]
}
```
At least one of the four prompts must be non-empty, or `moments` must be non-empty. Each moment sets exactly one of `spotId` / `placeNote` — never both, never neither. `placeNote` and `description` are trimmed first, so a blank `placeNote` counts as unset (stored `null`) and a whitespace-only `description` is rejected. `moments` defaults to `[]` when omitted. `position` is derived server-side from array order.

**Response `201`** — `TourReflectionResponse`
```json
{
  "id": "uuid",
  "buddyId": "uuid",
  "sessionId": "uuid",
  "sessionOrder": 1,
  "sessionLabel": "string | null",
  "tourId": "uuid",
  "didWell": "string | null",
  "couldImprove": "string | null",
  "notesForOthers": "string | null",
  "openQuestions": "string | null",
  "moments": [
    {
      "id": "uuid",
      "position": 0,
      "spotId": "uuid | null",
      "placeNote": "string | null",
      "description": "string",
      "spot": { "id": "uuid", "nameJa": "string", "nameEn": "string", "place": { "id": "uuid", "nameJa": "string", "nameEn": "string" } } | null
    }
  ],
  "locked": false,
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```
`tourId`, `sessionOrder` and `sessionLabel` are read through the session relation — `TourReflection` stores none of them. `moments`, ordered by `position`.

**Errors**
- `400` — all four prompts blank and no moments, a moment sets both/neither of `spotId`/`placeNote`, or a `spotId` is not a spot of the session's place (retired spots are accepted)
- `403` — buddy holds no `confirmed` booking on that session, or the tour is not in `completed` status
- `409` — a reflection already exists for this session

---

#### `GET /me/reflections`
List the authenticated buddy's own reflections.

**Auth:** `buddy`

**Query params:** `?tourId=uuid` (optional) — filters through the session relation, returning every session of that tour the buddy wrote up

**Response `200`** — array of `TourReflectionResponse`, ordered by `createdAt` descending

---

#### `PUT /me/reflections/:id`
Edit own reflection within the 7-day edit window.

**Auth:** `buddy` (must equal owner)

**Request** — `UpdateTourReflectionSchema` (the four prompts and `moments`, no `sessionId`). This is a **replacement**, not a patch: a prompt left out is cleared, every moment is deleted and recreated from the array (fresh `position`s), and at least one prompt or moment must survive.

**Response `200`** — `TourReflectionResponse`

**Errors**
- `400` — all four prompts blank and no moments, a moment sets both/neither of `spotId`/`placeNote`, or a `spotId` is not a spot of the session's place (retired spots are accepted)
- `404` — not found, or owned by another buddy
- `409` — edit window (7 days from creation) has closed

---

### Reflections (admin read access)

#### `GET /admin/reflections`
Admins read all buddy reflections.

**Auth:** `admin`

**Query params:** `?buddyId=uuid` (optional)

**Response `200`** — array of `AdminTourReflectionResponse` (adds `buddyDisplayName` and `tourDate`, drops `locked`; same `moments` shape), ordered by `createdAt` descending

---

#### `GET /admin/reflections/stats`
Every reflection in scope for the reflection stats page (PRD §11.4 "Reflection Stats Page"), with the sessions each buddy attended in the same scope, the rate's denominator. The page computes its figures and charts from this response and filters rows itself.

**Auth:** `admin`

**Query params:** the same as `GET /admin/buddies/stats` (`from`, `to`, `groupType`, `placeId`), plus:
- `tourId` — uuid. Only that tour.

Only `published` and `completed` tours count, as on the buddy stats. `placeId` keeps reflections on sessions at that place.

**Response `200`** — `AdminReflectionStatsResponse`:
```json
{
  "reflections": [
    {
      "...": "AdminTourReflectionResponse",
      "buddyRealName": "string",
      "buddyMemberType": "buddy | plab_member",
      "group": { "name": "string", "type": "school" },
      "place": { "id": "uuid", "nameJa": "string", "nameEn": "string" }
    }
  ],
  "buddies": [
    { "id": "uuid", "displayName": "string", "realName": "string", "memberType": "buddy", "sessionsAttended": 3 }
  ],
  "places": [
    {
      "id": "uuid", "nameJa": "string", "nameEn": "string", "active": true,
      "spots": [{ "id": "uuid", "nameJa": "string", "nameEn": "string", "active": true }]
    }
  ]
}
```
- `reflections[].place` is the session's place, the place every moment on it belongs to. Ordered by `createdAt` descending.
- `buddies` lists every buddy with at least one session attended in scope, counted as `sessionsAttended` on `GET /admin/buddies/stats`, whatever their status or member type.
- `places` is every place and every spot, retired ones included, in `sortOrder`.

**Response `400`** — a malformed date, group type or uuid, or `from` after `to`.

---

#### `GET /admin/reflections/:id`
Fetch a single reflection.

**Auth:** `admin`

**Response `200`** — `AdminTourReflectionResponse` or `404`

---

## Attendance

The record of when each buddy actually worked (#262, PRD §11.10). Times are
JST clock times as `HH:MM`; `minutes` are whole minutes, and `null` when the
hours cannot be known yet (no finish time for the day, and no leave time of
the buddy's own). Every write is logged in `AttendanceChange`. A write that
touches a locked month returns `409 conflict`.

### Admin: `GET /admin/tours/:id/attendance`
The tour's attendance sheet: one row per confirmed buddy.

**Auth:** `admin`

**Response `200`** — `TourAttendanceResponse`
```json
{
  "tourId": "uuid",
  "date": "YYYY-MM-DD",
  "editable": true,
  "locked": false,
  "finishTime": "HH:MM | null",
  "break": { "start": "HH:MM | null", "end": "HH:MM | null", "minutes": 45 },
  "followingFinish": 5,
  "rows": [
    {
      "buddyId": "uuid", "displayName": "string", "realName": "string", "memberType": "buddy | plab_member",
      "defaultArrival": "HH:MM",
      "arrivalTime": "HH:MM | null", "lateMinutes": 0,
      "lateReason": "transport_delay | other | null", "lateNote": "string | null", "lateExcused": "boolean | null",
      "leaveTime": "HH:MM | null", "leaveNote": "string | null", "earlyMinutes": "number | null",
      "absent": false, "absenceReported": "boolean | null",
      "breakMinutes": 0,
      "minutes": "number | null"
    }
  ],
  "changes": [
    { "id": "uuid", "kind": "finish_time | attendance | tour_break", "buddyName": "string | null", "fields": ["arrivalTime"], "changedByName": "string", "createdAt": "ISO8601" }
  ]
}
```

`editable` is false until the tour is `completed`, and while its month is
locked. `followingFinish` counts buddies on every completed tour of the date
whose end is the finish time. `break` is the tour's unpaid break, `null` for
none; a row's `breakMinutes` is the part of it inside that buddy's start → end
(0 when absent). `changes` covers the whole date, newest first, plus this
tour's break changes.

**Errors:** `404` — tour not found

---

### Admin: `PUT /admin/attendance/days/:date`
Sets the finish time of a tour date (`YYYY-MM-DD`). It is the default end of
every buddy on every tour of that date; individual leave times are untouched.

**Auth:** `admin`

**Request** — `SetFinishTimeSchema`: `{ "finishTime": "HH:MM" }`

**Response `200`** — `{ "date": "YYYY-MM-DD", "finishTime": "HH:MM" }`

**Errors:** `400` — invalid date or time, or a time at or before the start of a buddy present that day without a leave time of their own · `404` — no completed tour on that date · `409` — month locked

---

### Admin: `PUT /admin/tours/:id/attendance/:buddyId`
Replaces one buddy's exceptions on the tour. Sending the default state
(`absent: false`, everything else `null`) deletes the row — "Back to default".

**Auth:** `admin`

**Request** — `UpdateAttendanceSchema`
```json
{
  "absent": false,
  "absenceReported": null,
  "arrivalTime": "HH:MM | null",
  "lateReason": "transport_delay | other | null",
  "lateNote": "string | null",
  "lateExcused": "boolean | null",
  "leaveTime": "HH:MM | null",
  "leaveNote": "string | null"
}
```

Rules, beyond the schema:
- Absent needs `absenceReported` and no times.
- An arrival after the buddy's default start needs `lateReason` and
  `lateExcused`; `other` needs `lateNote`. For an arrival that is not late the
  late fields are stored as `null`.
- Arrival must be before leave (or the finish time).

**Response `200`** — the updated `TourAttendanceResponse`, as `GET /admin/tours/:id/attendance`

**Errors:** `400` — invalid body or rule · `404` — tour not found, or the buddy has no confirmed booking on it · `409` — tour not `completed`, or month locked

---

### Admin: `PUT /admin/tours/:id/attendance/break`
Sets or removes the tour's unpaid break. Everyone on the tour takes it
together: with start and end, each buddy loses only the part inside their own
start → end; with minutes alone, every buddy present loses them, up to their
own span.

**Auth:** `admin`

**Request** — `SetAttendanceBreakSchema`: `{ "break": { "start": "HH:MM", "end": "HH:MM" } }`,
`{ "break": { "minutes": 45 } }`, or `{ "break": null }` to remove it. End must
be after start; minutes 1–720.

**Response `200`** — the updated `TourAttendanceResponse`, as `GET /admin/tours/:id/attendance`

**Errors:** `400` — invalid body · `404` — tour not found · `409` — tour not `completed`, or month locked

---

### Admin: `GET /admin/attendance?month=YYYY-MM`
The month: one row per buddy per day, the lock, and open flags.

**Auth:** `admin`

**Response `200`** — `AttendanceMonthResponse`
```json
{
  "month": "YYYY-MM",
  "lock": { "lockedAt": "ISO8601", "lockedByName": "string" },
  "days": [
    {
      "date": "YYYY-MM-DD", "buddyId": "uuid", "displayName": "string", "realName": "string", "memberType": "buddy | plab_member",
      "tours": [{ "tourId": "uuid", "groupName": "string" }],
      "start": "HH:MM | null", "end": "HH:MM | null", "breakMinutes": 0, "minutes": "number | null",
      "absent": false, "finishMissing": false, "lateMinutes": 0, "lateExcused": "boolean | null"
    }
  ],
  "openFlags": [
    { "id": "uuid", "buddyId": "uuid", "displayName": "string", "date": "YYYY-MM-DD", "note": "string", "createdAt": "ISO8601" }
  ]
}
```

`lock` is `null` for an open month. A day covers the buddy's completed tours
of that date: `start` is the first arrival, `end` the last leave, and
`minutes` = end − start − `breakMinutes`. `absent` is true only when the buddy
was absent from every tour of the day (0 minutes). The web filters this
response (buddy, tour, member type, status, date range) and builds the finance
CSV from the rows the filters leave.

---

### Admin: `POST /admin/attendance/locks`
Locks a month. **Request** — `{ "month": "YYYY-MM" }`. **Response `201`** — `{ "month": "YYYY-MM" }`. **Errors:** `409` — already locked.

### Admin: `DELETE /admin/attendance/locks/:month`
Unlocks a month. **Response `204`**. **Errors:** `404` — not locked.

### Admin: `POST /admin/attendance/flags/:id/resolve`
Marks a buddy's flag resolved. **Response `204`**. **Errors:** `404` — not found · `409` — already resolved.

---

### Buddy: `GET /me/attendance?month=YYYY-MM`
The caller's own days in the month, over completed tours.

**Auth:** any authenticated buddy

**Response `200`** — `MyAttendanceResponse`
```json
{
  "month": "YYYY-MM",
  "days": [
    {
      "date": "YYYY-MM-DD",
      "tours": [{ "tourId": "uuid", "groupName": "string" }],
      "start": "HH:MM | null", "end": "HH:MM | null", "breakMinutes": 0, "minutes": "number | null",
      "absent": false, "finishMissing": false,
      "flag": { "id": "uuid", "note": "string", "createdAt": "ISO8601", "resolvedAt": "ISO8601 | null" }
    }
  ]
}
```

`flag` is the day's latest flag, or `null`. Late reasons and whether a
lateness was excused are not included.

### Buddy: `POST /me/attendance/flags`
Reports a mistake in the caller's record for a day. Notifies every PLAB
member in-app and posts to Slack (`attendance_flagged`).

**Request** — `CreateAttendanceFlagSchema`: `{ "date": "YYYY-MM-DD", "note": "string" }`

**Response `201`** — `{ "id": "uuid" }`

**Errors:** `400` — invalid body · `404` — the caller has no record on that date · `409` — an open flag already exists for that date

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

Admin and buddy preferences share one `NotificationPreference` table but are
reached through separate endpoints with separate event sets. `slackEnabled` is
informational only — nothing reads it at enqueue time (PRD §10.3).

### `GET /admin/notification-preferences`
Returns the authenticated admin's notification preferences. Every event type is
present; those with no stored row are filled in from the defaults (email off —
Slack is the admin channel).

**Auth:** `admin`

**Response `200`**
```json
{
  "preferences": [
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

### `PUT /admin/notification-preferences`
Upserts notification preferences for the authenticated admin. Send the full array.

**Auth:** `admin`

**Request**
```json
{
  "preferences": [
    {
      "eventType": "new_signup | new_booking | cancellation | maybe_resolved | maybe_deadline_missed",
      "emailEnabled": true,
      "emailMode": "immediate | digest",
      "slackEnabled": false
    }
  ]
}
```

**Response `200`** — updated preferences

**Errors:** `400 invalid_request` — malformed body, unknown `eventType`, or a duplicate `eventType`

---

## Notification Preferences *(buddy)*

Email on/off per event. No delivery mode and no Slack column: the digest is an
admin concept and Slack is not a buddy channel (PRD §10.3). In-app delivery is
not configurable — a muted event still appears in `GET /me/notifications`.

Only the four mutable events are addressable. `tour_cancelled`,
`waitlist_promoted`, `account_approved` and `account_rejected` are not in the
enum and a request naming one is rejected (PRD §10.1).

### `GET /me/notification-preferences`
Returns the authenticated buddy's email preferences. All four events are
present; those with no stored row default to `emailEnabled: true`.

**Auth:** authenticated

**Response `200`**
```json
{
  "preferences": [
    {
      "eventType": "tour_published | tour_details_changed | tour_reminder | maybe_reminder",
      "emailEnabled": true
    }
  ]
}
```

---

### `PUT /me/notification-preferences`
Upserts the authenticated buddy's email preferences. Send the full array.

**Auth:** authenticated

**Request**
```json
{
  "preferences": [
    {
      "eventType": "tour_published | tour_details_changed | tour_reminder | maybe_reminder",
      "emailEnabled": false
    }
  ]
}
```

**Response `200`** — updated preferences

**Errors:** `400 invalid_request` — malformed body, an `eventType` outside the mutable set, or a duplicate `eventType`

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
