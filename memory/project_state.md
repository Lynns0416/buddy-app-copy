---
name: Project state
description: Current build status, blockers, and next steps
type: project
originSessionId: fc506377-5348-44f6-8a36-6390a05db19f
---
## Built (most recent)

### Post-merge review fixes for PR #56 · COMPLETE
- [x] `docker-compose.yml`: restore separate `ci_nm_*` volumes (single `ci:` volume was merging all node_modules)
- [x] `admin.service.ts`: typed Prisma update data (`Record<string,unknown>` → explicit type); remove dead P2025 catch from `getBuddyDetail`
- [x] `api-client.ts`: `updateBuddy` typed as `UpdateAdminBuddyProfile` (was `Record<string,unknown>`)
- [x] `admin.buddy.ts`: extract shared `mapBuddyError(t, error)` — dedup across pages
- [x] `pending/page.tsx`: show error message when approve/reject action fails (was silently swallowed)
- [x] `buddy-form.tsx`: remove react-hook-form (was unused); remove unused `useEffect` import
- [x] `app-shell.tsx`: fix active nav state — "Buddies" highlights on `/admin/buddies/:id`

### Admin buddy management (full) · PRD §11.4 — COMPLETE (PR #56)
- [x] `GET /admin/buddies/:id`, `PUT /admin/buddies/:id`, `PUT /admin/buddies/:id/status`
- [x] Admin buddy detail page, tier/notes form, pending approval queue, buddy roster

### Buddy profile settings · PRD §5.3, §11.6 — COMPLETE
- [x] `LanguageSchema` enum (14 ordered values) added to `packages/types`
- [x] `UpdateBuddyProfileSchema.languages` → `z.array(LanguageSchema)`; `BuddyProfileResponse.languages` → `Language[]`
- [x] API test fixtures updated (`['en']` → `['english']` etc.), `prisma/seed.ts` updated
- [x] `getMyProfile`, `updateMyProfile` in `api-client.ts`; `dashboardProfile` route added
- [x] `dashboard/profile/dashboard.profile.ts` + tests
- [x] `dashboard/profile/page.tsx` + `_components/profile-form.tsx` (language checkboxes, skills textarea, photo disabled)
- [x] `app-shell.tsx`: Profile nav item for buddy variant; generalized isActive logic

## Next (priority order)

### 1. — TBD

**API: zero changes needed.** `GET /me/profile` and `PUT /me/profile` already exist.

Files to create/modify:

| File | Action |
|---|---|
| `packages/types/src/index.ts` | Add `LanguageSchema` enum (14 values, ordered); update `UpdateBuddyProfileSchema.languages` to `z.array(LanguageSchema)`; update `BuddyProfileResponse.languages` to `Language[]` |
| `apps/web/src/lib/api-client.ts` | Add `getMyProfile`, `updateMyProfile` (uses existing `apiPaths.meProfile`) |
| `apps/web/src/lib/routes.ts` | Add `dashboardProfile: /${locale}/dashboard/profile` |
| `apps/web/src/app/[locale]/dashboard/profile/dashboard.profile.ts` | New — `fetchMyProfile`, `updateMyProfile` thin functions |
| `apps/web/src/app/[locale]/dashboard/profile/dashboard.profile.test.ts` | New — unit tests |
| `apps/web/src/app/[locale]/dashboard/profile/page.tsx` | New — fetch + render `<ProfileForm />` |
| `apps/web/src/app/[locale]/dashboard/profile/_components/profile-form.tsx` | New — form state + submit |
| `apps/web/src/components/app-shell.tsx` | Add "Profile" nav item to buddy variant |
| `apps/web/messages/en.json` + `ja.json` | Add `profile.*`, `languages.*`, `shell.nav.profile` |

## Decisions

### Admin buddy pages
- Flat navigation: pending + buddies as separate top-level menu items
- API uses query params (`?status=pending`, `?status=active`); `/admin/buddies/pending` is a Next.js page URL only
- Buddy detail accessed via `/admin/buddies/:id` link from roster

### Buddy profile settings (§11.6)
- Language enum (`LanguageSchema`) ordered for UI — priority tier first: `english, korean, chinese_simplified, chinese_traditional`, then alphabetical: `arabic, french, german, italian, japanese, portuguese, russian, spanish, thai, vietnamese`
- Skills: free text textarea (one per line, split on `\n` before submit) — structured multi-select deferred
- Photo (`photoUrl`): disabled field with "coming soon" text; not sent in PUT body — existing value preserved
- Both `displayName` and `realName` editable by buddy
- `languages.*` i18n namespace kept separate from `profile.*` for reuse in admin views
