import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { TourAttendanceResponse, TourAttendanceRow } from '@peace-buddy/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('../../attendance/admin.attendance', () => ({
  fetchTourAttendance: vi.fn(),
  saveAttendance: vi.fn(),
  saveBreak: vi.fn(),
  saveFinishTime: vi.fn(),
}))

import { fetchTourAttendance, saveAttendance, saveBreak, saveFinishTime } from '../../attendance/admin.attendance'
import { TourAttendanceSection } from './tour-attendance-section'

function row(overrides: Partial<TourAttendanceRow> = {}): TourAttendanceRow {
  return {
    buddyId: 'b1', displayName: 'Aya', realName: '綾', memberType: 'buddy', defaultArrival: '10:00',
    arrivalTime: null, lateMinutes: 0, lateReason: null, lateNote: null, lateExcused: null,
    leaveTime: null, leaveNote: null, earlyMinutes: 0, absent: false, absenceReported: null,
    breakMinutes: 0, minutes: 330,
    ...overrides,
  }
}

function sheet(overrides: Partial<TourAttendanceResponse> = {}): TourAttendanceResponse {
  return {
    tourId: 't1', date: '2026-06-10', editable: true, locked: false, finishTime: '15:30', break: null, followingFinish: 1,
    rows: [row()], changes: [],
    ...overrides,
  }
}

describe('TourAttendanceSection', () => {
  beforeEach(() => vi.clearAllMocks())

  it('saves the finish time for the tour date', async () => {
    vi.mocked(fetchTourAttendance).mockResolvedValue({ ok: true, data: sheet() })
    vi.mocked(saveFinishTime).mockResolvedValue({ ok: true, data: { date: '2026-06-10', finishTime: '16:00' } })
    render(<TourAttendanceSection tourId="t1" />)

    const input = await screen.findByLabelText('finishTime')
    fireEvent.change(input, { target: { value: '16:00' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(saveFinishTime).toHaveBeenCalledWith('2026-06-10', '16:00'))
  })

  it('saves the break for the whole tour, outside any buddy row', async () => {
    vi.mocked(fetchTourAttendance).mockResolvedValue({ ok: true, data: sheet() })
    vi.mocked(saveBreak).mockResolvedValue({ ok: true, data: sheet({ break: { start: '12:00', end: '12:45', minutes: 45 } }) })
    render(<TourAttendanceSection tourId="t1" />)

    const form = await screen.findByRole('form', { name: 'unpaidBreak' })
    fireEvent.click(within(form).getByRole('radio', { name: 'breakMode.times' }))
    fireEvent.change(within(form).getByLabelText('breakStart'), { target: { value: '12:00' } })
    fireEvent.change(within(form).getByLabelText('breakEnd'), { target: { value: '12:45' } })
    fireEvent.click(within(form).getByRole('button', { name: 'save' }))

    await waitFor(() => expect(saveBreak).toHaveBeenCalledWith('t1', { break: { start: '12:00', end: '12:45' } }))
    expect(saveAttendance).not.toHaveBeenCalled()
  })

  it('records an absence from the start editor, keeping no times', async () => {
    vi.mocked(fetchTourAttendance).mockResolvedValue({ ok: true, data: sheet() })
    vi.mocked(saveAttendance).mockResolvedValue({ ok: true, data: sheet({ rows: [row({ absent: true, absenceReported: false, minutes: 0 })] }) })
    render(<TourAttendanceSection tourId="t1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'editStartFor' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'absent' }))
    fireEvent.click(screen.getByRole('radio', { name: 'notReported' }))
    const form = screen.getByRole('form', { name: 'editStart' })
    fireEvent.submit(form)

    await waitFor(() =>
      expect(saveAttendance).toHaveBeenCalledWith('t1', 'b1', expect.objectContaining({ absent: true, absenceReported: false, arrivalTime: null, leaveTime: null })),
    )
    expect(await screen.findByText('absentUnreported')).toBeTruthy()
  })

  it('"Back to default" on the end clears the leave time but keeps the start', async () => {
    const late = row({ arrivalTime: '10:25', lateMinutes: 25, lateReason: 'other', lateNote: 'x', lateExcused: false, leaveTime: '14:00' })
    vi.mocked(fetchTourAttendance).mockResolvedValue({ ok: true, data: sheet({ rows: [late] }) })
    vi.mocked(saveAttendance).mockResolvedValue({ ok: true, data: sheet() })
    render(<TourAttendanceSection tourId="t1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'editEndFor' }))
    fireEvent.click(screen.getByRole('button', { name: 'backToDefault' }))

    await waitFor(() =>
      expect(saveAttendance).toHaveBeenCalledWith('t1', 'b1', expect.objectContaining({ arrivalTime: '10:25', lateExcused: false, leaveTime: null, leaveNote: null })),
    )
  })

  it('offers no editing while the month is locked', async () => {
    vi.mocked(fetchTourAttendance).mockResolvedValue({ ok: true, data: sheet({ editable: false, locked: true }) })
    render(<TourAttendanceSection tourId="t1" />)

    expect(await screen.findByText('lockedNotice')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'editStartFor' })).toBeNull()
  })
})
