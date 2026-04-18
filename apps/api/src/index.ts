import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { routes } from './routes'

const app = new Hono()

app.use('*', logger())

app.route('/', routes)

app.get('/health', (c) => c.json({ ok: true }))

const port = parseInt(process.env.PORT ?? '8080')

serve({ fetch: app.fetch, port }, () => {
  console.log(`API running on http://localhost:${port}`)
})
