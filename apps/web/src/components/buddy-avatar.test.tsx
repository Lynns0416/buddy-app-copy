import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BuddyAvatar } from './buddy-avatar'
import { getInitials } from './avatar-placeholder'

describe('getInitials', () => {
  it('takes the first letter of the first and last word', () => {
    expect(getInitials('Ada Lovelace')).toBe('AL')
  })

  it('ignores middle words', () => {
    expect(getInitials('Ada King Lovelace')).toBe('AL')
  })

  it('takes a single letter for a one-word name', () => {
    expect(getInitials('Ada')).toBe('A')
  })

  it('handles a name with no spaces in Japanese', () => {
    expect(getInitials('田中太郎')).toBe('田')
  })

  it('handles surrounding and repeated whitespace', () => {
    expect(getInitials('  Ada   Lovelace  ')).toBe('AL')
  })

  it('returns an empty string for a blank name', () => {
    expect(getInitials('   ')).toBe('')
  })
})

describe('BuddyAvatar', () => {
  it('renders the photo when photoUrl is set', () => {
    render(<BuddyAvatar photoUrl="https://example.com/a.jpg" displayName="Ada Lovelace" />)
    expect(screen.getByRole('img', { name: 'Ada Lovelace' }).tagName).toBe('IMG')
  })

  it('renders an initials placeholder when photoUrl is null', () => {
    render(<BuddyAvatar photoUrl={null} displayName="Ada Lovelace" />)
    const placeholder = screen.getByRole('img', { name: 'Ada Lovelace' })
    expect(placeholder.tagName).not.toBe('IMG')
    expect(placeholder).toHaveTextContent('AL')
  })

  it('scales the initials with the avatar size', () => {
    render(<BuddyAvatar photoUrl={null} displayName="Ada Lovelace" size="lg" />)
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toHaveStyle({ fontSize: '26px' })
  })
})
