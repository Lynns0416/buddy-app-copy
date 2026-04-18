import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { routes } from './routes'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))

app.route('/', routes)

app.get('/health', (c) => c.json({ ok: true }))

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Internal server error' }, 500)
})

const port = parseInt(process.env.PORT ?? '8080')

serve({ fetch: app.fetch, port }, () => {
  console.log(`API running on http://localhost:${port}`)
})
