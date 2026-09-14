import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { hasEmailTemplate, renderEmail } from './index'
import type { Locale, NotifEventKind } from '@peace-buddy/types'

const ORIGINAL_WEB_BASE = process.env.WEB_BASE_URL

beforeEach(() => {
  process.env.WEB_BASE_URL = 'https://example.test'
})

afterEach(() => {
  process.env.WEB_BASE_URL = ORIGINAL_WEB_BASE
})

describe('renderEmail', () => {
  const tour = { tourId: 'tour-123' }

  const cases: Array<{ event: NotifEventKind; payload?: Record<string, unknown> }> = [
    { event: 'account_approved' },
    { event: 'account_rejected' },
    { event: 'tour_published', payload: tour },
    { event: 'tour_details_changed', payload: tour },
    { event: 'tour_cancelled', payload: tour },
    { event: 'tour_reminder', payload: tour },
    { event: 'maybe_reminder', payload: tour },
    { event: 'waitlist_promoted', payload: tour },
    { event: 'booking_cancelled', payload: tour },
    { event: 'cant_go_post_deadline', payload: tour },
    { event: 'maybe_resolved', payload: tour },
    { event: 'maybe_deadline_missed', payload: tour },
  ]

  for (const { event, payload } of cases) {
    it(`renders both locales for '${event}' with subject/html/text populated`, () => {
      for (const locale of ['ja', 'en'] as Locale[]) {
        const rendered = renderEmail(event, payload ?? {}, locale)
        expect(rendered).not.toBeNull()
        expect(rendered!.subject.length).toBeGreaterThan(0)
        expect(rendered!.html.length).toBeGreaterThan(0)
        expect(rendered!.text.length).toBeGreaterThan(0)
      }
    })
  }

  it('embeds the tour id in tour-scoped links', () => {
    const rendered = renderEmail('tour_published', { tourId: 'tour-xyz' }, 'en')!
    expect(rendered.html).toContain('/buddy/tours/tour-xyz')
    expect(rendered.text).toContain('/buddy/tours/tour-xyz')
  })

  it('uses the locale prefix in links', () => {
    const ja = renderEmail('tour_published', { tourId: 'tour-xyz' }, 'ja')!
    expect(ja.html).toContain('https://example.test/ja/buddy/tours/')
  })
})

describe('renderEmail detail variant', () => {
  const tourDetail = { tourId: 'tour-1', groupName: 'Sakura School', tourDate: '2026-07-04' }
  const bookingDetail = {
    ...tourDetail,
    bookingId: 'b-1',
    sessionId: 's-1',
    buddyId: 'bd-1',
    buddyName: 'Aya',
  }

  it('names the tour in the subject, text body and html body', () => {
    for (const locale of ['ja', 'en'] as Locale[]) {
      const r = renderEmail('tour_published', tourDetail, locale)!
      expect(r.subject).toContain('Sakura School')
      expect(r.text).toContain('Sakura School')
      expect(r.text).toContain('2026-07-04')
      expect(r.html).toContain('Sakura School')
    }
  })

  it('names the acting buddy in admin-targeted mail', () => {
    const r = renderEmail('cant_go_post_deadline', bookingDetail, 'ja')!
    expect(r.subject).toContain('Aya')
    expect(r.text).toContain('Aya')
    expect(r.html).toContain('Aya')
  })

  it('keeps the link in the detail text body', () => {
    const r = renderEmail('tour_published', tourDetail, 'en')!
    expect(r.text).toContain('https://example.test/en/buddy/tours/tour-1')
  })

  it('falls back to the generic copy when the payload predates the widened fields', () => {
    const generic = renderEmail('tour_published', {}, 'en')!
    const withTourOnly = renderEmail('tour_published', { tourId: 'tour-1' }, 'en')!
    expect(withTourOnly.subject).toBe(generic.subject)
    expect(withTourOnly.text).not.toContain('{groupName}')
    expect(withTourOnly.html).not.toContain('{groupName}')
  })

  it('falls back for the whole message when only part of the detail resolves', () => {
    const generic = renderEmail('booking_cancelled', {}, 'en')!
    const partial = renderEmail('booking_cancelled', { tourId: 'tour-1', buddyName: 'Aya' }, 'en')!
    expect(partial.subject).toBe(generic.subject)
    expect(partial.html).not.toContain('Aya')
  })

  it('renders a buddy display name containing html markup inert', () => {
    const r = renderEmail(
      'booking_cancelled',
      { ...bookingDetail, buddyName: '<img src=x onerror=alert(1)>' },
      'en',
    )!
    expect(r.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(r.html).not.toContain('<img')
  })

  it('strips control characters from an interpolated subject', () => {
    const r = renderEmail(
      'booking_cancelled',
      { ...bookingDetail, buddyName: 'Aya\r\nBcc: evil@example.test' },
      'en',
    )!
    expect(r.subject).not.toMatch(/[\r\n]/)
    expect(r.subject).toContain('Aya Bcc: evil@example.test')
  })

  it('links to the locale home rather than a partial path when the tour id is missing', () => {
    const r = renderEmail('tour_published', {}, 'en')!
    expect(r.html).toContain('href="https://example.test/en"')
    expect(r.html).not.toContain('/buddy/tours/"')
  })
})

describe('hasEmailTemplate', () => {
  it('returns true for events shipped in slice 3', () => {
    expect(hasEmailTemplate('account_approved')).toBe(true)
    expect(hasEmailTemplate('cant_go_post_deadline')).toBe(true)
    expect(hasEmailTemplate('maybe_reminder')).toBe(true)
  })

  it('returns false for digest-only and not-yet-shipped events', () => {
    // new_signup, new_booking → digest-only (slice 5)
    expect(hasEmailTemplate('new_signup')).toBe(false)
    expect(hasEmailTemplate('new_booking')).toBe(false)
    // self-eval prompt is in-app-only per PRD
    expect(hasEmailTemplate('self_eval_prompt')).toBe(false)
  })

  it('returns null from renderEmail when no template registered', () => {
    expect(renderEmail('new_signup', {}, 'en')).toBeNull()
  })
})
