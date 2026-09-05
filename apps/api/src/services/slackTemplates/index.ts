import type { NotifEventKind } from '@peace-buddy/types'
import { webBase } from '../../lib/webBase'
import messagesJa from './messages.ja.json'

export type RenderedSlack = { text: string }

type Payload = Record<string, unknown>

type Entry = {
  text: string
  cta: string
  path: string
}

// Slack posts go to a single shared admin channel, so there is no per-recipient
// locale to honour — the channel is one language. Japanese, matching the admin
// team. See docs/decisions.md 2026-08-15.
const CHANNEL_LOCALE = 'ja'

// Only admin-targeted events post to Slack. Buddy-targeted events stay on
// in-app + email; they have no place in an internal ops channel.
const messages: Record<string, Entry> = messagesJa as Record<string, Entry>

// Returns null when any placeholder has no string value in the payload. A
// partially-resolved path (`/admin/tours/`) is a 404, which is worse in an ops
// channel than a post with no link at all — the caller drops the link instead.
function resolvePath(template: string, payload: Payload): string | null {
  let resolved = true
  const path = template.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = payload[key]
    if (typeof v !== 'string' || v === '') {
      resolved = false
      return ''
    }
    return encodeURIComponent(v)
  })
  return resolved ? path : null
}

// Slack treats &, < and > as markup delimiters inside message text. Only these
// three need escaping, and only in the text body — the URL half of a
// <url|label> link must stay raw.
const SLACK_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
}
function escapeSlack(s: string): string {
  return s.replace(/[&<>]/g, (c) => SLACK_ESCAPE[c])
}

function safeUrl(u: string): string | null {
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

export function hasSlackTemplate(eventType: NotifEventKind): boolean {
  return eventType in messages
}

export function renderSlack(eventType: NotifEventKind, payload: Payload): RenderedSlack | null {
  const entry = messages[eventType]
  if (!entry) return null

  const path = resolvePath(entry.path, payload)
  const url = path === null ? null : safeUrl(`${webBase()}/${CHANNEL_LOCALE}${path}`)

  // entry.text is template-authored and trusted; the CTA label crosses into
  // link markup, so it gets escaped.
  if (!url) return { text: entry.text }
  return { text: `${entry.text}\n<${url}|${escapeSlack(entry.cta)}>` }
}
