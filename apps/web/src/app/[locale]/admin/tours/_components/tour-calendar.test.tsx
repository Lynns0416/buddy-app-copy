import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AdminTourSummaryResponse, TourSessionResponse, TourStatus } from '@peace-buddy/types'
import { adminTourSummary } from '@/test/tour-fixtures'
import { TourCalendar } from './tour-calendar'

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

const TODAY = '2025-07-15'

// Every case here is about where a tour lands in the July grid, so the shared
// fixture's June date and draft status are pinned to the month under test.
const tour = (overrides: Partial<AdminTourSummaryResponse> = {}): AdminTourSummaryResponse =>
  adminTourSummary({ tourDate: '2025-07-04', status: 'published', ...overrides })

function renderCalendar(tours: AdminTourSummaryResponse[], month = '2025-07') {
  const onMonthChange = vi.fn()
  const { container } = render(
    <TourCalendar tours={tours} month={month} today={TODAY} locale="en" onMonthChange={onMonthChange} />,
  )
  return { onMonthChange, container }
}

// The grid is a plain div tree, so cells are addressed by the date they render.
const cell = (container: HTMLElement, date: string) =>
  container.querySelector<HTMLElement>(`[data-date="${date}"]`)!

describe('TourCalendar', () => {
  it('lays the month out as six Monday-first weeks', () => {
    const { container } = renderCalendar([])

    expect(container.querySelectorAll('[data-date]')).toHaveLength(42)
    // 2025-07-01 is a Tuesday, so Monday 2025-06-30 opens the grid.
    expect(cell(container, '2025-06-30')).toBeTruthy()
    expect(cell(container, '2025-07-01')).toBeTruthy()
  })

  it('puts a tour in the cell for its date', () => {
    const { container } = renderCalendar([tour({ tourDate: '2025-07-04' })])

    expect(within(cell(container, '2025-07-04')).getByRole('link', { name: /Alpha/ })).toBeTruthy()
    expect(within(cell(container, '2025-07-05')).queryByRole('link')).toBeNull()
  })

  it('shows fill state as confirmed over capacity', () => {
    const { container } = renderCalendar([tour({ confirmedCount: 3, capacity: 12 })])

    expect(within(cell(container, '2025-07-04')).getByText('3/12')).toBeTruthy()
  })

  it('links a tour to its detail page', () => {
    const { container } = renderCalendar([tour({ id: 'tour-42' })])

    expect(within(cell(container, '2025-07-04')).getByRole('link', { name: /Alpha/ }))
      .toHaveAttribute('href', expect.stringContaining('tour-42'))
  })

  it('renders every status, so nothing is silently hidden from the month', () => {
    const statuses: TourStatus[] = ['draft', 'published', 'cancelled', 'completed']
    const { container } = renderCalendar(
      statuses.map((status, i) => tour({ id: status, status, group: { id: `g${i}`, name: status, type: 'school' } })),
    )

    const day = within(cell(container, '2025-07-04'))
    // Three fit; the fourth is behind the overflow control.
    expect(day.getAllByRole('link')).toHaveLength(3)
    expect(day.getByRole('button', { name: 'adminTours.calendar.more' })).toBeTruthy()
  })

  it('reveals the tours behind the overflow control when it is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderCalendar(
      Array.from({ length: 5 }, (_, i) =>
        tour({ id: `t${i}`, group: { id: `g${i}`, name: `Group ${i}`, type: 'school' } }),
      ),
    )

    await user.click(within(cell(container, '2025-07-04')).getByRole('button', { name: 'adminTours.calendar.more' }))

    expect(within(cell(container, '2025-07-04')).getAllByRole('link')).toHaveLength(5)
  })

  it('says so when the month has no tours at all', () => {
    renderCalendar([tour({ tourDate: '2025-09-04' })])

    expect(screen.getByText('adminTours.calendar.emptyMonth')).toBeTruthy()
  })

  it('leaves the grid padding empty — a tour outside the month is June\'s, not July\'s', () => {
    // 2025-06-30 is rendered by the July grid but belongs to June, so its cell
    // stays bare and the month still counts as having no tours.
    const { container } = renderCalendar([tour({ tourDate: '2025-06-30' })])

    expect(within(cell(container, '2025-06-30')).queryByRole('link')).toBeNull()
    expect(screen.getByText('adminTours.calendar.emptyMonth')).toBeTruthy()
  })

  it('steps to the previous and next month', async () => {
    const user = userEvent.setup()
    const { onMonthChange } = renderCalendar([])

    await user.click(screen.getByRole('button', { name: 'adminTours.calendar.previousMonth' }))
    expect(onMonthChange).toHaveBeenCalledWith('2025-06')

    await user.click(screen.getByRole('button', { name: 'adminTours.calendar.nextMonth' }))
    expect(onMonthChange).toHaveBeenCalledWith('2025-08')
  })

  it("jumps back to today's month", async () => {
    const user = userEvent.setup()
    const { onMonthChange } = renderCalendar([], '2025-11')

    await user.click(screen.getByRole('button', { name: 'adminTours.calendar.today' }))

    expect(onMonthChange).toHaveBeenCalledWith('2025-07')
  })
})
