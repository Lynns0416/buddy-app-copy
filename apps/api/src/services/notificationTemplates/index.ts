import type { Locale, NotifEventKind } from '@peace-buddy/types'
import { webBase } from '../../lib/webBase'
import {
  escapeHtml,
  escapePlain,
  interpolate,
  resolvePath,
  safeUrl,
  type TemplatePayload,
} from '../../lib/templateRender'
import messagesEn from './messages.en.json'
import messagesJa from './messages.ja.json'

export type RenderedEmail = { subject: string; html: string; text: string }

type Detail = {
  subject: string
  bodyText: string
  bodyHtml: string
}

type Entry = {
  subject: string
  bodyText: string
  bodyHtml: string
  cta: string
  path: string
  detail?: Detail
}

const APP_NAME = 'Peace Buddy'

// Events that intentionally have no email body:
// - new_signup, new_booking: admin-targeted, delivered via Slack instead of
//   email (docs/decisions.md 2026-08-15). See services/slackTemplates.
// - waitlist_opened: ships alongside its respective cron job.
// - self_eval_prompt: in-app only per PRD §10.1.
const messages: Record<Locale, Record<string, Entry>> = {
  en: messagesEn as Record<string, Entry>,
  ja: messagesJa as Record<string, Entry>,
}

function wrap(bodyHtml: string, ctaUrl: string, ctaText: string): string {
  // `bodyHtml` arrives already safe: it is either trusted template copy or the
  // `detail` variant, whose interpolated values were escaped with escapeHtml
  // when they were substituted in. Everything else crossing into an attribute
  // or text node here is escaped at this boundary.
  const href = escapeHtml(safeUrl(ctaUrl) ?? '#')
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

function lookup(locale: Locale, eventType: NotifEventKind): Entry | null {
  const e = messages[locale]?.[eventType]
  if (e) return e
  return messages.en[eventType] ?? null
}

// Renders the detail variant, or null if any part of it has an unresolved
// placeholder. All three parts stand or fall together — a subject that names
// the tour above a body that doesn't reads like two different emails.
function renderDetail(
  detail: Detail,
  scope: TemplatePayload,
): { subject: string; text: string; bodyHtml: string } | null {
  const subject = interpolate(detail.subject, scope, escapePlain)
  const text = interpolate(detail.bodyText, scope, escapePlain)
  const bodyHtml = interpolate(detail.bodyHtml, scope, escapeHtml)
  if (subject === null || text === null || bodyHtml === null) return null
  return { subject, text, bodyHtml }
}

export function hasEmailTemplate(eventType: NotifEventKind): boolean {
  return eventType in messages.en
}

export function renderEmail(
  eventType: NotifEventKind,
  payload: TemplatePayload,
  locale: Locale,
): RenderedEmail | null {
  const entry = lookup(locale, eventType)
  if (!entry) return null

  // An unresolved path would deep-link to `/buddy/tours/` — a 404. The locale
  // home is the honest degradation. (The Slack renderer drops the link
  // entirely; an email always has a CTA button, so it needs somewhere to go.)
  const path = resolvePath(entry.path, payload)
  const url = `${webBase()}/${locale}${path ?? ''}`

  // `url` joins the payload so a template can place the link inside its body
  // text. Payload keys cannot shadow it.
  const scope: TemplatePayload = { ...payload, url }

  const detail = entry.detail ? renderDetail(entry.detail, scope) : null
  if (detail) {
    return { subject: detail.subject, text: detail.text, html: wrap(detail.bodyHtml, url, entry.cta) }
  }

  return {
    subject: entry.subject,
    text: entry.bodyText.replaceAll('{url}', url),
    html: wrap(entry.bodyHtml, url, entry.cta),
  }
}
