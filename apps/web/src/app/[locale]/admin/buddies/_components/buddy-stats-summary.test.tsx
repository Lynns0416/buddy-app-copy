import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { AdminBuddyStatsRow, BuddyStats } from '@peace-buddy/types'
import { BuddyStatsSummary } from './buddy-stats-summary'

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useLocale: () => 'en',
}))

vi.mock('@/i18n/routing', () => ({ routing: { defaultLocale: 'en' } }))

const stats: BuddyStats = {
  sessionsAttended: 4, toursAttended: 3, noShows: 0, lateUnexcused: 0, toursMissed: 0, attendanceRate: 0.75, upcomingConfirmed: 1,
  openMaybe: 0, openWaitlist: 0, firstTourDate: null, lastTourDate: null, daysSinceLastTour: null,
  minutesOnTour: 0, sessionsWithoutTimes: 0, bookings: 0, cancellations: 0, lateCancellations: 0,
  cancellationsUnavoidable: 0, cancellationsAvoidable: 0, cancellationsUnreviewed: 0,
  cancellationsByCategory: { health: 0, emergency: 0, personal: 0, work: 0, other: 0 },
  cancellationRate: null, reflections: 0, reflectionRate: null, moments: 0, evaluationsReceived: 0,
  evaluationsMissing: 0,
  averageScores: {
    overallRating: null, reliability: null, communication: null, groupEngagement: null, memory: null,
    knowledge: null, dedication: null, dialogue: null, adaptability: null, confidence: null,
  },
  scoreCounts: {
    overallRating: 0, reliability: 0, communication: 0, groupEngagement: 0, memory: 0,
    knowledge: 0, dedication: 0, dialogue: 0, adaptability: 0, confidence: 0,
  },
  profileOverallRating: null, placesGuided: 0, sessionsByPlace: {}, groupTypesServed: 0,
  sessionsByGroupType: { school: 0, company: 0, community: 0, other: 0 }, monthsSinceRegistration: 0,
}

const buddy: AdminBuddyStatsRow = {
  id: 'b1', displayName: 'Aki', realName: '', status: 'active', tier: 'buddy', memberType: 'buddy',
  createdAt: '2025-01-01T00:00:00.000Z', stats,
}

describe('BuddyStatsSummary', () => {
  it('leads with key numbers in three sections, cancellations and profile left out', () => {
    const { container } = render(<BuddyStatsSummary buddy={buddy} />)
    const sections = Array.from(container.querySelectorAll('section'))
    const labelsOf = (section: HTMLElement) =>
      within(section).getAllByRole('term').map((el) => el.textContent?.replace('adminBuddyStats.columns.', ''))
    expect(sections.map((s) => within(s).getByRole('heading').textContent)).toEqual([
      'adminBuddyStats.detail.sections.activity',
      'adminBuddyStats.detail.sections.reliability',
      'adminBuddyStats.detail.sections.recent',
    ])
    expect(sections.map(labelsOf)).toEqual([
      ['sessionsAttended', 'toursAttended', 'reflections'],
      ['attendanceRate', 'noShows', 'lateUnexcused', 'lateCancellations'],
      ['lastTourDate', 'daysSinceLastTour', 'upcomingConfirmed'],
    ])
  })

  it('puts every group but profile in its own collapsed section', () => {
    const { container } = render(<BuddyStatsSummary buddy={buddy} />)
    const sections = Array.from(container.querySelectorAll('details'))
    expect(sections.map((s) => s.querySelector('summary')?.textContent)).toEqual([
      'adminBuddyStats.groups.participation',
      'adminBuddyStats.groups.cancellations',
      'adminBuddyStats.groups.engagement',
      'adminBuddyStats.groups.evaluations',
      'adminBuddyStats.groups.coverage',
    ])
    expect(sections.every((s) => !s.open)).toBe(true)
    expect(screen.queryByText('adminBuddyStats.groups.profile')).toBeNull()
  })
})
