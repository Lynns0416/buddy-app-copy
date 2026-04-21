import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import PendingPage from './page'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: () => ({ locale: 'en' }),
}))

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

const mockPush = vi.fn()
const mockReplace = vi.fn()
vi.mocked(useRouter).mockReturnValue({ push: mockPush, replace: mockReplace } as never)

const mockUseAuth = vi.mocked(useAuth)
const mockSignOut = vi.fn()

describe('PendingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({ push: mockPush, replace: mockReplace } as never)
    mockSignOut.mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue({
      firebaseUser: { uid: 'u1' },
      dbUser: { buddyProfile: { status: 'pending' } },
      loading: false,
      signOut: mockSignOut,
    } as never)
  })

  it('renders nothing while loading', () => {
    mockUseAuth.mockReturnValue({ firebaseUser: null, dbUser: null, loading: true, signOut: mockSignOut } as never)
    const { container } = render(<PendingPage />)
    expect(container.firstChild).toBeNull()
  })

  it('redirects to login when not authenticated', () => {
    mockUseAuth.mockReturnValue({ firebaseUser: null, dbUser: null, loading: false, signOut: mockSignOut } as never)
    render(<PendingPage />)
    expect(mockReplace).toHaveBeenCalledWith('/en/login')
  })

  it('redirects to dashboard when buddy is active', () => {
    mockUseAuth.mockReturnValue({
      firebaseUser: { uid: 'u1' },
      dbUser: { buddyProfile: { status: 'active' } },
      loading: false,
      signOut: mockSignOut,
    } as never)
    render(<PendingPage />)
    expect(mockReplace).toHaveBeenCalledWith('/en/dashboard')
  })

  it('renders pending message', () => {
    render(<PendingPage />)
    expect(screen.getByText('title')).toBeInTheDocument()
    expect(screen.getByText('message')).toBeInTheDocument()
  })

  it('calls signOut and redirects to login on sign-out click', async () => {
    render(<PendingPage />)
    screen.getByText('signOut').click()
    await vi.waitFor(() => expect(mockSignOut).toHaveBeenCalled())
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledWith('/en/login'))
  })
})
