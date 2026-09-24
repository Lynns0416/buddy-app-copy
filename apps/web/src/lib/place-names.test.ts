import { describe, it, expect } from 'vitest'
import { placeName, placeNames, momentLocation } from './place-names'

const peacePark = { nameJa: '平和公園', nameEn: 'Peace Park' }
const urakami = { nameJa: '浦上天主堂', nameEn: 'Urakami Cathedral' }

describe('placeName', () => {
  it('returns nameJa for ja', () => {
    expect(placeName(peacePark, 'ja')).toBe('平和公園')
  })

  it('returns nameEn for en', () => {
    expect(placeName(peacePark, 'en')).toBe('Peace Park')
  })
})

describe('placeNames', () => {
  it('joins multiple places with a Japanese separator for ja', () => {
    expect(placeNames([peacePark, urakami], 'ja')).toBe('平和公園、浦上天主堂')
  })

  it('joins multiple places with a comma for en', () => {
    expect(placeNames([peacePark, urakami], 'en')).toBe('Peace Park, Urakami Cathedral')
  })

  it('returns an empty string for no places', () => {
    expect(placeNames([], 'en')).toBe('')
  })
})

describe('momentLocation', () => {
  const spot = { nameJa: '平和祈念像', nameEn: 'Peace Statue', place: peacePark }

  it('joins place and spot names when tied to a spot', () => {
    expect(momentLocation({ spot, placeNote: null }, 'en')).toBe('Peace Park — Peace Statue')
  })

  it('falls back to placeNote when there is no spot', () => {
    expect(momentLocation({ spot: null, placeNote: 'Somewhere else' }, 'en')).toBe('Somewhere else')
  })

  it('returns an empty string when neither is set', () => {
    expect(momentLocation({ spot: null, placeNote: null }, 'en')).toBe('')
  })
})
