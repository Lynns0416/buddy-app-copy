import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AdminTourNewPage from './page'
import type { AdminTourDetailResponse } from '@peace-buddy/types'
import { AppErrorCodeSchema } from '@peace-buddy/types'
import { createTour, fetchGroups, fetchPlaces } from '../admin.tour'

const GROUP_A = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const GROUP_B = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'

const createdTour = { id: 'new-tour-1' } as AdminTourDetailResponse

const push = vi.fn()
let searchParams = new URLSearchParams()
// The group the stubbed form reports back, which need not be the one it opened with.
let submittedGroupId = GROUP_A

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParams,
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

// Only the network calls are stubbed; `groupIdFromParams` stays real, since the
// page's job is to route its result rather than to re-parse the query string.
vi.mock('../admin.tour', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../admin.tour')>()),
  fetchGroups: vi.fn(),
  fetchPlaces: vi.fn(),
  createTour: vi.fn(),
}))

type TourFormProps = {
  initialGroupId?: string
  cancelHref: string
  onSubmit: (values: { groupId: string }) => Promise<void>
}

vi.mock('../_components/tour-form', () => ({
  TourForm: ({ initialGroupId, cancelHref, onSubmit }: TourFormProps) => (
    <div>
      <output aria-label="initialGroupId">{initialGroupId ?? ''}</output>
      <a href={cancelHref}>cancel</a>
      <button onClick={() => onSubmit({ groupId: submittedGroupId })}>save</button>
    </div>
  ),
}))

function renderPage(query = '') {
  searchParams = new URLSearchParams(query)
  render(<AdminTourNewPage />)
}

async function save() {
  await userEvent.setup().click(screen.getByRole('button', { name: 'save' }))
  await waitFor(() => expect(push).toHaveBeenCalled())
}

describe('AdminTourNewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    submittedGroupId = GROUP_A
    vi.mocked(fetchGroups).mockResolvedValue({ ok: true, data: [] })
    vi.mocked(fetchPlaces).mockResolvedValue({ ok: true, data: [] })
    vi.mocked(createTour).mockResolvedValue({ ok: true, data: createdTour })
  })

  it('preselects nothing and returns to the tour list without a groupId', async () => {
    renderPage()

    expect(screen.getByLabelText('initialGroupId')).toHaveTextContent('')
    expect(screen.getByRole('link', { name: 'cancel' })).toHaveAttribute('href', '/en/admin/tours')
    expect(screen.getByRole('link', { name: '← back' })).toHaveAttribute('href', '/en/admin/tours')

    await save()
    expect(push).toHaveBeenCalledWith('/en/admin/tours')
  })

  it('preselects the group and returns to it when arriving from a group', async () => {
    renderPage(`groupId=${GROUP_A}`)

    expect(screen.getByLabelText('initialGroupId')).toHaveTextContent(GROUP_A)
    expect(screen.getByRole('link', { name: 'cancel' })).toHaveAttribute('href', `/en/admin/groups/${GROUP_A}`)
    expect(screen.getByRole('link', { name: '← backToDetail' })).toBeInTheDocument()

    await save()
    expect(push).toHaveBeenCalledWith(`/en/admin/groups/${GROUP_A}`)
  })

  it('returns to the group the tour was created for, not the one it opened with', async () => {
    renderPage(`groupId=${GROUP_A}`)
    submittedGroupId = GROUP_B

    await save()
    expect(push).toHaveBeenCalledWith(`/en/admin/groups/${GROUP_B}`)
  })

  it('ignores a malformed groupId', async () => {
    renderPage('groupId=not-a-uuid')

    expect(screen.getByLabelText('initialGroupId')).toHaveTextContent('')
    expect(screen.getByRole('link', { name: 'cancel' })).toHaveAttribute('href', '/en/admin/tours')

    await save()
    expect(push).toHaveBeenCalledWith('/en/admin/tours')
  })

  it('stays on the form and shows the error when creation fails', async () => {
    vi.mocked(createTour).mockResolvedValue({ ok: false, error: { code: AppErrorCodeSchema.enum.conflict } })
    renderPage(`groupId=${GROUP_A}`)

    await userEvent.setup().click(screen.getByRole('button', { name: 'save' }))

    expect(await screen.findByText('error.conflict')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})
