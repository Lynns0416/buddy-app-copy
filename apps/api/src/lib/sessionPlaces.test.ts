import { describe, it, expect } from 'vitest'
import { sessionPlaces } from './sessionPlaces'

const peacePark = { id: 'p1', nameJa: '平和公園', nameEn: 'Peace Park' }
const cathedral = { id: 'p2', nameJa: '浦上天主堂', nameEn: 'Urakami Cathedral' }

describe('sessionPlaces', () => {
  it('lists each place once, in session order', () => {
    expect(sessionPlaces([{ place: cathedral }, { place: peacePark }])).toEqual([cathedral, peacePark])
  })

  it('collapses two sessions at the same place into one', () => {
    expect(sessionPlaces([{ place: peacePark }, { place: peacePark }])).toEqual([peacePark])
  })

  it('returns no places for no sessions', () => {
    expect(sessionPlaces([])).toEqual([])
  })
})
