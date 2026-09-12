import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BuddyForm } from './buddy-form'
import type { AdminBuddyResponse } from '@peace-buddy/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('../admin.buddy', async () => {
  const actual = await vi.importActual<typeof import('../admin.buddy')>('../admin.buddy')
  return {
    ...actual,
    updateBuddy: vi.fn(),
    updateBuddyStatus: vi.fn(),
  }
})

import { updateBuddy, updateBuddyStatus } from '../admin.buddy'

const mockUpdateBuddy = vi.mocked(updateBuddy)
const mockUpdateBuddyStatus = vi.mocked(updateBuddyStatus)

const buddy = (overrides: Partial<AdminBuddyResponse> = {}): AdminBuddyResponse => ({
  id: 'profile-1',
  userId: 'user-1',
  status: 'active',
  tier: 'junior',
  memberType: 'buddy',
  displayName: 'Test Buddy',
  realName: 'Real Name',
  photoUrl: null,
  email: 'buddy@example.com',
  internalNotes: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

const trainee = buddy({ status: 'trainee', tier: null })

describe('BuddyForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateBuddy.mockResolvedValue({ ok: true, data: buddy() })
    mockUpdateBuddyStatus.mockResolvedValue({ ok: true, data: undefined })
  })

  async function selectMemberType(labelKey: string) {
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: /memberType/i }))
    await user.click(screen.getByRole('option', { name: labelKey }))
  }

  describe('member type field', () => {
    it('renders for an active buddy', () => {
      render(<BuddyForm buddy={buddy()} />)
      expect(screen.getByText('memberType')).toBeInTheDocument()
    })

    // Employment does not depend on account status: a trainee can be a PLAB
    // member, so the field stays available where the tier field does not.
    it('renders for a trainee, unlike the tier field', () => {
      render(<BuddyForm buddy={trainee} />)
      expect(screen.getByText('memberType')).toBeInTheDocument()
      expect(screen.queryByText('tier')).not.toBeInTheDocument()
    })
  })

  describe('save', () => {
    it('sends only the fields that changed', async () => {
      render(<BuddyForm buddy={buddy()} />)

      fireEvent.change(screen.getByLabelText('internalNotes'), { target: { value: 'noted' } })
      fireEvent.submit(screen.getByRole('button', { name: 'save' }).closest('form')!)

      await waitFor(() => expect(mockUpdateBuddy).toHaveBeenCalled())
      expect(mockUpdateBuddy).toHaveBeenCalledWith('profile-1', { internalNotes: 'noted' })
    })

    it('sends memberType when it changed', async () => {
      render(<BuddyForm buddy={buddy({ internalNotes: null })} />)

      await selectMemberType('memberTypePlabMember')
      fireEvent.submit(screen.getByRole('button', { name: 'save' }).closest('form')!)

      await waitFor(() => expect(mockUpdateBuddy).toHaveBeenCalled())
      expect(mockUpdateBuddy).toHaveBeenCalledWith('profile-1', { memberType: 'plab_member' })
    })

    // An unset note arrives as null and seeds the textarea as '', so the diff
    // has to treat the two as equal rather than as a change.
    it('sends nothing when no field changed', async () => {
      render(<BuddyForm buddy={buddy({ internalNotes: null })} />)
      fireEvent.submit(screen.getByRole('button', { name: 'save' }).closest('form')!)

      await waitFor(() => expect(mockUpdateBuddy).toHaveBeenCalled())
      expect(mockUpdateBuddy).toHaveBeenCalledWith('profile-1', {})
    })
  })

  describe('promote', () => {
    function promote() {
      fireEvent.click(screen.getByRole('button', { name: 'promoteButton' }))
      fireEvent.click(screen.getByRole('button', { name: 'promoteTierModal.confirm' }))
    }

    // The promote button sits beside the member type and notes fields, so an
    // admin editing one and then promoting must not lose the edit.
    it('persists pending edits before changing status', async () => {
      render(<BuddyForm buddy={trainee} />)

      fireEvent.change(screen.getByLabelText('internalNotes'), { target: { value: 'PLAB team' } })
      promote()

      await waitFor(() => expect(mockUpdateBuddyStatus).toHaveBeenCalled())
      expect(mockUpdateBuddy).toHaveBeenCalledWith('profile-1', { internalNotes: 'PLAB team' })
    })

    // The scenario the save-before-promote rule exists for: mark the trainee a
    // PLAB member, then promote them in the same visit.
    it('persists a member type change before changing status', async () => {
      render(<BuddyForm buddy={trainee} />)

      await selectMemberType('memberTypePlabMember')
      promote()

      await waitFor(() => expect(mockUpdateBuddyStatus).toHaveBeenCalled())
      expect(mockUpdateBuddy).toHaveBeenCalledWith('profile-1', { memberType: 'plab_member' })
    })

    it('skips the profile write when nothing was edited', async () => {
      render(<BuddyForm buddy={trainee} />)
      promote()

      await waitFor(() => expect(mockUpdateBuddyStatus).toHaveBeenCalledWith('profile-1', 'active'))
      expect(mockUpdateBuddy).not.toHaveBeenCalled()
    })

    it('does not change status when saving the pending edit fails', async () => {
      mockUpdateBuddy.mockResolvedValue({ ok: false, error: { code: 'network' } })
      render(<BuddyForm buddy={trainee} />)

      fireEvent.change(screen.getByLabelText('internalNotes'), { target: { value: 'PLAB team' } })
      promote()

      await waitFor(() => expect(screen.getByText('error.unknown')).toBeInTheDocument())
      expect(mockUpdateBuddyStatus).not.toHaveBeenCalled()
    })
  })
})
