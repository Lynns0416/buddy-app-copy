import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProfileHeader } from './profile-header'
import type { BuddyProfileResponse } from '@peace-buddy/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

vi.mock('@/lib/status-display', () => ({
  getBuddyStatusLabel: (_t: unknown, status: string) => `status:${status}`,
  buddyStatusBadgeVariant: {
    active: 'default',
    pending: 'secondary',
    suspended: 'outline',
    rejected: 'destructive',
  },
}))

vi.mock('./profile-photo', () => ({
  ProfilePhoto: () => null,
}))

const stubProfile: BuddyProfileResponse = {
  id: 'p1',
  status: 'active',
  displayName: 'Test Buddy',
  realName: 'Real Name',
  photoUrl: null,
  bio: null,
  contactInfo: null,
  languages: [],
  skills: [],
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z',
}

describe('ProfileHeader', () => {
  it('renders status label key', () => {
    render(<ProfileHeader profile={stubProfile} onPhotoSaved={vi.fn()} />)
    expect(screen.getByText('statusLabel')).toBeInTheDocument()
  })

  it('renders mapped status label', () => {
    render(<ProfileHeader profile={stubProfile} onPhotoSaved={vi.fn()} />)
    expect(screen.getByText('status:active')).toBeInTheDocument()
  })

  it('renders memberSince label key', () => {
    render(<ProfileHeader profile={stubProfile} onPhotoSaved={vi.fn()} />)
    expect(screen.getByText('memberSince')).toBeInTheDocument()
  })

  it('renders formatted member since date', () => {
    render(<ProfileHeader profile={stubProfile} onPhotoSaved={vi.fn()} />)
    expect(screen.getByText(/January 15, 2026/)).toBeInTheDocument()
  })

  it('renders correct badge variant for pending status', () => {
    render(<ProfileHeader profile={{ ...stubProfile, status: 'pending' }} onPhotoSaved={vi.fn()} />)
    expect(screen.getByText('status:pending')).toBeInTheDocument()
  })
})
