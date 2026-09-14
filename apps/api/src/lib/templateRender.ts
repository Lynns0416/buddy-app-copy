// Shared substitution core for the email and Slack notification renderers.
//
// Both channels fill the same `{placeholder}` syntax from the same
// `NotificationJob.payload`, and differ only in how an interpolated value has
// to be neutralised for their markup. So the substitution lives here once and
// each renderer supplies its escaper. Before this existed the two renderers
// carried near-identical copies of `resolvePath`, an escape map and a URL
// guard; adding interpolation would have duplicated that a third and fourth
// time.

export type TemplatePayload = Record<string, unknown>
export type Escaper = (s: string) => string

const PLACEHOLDER = /\{(\w+)\}/g

// Substitutes every `{key}` from `payload`, escaping each value for the
// destination. Returns null when any placeholder has no non-empty string
// value.
//
// All-or-nothing on purpose. The payload is a persisted contract and rows
// written before a field existed are still in the queue, so a half-filled
// template would post a sentence with a hole in it to the ops channel. Callers
// fall back to a placeholder-free variant of the message instead.
export function interpolate(
  template: string,
  payload: TemplatePayload,
  escape: Escaper,
): string | null {
  let resolved = true
  const out = template.replace(PLACEHOLDER, (_m, key: string) => {
    const v = payload[key]
    if (typeof v !== 'string' || v === '') {
      resolved = false
      return ''
    }
    return escape(v)
  })
  return resolved ? out : null
}

// A deep-link path. Values are URL-encoded rather than markup-escaped, and the
// same all-or-nothing rule applies: a partially-resolved path (`/admin/tours/`)
// is a 404, which is worse than no link at all.
export function resolvePath(template: string, payload: TemplatePayload): string | null {
  return interpolate(template, payload, encodeURIComponent)
}

// Control characters and the Unicode line separators. An interpolated value
// must never introduce line structure of its own: `displayName` is set at
// registration with no charset constraint, so a name full of newlines would
// render in the ops channel as several apparent messages, and would split an
// email subject line. The template's own newlines are untouched — interpolate()
// escapes values, never the surrounding template.
const CONTROL = /[\u0000-\u001F\u007F\u2028\u2029]+/g
function stripControl(s: string): string {
  return s.replace(CONTROL, ' ')
}

// Slack treats &, < and > as markup delimiters inside message text. Only these
// three need escaping, and only in the text body — the URL half of a
// <url|label> link must stay raw.
const SLACK_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
}
export function escapeSlack(s: string): string {
  return stripControl(s).replace(/[&<>]/g, (c) => SLACK_ESCAPE[c])
}

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c])
}

// Plain-text destinations — the email subject and the text/plain body — carry
// no markup, so there is nothing to entity-encode, and stripping the line
// structure is the whole job. Header injection itself is already blocked
// downstream, since `lib/email.ts` base64-encodes the subject into the MIME.
//
// escapeHtml needs no equivalent: a stray newline inside a <p> renders as
// whitespace, so it cannot forge structure the way it can in Slack text.
export function escapePlain(s: string): string {
  return stripControl(s)
}

// Notification URLs are built from a hardcoded template path plus URL-encoded
// payload values, so a hostile scheme shouldn't reach here — but the guard
// means a future template that pulls an externally-sourced URL through cannot
// emit `javascript:` or `data:`.
export function safeUrl(u: string): string | null {
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}
