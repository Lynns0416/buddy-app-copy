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
import type { TourReflectionResponse, TourPlaceWithSpots } from '@peace-buddy/types'

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
  notesForOthers: null,
  openQuestions: null,
  moments: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  locked: false,
}

// A place with no spots — the single-textarea fallback, keeping this suite's
// baseline behaviour close to the pre-#239 shape. The moments picker itself
// is covered in moments-editor.test.tsx.
const placeNoSpots: TourPlaceWithSpots = { id: 'place-1', nameJa: '場所', nameEn: 'Place', spots: [] }

const peaceParkWithSpot: TourPlaceWithSpots = {
  id: 'place-2',
  nameJa: '平和公園',
  nameEn: 'Peace Park',
  spots: [{ id: 'spot-1', nameJa: '平和祈念像', nameEn: 'Peace Statue' }],
}

function renderForm(props: Partial<React.ComponentProps<typeof ReflectionForm>> = {}) {
  return render(
    <ReflectionForm
      sessionId="session-1"
      place={placeNoSpots}
      locale="en"
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

  it('enables submit from a moment alone, with every prompt left blank', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('moments.singlePlaceDescription'), { target: { value: 'Saw the statue' } })
    expect(screen.getByRole('button', { name: 'actions.save' })).toHaveProperty('disabled', false)
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
      notesForOthers: null,
      openQuestions: null,
      moments: [],
    })
  })

  it('includes the auto-tagged moment when the single-place fallback is filled in', async () => {
    mockCreate.mockResolvedValueOnce({ ok: true, data: mockExisting })
    renderForm()

    fireEvent.change(screen.getByLabelText('moments.singlePlaceDescription'), { target: { value: 'Saw the statue' } })
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))

    await waitFor(() => expect(mockCreate).toHaveBeenCalled())
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      moments: [{ spotId: null, placeNote: placeNoSpots.nameJa, description: 'Saw the statue' }],
    })
  })

  it('opens with one moment row on the first spot when the place has spots', () => {
    renderForm({ place: peaceParkWithSpot })
    expect(screen.getByLabelText('moments.spotLabel')).toHaveProperty('value', 'spot-1')
  })

  it('keeps a moment on a since-retired spot in the picker rather than the no-spot fallback', () => {
    const retiredSpotMoment: TourReflectionResponse = {
      ...mockExisting,
      moments: [{
        id: 'moment-1',
        position: 0,
        spotId: 'spot-retired',
        placeNote: null,
        description: 'Saw the old sign',
        spot: {
          id: 'spot-retired',
          nameJa: '旧看板',
          nameEn: 'Old sign',
          place: { id: peaceParkWithSpot.id, nameJa: peaceParkWithSpot.nameJa, nameEn: peaceParkWithSpot.nameEn },
        },
      }],
    }
    renderForm({ place: { ...peaceParkWithSpot, spots: [] }, existing: retiredSpotMoment })

    expect(screen.queryByLabelText('moments.singlePlaceDescription')).toBeNull()
    expect(screen.getByLabelText('moments.spotLabel')).toHaveProperty('value', 'spot-retired')
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
