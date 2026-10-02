import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SuggestInput } from './suggest-input'

function renderInput(value = '') {
  const onChange = vi.fn()
  render(<SuggestInput aria-label="buddy" suggestions={['Ken', 'Aya', 'Ken', 'Kenta']} value={value} onChange={onChange} />)
  return { onChange, input: screen.getByRole('combobox', { name: 'buddy' }) }
}

describe('SuggestInput', () => {
  it('lists each candidate once, sorted, when opened', () => {
    const { input } = renderInput()
    fireEvent.click(input)
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Aya', 'Ken', 'Kenta'])
  })

  it('narrows the list to what the text contains', () => {
    const { input } = renderInput('ken')
    fireEvent.click(input)
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Ken', 'Kenta'])
  })

  it('takes free text as typed, and Enter alone keeps it', () => {
    const { input, onChange } = renderInput()
    fireEvent.change(input, { target: { value: 'ke' } })
    expect(onChange).toHaveBeenLastCalledWith('ke')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('picks a candidate by click or by arrow and Enter', () => {
    const { input, onChange } = renderInput()
    fireEvent.click(input)
    fireEvent.click(screen.getByRole('option', { name: 'Kenta' }))
    expect(onChange).toHaveBeenLastCalledWith('Kenta')

    fireEvent.click(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith('Aya')
  })
})
