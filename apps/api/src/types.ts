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

export type BuddyProfileResponse = {
  id: string
  status: string
  displayName: string
  realName: string
  photoUrl: string | null
  bio: string | null
  contactInfo: string | null
  languages: string[]
  skills: string[]
  availability: string | null
  createdAt: Date
  updatedAt: Date
}

export type ToursQuery = {
  status?: string
  from?: Date
  to?: Date
}

export type TourResponse = {
  id: string
  groupId: string
  group: { id: string; name: string; type: string }
  status: string
  tourDate: Date
  meetingTime: Date
  location: string
  capacity: number
  description: string | null
  cancellationDeadline: Date
  maybeDeadline: Date | null
  notificationOffsets: number[]
  createdAt: Date
  updatedAt: Date
}

// Sanitized response type — no admin-only fields (internalNotes, tier, adminEvaluations, etc.)
export type UserResponse = {
  id: string
  email: string
  role: string
  createdAt: Date
  buddyProfile: BuddyProfileResponse | null
}
