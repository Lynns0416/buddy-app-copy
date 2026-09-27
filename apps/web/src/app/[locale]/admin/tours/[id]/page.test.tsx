import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminTourDetailPage from './page'
import type { AdminTourDetailResponse } from '@peace-buddy/types'
import { TourStatusSchema } from '@peace-buddy/types'
import { fetchTour, toggleTourBooking } from '../admin.tour'
import { adminTourSummary } from '@/test/tour-fixtures'

const TOUR_ID = 'c3d4e5f6-a7b8-9012-cdef-123456789012'

function tourFixture(bookingOpen: boolean, status: AdminTourDetailResponse['status'] = TourStatusSchema.enum.published): AdminTourDetailResponse {
  return {
    ...adminTourSummary({ id: TOUR_ID, status, bookingOpen }),
    adminMemo: null,
    cancellationDeadline: '2025-05-29',
    maybeDeadline: null,
    notificationOffsets: [],
    bookings: [],
    assignedAdmins: [],
    staffInChargeId: null,
  }
}

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: TOUR_ID }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/hooks/use-admin-guard', () => ({
  useAdminGuard: () => ({ ready: true, locale: 'en' }),
}))

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../hooks/use-all-admins', () => ({ useAllAdmins: () => [] }))
vi.mock('../_components/tour-bookings-table', () => ({ TourBookingsTable: () => null }))
vi.mock('../_components/tour-buddy-eval-section', () => ({ TourBuddyEvalSection: () => null }))
vi.mock('../_components/complete-tour-modal', () => ({ CompleteTourModal: () => null }))
vi.mock('../_components/tour-admin-assignment', () => ({ TourAdminAssignment: () => null }))

vi.mock('../admin.tour', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../admin.tour')>()),
  fetchTour: vi.fn(),
  toggleTourBooking: vi.fn(),
}))

describe('AdminTourDetailPage booking toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    { bookingOpen: false, button: 'openBooking', message: 'confirmOpenBooking' },
    { bookingOpen: true, button: 'closeBooking', message: 'confirmCloseBooking' },
  ])('asks $message and toggles once confirmed', async ({ bookingOpen, button, message }) => {
    vi.mocked(fetchTour).mockResolvedValue({ ok: true, data: tourFixture(bookingOpen) })
    vi.mocked(toggleTourBooking).mockResolvedValue({ ok: true, data: tourFixture(!bookingOpen) })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AdminTourDetailPage />)

    await userEvent.setup().click(await screen.findByRole('button', { name: button }))

    expect(confirm).toHaveBeenCalledWith(message)
    await waitFor(() => expect(toggleTourBooking).toHaveBeenCalledWith(TOUR_ID, bookingOpen))
  })

  it('does not toggle when the admin dismisses the confirmation', async () => {
    vi.mocked(fetchTour).mockResolvedValue({ ok: true, data: tourFixture(false) })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AdminTourDetailPage />)

    await userEvent.setup().click(await screen.findByRole('button', { name: 'openBooking' }))

    expect(toggleTourBooking).not.toHaveBeenCalled()
  })
})

describe('AdminTourDetailPage reflections link', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('links a completed tour to its reflections', async () => {
    vi.mocked(fetchTour).mockResolvedValue({ ok: true, data: tourFixture(false, TourStatusSchema.enum.completed) })
    render(<AdminTourDetailPage />)

    expect(await screen.findByRole('link', { name: 'reflections.view' }))
      .toHaveAttribute('href', `/en/admin/stats/reflections?tourId=${TOUR_ID}`)
  })

  it('has no reflections link before the tour is completed', async () => {
    vi.mocked(fetchTour).mockResolvedValue({ ok: true, data: tourFixture(false) })
    render(<AdminTourDetailPage />)

    await screen.findByRole('button', { name: 'openBooking' })
    expect(screen.queryByRole('link', { name: 'reflections.view' })).not.toBeInTheDocument()
  })
})
