// Slack delivery via a single incoming webhook posting to one admin channel.
// Setup: create a Slack app, enable Incoming Webhooks, install it to the
// workspace, and set SLACK_WEBHOOK_URL to the generated URL.
//
// One channel, not per-admin DMs — see docs/decisions.md 2026-08-15. There is
// no per-recipient targeting, so these jobs carry recipientUserId: null.

export type SendSlackArgs = {
  text: string
}

// Safe-by-default, mirroring lib/email.ts: posts only when
// NODE_ENV === 'production' or SLACK_ENABLED === 'true'. Any other environment
// (test, dev without opt-in, CI, a freshly-cloned repo) logs and returns.
// SLACK_DISABLED === 'true' forces a no-op even in production, for
// incident-time kill-switches.
function sendingEnabled(): boolean {
  if (process.env.SLACK_DISABLED === 'true') return false
  if (process.env.SLACK_ENABLED === 'true') return true
  return process.env.NODE_ENV === 'production'
}

// Posts one message. Throws on webhook failure; the dispatcher catches and
// converts to a retry / dead-letter outcome.
export async function sendSlack(args: SendSlackArgs): Promise<void> {
  if (!sendingEnabled()) {
    console.log('[slack:disabled]', { text: args.text.slice(0, 200) })
    return
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    throw new Error('Slack not configured: requires SLACK_WEBHOOK_URL')
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: args.text }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Slack send failed: ${res.status} ${detail.slice(0, 400)}`)
  }
}
