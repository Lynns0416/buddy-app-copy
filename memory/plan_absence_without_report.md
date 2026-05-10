---
name: Plan — absence without report
branch: feat/admin/absence-without-report (new branch from main after cancellation-reason PR merges)
status: ready to implement
---

## Goal

Allow admin to record that a buddy was absent from a tour without reporting in advance.
The count is used to inform reliability evaluation — no auto-calculation.

## Schema change

`prisma/schema.prisma` — add to `AdminEvaluation`:

```
absentWithoutReport Boolean @default(false)
```

Not on `AdminProfileEvaluation` (overall profile judgement, not per-tour fact).

## Layers to change

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `absentWithoutReport Boolean @default(false)` to `AdminEvaluation` |
| `packages/types/src/index.ts` | Add `absentWithoutReport: boolean` to the eval schema and response type |
| `apps/api/src/services/adminTour.service.ts` (or wherever eval upsert lives) | Include `absentWithoutReport` in select and upsert |
| Eval form UI component | Add checkbox for `absentWithoutReport` |
| `apps/api/src/services/admin.service.ts` — `getBuddyDetail` | Count `AdminEvaluation` rows where `absentWithoutReport = true` for this buddy; add to response |
| `packages/types/src/index.ts` — `AdminBuddyDetailResponse` | Add `absenceSummary: { absentWithoutReport: number }` |
| Admin buddy detail page | Show `absenceSummary.absentWithoutReport` count near `cancellationSummary` |
| `en.json` + `ja.json` | Add i18n keys for the checkbox label and summary display |

## Count surface

`getBuddyDetail` computes the count from already-fetched evaluations (no extra query needed if evals are already selected). Add to the response:

```
absenceSummary: {
  absentWithoutReport: number
}
```

Displayed in buddy detail page alongside the cancellation summary.

## Notes

- `absentWithoutReport` is a factual record set by admin in the per-tour eval form
- Admin uses the count manually to decide the `reliability` score in `AdminProfileEvaluation`
- No auto-computation of reliability — numbers only
- Apply schema with `prisma db push` (no migration needed)
