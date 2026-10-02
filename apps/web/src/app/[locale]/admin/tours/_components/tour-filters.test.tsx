import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TourFilterBar } from './tour-filters'
import { emptyTourFilters, type TourFilters } from '../admin.tour'

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}))

function renderBar(filters: Partial<TourFilters> = {}, onSubmit = vi.fn()) {
  const onChange = vi.fn()
  render(
    <form onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
      <TourFilterBar
        filters={{ ...emptyTourFilters, ...filters }}
        onChange={onChange}
        suggestions={['Sakura School']}
        resultCount={2}
        totalCount={5}
      />
      <button type="submit">submit</button>
    </form>,
  )
  return { onChange, onSubmit }
}

const searchBox = () => screen.getByRole('combobox', { name: 'adminTours.search.label' })

describe('TourFilterBar', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reports what the user types in the search box', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBar()

    await user.type(searchBox(), 'a')

    expect(onChange).toHaveBeenCalledWith({ ...emptyTourFilters, search: 'a' })
  })

  it('adds a status to the selection when its checkbox is ticked', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBar()

    await user.click(screen.getByRole('checkbox', { name: 'tourStatus.published' }))

    expect(onChange).toHaveBeenCalledWith({ ...emptyTourFilters, statuses: ['published'] })
  })

  it('removes a status that was already selected', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBar({ statuses: ['published', 'draft'] })

    await user.click(screen.getByRole('checkbox', { name: 'tourStatus.published' }))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ statuses: ['draft'] }))
  })

  it('reports the selected group type', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBar()

    await user.click(screen.getByRole('checkbox', { name: 'groupType.company' }))

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ groupTypes: ['company'] }))
  })

  it('reports the selected date range', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBar()

    await user.selectOptions(screen.getByLabelText('adminTours.filters.dateRange'), 'past')

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dateRange: 'past' }))
  })

  it('hides the result count and clear-all while nothing is active', () => {
    renderBar()

    expect(screen.queryByText('filters.resultCount')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'adminTours.filters.clearAll' })).not.toBeInTheDocument()
  })

  it('shows the result count and resets everything from clear-all', async () => {
    const user = userEvent.setup()
    const { onChange } = renderBar({ search: 'alpha', statuses: ['draft'] })

    expect(screen.getByText('adminTours.filters.resultCount')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'adminTours.filters.clearAll' }))

    expect(onChange).toHaveBeenCalledWith(emptyTourFilters)
  })

  describe('IME composition', () => {
    it('never submits the enclosing form on Enter', async () => {
      const user = userEvent.setup()
      const { onSubmit } = renderBar()

      await user.click(searchBox())
      await user.keyboard('{Enter}')

      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('keeps filtering while the candidate window is open', () => {
      const { onChange } = renderBar()
      const input = searchBox()

      fireEvent.compositionStart(input)
      fireEvent.change(input, { target: { value: '青' } })

      expect(onChange).toHaveBeenCalledWith({ ...emptyTourFilters, search: '青' })
    })
  })
})
