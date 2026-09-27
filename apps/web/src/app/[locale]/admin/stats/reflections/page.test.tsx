import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AdminReflectionStatsResponse, AdminReflectionStatsRow } from '@peace-buddy/types'
import AdminReflectionStatsPage from './page'

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useLocale: () => 'en',
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

let searchParams = new URLSearchParams()
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/en/admin/stats/reflections',
}))

vi.mock('@/hooks/use-admin-guard', () => ({ useAdminGuard: () => ({ ready: true }) }))

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/api-client', () => ({ apiClient: { listReflectionStats: vi.fn() } }))

vi.mock('@/lib/api', () => ({ ApiError: class extends Error {} }))

import { apiClient } from '@/lib/api-client'

const mockStats = vi.mocked(apiClient.listReflectionStats)

const TOUR_ID = '00000000-0000-0000-0001-000000000021'
const PARK = { id: 'park', nameJa: '平和公園', nameEn: 'Peace Park' }
const STATUE = { id: 'statue', nameJa: '平和祈念像', nameEn: 'Peace Statue' }

function row(id: string, buddyDisplayName: string, overrides: Partial<AdminReflectionStatsRow> = {}): AdminReflectionStatsRow {
  return {
    id,
    buddyId: `buddy-${id}`,
    buddyDisplayName,
    buddyRealName: '',
    buddyMemberType: 'buddy',
    sessionId: `s-${id}`,
    sessionOrder: 1,
    sessionLabel: null,
    tourId: TOUR_ID,
    tourDate: '2026-06-01T00:00:00.000Z',
    didWell: null,
    couldImprove: null,
    notesForOthers: null,
    openQuestions: null,
    moments: [],
    createdAt: '2026-06-02T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
    group: { name: 'Nagasaki High', type: 'school' },
    place: PARK,
    ...overrides,
  }
}

const response: AdminReflectionStatsResponse = {
  reflections: [
    row('a', 'Aya', {
      didWell: 'Kept the group together',
      moments: [{ id: 'm1', position: 0, spotId: STATUE.id, placeNote: null, description: 'They asked about the hands', spot: { ...STATUE, place: PARK } }],
    }),
    row('b', 'Ken'),
  ],
  buddies: [
    { id: 'buddy-a', displayName: 'Aya', realName: '', memberType: 'buddy', sessionsAttended: 2 },
    { id: 'buddy-b', displayName: 'Ken', realName: '', memberType: 'buddy', sessionsAttended: 2 },
  ],
  places: [{ ...PARK, active: true, spots: [{ ...STATUE, active: true }] }],
}

function listedBuddies(): string[] {
  const [, body] = screen.getAllByRole('rowgroup')
  return within(body).getAllByRole('link').map((a) => a.textContent ?? '').filter((name) => name !== 'Nagasaki High')
}

beforeEach(() => {
  vi.clearAllMocks()
  searchParams = new URLSearchParams()
  mockStats.mockResolvedValue(response)
})

describe('AdminReflectionStatsPage', () => {
  it('loads every reflection, all time', async () => {
    render(<AdminReflectionStatsPage />)

    expect(await screen.findByRole('link', { name: 'Aya' })).toBeInTheDocument()
    expect(mockStats).toHaveBeenCalledWith({
      from: undefined, to: undefined, groupType: undefined, placeId: undefined, tourId: undefined,
    })
    expect(listedBuddies()).toEqual(['Aya', 'Ken'])
  })

  it('opens on the tour the URL names, and can widen to every tour', async () => {
    searchParams = new URLSearchParams({ tourId: TOUR_ID })
    const user = userEvent.setup()
    render(<AdminReflectionStatsPage />)
    await screen.findByRole('link', { name: 'Aya' })
    expect(mockStats).toHaveBeenCalledWith(expect.objectContaining({ tourId: TOUR_ID }))

    await user.click(screen.getByRole('button', { name: 'adminReflectionStats.scope.clearTour' }))

    expect(mockStats).toHaveBeenLastCalledWith(expect.objectContaining({ tourId: undefined }))
    expect(mockReplace).toHaveBeenCalledWith('/en/admin/stats/reflections')
  })

  it('narrows the list to the reflections behind a spot bar', async () => {
    const user = userEvent.setup()
    render(<AdminReflectionStatsPage />)
    await screen.findByRole('link', { name: 'Aya' })

    await user.click(screen.getByRole('button', { name: 'Peace Statue: 1' }))

    expect(listedBuddies()).toEqual(['Aya'])
    await user.click(screen.getByRole('button', { name: 'adminReflectionStats.overview.clearFocus' }))
    expect(listedBuddies()).toEqual(['Aya', 'Ken'])
  })

  it('shows the full reflection when its row is opened', async () => {
    const user = userEvent.setup()
    render(<AdminReflectionStatsPage />)
    await screen.findByRole('link', { name: 'Aya' })
    expect(screen.queryByText('Kept the group together')).not.toBeInTheDocument()

    const [first] = screen.getAllByRole('button', { name: '2026/06/01' })
    await user.click(first)

    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Kept the group together')).toBeInTheDocument()
    expect(screen.getByText('They asked about the hands')).toBeInTheDocument()
  })

  it('sorts by buddy', async () => {
    const user = userEvent.setup()
    render(<AdminReflectionStatsPage />)
    await screen.findByRole('link', { name: 'Aya' })

    await user.click(screen.getByRole('button', { name: 'adminReflectionStats.columns.buddy' }))
    await user.click(screen.getByRole('button', { name: 'adminReflectionStats.columns.buddy' }))

    expect(listedBuddies()).toEqual(['Ken', 'Aya'])
  })
})
