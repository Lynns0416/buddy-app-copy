import { JWT } from 'google-auth-library'

// Gmail send via service account + domain-wide delegation.
// Setup: in the Workspace admin console, grant the service account the
// scope `https://www.googleapis.com/auth/gmail.send` and authorize it to
// impersonate `GMAIL_IMPERSONATE`. Reuses the Firebase service account creds.
//
// Two addresses so the visible sender and the impersonated identity can differ:
// `GMAIL_IMPERSONATE` is the mailbox we act as, `GMAIL_SENDER` is the From:
// address, which may be one of that mailbox's aliases. Splitting them means the
// impersonation can move to another seat without changing the sender address
// recipients have already seen. Defaults to `GMAIL_SENDER` when unset.

export type SendEmailArgs = {
  to: string
  subject: string
  html: string
  text: string
}

let cachedClient: JWT | null = null

function getClient(): JWT {
  if (cachedClient) return cachedClient

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const subject = process.env.GMAIL_IMPERSONATE || process.env.GMAIL_SENDER

  if (!clientEmail || !privateKey || !subject) {
    throw new Error(
      'Gmail not configured: requires FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, GMAIL_SENDER',
    )
  }

  cachedClient = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject,
  })

  return cachedClient
}

function assertHeaderSafe(name: string, value: string): void {
  // CRLF in a header value lets the rest of the string inject arbitrary
  // headers (Bcc, Reply-To, etc.). Bail before the MIME goes out.
  if (/[\r\n]/.test(value)) {
    throw new Error(`Gmail: ${name} contains illegal CR/LF`)
  }
}

function buildMime({ to, subject, html, text }: SendEmailArgs, sender: string): string {
  assertHeaderSafe('to', to)
  assertHeaderSafe('sender', sender)
  const boundary = `bnd_${Math.random().toString(36).slice(2)}`
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`

  // Multipart/alternative: clients pick the richest part they can render.
  return [
    `From: ${sender}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(text, 'utf8').toString('base64'),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html, 'utf8').toString('base64'),
    `--${boundary}--`,
  ].join('\r\n')
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Sends one email. Throws on Gmail API failure (4xx/5xx). The dispatcher
// catches and converts to a retry / dead-letter outcome.
//
// Safe-by-default: sends only when NODE_ENV === 'production' or
// EMAIL_ENABLED === 'true'. Any other environment (test, dev without opt-in,
// CI, a freshly-cloned repo) logs the payload and returns without sending.
// EMAIL_DISABLED === 'true' still forces a no-op even in production, useful
// for incident-time kill-switches.
function sendingEnabled(): boolean {
  if (process.env.EMAIL_DISABLED === 'true') return false
  if (process.env.EMAIL_ENABLED === 'true') return true
  return process.env.NODE_ENV === 'production'
}

export async function sendEmail(args: SendEmailArgs): Promise<void> {
  if (!sendingEnabled()) {
    console.log('[email:disabled]', { to: args.to, subject: args.subject })
    return
  }

  const sender = process.env.GMAIL_SENDER
  if (!sender) throw new Error('Gmail not configured: requires GMAIL_SENDER')
  const client = getClient()
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('Gmail: failed to acquire access token')

  const mime = buildMime(args, sender)
  const body = JSON.stringify({ raw: toBase64Url(mime) })

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    },
  )

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Gmail send failed: ${res.status} ${detail.slice(0, 400)}`)
  }
}
