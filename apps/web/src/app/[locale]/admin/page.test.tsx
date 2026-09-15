import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AppErrorCodeSchema } from '@peace-buddy/types'
import type { AdminDashboardResponse, NotificationsListResponse } from '@peace-buddy/types'
import AdminHomePage from './page'
import { routes } from '@/lib/routes'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

vi.mock('@/hooks/use-admin-guard', () => ({
  useAdminGuard: () => ({ ready: true, locale: 'en' }),
}))

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('./admin.dashboard', () => ({
  fetchAdminDashboard: vi.fn(),
}))

vi.mock('@/hooks/use-notifications', () => ({
  useNotifications: vi.fn(),
}))

import { fetchAdminDashboard } from './admin.dashboard'
import { useNotifications } from '@/hooks/use-notifications'

const emptyDashboard: AdminDashboardResponse = {
  pendingBuddies: [],
  overdueMaybeTours: [],
  underfilledTours: [],
  underfilledLookaheadDays: 14,
  toursMissingEvaluations: [],
}

const fullDashboard: AdminDashboardResponse = {
  pendingBuddies: [{ id: 'b1', displayName: 'Aya', createdAt: '2026-06-01T00:00:00.000Z' }],
  overdueMaybeTours: [
    { id: 't1', tourDate: '2026-07-04T00:00:00.000Z', group: { name: 'Sakura School' }, maybeDeadline: '2026-06-19T00:00:00.000Z', maybeCount: 2 },
  ],
  underfilledTours: [
    {
      id: 't2',
      tourDate: '2026-06-25T00:00:00.000Z',
      group: { name: 'Hikari School' },
      sessions: [{ id: 's1', order: 1, label: null, minBuddies: 3, confirmedCount: 1 }],
    },
  ],
  underfilledLookaheadDays: 14,
  toursMissingEvaluations: [
    { id: 't3', tourDate: '2026-06-10T00:00:00.000Z', group: { name: 'Minato Co.' }, missingCount: 4 },
  ],
}

function mockNotifications(data: NotificationsListResponse | null, error = false) {
  const markRead = vi.fn()
  vi.mocked(useNotifications).mockReturnValue({ data, error, refetch: vi.fn(), markRead })
  return markRead
}

