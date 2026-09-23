import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('../reflection', () => ({
  createReflection: vi.fn(),
  updateReflection: vi.fn(),
}))

import { ReflectionForm } from './reflection-form'
import { createReflection, updateReflection } from '../reflection'
import type { TourReflectionResponse } from '@peace-buddy/types'

const mockCreate = vi.mocked(createReflection)
const mockUpdate = vi.mocked(updateReflection)

const mockExisting: TourReflectionResponse = {
  id: 'refl-1',
  buddyId: 'buddy-1',
  sessionId: 'session-1',
  sessionOrder: 1,
  sessionLabel: null,
  tourId: 'tour-1',
  didWell: 'Kept everyone together',
  couldImprove: null,
  memorableMoment: null,
  notesForOthers: null,
  openQuestions: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  locked: false,
}

function renderForm(props: Partial<React.ComponentProps<typeof ReflectionForm>> = {}) {
  return render(
    <ReflectionForm
      sessionId="session-1"
      existing={null}
      onSaved={vi.fn()}
      {...props}
    />,
  )
}

describe('ReflectionForm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders one textarea per prompt and no score pickers', () => {
    renderForm()
    for (const key of [
      'prompts.didWell',
      'prompts.couldImprove',
      'prompts.memorableMoment',
      'prompts.notesForOthers',
      'prompts.openQuestions',
    ]) {
      expect(screen.getByLabelText(key)).toBeTruthy()
    }
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('disables submit until at least one prompt is answered', () => {
    renderForm()
    const submit = screen.getByRole('button', { name: 'actions.save' })
    expect(submit).toHaveProperty('disabled', true)

    fireEvent.change(screen.getByLabelText('prompts.didWell'), { target: { value: 'Kept calm' } })
    expect(submit).toHaveProperty('disabled', false)
  })

  it('keeps submit disabled when the only answer is whitespace', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('prompts.didWell'), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: 'actions.save' })).toHaveProperty('disabled', true)
  })

  it('creates with the session id and the trimmed answers', async () => {
    mockCreate.mockResolvedValueOnce({ ok: true, data: mockExisting })
    const onSaved = vi.fn()
    renderForm({ onSaved })

    fireEvent.change(screen.getByLabelText('prompts.didWell'), { target: { value: ' Kept calm ' } })
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(mockExisting))
    expect(mockCreate).toHaveBeenCalledWith({
      sessionId: 'session-1',
      didWell: 'Kept calm',
      couldImprove: null,
      memorableMoment: null,
      notesForOthers: null,
      openQuestions: null,
    })
  })

  it('updates rather than creates when a reflection already exists', async () => {
    mockUpdate.mockResolvedValueOnce({ ok: true, data: mockExisting })
    renderForm({ existing: mockExisting })

    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
    expect(mockUpdate.mock.calls[0][0]).toBe('refl-1')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('pre-fills the textareas from an existing reflection', () => {
    renderForm({ existing: mockExisting })
    expect(screen.getByLabelText('prompts.didWell')).toHaveProperty('value', 'Kept everyone together')
    expect(screen.getByLabelText('prompts.couldImprove')).toHaveProperty('value', '')
  })

  it('shows the mapped error when saving fails', async () => {
    mockCreate.mockResolvedValueOnce({ ok: false, error: { code: 'forbidden' } })
    renderForm()

    fireEvent.change(screen.getByLabelText('prompts.didWell'), { target: { value: 'Kept calm' } })
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    expect(await screen.findByText('error.notEligible')).toBeTruthy()
  })

  it('shows no cancel button when there is nothing to cancel back to', () => {
    renderForm({ onCancel: vi.fn() })
    expect(screen.queryByRole('button', { name: 'actions.cancel' })).toBeNull()
  })

  it('calls onCancel from the cancel button while editing', () => {
    const onCancel = vi.fn()
    renderForm({ existing: mockExisting, onCancel })
    fireEvent.click(screen.getByRole('button', { name: 'actions.cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
