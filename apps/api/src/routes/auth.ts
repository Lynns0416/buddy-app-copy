import { Hono, type Context } from 'hono'
import { RegisterRequestBodySchema, type RegisterRequestBody } from '@peace-buddy/types'
import { upsertUser, getUser } from '../services/auth.service'
import type { FirebaseEnv, AuthEnv } from '../types'

// Handler for POST /auth/register — mounted on publicApp (firebaseAuth middleware only)
export async function registerHandler(c: Context<FirebaseEnv>) {
  const { uid, email, name, picture } = c.get('firebaseUser')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    body = {}
  }

  let data: RegisterRequestBody
  try {
    data = RegisterRequestBodySchema.parse(body)
  } catch {
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const user = await upsertUser(uid, email, {
    displayName: data.displayName ?? name,
    realName: data.realName,
    languages: data.languages,
    photoUrl: data.photoUrl ?? picture ?? null,
    bio: data.bio,
  })

  return c.json(user, 201)
}

// Protected routes — mounted on protectedApp (authMiddleware)
const authRoutes = new Hono<AuthEnv>()

authRoutes.get('/me', async (c) => {
  const { id } = c.get('user')

  const user = await getUser(id)

  if (!user) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json(user)
})

export { authRoutes }
