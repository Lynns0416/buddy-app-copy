import { createMiddleware } from 'hono/factory'
import { auth } from '../lib/firebase'
import type { FirebaseEnv, FirebaseUser } from '../types'

export async function verifyFirebaseToken(token: string): Promise<FirebaseUser> {
  const decoded = await auth.verifyIdToken(token)
  return {
    uid: decoded.uid,
    email: decoded.email ?? '',
    name: decoded.name as string | undefined,
    picture: decoded.picture,
  }
}

export const firebaseAuthMiddleware = createMiddleware<FirebaseEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authHeader.slice(7)

  try {
    const firebaseUser = await verifyFirebaseToken(token)
    c.set('firebaseUser', firebaseUser)
    return next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
})
