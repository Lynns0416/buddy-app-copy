import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendSlack } from './slack'

const ENV_KEYS = ['SLACK_ENABLED', 'SLACK_DISABLED', 'SLACK_WEBHOOK_URL', 'NODE_ENV'] as const
let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
  for (const k of ENV_KEYS) delete process.env[k]
  vi.restoreAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

describe('sendSlack', () => {
  it('no-ops outside production without opt-in — a fresh clone must not post', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await sendSlack({ text: 'hello' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('no-ops when SLACK_DISABLED is set, even in production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.SLACK_DISABLED = 'true'
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/x'
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await sendSlack({ text: 'hello' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('posts the text to the webhook when enabled', async () => {
    process.env.SLACK_ENABLED = 'true'
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/x'
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('ok', { status: 200 }))

    await sendSlack({ text: 'hello' })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://hooks.slack.test/x')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ text: 'hello' })
  })

  it('throws when enabled but the webhook URL is missing', async () => {
    process.env.SLACK_ENABLED = 'true'
    await expect(sendSlack({ text: 'hello' })).rejects.toThrow(/SLACK_WEBHOOK_URL/)
  })

  it('throws on a non-2xx webhook response so the dispatcher can retry', async () => {
    process.env.SLACK_ENABLED = 'true'
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/x'
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no_service', { status: 404 }))

    await expect(sendSlack({ text: 'hello' })).rejects.toThrow(/Slack send failed: 404/)
  })
})
