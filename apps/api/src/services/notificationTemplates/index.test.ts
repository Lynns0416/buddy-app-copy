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
