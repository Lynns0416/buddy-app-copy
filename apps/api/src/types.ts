import type { GroupType } from '@peace-buddy/types'

export type FirebaseUser = {
  uid: string
  email: string
  name?: string
  picture?: string
}

export type DbUser = {
  id: string
  firebaseUid: string
  email: string
  role: string
}

export type FirebaseEnv = { Variables: { firebaseUser: FirebaseUser } }
export type AuthEnv = { Variables: { firebaseUser: FirebaseUser; user: DbUser } }
export type SchedulerEnv = { Variables: Record<string, never> }

export type ToursQuery = {
  status?: string
  from?: Date
  to?: Date
}

// Scope of `GET /admin/buddies/stats` and `GET /admin/reflections/stats`: every
// number counts only tours inside it. Dates are UTC midnight, the shape of a
// `@db.Date` column. `tourId` is set by the reflection stats only.
export type BuddyStatsScope = {
  from?: Date
  to?: Date
  groupType?: GroupType
  placeId?: string
  tourId?: string
}
