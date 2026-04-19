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
