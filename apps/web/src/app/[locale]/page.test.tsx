import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import HomePage from './page'

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  useParams: () => ({ locale: 'en' }),
}))

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}))

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth'

const mockReplace = vi.fn()
vi.mocked(useRouter).mockReturnValue({ replace: mockReplace } as never)

const mockUseAuth = vi.mocked(useAuth)

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRouter).mockReturnValue({ replace: mockReplace } as never)
  })

  it('renders nothing while loading', () => {
    mockUseAuth.mockReturnValue({ firebaseUser: null, loading: true } as never)
    const { container } = render(<HomePage />)
    expect(container.firstChild).toBeNull()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('redirects to dashboard when authenticated', () => {
    mockUseAuth.mockReturnValue({ firebaseUser: { uid: 'u1' }, loading: false } as never)
    render(<HomePage />)
    expect(mockReplace).toHaveBeenCalledWith('/en/dashboard')
  })

  it('redirects to login when not authenticated', () => {
    mockUseAuth.mockReturnValue({ firebaseUser: null, loading: false } as never)
    render(<HomePage />)
    expect(mockReplace).toHaveBeenCalledWith('/en/login')
  })
})
