import { Hono } from 'hono'
import { CreateGroupSchema, UpdateGroupSchema } from '@peace-buddy/types'
import { listGroups, createGroup, updateGroup, getGroup } from '../services/group.service'
import { apiError } from '../lib/api-error'
import type { AuthEnv } from '../types'

const adminGroupRoutes = new Hono<AuthEnv>()

adminGroupRoutes.get('/', async (c) => {
  return c.json(await listGroups())
})

adminGroupRoutes.post('/', async (c) => {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = CreateGroupSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  return c.json(await createGroup(parsed.data), 201)
})

adminGroupRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const group = await getGroup(id)
  if (!group) return c.json(apiError('not_found'), 404)
  return c.json(group)
})

adminGroupRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(apiError('invalid_request'), 400)
  }

  const parsed = UpdateGroupSchema.safeParse(body)
  if (!parsed.success) return c.json(apiError('invalid_request'), 400)

  const group = await updateGroup(id, parsed.data)
  if (!group) return c.json(apiError('not_found'), 404)
  return c.json(group)
})

export { adminGroupRoutes }
