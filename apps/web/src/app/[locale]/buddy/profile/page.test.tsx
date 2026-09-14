import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProfilePage from './page'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const searchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useParams: () => ({ locale: 'en' }),
  useSearchParams: () => searchParams,
}))

vi.mock('@/lib/auth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('./_components/profile-header', () => ({
  ProfileHeader: () => <div />,
}))

vi.mock('./_components/linked-accounts', () => ({
  LinkedAccounts: () => null,
}))

vi.mock('./_components/profile-form', () => ({
  ProfileForm: () => <div />,
}))

vi.mock('./hooks/use-my-profile', () => ({
  useMyProfile: () => ({
    profile: { id: 'p1', displayName: 'Test Buddy' },
    error: false,
    refetch: vi.fn(),
    updateProfile: vi.fn(),
  }),
}))

import { useAuth } from '@/lib/auth'

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchParams.delete('onboarding')
    vi.mocked(useAuth).mockReturnValue({
      firebaseUser: { uid: 'u1' },
      dbUser: { buddyProfile: { status: 'active' } },
      loading: false,
    } as never)
  })

  it('explains why the buddy is here when they arrive from onboarding', () => {
    searchParams.set('onboarding', '1')
    render(<ProfilePage />)
    expect(screen.getByText('onboardingNotice')).toBeInTheDocument()
  })

  it('shows no notice on an ordinary visit', () => {
    render(<ProfilePage />)
    expect(screen.queryByText('onboardingNotice')).not.toBeInTheDocument()
  })
})
