import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { hasSlackTemplate, renderSlack } from './index'
import messages from './messages.ja.json'

const ADMIN_EVENTS = [
  'new_signup',
  'new_booking',
  'booking_cancelled',
  'maybe_resolved',
  'maybe_deadline_missed',
  'cant_go_post_deadline',
] as const

describe('hasSlackTemplate', () => {
  it('covers every admin-targeted event', () => {
    for (const e of ADMIN_EVENTS) {
      expect(hasSlackTemplate(e)).toBe(true)
    }
  })

  it('returns false for buddy-targeted events — they have no place in an ops channel', () => {
    expect(hasSlackTemplate('tour_reminder')).toBe(false)
    expect(hasSlackTemplate('account_approved')).toBe(false)
    expect(hasSlackTemplate('waitlist_promoted')).toBe(false)
  })
})

describe('renderSlack', () => {
  const OLD_ENV = process.env.WEB_BASE_URL

  beforeEach(() => {
    process.env.WEB_BASE_URL = 'https://app.example.com'
  })
  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.WEB_BASE_URL
    else process.env.WEB_BASE_URL = OLD_ENV
  })

  it('returns null for an event with no template', () => {
    expect(renderSlack('tour_reminder', {})).toBeNull()
  })

  it('interpolates the payload into the deep link', () => {
    const out = renderSlack('new_booking', { tourId: 't-123' })
    expect(out?.text).toContain('https://app.example.com/ja/admin/tours/t-123')
  })

  it('builds a Slack link with the CTA as the label', () => {
    const out = renderSlack('new_signup', { buddyUserId: 'u-1' })
    expect(out?.text).toContain(
      `<https://app.example.com/ja/admin/buddies/u-1|${messages.new_signup.cta}>`,
    )
  })

  it('omits the link when a placeholder is unresolved — never posts a partial 404 path', () => {
    const out = renderSlack('new_booking', {})
    expect(out?.text).not.toContain('{tourId}')
    expect(out?.text).not.toContain('https://app.example.com')
    expect(out?.text).not.toContain('<')
  })

  it('omits the link when a placeholder is present but empty', () => {
    const out = renderSlack('new_booking', { tourId: '' })
    expect(out?.text).not.toContain('https://app.example.com')
  })

  it('still returns the message text when the link is dropped', () => {
    const out = renderSlack('new_booking', {})
    expect(out?.text).toBe(messages.new_booking.text)
  })

  it('url-encodes payload values so a crafted id cannot break out of the path', () => {
    const out = renderSlack('new_booking', { tourId: 'a/../../evil' })
    expect(out?.text).toContain('a%2F..%2F..%2Fevil')
  })

  it('omits the link entirely when the base URL is unusable', () => {
    process.env.WEB_BASE_URL = 'not a url'
    const out = renderSlack('new_signup', { buddyUserId: 'u-1' })
    expect(out?.text).not.toContain('<')
  })
})

describe('renderSlack detail variant', () => {
  const OLD_ENV = process.env.WEB_BASE_URL

  const bookingPayload = {
    bookingId: 'b-1',
    tourId: 't-1',
    sessionId: 's-1',
    buddyId: 'bd-1',
    buddyName: 'Aya',
    groupName: 'Sakura School',
    tourDate: '2026-07-04',
  }

  beforeEach(() => {
    process.env.WEB_BASE_URL = 'https://app.example.com'
  })
  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.WEB_BASE_URL
    else process.env.WEB_BASE_URL = OLD_ENV
  })

  it('names the acting buddy and the tour in all six admin events', () => {
    const payloads: Record<(typeof ADMIN_EVENTS)[number], Record<string, unknown>> = {
      new_signup: { buddyUserId: 'u-1', email: 'aya@example.test', displayName: 'Aya' },
      new_booking: { ...bookingPayload, status: 'confirmed' },
      booking_cancelled: bookingPayload,
      maybe_resolved: { ...bookingPayload, resolution: 'confirmed' },
      maybe_deadline_missed: { tourId: 't-1', groupName: 'Sakura School', tourDate: '2026-07-04' },
      cant_go_post_deadline: { ...bookingPayload, category: 'health' },
    }

    for (const event of ADMIN_EVENTS) {
      const out = renderSlack(event, payloads[event])!
      // Every admin event says more than the generic announcement it replaces.
      expect(out.text).not.toContain(messages[event].text)
      if (event === 'new_signup') expect(out.text).toContain('Aya')
      else expect(out.text).toContain('Sakura School')
    }
  })

  it('falls back to the generic text when the payload predates the widened fields', () => {
    const out = renderSlack('new_booking', { tourId: 't-1' })!
    expect(out.text).toContain(messages.new_booking.text)
    expect(out.text).not.toContain('{buddyName}')
  })

  it('falls back when only some of the detail fields are present', () => {
    const out = renderSlack('booking_cancelled', { tourId: 't-1', buddyName: 'Aya' })!
    expect(out.text).toContain(messages.booking_cancelled.text)
    expect(out.text).not.toContain('Aya')
  })

  it('renders a buddy display name containing Slack markup inert', () => {
    const out = renderSlack('new_booking', {
      ...bookingPayload,
      buddyName: '<http://evil.test|click me>',
    })!
    expect(out.text).toContain('&lt;http://evil.test|click me&gt;')
    expect(out.text).not.toContain('<http://evil.test')
  })

  it('strips newlines from a display name so it cannot forge extra channel lines', () => {
    const out = renderSlack('new_signup', {
      buddyUserId: 'u-1',
      email: 'aya@example.test',
      displayName: 'Aya\n\n:rotating_light: *承認済み*',
    })!
    // Only the newline the template itself puts before the CTA link survives.
    expect(out.text.split('\n')).toHaveLength(2)
  })

  it('escapes a group name containing Slack markup', () => {
    const out = renderSlack('booking_cancelled', { ...bookingPayload, groupName: '<@U123> & co' })!
    expect(out.text).toContain('&lt;@U123&gt; &amp; co')
    expect(out.text).not.toContain('<@U123>')
  })
})
