import type { Locale, NotifEventKind } from '@peace-buddy/types'
import messagesEn from './messages.en.json'
import messagesJa from './messages.ja.json'

export type RenderedEmail = { subject: string; html: string; text: string }

type Payload = Record<string, unknown>

type Entry = {
  subject: string
  bodyText: string
  bodyHtml: string
  cta: string
  path: string
}

const APP_NAME = 'Peace Buddy'

// Events that intentionally have no email body yet:
// - new_signup, new_booking: defaults to digest (PRD §10.2); ships with the
//   daily digest cron.
// - maybe_reminder, waitlist_opened: ship alongside their respective cron jobs.
// - self_eval_prompt: in-app only per PRD §10.1.
const messages: Record<Locale, Record<string, Entry>> = {
  en: messagesEn as Record<string, Entry>,
  ja: messagesJa as Record<string, Entry>,
}

function webBase(): string {
  const url = process.env.WEB_BASE_URL
  if (url) return url
  if (process.env.NODE_ENV === 'production') {
    throw new Error('WEB_BASE_URL is required in production')
  }
  return 'http://localhost:3000'
}

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c])
}

// URLs are constructed from a hardcoded template path + URL-encoded payload
// values, so injection through ctaUrl shouldn't happen — but if a future
// template ever pulls an externally-sourced URL through here, the scheme guard
// blocks `javascript:` / `data:` and friends.
function safeHref(u: string): string {
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '#'
    return parsed.toString()
  } catch {
    return '#'
  }
}

function wrap(bodyHtml: string, ctaUrl: string, ctaText: string): string {
  // bodyHtml is template-authored and trusted. Anything that crosses an
  // interpolation boundary into an HTML attribute or text node is escaped.
  const href = escapeHtml(safeHref(ctaUrl))
  const label = escapeHtml(ctaText)
  return [
    '<!doctype html>',
    '<html><body style="font-family:system-ui,sans-serif;color:#111;line-height:1.6;">',
    `<div style="max-width:560px;margin:24px auto;padding:24px;border:1px solid #eee;border-radius:8px;">`,
    `<h2 style="margin:0 0 16px 0;font-size:18px;">${APP_NAME}</h2>`,
    bodyHtml,
    `<p style="margin-top:24px;"><a href="${href}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">${label}</a></p>`,
    '</div></body></html>',
  ].join('')
}

function resolvePath(template: string, payload: Payload): string {
  return template.replace(/\{(\w+)\}/g, (_m, key: string) => {
    const v = payload[key]
    return typeof v === 'string' ? encodeURIComponent(v) : ''
  })
}

function lookup(locale: Locale, eventType: NotifEventKind): Entry | null {
  const e = messages[locale]?.[eventType]
  if (e) return e
  return messages.en[eventType] ?? null
}

export function hasEmailTemplate(eventType: NotifEventKind): boolean {
  return eventType in messages.en
}

export function renderEmail(
  eventType: NotifEventKind,
  payload: Payload,
  locale: Locale,
): RenderedEmail | null {
  const entry = lookup(locale, eventType)
  if (!entry) return null

  const path = resolvePath(entry.path, payload)
  const url = `${webBase()}/${locale}${path}`
  const text = entry.bodyText.replaceAll('{url}', url)

  return {
    subject: entry.subject,
    text,
    html: wrap(entry.bodyHtml, url, entry.cta),
  }
}
