import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { MyAttendanceDay } from '@peace-buddy/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/lib/api-client', () => ({
  apiClient: { getMyAttendance: vi.fn(), flagMyAttendance: vi.fn() },
}))

import { apiClient } from '@/lib/api-client'
import { WorkingHours } from './working-hours'

const mockGet = vi.mocked(apiClient.getMyAttendance)
const mockFlag = vi.mocked(apiClient.flagMyAttendance)

function day(overrides: Partial<MyAttendanceDay> = {}): MyAttendanceDay {
  return {
    date: '2026-06-10',
    tours: [{ tourId: 't1', groupName: 'Sakura School' }],
    start: '10:00',
    end: '15:30',
    breakMinutes: 0,
    minutes: 330,
    absent: false,
    finishMissing: false,
    flag: null,
    ...overrides,
  }
}

describe('WorkingHours', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists the days of the month', async () => {
    mockGet.mockResolvedValue({ month: '2026-06', days: [day(), day({ date: '2026-06-11', absent: true, minutes: 0, start: null, end: null })] })
    render(<WorkingHours />)

    expect(await screen.findAllByText('Sakura School')).toHaveLength(2)
    expect(screen.getByText('2026/06/10')).toBeTruthy()
    expect(screen.getByText('absent')).toBeTruthy()
  })

  it('sends a flag with the note and reloads', async () => {
    mockGet.mockResolvedValue({ month: '2026-06', days: [day()] })
    mockFlag.mockResolvedValue({ id: 'f1' })
    render(<WorkingHours />)

    fireEvent.click(await screen.findByRole('button', { name: 'report' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'noteLabel' }), { target: { value: 'I left at 14:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'send' }))

    await waitFor(() => expect(mockFlag).toHaveBeenCalledWith('2026-06-10', 'I left at 14:00'))
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2))
  })

  it('shows an open flag instead of the report button', async () => {
    mockGet.mockResolvedValue({ month: '2026-06', days: [day({ flag: { id: 'f1', note: 'x', createdAt: '2026-06-12T00:00:00Z', resolvedAt: null } })] })
    render(<WorkingHours />)

    expect(await screen.findByText('beingChecked')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'report' })).toBeNull()
  })
})
