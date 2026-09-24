import { describe, it, expect } from 'vitest'
import { AppErrorCodeSchema } from '@peace-buddy/types'
import type { TourReflectionResponse, TourPlaceWithSpots } from '@peace-buddy/types'
import {
  emptyPrompts,
  fromReflectionResponse,
  emptyMoment,
  momentsFromReflectionResponse,
  defaultSpotId,
  initialMoments,
  withTaggedSpots,
  usesSingleMoment,
  buildMomentPayload,
  buildReflectionPayload,
  hasAnyAnswer,
  mapReflectionError,
} from './reflection-form-state'

const response: TourReflectionResponse = {
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
  moments: [
    {
      id: 'moment-1',
      position: 0,
      spotId: 'spot-1',
      placeNote: null,
      description: 'A student said it could have happened at home',
      spot: { id: 'spot-1', nameJa: 'スポット', nameEn: 'Spot', place: { id: 'place-1', nameJa: '場所', nameEn: 'Place' } },
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  locked: false,
}

describe('emptyPrompts', () => {
  it('starts every prompt as an empty string', () => {
    expect(emptyPrompts()).toEqual({
      didWell: '',
      couldImprove: '',
      notesForOthers: '',
      openQuestions: '',
    })
  })
})

describe('fromReflectionResponse', () => {
  it('turns a null prompt into an empty textarea value', () => {
    expect(fromReflectionResponse(response)).toEqual({
      didWell: 'Kept everyone together',
      couldImprove: '',
      notesForOthers: '',
      openQuestions: '',
    })
  })
})

describe('emptyMoment', () => {
  it('starts with no spot, no place note and no description', () => {
    expect(emptyMoment()).toEqual({ spotId: null, placeNote: '', description: '' })
  })
})

describe('momentsFromReflectionResponse', () => {
  it('carries spotId, placeNote and description across, defaulting a null placeNote to empty string', () => {
    expect(momentsFromReflectionResponse(response.moments)).toEqual([
      { spotId: 'spot-1', placeNote: '', description: 'A student said it could have happened at home' },
    ])
  })

  it('keeps a free-text placeNote when there is no spot', () => {
    expect(
      momentsFromReflectionResponse([
        { id: 'm2', position: 0, spotId: null, placeNote: 'Somewhere else', description: 'A quiet moment', spot: null },
      ]),
    ).toEqual([{ spotId: null, placeNote: 'Somewhere else', description: 'A quiet moment' }])
  })
})

const spotless: TourPlaceWithSpots = { id: 'place-0', nameJa: '場所0', nameEn: 'Place 0', spots: [] }
const withSpot: TourPlaceWithSpots = {
  id: 'place-1',
  nameJa: '場所',
  nameEn: 'Place',
  spots: [{ id: 'spot-2', nameJa: 'スポット2', nameEn: 'Spot 2' }],
}

describe('defaultSpotId', () => {
  it('is the place\'s first spot', () => {
    expect(defaultSpotId(withSpot)).toBe('spot-2')
  })

  it('is null when the place has no spot', () => {
    expect(defaultSpotId(spotless)).toBeNull()
  })
})

describe('initialMoments', () => {
  it('opens a new reflection with one row on the first spot when spots exist', () => {
    expect(initialMoments(null, withSpot)).toEqual([{ spotId: 'spot-2', placeNote: '', description: '' }])
  })

  it('opens with no row when the place has no spot', () => {
    expect(initialMoments(null, spotless)).toEqual([])
  })

  it('opens an edit with no moments like a new reflection', () => {
    expect(initialMoments({ ...response, moments: [] }, withSpot)).toEqual([
      { spotId: 'spot-2', placeNote: '', description: '' },
    ])
  })

  it('keeps the saved moments on an edit', () => {
    expect(initialMoments(response, withSpot)).toEqual(momentsFromReflectionResponse(response.moments))
  })
})

describe('withTaggedSpots', () => {
  it('adds a retired spot a saved moment is tagged with to its place', () => {
    // response's moment is on spot-1, which withSpot no longer lists.
    expect(withTaggedSpots(withSpot, response.moments)).toEqual(
      { ...withSpot, spots: [...withSpot.spots, { id: 'spot-1', nameJa: 'スポット', nameEn: 'Spot' }] },
    )
  })

  it('leaves the place unchanged when every tagged spot is already listed', () => {
    const listed = { ...withSpot, spots: [{ id: 'spot-1', nameJa: 'スポット', nameEn: 'Spot' }] }
    expect(withTaggedSpots(listed, response.moments)).toBe(listed)
  })

  it('ignores a tagged spot of another place', () => {
    expect(withTaggedSpots(spotless, response.moments)).toBe(spotless)
  })

  it('adds a spot once however many moments are tagged with it', () => {
    const twice = [response.moments[0], { ...response.moments[0], id: 'moment-2', position: 1 }]
    expect(withTaggedSpots(withSpot, twice).spots).toHaveLength(2)
  })
})

describe('usesSingleMoment', () => {
  const spotless: TourPlaceWithSpots = { id: 'place-2', nameJa: '浦上天主堂', nameEn: 'Urakami Cathedral', spots: [] }
  const withSpots: TourPlaceWithSpots = { ...spotless, spots: [{ id: 'spot-1', nameJa: 'スポット', nameEn: 'Spot' }] }

  it('is false once the place has a spot', () => {
    expect(usesSingleMoment(withSpots, [])).toBe(false)
  })

  it.each([
    ['nothing saved', []],
    ['a note holding the nameJa', [{ placeNote: spotless.nameJa }]],
    ['a note holding the nameEn', [{ placeNote: spotless.nameEn }]],
  ])('is true on a spot-less place with %s', (_, saved) => {
    expect(usesSingleMoment(spotless, saved)).toBe(true)
  })

  it.each([
    ['two moments', [{ placeNote: spotless.nameJa }, { placeNote: spotless.nameJa }]],
    ['a note in the buddy\'s own words', [{ placeNote: 'By the gate' }]],
  ])('is false on a spot-less place with %s', (_, saved) => {
    expect(usesSingleMoment(spotless, saved)).toBe(false)
  })
})

describe('buildMomentPayload', () => {
  it('trims the description and drops placeNote when a spot is set', () => {
    expect(
      buildMomentPayload([{ spotId: 'spot-1', placeNote: '', description: '  Saw the statue  ' }]),
    ).toEqual([{ spotId: 'spot-1', placeNote: null, description: 'Saw the statue' }])
  })

  it('trims placeNote and keeps spotId null for a free-text moment', () => {
    expect(
      buildMomentPayload([{ spotId: null, placeNote: '  Somewhere else  ', description: 'A quiet moment' }]),
    ).toEqual([{ spotId: null, placeNote: 'Somewhere else', description: 'A quiet moment' }])
  })

  it('drops a row with a blank description', () => {
    expect(buildMomentPayload([{ spotId: 'spot-1', placeNote: '', description: '   ' }])).toEqual([])
  })

  it('drops a row with neither spotId nor placeNote', () => {
    expect(buildMomentPayload([{ spotId: null, placeNote: '  ', description: 'Something happened' }])).toEqual([])
  })

  it('preserves entry order', () => {
    expect(
      buildMomentPayload([
        { spotId: 'spot-1', placeNote: '', description: 'First' },
        { spotId: 'spot-2', placeNote: '', description: 'Second' },
      ]),
    ).toEqual([
      { spotId: 'spot-1', placeNote: null, description: 'First' },
      { spotId: 'spot-2', placeNote: null, description: 'Second' },
    ])
  })
})

describe('buildReflectionPayload', () => {
  it('trims answers and sends a blank one as null, alongside the built moments', () => {
    expect(
      buildReflectionPayload(
        {
          didWell: '  Kept everyone together  ',
          couldImprove: '   ',
          notesForOthers: '',
          openQuestions: '',
        },
        [{ spotId: 'spot-1', placeNote: '', description: 'Saw the statue' }],
      ),
    ).toEqual({
      didWell: 'Kept everyone together',
      couldImprove: null,
      notesForOthers: null,
      openQuestions: null,
      moments: [{ spotId: 'spot-1', placeNote: null, description: 'Saw the statue' }],
    })
  })
})

describe('hasAnyAnswer', () => {
  it('is false when every prompt is blank and there are no moments', () => {
    expect(hasAnyAnswer({ ...emptyPrompts(), couldImprove: '   ' }, [])).toBe(false)
  })

  it('is true when one prompt has content', () => {
    expect(hasAnyAnswer({ ...emptyPrompts(), openQuestions: 'Who funds the programme?' }, [])).toBe(true)
  })

  it('is true when a moment has content even with every prompt blank', () => {
    expect(hasAnyAnswer(emptyPrompts(), [{ spotId: 'spot-1', placeNote: '', description: 'Saw the statue' }])).toBe(true)
  })

  it('is false when the only moment is blank', () => {
    expect(hasAnyAnswer(emptyPrompts(), [emptyMoment()])).toBe(false)
  })
})

describe('mapReflectionError', () => {
  const t = (key: string) => key

  it('maps every error code to its own message key', () => {
    expect(mapReflectionError(t, AppErrorCodeSchema.enum.not_found)).toBe('error.notFound')
    expect(mapReflectionError(t, AppErrorCodeSchema.enum.forbidden)).toBe('error.notEligible')
    expect(mapReflectionError(t, AppErrorCodeSchema.enum.conflict)).toBe('error.locked')
    expect(mapReflectionError(t, AppErrorCodeSchema.enum.conflict, { creating: true })).toBe('error.alreadyExists')
    expect(mapReflectionError(t, AppErrorCodeSchema.enum.invalid_request)).toBe('error.invalidRequest')
    expect(mapReflectionError(t, AppErrorCodeSchema.enum.network)).toBe('error.network')
  })

  it('falls back to the unknown message for an unrecognised code', () => {
    expect(mapReflectionError(t, 'something_else')).toBe('error.unknown')
  })
})
