import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AdminBuddyStatsResponse, AdminBuddyStatsRow, BuddyStats } from '@peace-buddy/types'
import AdminBuddyStatsPage from './page'

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useLocale: () => 'en',
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/hooks/use-admin-guard', () => ({ useAdminGuard: () => ({ ready: true }) }))

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/i18n/routing', () => ({ routing: { defaultLocale: 'en' } }))

vi.mock('@/lib/api-client', () => ({ apiClient: { listBuddyStats: vi.fn() } }))

vi.mock('@/lib/api', () => ({ ApiError: class extends Error {} }))

import { apiClient } from '@/lib/api-client'

const mockList = vi.mocked(apiClient.listBuddyStats)

function stats(overrides: Partial<BuddyStats> = {}): BuddyStats {
  return {
    sessionsAttended: 0, toursAttended: 0, noShows: 0, toursMissed: 0, attendanceRate: null, upcomingConfirmed: 0,
    openMaybe: 0, openWaitlist: 0, firstTourDate: null, lastTourDate: null, daysSinceLastTour: null,
    minutesVolunteered: 0, sessionsWithoutTimes: 0, bookings: 0, cancellations: 0, lateCancellations: 0,
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
    ...overrides,
  }
}

function buddy(id: string, displayName: string, overrides: Partial<AdminBuddyStatsRow> = {}): AdminBuddyStatsRow {
  return {
    id, displayName, realName: '', status: 'active', tier: 'buddy', memberType: 'buddy',
    createdAt: '2025-01-01T00:00:00.000Z', stats: stats(), ...overrides,
  }
}

const response: AdminBuddyStatsResponse = {
  places: [{ id: 'p1', nameJa: 'ホール', nameEn: 'Hall' }],
  buddies: [
    buddy('b1', 'Aya', { stats: stats({ sessionsAttended: 2 }) }),
    buddy('b2', 'Ken', { stats: stats({ sessionsAttended: 7 }) }),
    buddy('b3', 'Staff', { memberType: 'plab_member' }),
  ],
}

function bodyNames(): string[] {
  const [, body] = screen.getAllByRole('rowgroup')
  return within(body).getAllByRole('link').map((a) => a.textContent ?? '')
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  mockList.mockResolvedValue(response)
})

describe('AdminBuddyStatsPage', () => {
  it('loads all-time stats and leaves PLAB members out by default', async () => {
    render(<AdminBuddyStatsPage />)

    expect(await screen.findByRole('link', { name: 'Aya' })).toBeInTheDocument()
    expect(mockList).toHaveBeenCalledWith({ from: undefined, to: undefined, groupType: undefined, placeId: undefined })
    expect(screen.queryByRole('link', { name: 'Staff' })).not.toBeInTheDocument()
  })

  it('refetches when the period changes', async () => {
    const user = userEvent.setup()
    render(<AdminBuddyStatsPage />)
    await screen.findByRole('link', { name: 'Aya' })

    await user.selectOptions(screen.getByLabelText('adminStats.scope.groupType'), 'school')

    expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({ groupType: 'school' }))
  })

  it('sorts a number column largest first on the first click', async () => {
    const user = userEvent.setup()
    render(<AdminBuddyStatsPage />)
    await screen.findByRole('link', { name: 'Aya' })

    await user.click(screen.getByRole('button', { name: 'adminBuddyStats.columns.sessionsAttended' }))

    expect(bodyNames()).toEqual(['Ken', 'Aya'])
  })

  it('explains a column whose name needs it, on focus of its ⓘ', async () => {
    render(<AdminBuddyStatsPage />)
    await screen.findByRole('link', { name: 'Aya' })
    const header = (name: string) => screen.getByRole('columnheader', { name: new RegExp(`columns\\.${name}`) })

    expect(within(header('noShows')).queryByRole('button', { name: 'adminBuddyStats.about' })).not.toBeInTheDocument()

    act(() => within(header('attendanceRate')).getByRole('button', { name: 'adminBuddyStats.about' }).focus())

    expect(await screen.findByRole('tooltip')).toHaveTextContent('adminBuddyStats.descriptions.attendanceRate')
  })

  it('adds a column the admin ticks and remembers it', async () => {
    const user = userEvent.setup()
    render(<AdminBuddyStatsPage />)
    await screen.findByRole('link', { name: 'Aya' })
    expect(screen.queryByRole('button', { name: 'adminBuddyStats.columns.moments' })).not.toBeInTheDocument()

    await user.click(screen.getByText('adminBuddyStats.columnPicker.title'))
    await user.click(screen.getByRole('checkbox', { name: 'adminBuddyStats.columns.moments' }))

    expect(screen.getByRole('button', { name: 'adminBuddyStats.columns.moments' })).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem('adminBuddyStats.columns') ?? '[]')).toContain('moments')
  })

  it('offers one column per place', async () => {
    const user = userEvent.setup()
    render(<AdminBuddyStatsPage />)
    await screen.findByRole('link', { name: 'Aya' })
    await user.click(screen.getByText('adminBuddyStats.columnPicker.title'))

    expect(screen.getByRole('checkbox', { name: 'adminBuddyStats.columns.sessionsAtPlace' })).toBeInTheDocument()
  })

  it('narrows the table to the buddies behind an overview bar, and shows all again', async () => {
    const user = userEvent.setup()
    render(<AdminBuddyStatsPage />)
    await screen.findByRole('link', { name: 'Aya' })

    await user.click(screen.getByRole('button', { name: '6–10: 1' }))

    expect(bodyNames()).toEqual(['Ken'])
    expect(screen.getByText('adminBuddyStats.overview.focused')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'adminBuddyStats.overview.clearFocus' }))

    expect(bodyNames()).toEqual(['Ken', 'Aya'])
  })

  it('sorts by the figure clicked and shows its column even when hidden', async () => {
    const user = userEvent.setup()
    render(<AdminBuddyStatsPage />)
    await screen.findByRole('link', { name: 'Aya' })
    expect(screen.queryByRole('button', { name: 'adminBuddyStats.columns.hoursVolunteered' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /adminBuddyStats\.columns\.hoursVolunteered$/ }))

    expect(screen.getByRole('button', { name: 'adminBuddyStats.columns.hoursVolunteered' })).toBeInTheDocument()
  })

  it('counts the overview over the filtered rows only', async () => {
    render(<AdminBuddyStatsPage />)
    await screen.findByRole('link', { name: 'Aya' })

    // Two buddies in view: the PLAB member is filtered out of the figures too.
    expect(screen.getByRole('button', { name: '0: 0' })).toBeInTheDocument()
  })
})
