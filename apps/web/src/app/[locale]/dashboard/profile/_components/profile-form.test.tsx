import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProfileForm } from './profile-form'
import type { BuddyProfileResponse } from '@peace-buddy/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('../dashboard.profile', () => ({
  updateMyProfile: vi.fn(),
}))

import { updateMyProfile } from '../dashboard.profile'

const mockUpdate = vi.mocked(updateMyProfile)

const stubProfile: BuddyProfileResponse = {
  id: 'p1',
  status: 'active',
  displayName: 'Test Buddy',
  realName: 'Real Name',
  photoUrl: null,
  bio: 'My bio',
  contactInfo: 'test@example.com',
  languages: ['english', 'japanese'],
  skills: ['sign language', 'navigation'],
  availability: 'weekends',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const onSaved = vi.fn()

describe('ProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all field labels', () => {
    render(<ProfileForm profile={stubProfile} onSaved={onSaved} />)
    expect(screen.getByText('displayName')).toBeInTheDocument()
    expect(screen.getByText('realName')).toBeInTheDocument()
    expect(screen.getByText('bio')).toBeInTheDocument()
    expect(screen.getByText('contactInfo')).toBeInTheDocument()
    expect(screen.getByText('skills')).toBeInTheDocument()
    expect(screen.getByText('availability')).toBeInTheDocument()
    expect(screen.getByText('languages')).toBeInTheDocument()
  })

  it('submit calls updateMyProfile with skills split on newline', async () => {
    mockUpdate.mockResolvedValue({ ok: true, data: stubProfile })
    render(<ProfileForm profile={stubProfile} onSaved={onSaved} />)

    fireEvent.submit(screen.getByRole('button', { name: 'save' }).closest('form')!)
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())

    const call = mockUpdate.mock.calls[0][0]
    expect(call.skills).toEqual(['sign language', 'navigation'])
  })

  it('shows success banner and calls onSaved after successful save', async () => {
    mockUpdate.mockResolvedValue({ ok: true, data: stubProfile })
    render(<ProfileForm profile={stubProfile} onSaved={onSaved} />)

    fireEvent.submit(screen.getByRole('button', { name: 'save' }).closest('form')!)
    await waitFor(() => expect(screen.getByText('saveSuccess')).toBeInTheDocument())
    expect(onSaved).toHaveBeenCalledOnce()
  })

  it('does not redirect to dashboard on success', async () => {
    mockUpdate.mockResolvedValue({ ok: true, data: stubProfile })
    render(<ProfileForm profile={stubProfile} onSaved={onSaved} />)

    fireEvent.submit(screen.getByRole('button', { name: 'save' }).closest('form')!)
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    // success stays on page — onSaved called, no navigation triggered
    expect(screen.getByText('saveSuccess')).toBeInTheDocument()
  })

  it('shows error message on api failure', async () => {
    mockUpdate.mockResolvedValue({ ok: false, error: { code: 'network' } })
    render(<ProfileForm profile={stubProfile} onSaved={onSaved} />)

    fireEvent.submit(screen.getByRole('button', { name: 'save' }).closest('form')!)
    await waitFor(() => expect(screen.getByText('error.network')).toBeInTheDocument())
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('clears success banner on field change', async () => {
    mockUpdate.mockResolvedValue({ ok: true, data: stubProfile })
    render(<ProfileForm profile={stubProfile} onSaved={onSaved} />)

    fireEvent.submit(screen.getByRole('button', { name: 'save' }).closest('form')!)
    await waitFor(() => expect(screen.getByText('saveSuccess')).toBeInTheDocument())

    const displayNameInput = screen.getByDisplayValue('Test Buddy')
    fireEvent.change(displayNameInput, { target: { value: 'Changed' } })
    expect(screen.queryByText('saveSuccess')).not.toBeInTheDocument()
  })

  it('language toggle adds unchecked language', () => {
    render(<ProfileForm profile={{ ...stubProfile, languages: [] }} onSaved={onSaved} />)
    const englishCheckbox = screen.getByRole('checkbox', { name: 'english' })
    expect(englishCheckbox).not.toBeChecked()
    fireEvent.click(englishCheckbox)
    expect(englishCheckbox).toBeChecked()
  })

  it('language toggle removes checked language', () => {
    render(<ProfileForm profile={stubProfile} onSaved={onSaved} />)
    const englishCheckbox = screen.getByRole('checkbox', { name: 'english' })
    expect(englishCheckbox).toBeChecked()
    fireEvent.click(englishCheckbox)
    expect(englishCheckbox).not.toBeChecked()
  })
})
