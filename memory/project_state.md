---
name: Project state
description: Current build status, blockers, and next steps
type: project
---

## Current branch
`feat/admin/profile-creation`

## Built (merged to main)
- Evaluation base (schema, API routes, types) — #59
- Admin evaluation UI — #61
- Buddy evaluation UI — #62
- Admin profile page (view/edit own name) — #63
- Fix/evaluation missing features (i18n fixes, self-eval card with pips) — #64

## In progress (feat/admin/profile-creation)
Commits:
1. `feat: admin profile system — ensureAdminProfile middleware and createdByName`
   - `ensureAdminProfile` middleware: auto-creates `AdminProfile` on first admin login
   - `createdByName` replaces `createdByEmail` in `AdminEvaluationResponse`
   - Fixed `adminProfile.service.ts` to use `instanceof Prisma.PrismaClientKnownRequestError`
   - Fixed `adminProfiles.ts` route to use `apiError()` and `safeParse()`
2. `feat: admin profile and roster pages with nav + createdByName in eval UI`
   - `/admin/profile` page (view + edit own name)
   - `/admin/profiles` roster page (super_admin soft-delete)
   - Admin shell nav: My Profile + Admin Roster (super_admin only)
   - Eval UI updated: `createdByEmail` → `createdByName` throughout

## All tests passing
- API: 314 tests ✓
- Web: 298 tests ✓

## Next
- Open PR for `feat/admin/profile-creation`
- After merge: look at remaining PRD items
