// RFC 5545 (iCalendar) primitives: escaping, line folding, and VCALENDAR
// assembly. Domain-specific mapping (which tour/session fields become which
// property) lives in tourIcs.ts — this file knows nothing about tours.

// TEXT values (RFC 5545 §3.3.11): backslash, semicolon and comma are
// delimiters and must be escaped; a literal newline is encoded as the two
// characters `\n`, not a real line break, since a real line break would start
// a new property. Escape the backslash first — otherwise the backslashes
// introduced by the later replacements would themselves get re-escaped.
// Control characters other than tab, CR and LF are not valid in a TEXT value;
// strip them the same way the Slack/email escapers in templateRender.ts do,
// so a group/location name full of control characters can't forge structure.
// CR/LF are excluded here because the newline replacement below needs to see
// them.
const ICS_CONTROL = new RegExp(
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\u2028\\u2029]+',
  'g',
)

export function escapeIcs(s: string): string {
  return s
    .replace(ICS_CONTROL, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

// RFC 5545 §3.1: a content line SHOULD be folded at 75 octets (excluding the
// CRLF), and a folded continuation begins with a single space, which itself
// counts toward that line's 75 octets. The split must land on a UTF-8
// character boundary — Japanese group/location names are mostly 3-byte
// characters, so a naive byte-offset split would corrupt one.
const FOLD_LIMIT = 75

export function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8')
  if (bytes.length <= FOLD_LIMIT) return line

  const chunks: string[] = []
  let start = 0
  let limit = FOLD_LIMIT
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length)
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--
    chunks.push(bytes.toString('utf8', start, end))
    start = end
    limit = FOLD_LIMIT - 1 // continuation lines start with a space
  }
  return chunks.join('\r\n ')
}

function foldProp(name: string, value: string): string {
  return foldLine(`${name}:${value}`)
}

function formatIcsUtc(d: Date): string {
  return `${d.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

// RFC 5545 §3.8.1.11 — the only three STATUS values a VEVENT may carry.
export type IcsEventStatus = 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED'

export type IcsEvent = {
  uid: string
  dtstart: Date
  dtend: Date
  summary: string
  status: IcsEventStatus
  location?: string | null
  description?: string | null
}

export function buildVCalendar(events: IcsEvent[], now: Date = new Date()): string {
  const dtstamp = formatIcsUtc(now)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Peace Buddy//Tour Calendar//EN',
    'CALSCALE:GREGORIAN',
    ...events.flatMap((event) => {
      const vevent = [
        'BEGIN:VEVENT',
        foldProp('UID', event.uid),
        foldProp('DTSTAMP', dtstamp),
        foldProp('DTSTART', formatIcsUtc(event.dtstart)),
        foldProp('DTEND', formatIcsUtc(event.dtend)),
        foldProp('SUMMARY', escapeIcs(event.summary)),
        // A closed enum, not free text — never escaped.
        foldProp('STATUS', event.status),
      ]
      if (event.location) vevent.push(foldProp('LOCATION', escapeIcs(event.location)))
      if (event.description) vevent.push(foldProp('DESCRIPTION', escapeIcs(event.description)))
      vevent.push('END:VEVENT')
      return vevent
    }),
    'END:VCALENDAR',
  ]
  return `${lines.join('\r\n')}\r\n`
}
