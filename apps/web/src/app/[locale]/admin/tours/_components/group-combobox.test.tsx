import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GroupCombobox } from './group-combobox'
import type { GroupResponse } from '@peace-buddy/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const group = (id: string, name: string): GroupResponse => ({
  id,
  name,
  type: 'school',
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const groups = [group('g1', 'Aoba High'), group('g2', 'Beta Academy'), group('g3', '青葉中学校')]

function Harness({ onSubmit = vi.fn(), initial = '' }: { onSubmit?: () => void; initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
      <label htmlFor="groupId">group</label>
      <GroupCombobox id="groupId" groups={groups} value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </form>
  )
}

const combobox = () => screen.getByRole('combobox')
const selectedValue = () => screen.getByTestId('value').textContent

describe('GroupCombobox', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists every group when opened with no search term', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(combobox())

    expect(screen.getAllByRole('option')).toHaveLength(groups.length)
  })

  it('narrows the options as the user types', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(combobox())
    await user.type(combobox(), 'beta')

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('Beta Academy')
  })

  it('shows a no-results message when nothing matches', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(combobox(), 'zzz')

    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('groupPicker.noResults')).toBeInTheDocument()
  })

  it('says no groups exist rather than no match when the list is empty', async () => {
    const user = userEvent.setup()
    render(
      <form>
        <label htmlFor="groupId">group</label>
        <GroupCombobox id="groupId" groups={[]} value="" onChange={vi.fn()} />
      </form>,
    )

    await user.click(screen.getByRole('combobox'))

    expect(screen.getByText('groupPicker.noGroups')).toBeInTheDocument()
    expect(screen.queryByText('groupPicker.noResults')).not.toBeInTheDocument()
  })

  it('selects an option by click', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(combobox())
    await user.click(screen.getByRole('option', { name: 'Beta Academy' }))

    expect(selectedValue()).toBe('g2')
    expect(combobox()).toHaveValue('Beta Academy')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('moves the highlight with the arrow keys and selects with Enter', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(combobox())
    await user.keyboard('{ArrowDown}{Enter}')

    expect(selectedValue()).toBe('g2')
  })

  it('wraps the highlight from the first option to the last on ArrowUp', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(combobox())
    await user.keyboard('{ArrowUp}{Enter}')

    expect(selectedValue()).toBe('g3')
  })

  it('restores the previous selection on Escape', async () => {
    const user = userEvent.setup()
    render(<Harness initial="g1" />)

    await user.clear(combobox())
    await user.type(combobox(), 'beta')
    await user.keyboard('{Escape}')

    expect(selectedValue()).toBe('g1')
    expect(combobox()).toHaveValue('Aoba High')
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })

  it('keeps the selection visible after the field is cleared and left', async () => {
    const user = userEvent.setup()
    render(<Harness initial="g1" />)

    await user.clear(combobox())
    expect(screen.getAllByRole('option')).toHaveLength(groups.length)

    await user.tab()

    expect(selectedValue()).toBe('g1')
    expect(combobox()).toHaveValue('Aoba High')
  })

  it('keeps the current selection when the list is opened and Enter is pressed', async () => {
    const user = userEvent.setup()
    render(<Harness initial="g3" />)

    await user.click(combobox())
    await user.keyboard('{Enter}')

    expect(selectedValue()).toBe('g3')
  })

  it('opens on the current selection so the arrow keys move from there', async () => {
    const user = userEvent.setup()
    render(<Harness initial="g1" />)

    await user.click(combobox())
    await user.keyboard('{ArrowDown}{Enter}')

    expect(selectedValue()).toBe('g2')
  })

  it('never submits the form on Enter', async () => {
    const onSubmit = vi.fn()
    const user = userEvent.setup()
    render(<Harness onSubmit={onSubmit} />)

    await user.click(combobox())
    await user.keyboard('{Enter}')

    expect(onSubmit).not.toHaveBeenCalled()
  })

  describe('IME composition', () => {
    it('does not select or submit on the Enter that confirms a candidate, and selects on the next one', () => {
      const onSubmit = vi.fn()
      render(<Harness onSubmit={onSubmit} />)
      const input = combobox()

      fireEvent.compositionStart(input)
      fireEvent.change(input, { target: { value: '青葉' } })

      // Filtering still tracks the composing text.
      expect(screen.getAllByRole('option')).toHaveLength(1)

      fireEvent.keyDown(input, { key: 'Enter', isComposing: true })

      expect(selectedValue()).toBe('')
      expect(onSubmit).not.toHaveBeenCalled()

      fireEvent.compositionEnd(input)
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(selectedValue()).toBe('g3')
      expect(onSubmit).not.toHaveBeenCalled()
    })

    it('leaves the highlight alone while the candidate window is open', () => {
      render(<Harness />)
      const input = combobox()

      fireEvent.click(input)
      const before = input.getAttribute('aria-activedescendant')

      fireEvent.compositionStart(input)
      fireEvent.keyDown(input, { key: 'ArrowDown', isComposing: true })

      expect(input.getAttribute('aria-activedescendant')).toBe(before)

      fireEvent.compositionEnd(input)
      fireEvent.keyDown(input, { key: 'ArrowDown' })

      expect(input.getAttribute('aria-activedescendant')).not.toBe(before)
    })
  })

  it('exposes the listbox it controls and the active option', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(combobox()).toHaveAttribute('aria-expanded', 'false')

    await user.click(combobox())

    const listbox = screen.getByRole('listbox')
    expect(combobox()).toHaveAttribute('aria-expanded', 'true')
    expect(combobox()).toHaveAttribute('aria-controls', listbox.id)
    expect(combobox()).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[0].id)
  })
})
