import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarkdownText } from './markdown-text'

describe('MarkdownText', () => {
  it('keeps single line breaks from plain-text rows', () => {
    const { container } = render(<MarkdownText>{'line one\nline two'}</MarkdownText>)
    expect(container.querySelectorAll('br')).toHaveLength(1)
  })

  it('renders bold and lists', () => {
    const { container } = render(<MarkdownText>{'**key**\n\n- a\n- b'}</MarkdownText>)
    expect(container.querySelector('strong')?.textContent).toBe('key')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('opens links in a new tab', () => {
    render(<MarkdownText>{'[site](https://example.com)'}</MarkdownText>)
    const link = screen.getByRole('link', { name: 'site' })
    expect(link.getAttribute('href')).toBe('https://example.com')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('does not render raw HTML', () => {
    const { container } = render(<MarkdownText>{'<img src=x onerror="alert(1)">'}</MarkdownText>)
    expect(container.querySelector('img')).toBeNull()
  })

  it('drops javascript: URLs', () => {
    const { container } = render(<MarkdownText>{'[x](javascript:alert(1))'}</MarkdownText>)
    expect(container.querySelector('a')?.getAttribute('href')).toBe('')
  })

  it('renders elements outside the allowed set as their text', () => {
    const { container } = render(<MarkdownText>{'# Heading\n\n![alt](https://example.com/a.png)'}</MarkdownText>)
    expect(container.querySelector('h1')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('Heading')
  })
})
