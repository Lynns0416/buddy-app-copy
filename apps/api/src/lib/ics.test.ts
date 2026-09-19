import { describe, it, expect } from 'vitest'
import { buildVCalendar, escapeIcs, foldLine } from './ics'

describe('escapeIcs', () => {
  it('escapes backslash, semicolon and comma', () => {
    expect(escapeIcs('a\\b;c,d')).toBe('a\\\\b\\;c\\,d')
  })

  it('escapes the backslash before the other delimiters, not after', () => {
    expect(escapeIcs(';')).toBe('\\;')
  })

  it('encodes a real newline as the two characters \\n', () => {
    expect(escapeIcs('line1\nline2')).toBe('line1\\nline2')
    expect(escapeIcs('line1\r\nline2')).toBe('line1\\nline2')
  })

  it('collapses other control characters to a space', () => {
    expect(escapeIcs('a\u0000b\u0007c')).toBe('a b c')
  })

  it('leaves ordinary Japanese text untouched', () => {
    expect(escapeIcs('東京駅')).toBe('東京駅')
  })
})

describe('foldLine', () => {
  it('leaves a short line alone', () => {
    expect(foldLine('SUMMARY:short')).toBe('SUMMARY:short')
  })

  it('folds a long ASCII line at 75 octets with a single leading space on the continuation', () => {
    const value = 'x'.repeat(100)
    const folded = foldLine(`SUMMARY:${value}`)
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts.slice(1)) {
      expect(part.startsWith(' ')).toBe(true)
      expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(75)
    }
    expect(Buffer.byteLength(parts[0], 'utf8')).toBeLessThanOrEqual(75)
  })

  it('never splits inside a multi-byte UTF-8 character', () => {
    // Every character here is 3 bytes in UTF-8, so a byte-75 cut would land
    // mid-character unless the fold backs off to the character boundary.
    const value = '東'.repeat(40)
    const folded = foldLine(`SUMMARY:${value}`)
    for (const part of folded.split('\r\n ')) {
      expect(Buffer.from(part, 'utf8').toString('utf8')).not.toContain('�')
    }
    // Rejoining strips only the fold's CRLF + leading space, recovering the original.
    expect(folded.replace(/\r\n /g, '')).toBe(`SUMMARY:${value}`)
  })
})

describe('buildVCalendar', () => {
  const now = new Date('2026-05-01T00:00:00.000Z')

  it('wraps one VEVENT per event with UID, DTSTAMP, DTSTART, DTEND, SUMMARY, STATUS', () => {
    const ics = buildVCalendar(
      [
        {
          uid: 'session-1@peace-buddy.internal',
          dtstart: new Date('2026-05-01T00:00:00.000Z'),
          dtend: new Date('2026-05-01T01:00:00.000Z'),
          summary: 'Test School',
          status: 'CONFIRMED',
        },
      ],
      now,
    )
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('UID:session-1@peace-buddy.internal')
    expect(ics).toContain('DTSTAMP:20260501T000000Z')
    expect(ics).toContain('DTSTART:20260501T000000Z')
    expect(ics).toContain('DTEND:20260501T010000Z')
    expect(ics).toContain('SUMMARY:Test School')
    expect(ics).toContain('STATUS:CONFIRMED')
    expect(ics).toContain('END:VEVENT')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics.endsWith('\r\n')).toBe(true)
  })

  it('emits the STATUS it is given', () => {
    const ics = buildVCalendar(
      [{ uid: 'x', dtstart: now, dtend: now, summary: 'S', status: 'CANCELLED' }],
      now,
    )
    expect(ics).toContain('STATUS:CANCELLED')
  })

  it('omits LOCATION and DESCRIPTION when not given', () => {
    const ics = buildVCalendar(
      [{ uid: 'x', dtstart: now, dtend: now, summary: 'S', status: 'CONFIRMED' }],
      now,
    )
    expect(ics).not.toContain('LOCATION')
    expect(ics).not.toContain('DESCRIPTION')
  })

  it('includes LOCATION and DESCRIPTION, escaped, when given', () => {
    const ics = buildVCalendar(
      [{ uid: 'x', dtstart: now, dtend: now, summary: 'S', status: 'CONFIRMED', location: 'A, B', description: 'line1\nline2' }],
      now,
    )
    expect(ics).toContain('LOCATION:A\\, B')
    expect(ics).toContain('DESCRIPTION:line1\\nline2')
  })

  it('renders an empty calendar with no events', () => {
    const ics = buildVCalendar([], now)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).not.toContain('VEVENT')
  })
})
