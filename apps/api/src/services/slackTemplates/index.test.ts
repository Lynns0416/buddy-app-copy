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
