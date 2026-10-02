import { describe, it, expect } from 'vitest'
import type { AdminAnnouncementResponse } from '@peace-buddy/types'
import {
  announcementState,
  emptyAnnouncementForm,
  moveAnnouncement,
  ruleExcludesTrainees,
  sortAnnouncements,
  toUpsertAnnouncement,
  validateAnnouncementForm,
  type AnnouncementFormValues,
} from './admin.announcement'

const TODAY = '2026-10-05'

function announcement(overrides: Partial<AdminAnnouncementResponse> = {}): AdminAnnouncementResponse {
  return {
    id: 'a',
    titleJa: 'タイトル',
    bodyJa: '本文',
    titleEn: null,
    bodyEn: null,
    audience: 'rule',
    statuses: [],
    tiers: [],
    buddies: [],
    startDate: '2026-10-01',
    endDate: '2026-10-10',
    position: 0,
    tour: null,
    createdBy: { name: 'A' },
    updatedBy: { name: 'A' },
    createdAt: '2026-09-30T00:00:00.000Z',
    updatedAt: '2026-09-30T00:00:00.000Z',
    ...overrides,
  }
}

function form(overrides: Partial<AnnouncementFormValues> = {}): AnnouncementFormValues {
  return { ...emptyAnnouncementForm(TODAY), titleJa: 't', bodyJa: 'b', endDate: '2026-10-10', ...overrides }
}

describe('announcementState', () => {
  it.each([
    ['scheduled', '2026-10-06', '2026-10-10'],
    ['showing', '2026-10-05', '2026-10-05'],
    ['showing', '2026-10-01', '2026-10-10'],
    ['ended', '2026-10-01', '2026-10-04'],
  ])('is %s from %s to %s', (state, startDate, endDate) => {
    expect(announcementState({ startDate, endDate }, TODAY)).toBe(state)
  })
})

describe('sortAnnouncements', () => {
  const ctx = { today: TODAY, audienceLabel: (a: AdminAnnouncementResponse) => a.id }
  const list = [
    announcement({ id: 'ended', position: 0, startDate: '2026-09-01', endDate: '2026-09-02' }),
    announcement({ id: 'showing', position: 1 }),
    announcement({ id: 'scheduled', position: 2, startDate: '2026-11-01', endDate: '2026-11-02' }),
  ]

  it('keeps the members\' order by position', () => {
    expect(sortAnnouncements([list[2], list[0], list[1]], 'position', 'asc', ctx).map((a) => a.id)).toEqual(['ended', 'showing', 'scheduled'])
  })

  it('puts what is showing first when sorted by state', () => {
    expect(sortAnnouncements(list, 'state', 'asc', ctx).map((a) => a.id)).toEqual(['showing', 'scheduled', 'ended'])
  })

  it('breaks ties by position', () => {
    const tied = [announcement({ id: 'b', position: 1 }), announcement({ id: 'a', position: 0 })]
    expect(sortAnnouncements(tied, 'title', 'desc', ctx).map((a) => a.id)).toEqual(['a', 'b'])
  })
})

describe('moveAnnouncement', () => {
  const ordered = [announcement({ id: 'a' }), announcement({ id: 'b' }), announcement({ id: 'c' })]

  it('swaps with the neighbour', () => {
    expect(moveAnnouncement(ordered, 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveAnnouncement(ordered, 'b', 1)).toEqual(['a', 'c', 'b'])
  })

  it('does nothing past either end', () => {
    expect(moveAnnouncement(ordered, 'a', -1)).toBeNull()
    expect(moveAnnouncement(ordered, 'c', 1)).toBeNull()
  })
})

describe('validateAnnouncementForm', () => {
  it('passes a complete form', () => {
    expect(validateAnnouncementForm(form())).toEqual([])
  })

  it('accepts an end date equal to the start date', () => {
    expect(validateAnnouncementForm(form({ startDate: TODAY, endDate: TODAY }))).toEqual([])
  })

  it('rejects an end date before the start date', () => {
    expect(validateAnnouncementForm(form({ endDate: '2026-10-04' }))).toEqual(['endBeforeStart'])
  })

  it('wants both English fields or neither', () => {
    expect(validateAnnouncementForm(form({ titleEn: 'Title' }))).toEqual(['enPair'])
    expect(validateAnnouncementForm(form({ titleEn: 'Title', bodyEn: 'Body' }))).toEqual([])
  })

  it('wants at least one picked buddy', () => {
    expect(validateAnnouncementForm(form({ audience: 'selected' }))).toEqual(['noBuddies'])
    expect(validateAnnouncementForm(form({ audience: 'selected', buddyIds: ['b1'] }))).toEqual([])
  })
})

describe('ruleExcludesTrainees', () => {
  it('is true when a tier is ticked and trainees could match', () => {
    expect(ruleExcludesTrainees(form({ tiers: ['star'] }))).toBe(true)
    expect(ruleExcludesTrainees(form({ tiers: ['star'], statuses: ['trainee'] }))).toBe(true)
  })

  it('is false without a tier, for active buddies only, or for picked buddies', () => {
    expect(ruleExcludesTrainees(form())).toBe(false)
    expect(ruleExcludesTrainees(form({ tiers: ['star'], statuses: ['active'] }))).toBe(false)
    expect(ruleExcludesTrainees(form({ audience: 'selected', tiers: ['star'] }))).toBe(false)
  })
})

describe('toUpsertAnnouncement', () => {
  it('sends empty English fields and no tour as null', () => {
    const body = toUpsertAnnouncement(form({ titleEn: '  ', bodyEn: '' }))
    expect(body).toMatchObject({ titleEn: null, bodyEn: null, tourId: null })
  })

  it('trims the text', () => {
    expect(toUpsertAnnouncement(form({ titleJa: '  t  ' })).titleJa).toBe('t')
  })
})
