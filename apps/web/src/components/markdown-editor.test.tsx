import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MarkdownEditor, insertLink, prefixLines, wrapBold } from './markdown-editor'
import { MarkdownText } from './markdown-text'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

describe('wrapBold', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(wrapBold('a bc d', 2, 4)).toEqual({ value: 'a **bc** d', selectionStart: 4, selectionEnd: 6 })
  })

  it('puts the cursor between the markers with no selection', () => {
    expect(wrapBold('ab', 1, 1)).toEqual({ value: 'a****b', selectionStart: 3, selectionEnd: 3 })
  })

  it('keeps edge punctuation outside the markers so CJK text still bolds', () => {
    const value = 'は「重要」です'
    const result = wrapBold(value, 1, 5)
    expect(result.value).toBe('は「**重要**」です')
    const { container } = render(<MarkdownText>{result.value}</MarkdownText>)
    expect(container.querySelector('strong')?.textContent).toBe('重要')
  })

  it('leaves a trailing space outside the markers', () => {
    expect(wrapBold('a word here', 2, 7).value).toBe('a **word** here')
  })

  it('wraps a selection that is only punctuation as is', () => {
    expect(wrapBold('a「」b', 1, 3).value).toBe('a**「」**b')
  })
})

describe('prefixLines', () => {
  it('prefixes every line the selection touches', () => {
    expect(prefixLines('x\none\ntwo\ny', 3, 7, false).value).toBe('x\n- one\n- two\ny')
  })

  it('numbers the lines for an ordered list', () => {
    expect(prefixLines('one\ntwo', 0, 7, true).value).toBe('1. one\n2. two')
  })

  it('prefixes the current line with no selection', () => {
    expect(prefixLines('one\ntwo', 5, 5, false).value).toBe('one\n- two')
  })

  it('does not prefix the line after a whole-line selection', () => {
    expect(prefixLines('one\ntwo', 0, 4, false).value).toBe('- one\ntwo')
  })
})

describe('insertLink', () => {
  it('links the selected text', () => {
    expect(insertLink('see here', 4, 8, 'https://e.com').value).toBe('see [here](https://e.com)')
  })

  it('uses the URL as the text with no selection', () => {
    expect(insertLink('', 0, 0, 'https://e.com').value).toBe('[https://e.com](https://e.com)')
  })
})

describe('MarkdownEditor', () => {
  it('applies a toolbar edit and reports it through onChange', async () => {
    const onChange = vi.fn()
    render(<MarkdownEditor aria-label="notes" defaultValue="hi" onChange={onChange} />)
    const textarea = screen.getByRole('textbox', { name: 'notes' }) as HTMLTextAreaElement
    textarea.setSelectionRange(0, 2)
    await userEvent.click(screen.getByRole('button', { name: 'bold' }))
    expect(textarea.value).toBe('**hi**')
    expect(onChange).toHaveBeenCalled()
  })

  it('previews the current text and keeps the textarea in the form', async () => {
    const { container } = render(
      <form>
        <MarkdownEditor aria-label="notes" name="notes" defaultValue="**hi**" />
      </form>
    )
    await userEvent.click(screen.getByRole('button', { name: 'preview' }))
    expect(container.querySelector('strong')?.textContent).toBe('hi')
    expect(screen.getByRole('button', { name: 'bold' })).toBeDisabled()
    const form = container.querySelector('form') as HTMLFormElement
    expect(new FormData(form).get('notes')).toBe('**hi**')
  })

  it('does nothing when the link prompt is cancelled', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null)
    render(<MarkdownEditor aria-label="notes" defaultValue="hi" />)
    await userEvent.click(screen.getByRole('button', { name: 'link' }))
    expect((screen.getByRole('textbox', { name: 'notes' }) as HTMLTextAreaElement).value).toBe('hi')
  })
})
