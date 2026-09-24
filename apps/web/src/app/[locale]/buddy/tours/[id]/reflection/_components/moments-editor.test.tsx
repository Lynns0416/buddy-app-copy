import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { TourPlaceWithSpots } from '@peace-buddy/types'
import { MomentsEditor } from './moments-editor'
import { emptyMoment, usesSingleMoment, type MomentState } from '../reflection-form-state'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const peacePark: TourPlaceWithSpots = {
  id: 'place-1',
  nameJa: '平和公園',
  nameEn: 'Peace Park',
  spots: [
    { id: 'spot-1', nameJa: '平和祈念像', nameEn: 'Peace Statue' },
    { id: 'spot-2', nameJa: '平和の泉', nameEn: 'Fountain of Peace' },
  ],
}

const urakami: TourPlaceWithSpots = { id: 'place-2', nameJa: '浦上天主堂', nameEn: 'Urakami Cathedral', spots: [] }

function Wrapper({
  place,
  initial,
  onChange,
}: {
  place: TourPlaceWithSpots
  initial: MomentState[]
  onChange?: (moments: MomentState[]) => void
}) {
  const [moments, setMoments] = useState(initial)
  return (
    <MomentsEditor
      place={place}
      newMomentSpotId={place.spots[0]?.id ?? null}
      singleMoment={usesSingleMoment(place, initial)}
      moments={moments}
      onChange={(next) => {
        setMoments(next)
        onChange?.(next)
      }}
      disabled={false}
      locale="en"
      idPrefix="s1"
    />
  )
}

describe('MomentsEditor — full picker (spots exist)', () => {
  it('starts with one row and an add-another button', () => {
    render(<Wrapper place={peacePark} initial={[emptyMoment()]} />)
    expect(screen.getByText('moments.addMoment')).toBeTruthy()
    expect(screen.queryByText('moments.remove')).toBeTruthy()
  })

  it('adds a new row defaulted to the first spot', () => {
    render(<Wrapper place={peacePark} initial={[]} />)
    fireEvent.click(screen.getByText('moments.addMoment'))
    const select = screen.getByLabelText('moments.spotLabel') as HTMLSelectElement
    expect(select.value).toBe('spot-1')
  })

  it('shows a free-text input only after choosing Other', () => {
    render(<Wrapper place={peacePark} initial={[{ spotId: 'spot-1', placeNote: '', description: '' }]} />)
    expect(screen.queryByPlaceholderText('moments.placeNoteLabel')).toBeNull()
    fireEvent.change(screen.getByLabelText('moments.spotLabel'), { target: { value: 'other' } })
    expect(screen.getByPlaceholderText('moments.placeNoteLabel')).toBeTruthy()
  })

  it('lists the place\'s spots plus Other, without a place grouping', () => {
    render(<Wrapper place={peacePark} initial={[{ spotId: 'spot-1', placeNote: '', description: '' }]} />)
    const select = screen.getByLabelText('moments.spotLabel') as HTMLSelectElement
    expect([...select.options].map((o) => o.value)).toEqual(['spot-1', 'spot-2', 'other'])
    expect(select.querySelector('optgroup')).toBeNull()
  })

  it('shows reorder controls only once there are 2+ rows', () => {
    render(<Wrapper place={peacePark} initial={[emptyMoment()]} />)
    expect(screen.queryByText('moments.moveDown')).toBeNull()
    fireEvent.click(screen.getByText('moments.addMoment'))
    expect(screen.getAllByText('moments.moveDown').length).toBeGreaterThan(0)
  })
})

describe('MomentsEditor — single textarea (place has no spots)', () => {
  it('renders one textarea and no picker', () => {
    render(<Wrapper place={urakami} initial={[]} />)
    expect(screen.getByLabelText('moments.singlePlaceDescription')).toBeTruthy()
    expect(screen.queryByRole('radio')).toBeNull()
    expect(screen.queryByText('moments.addMoment')).toBeNull()
  })

  it('fills placeNote with nameJa even when the UI is in English', () => {
    const onChange = vi.fn()
    render(<Wrapper place={urakami} initial={[]} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('moments.singlePlaceDescription'), { target: { value: 'Rang the bell' } })
    expect(onChange).toHaveBeenLastCalledWith([{ spotId: null, placeNote: urakami.nameJa, description: 'Rang the bell' }])
  })
})

describe('MomentsEditor — no spots, saved moments the textarea cannot hold', () => {
  const others: MomentState[] = [
    { spotId: null, placeNote: 'By the gate', description: 'A' },
    { spotId: null, placeNote: 'On the bus', description: 'B' },
  ]

  it('keeps every saved moment in the picker, Other being the only choice', () => {
    render(<Wrapper place={urakami} initial={others} />)
    expect(screen.queryByLabelText('moments.singlePlaceDescription')).toBeNull()
    const selects = screen.getAllByLabelText('moments.spotLabel') as HTMLSelectElement[]
    expect(selects).toHaveLength(2)
    expect(selects.every((s) => s.value === 'other' && s.options.length === 1)).toBe(true)
  })

  it('keeps the buddy\'s own note when the description is edited', () => {
    const onChange = vi.fn()
    render(<Wrapper place={urakami} initial={[others[0]]} onChange={onChange} />)
    fireEvent.change(screen.getByPlaceholderText('moments.descriptionLabel'), { target: { value: 'A2' } })
    expect(onChange).toHaveBeenLastCalledWith([{ spotId: null, placeNote: 'By the gate', description: 'A2' }])
  })
})
