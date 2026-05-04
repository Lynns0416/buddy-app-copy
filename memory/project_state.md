---
name: Project state
description: Current build status, blockers, and next steps
type: project
---

## Built & Merged to main
- Admin profile system (#63): ensureAdminProfile middleware, createdByName in evaluations
- Admin profile & roster pages (#63): view/edit own name, super_admin soft-delete
- Evaluation fixes (#64): i18n fixes, self-eval card with pips, multi-admin eval support
- **Tour application system (PR pending)**: 3-pool capacity model, auto-assignment, auto-promotion, buddy UI

## Current Work — feat/tour-application-ui (PR pending)

### Backend (complete)
- Schema: `ApplicationPool` enum (junior/non_junior/anyone), `TierCapacity.pool` field, `Application.booking` FK
- Service: 3-pool logic (`getPoolCapacities`, `tryAssignToPool`, `assignApplication`), default 20/30/50 split, re-apply when rejected, promotion across pools
- API: applications routes (POST create, DELETE cancel, GET status)

### Frontend (complete)
- Types: `ApplicationResponse` type, api client methods
- Hook: `tour-application.ts` action module
- UI: `tour-application-section.tsx`, `cancel-application-modal.tsx` on tour detail page
- i18n: `tourApplication` namespace in en.json + ja.json

## Next Phase

### Immediate
- Merge tour-application-ui PR
- Admin UI for tier capacity configuration (blocked: need routes + form fields in tour creation)

### Phase 2 — Deferred
- `trainee` BuddyStatus alignment (§5.1): add status value, handle in transitions, add label/badge, update login flow
- Self-evaluation UI (spec in PRD §8.8): fetch tourId filter, form component, tour section integration
