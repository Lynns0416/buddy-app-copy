import { BuddyStatusSchema, type AdminDashboardResponse } from '@peace-buddy/types'
import { listBuddies } from './admin.service'
import { listToursMissingEvaluations } from './adminEvaluation.service'
import { listUnderfilledTours } from './adminTour.service'
import { listOverdueMaybeTours } from './maybeDeadline.service'

export const UNDERFILLED_LOOKAHEAD_DAYS = 14

// The admin home worklist (PRD §11.7). Each queue is computed by the service
// that owns the data behind the page it links to, so the worklist and that page
// cannot disagree about what is waiting. Unread notifications are not here: the
// page reads them from `GET /me/notifications`, which the bell already polls.
export async function getAdminDashboard(now: Date = new Date()): Promise<AdminDashboardResponse> {
  const [pending, overdueMaybeTours, underfilledTours, toursMissingEvaluations] = await Promise.all([
    listBuddies(BuddyStatusSchema.enum.pending),
    listOverdueMaybeTours(now),
    listUnderfilledTours(now, UNDERFILLED_LOOKAHEAD_DAYS),
    listToursMissingEvaluations(),
  ])

  return {
    pendingBuddies: pending.map(({ id, displayName, createdAt }) => ({ id, displayName, createdAt })),
    overdueMaybeTours,
    underfilledTours,
    underfilledLookaheadDays: UNDERFILLED_LOOKAHEAD_DAYS,
    toursMissingEvaluations,
  }
}
