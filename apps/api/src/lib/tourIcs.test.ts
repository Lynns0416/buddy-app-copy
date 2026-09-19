import { describe, it, expect } from 'vitest'
import { TourStatusSchema } from '@peace-buddy/types'
import { buildTourIcsEvents } from './tourIcs'

const tour = {
  tourDate: new Date('2026-05-01T00:00:00.000Z'),
  status: TourStatusSchema.enum.published,
  group: { name: 'Test School' },
  location: 'Tokyo Station',
  description: 'A visit.',
}

describe('buildTourIcsEvents', () => {
  it('combines the tour date with meetingTime as JST wall-clock time, emitted in UTC', () => {
    // meetingTime's stored UTC hour/minute (09:00) IS the JST wall-clock time,
    // so 09:00 JST on 2026-05-01 is 00:00 UTC the same day.
    const [event] = buildTourIcsEvents(tour, [
      {
        id: 'session-1',
        label: null,
        meetingTime: new Date('1970-01-01T09:00:00.000Z'),
        startTime: null,
        endTime: null,
      },
    ])
    expect(event.dtstart.toISOString()).toBe('2026-05-01T00:00:00.000Z')
  })

  it('defaults to a 1-hour duration when endTime is not set', () => {
    const [event] = buildTourIcsEvents(tour, [
      {
        id: 'session-1',
        label: null,
        meetingTime: new Date('1970-01-01T09:00:00.000Z'),
        startTime: null,
        endTime: null,
      },
    ])
    expect(event.dtend.getTime() - event.dtstart.getTime()).toBe(60 * 60 * 1000)
  })

  it('falls back to the default duration when endTime is not after the start', () => {
    // startTime/endTime have no ordering constraint in CreateTourSessionSchema
    // or the session service, so the API accepts this pair.
    const [event] = buildTourIcsEvents(tour, [
      {
        id: 'session-1',
        label: null,
        meetingTime: new Date('1970-01-01T09:00:00.000Z'),
        startTime: new Date('1970-01-01T13:00:00.000Z'),
        endTime: new Date('1970-01-01T10:00:00.000Z'),
      },
    ])
    expect(event.dtend.getTime()).toBeGreaterThan(event.dtstart.getTime())
    expect(event.dtend.getTime() - event.dtstart.getTime()).toBe(60 * 60 * 1000)
  })

  it('falls back to the default duration when endTime equals the start', () => {
    const [event] = buildTourIcsEvents(tour, [
      {
        id: 'session-1',
        label: null,
        meetingTime: new Date('1970-01-01T09:00:00.000Z'),
        startTime: null,
        endTime: new Date('1970-01-01T09:00:00.000Z'),
      },
    ])
    expect(event.dtend.getTime() - event.dtstart.getTime()).toBe(60 * 60 * 1000)
  })

  it('honours endTime measured against meetingTime when startTime is unset', () => {
    const [event] = buildTourIcsEvents(tour, [
      {
        id: 'session-1',
        label: null,
        meetingTime: new Date('1970-01-01T09:00:00.000Z'),
        startTime: null,
        endTime: new Date('1970-01-01T11:00:00.000Z'),
      },
    ])
    expect(event.dtend.toISOString()).toBe('2026-05-01T02:00:00.000Z')
  })

  it.each([
    [TourStatusSchema.enum.published, 'CONFIRMED'],
    [TourStatusSchema.enum.completed, 'CONFIRMED'],
    [TourStatusSchema.enum.draft, 'TENTATIVE'],
    [TourStatusSchema.enum.cancelled, 'CANCELLED'],
  ] as const)('maps tour status %s to STATUS:%s', (tourStatus, expected) => {
    const [event] = buildTourIcsEvents({ ...tour, status: tourStatus }, [
      { id: 'session-1', label: null, meetingTime: new Date('1970-01-01T09:00:00.000Z'), startTime: null, endTime: null },
    ])
    expect(event.status).toBe(expected)
  })

  it('prefers startTime/endTime over meetingTime when both are set', () => {
    const [event] = buildTourIcsEvents(tour, [
      {
        id: 'session-1',
        label: null,
        meetingTime: new Date('1970-01-01T08:45:00.000Z'),
        startTime: new Date('1970-01-01T09:00:00.000Z'),
        endTime: new Date('1970-01-01T10:30:00.000Z'),
      },
    ])
    expect(event.dtstart.toISOString()).toBe('2026-05-01T00:00:00.000Z')
    expect(event.dtend.toISOString()).toBe('2026-05-01T01:30:00.000Z')
  })

  it('uses a stable per-session UID', () => {
    const [event] = buildTourIcsEvents(tour, [
      { id: 'session-1', label: null, meetingTime: new Date('1970-01-01T09:00:00.000Z'), startTime: null, endTime: null },
    ])
    expect(event.uid).toBe('session-session-1@peace-buddy.internal')
  })

  it('appends the session label to the summary when set', () => {
    const [event] = buildTourIcsEvents(tour, [
      { id: 'session-1', label: '1st Half', meetingTime: new Date('1970-01-01T09:00:00.000Z'), startTime: null, endTime: null },
    ])
    expect(event.summary).toBe('Test School (1st Half)')
  })

  it('uses the group name alone when there is no label', () => {
    const [event] = buildTourIcsEvents(tour, [
      { id: 'session-1', label: null, meetingTime: new Date('1970-01-01T09:00:00.000Z'), startTime: null, endTime: null },
    ])
    expect(event.summary).toBe('Test School')
  })

  it('carries location and description through unescaped — escaping happens at VEVENT assembly', () => {
    const [event] = buildTourIcsEvents(tour, [
      { id: 'session-1', label: null, meetingTime: new Date('1970-01-01T09:00:00.000Z'), startTime: null, endTime: null },
    ])
    expect(event.location).toBe('Tokyo Station')
    expect(event.description).toBe('A visit.')
  })

  it('produces one event per session, in order', () => {
    const events = buildTourIcsEvents(tour, [
      { id: 'session-1', label: null, meetingTime: new Date('1970-01-01T09:00:00.000Z'), startTime: null, endTime: null },
      { id: 'session-2', label: null, meetingTime: new Date('1970-01-01T13:00:00.000Z'), startTime: null, endTime: null },
    ])
    expect(events.map((e) => e.uid)).toEqual([
      'session-session-1@peace-buddy.internal',
      'session-session-2@peace-buddy.internal',
    ])
  })
})
