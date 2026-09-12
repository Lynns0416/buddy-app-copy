import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import AdminBuddiesPage from './page'
import type { AdminBuddyResponse } from '@peace-buddy/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))

vi.mock('@/hooks/use-admin-guard', () => ({
  useAdminGuard: () => ({ ready: true }),
}))

vi.mock('@/components/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const buddies: AdminBuddyResponse[] = [
  {
    id: 'b1',
    userId: 'u1',
    status: 'active',
    tier: 'buddy',
    memberType: 'buddy',
    displayName: 'Test Buddy',
    realName: '',
    photoUrl: null,
    email: 'buddy@example.com',
    internalNotes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
]

vi.mock('./use-buddies', () => ({
  useBuddies: () => ({ buddies, fetchError: null }),
}))

// The mobile card and the sm+ table both render; only CSS hides one. The card
// column also leads with sort chips carrying the same field names, so scope to
// the row itself rather than to the column.
function mobileCard(container: HTMLElement): HTMLElement {
  const card = container.querySelector('.sm\\:hidden > .cursor-pointer')
  if (!card) throw new Error('mobile card row not found')
  return card as HTMLElement
}

describe('AdminBuddiesPage mobile cards', () => {
  // tier `buddy` and member type `buddy` both render as the same word, so the
  // card has to name the field the way the table's column headers do.
  it('names the field beside each value', () => {
    const { container } = render(<AdminBuddiesPage />)
    const card = within(mobileCard(container))

    expect(card.getByText('tier')).toBeInTheDocument()
    expect(card.getByText('memberType')).toBeInTheDocument()
    expect(card.getByText('tierBuddy')).toBeInTheDocument()
    expect(card.getByText('memberTypeBuddy')).toBeInTheDocument()
  })

  it('keeps a space between the field name and its value', () => {
    const { container } = render(<AdminBuddiesPage />)
    const text = mobileCard(container).textContent ?? ''

    expect(text).toContain('tier tierBuddy')
    expect(text).toContain('memberType memberTypeBuddy')
  })

  // Scoped to the table: the mobile sort chips carry the same field names, so an
  // unscoped role query passes even with the column deleted.
  it('shows the member type column in the table too', () => {
    render(<AdminBuddiesPage />)
    const table = within(screen.getByRole('table'))

    expect(table.getByRole('button', { name: 'memberType' })).toBeInTheDocument()
    expect(table.getByRole('cell', { name: 'memberTypeBuddy' })).toBeInTheDocument()
  })
})
