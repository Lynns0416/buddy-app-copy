import type { NotifEventKind } from '@peace-buddy/types'
import { webBase } from '../../lib/webBase'
import {
  escapeSlack,
  interpolate,
  resolvePath,
  safeUrl,
  type TemplatePayload,
} from '../../lib/templateRender'
import messagesJa from './messages.ja.json'

export type RenderedSlack = { text: string }

type Entry = {
  text: string
  cta: string
  path: string
  detail?: { text: string }
}

// Slack posts go to a single shared admin channel, so there is no per-recipient
// locale to honour — the channel is one language. Japanese, matching the admin
// team. See docs/decisions.md 2026-08-15.
const CHANNEL_LOCALE = 'ja'

// Only admin-targeted events post to Slack. Buddy-targeted events stay on
// in-app + email; they have no place in an internal ops channel.
const messages: Record<string, Entry> = messagesJa as Record<string, Entry>

export function hasSlackTemplate(eventType: NotifEventKind): boolean {
  return eventType in messages
}

export function renderSlack(
  eventType: NotifEventKind,
  payload: TemplatePayload,
): RenderedSlack | null {
  const entry = messages[eventType]
  if (!entry) return null

  // `entry.detail` names the buddy and the tour; `entry.text` is the generic
  // announcement it replaces. Every interpolated value is buddy-controlled
  // (`displayName` comes straight from registration) so it is escaped on the
  // way in — a buddy called `<http://evil|click>` renders as literal text, not
  // as a link in the ops channel. `entry.text` stays trusted template copy.
  const detail = entry.detail ? interpolate(entry.detail.text, payload, escapeSlack) : null
  const body = detail ?? entry.text

  const path = resolvePath(entry.path, payload)
  const url = path === null ? null : safeUrl(`${webBase()}/${CHANNEL_LOCALE}${path}`)

  // The CTA label crosses into link markup, so it gets escaped too.
  if (!url) return { text: body }
  return { text: `${body}\n<${url}|${escapeSlack(entry.cta)}>` }
}