describe('AdminHomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNotifications({ items: [], unreadCount: 0 })
  })

  it('links each queue item into the page where it is resolved', async () => {
    vi.mocked(fetchAdminDashboard).mockResolvedValue({ ok: true, data: fullDashboard })

    render(<AdminHomePage />)

    expect(await screen.findByRole('link', { name: /Aya/ })).toHaveAttribute('href', routes.adminBuddyDetail('en', 'b1'))
    expect(screen.getByRole('link', { name: /Sakura School/ })).toHaveAttribute('href', routes.adminTourDetail('en', 't1'))
    expect(screen.getByRole('link', { name: /Hikari School/ })).toHaveAttribute('href', routes.adminTourDetail('en', 't2'))
    expect(screen.getByRole('link', { name: /Minato Co\./ })).toHaveAttribute('href', routes.adminTourDetail('en', 't3'))
  })

  it('links the pending queue to the approval page and the feed to all notifications', async () => {
    vi.mocked(fetchAdminDashboard).mockResolvedValue({ ok: true, data: emptyDashboard })

    render(<AdminHomePage />)

    await screen.findByText('pending.empty')
    const hrefs = screen.getAllByRole('link', { name: 'viewAll' }).map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual([routes.adminBuddiesPending('en'), routes.notifications('en')])
  })

  it('shows every queue as empty when nothing is waiting', async () => {
    vi.mocked(fetchAdminDashboard).mockResolvedValue({ ok: true, data: emptyDashboard })

    render(<AdminHomePage />)

    expect(await screen.findByText('pending.empty')).toBeInTheDocument()
    expect(screen.getByText('overdueMaybes.empty')).toBeInTheDocument()
    expect(screen.getByText('underfilled.empty')).toBeInTheDocument()
    expect(screen.getByText('missingEvaluations.empty')).toBeInTheDocument()
    expect(screen.getByText('notifications.empty')).toBeInTheDocument()
  })

  it('lists unread notifications only', async () => {
    vi.mocked(fetchAdminDashboard).mockResolvedValue({ ok: true, data: emptyDashboard })
    mockNotifications({
      items: [
        { id: 'n1', type: 'new_signup', payload: {}, readAt: null, createdAt: '2026-06-01T00:00:00.000Z' },
        { id: 'n2', type: 'new_booking', payload: {}, readAt: '2026-06-01T01:00:00.000Z', createdAt: '2026-06-01T00:00:00.000Z' },
      ],
      unreadCount: 1,
    })

    render(<AdminHomePage />)

    await screen.findByText('pending.empty')
    expect(screen.getByText('new_signup')).toBeInTheDocument()
    expect(screen.queryByText('new_booking')).not.toBeInTheDocument()
  })

  it('marks a notification read from the feed', async () => {
    vi.mocked(fetchAdminDashboard).mockResolvedValue({ ok: true, data: emptyDashboard })
    const markRead = mockNotifications({
      items: [{ id: 'n1', type: 'new_signup', payload: {}, readAt: null, createdAt: '2026-06-01T00:00:00.000Z' }],
      unreadCount: 1,
    })

    render(<AdminHomePage />)

    await screen.findByText('pending.empty')
    fireEvent.click(screen.getByRole('button'))
    expect(markRead).toHaveBeenCalledWith({ ids: ['n1'] })
  })

  it('points to older unread notifications when none are in the feed', async () => {
    vi.mocked(fetchAdminDashboard).mockResolvedValue({ ok: true, data: emptyDashboard })
    mockNotifications({
      items: [{ id: 'n2', type: 'new_booking', payload: {}, readAt: '2026-06-01T01:00:00.000Z', createdAt: '2026-06-01T00:00:00.000Z' }],
      unreadCount: 1,
    })

    render(<AdminHomePage />)

    await screen.findByText('pending.empty')
    expect(screen.getByText('notifications.olderUnread')).toBeInTheDocument()
    expect(screen.queryByText('notifications.empty')).not.toBeInTheDocument()
  })

  it('points to older unread notifications when the feed is capped below the unread count', async () => {
    vi.mocked(fetchAdminDashboard).mockResolvedValue({ ok: true, data: emptyDashboard })
    mockNotifications({
      items: Array.from({ length: 6 }, (_, i) => ({
        id: `n${i}`,
        type: 'new_signup' as const,
        payload: {},
        readAt: null,
        createdAt: '2026-06-01T00:00:00.000Z',
      })),
      unreadCount: 6,
    })

    render(<AdminHomePage />)

    await screen.findByText('pending.empty')
    expect(screen.getAllByText('new_signup')).toHaveLength(5)
    expect(screen.getByText('notifications.olderUnread')).toBeInTheDocument()
  })

  it('holds the notification feed until the worklist settles', () => {
    vi.mocked(fetchAdminDashboard).mockReturnValue(new Promise(() => {}))

    render(<AdminHomePage />)

    expect(screen.queryByText('notifications.empty')).not.toBeInTheDocument()
  })

  it('does not show the notifications empty state before notifications load', async () => {
    vi.mocked(fetchAdminDashboard).mockResolvedValue({ ok: true, data: emptyDashboard })
    mockNotifications(null)

    render(<AdminHomePage />)

    await screen.findByText('pending.empty')
    expect(screen.queryByText('notifications.empty')).not.toBeInTheDocument()
    expect(screen.queryByText('notifications.loadError')).not.toBeInTheDocument()
  })

  it('shows an error instead of an empty feed when notifications fail to load', async () => {
    vi.mocked(fetchAdminDashboard).mockResolvedValue({ ok: true, data: emptyDashboard })
    mockNotifications(null, true)

    render(<AdminHomePage />)

    await screen.findByText('pending.empty')
    expect(screen.getByText('notifications.loadError')).toBeInTheDocument()
    expect(screen.queryByText('notifications.empty')).not.toBeInTheDocument()
  })

  it('shows an error when the worklist fails to load', async () => {
    vi.mocked(fetchAdminDashboard).mockResolvedValue({ ok: false, error: { code: AppErrorCodeSchema.enum.network } })

    render(<AdminHomePage />)

    expect(await screen.findByText('loadError')).toBeInTheDocument()
    expect(screen.queryByText('pending.empty')).not.toBeInTheDocument()
  })
})
