import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { GroupResponse } from '@peace-buddy/types'
import { GroupTypeSchema } from '@peace-buddy/types'
import en from '../../../../../../messages/en.json'
import ja from '../../../../../../messages/ja.json'
import { GroupSummary } from './group-summary'

// Echo the fully qualified key: a bare `key` echo cannot tell the translated
// group type label apart from the raw enum value, since they are the same string.
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
  useLocale: () => 'en',
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}))

const baseGroup: GroupResponse = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  name: 'Test School',
  type: 'school',
  contactName: 'Hana Sato',
  contactEmail: 'hana@example.com',
  contactPhone: '090-0000-0000',
  notes: 'Arrives by bus',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('GroupSummary', () => {
  it('renders nothing when no group is selected', () => {
    const { container } = render(<GroupSummary group={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the name, translated type and every populated detail', () => {
    render(<GroupSummary group={baseGroup} />)

    expect(screen.getByText(baseGroup.name)).toBeInTheDocument()
    expect(screen.getByText(`groupType.${baseGroup.type}`)).toBeInTheDocument()
    expect(screen.getByText(baseGroup.contactName!)).toBeInTheDocument()
    expect(screen.getByText(baseGroup.contactEmail!)).toBeInTheDocument()
    expect(screen.getByText(baseGroup.contactPhone!)).toBeInTheDocument()
    expect(screen.getByText(baseGroup.notes!)).toBeInTheDocument()
  })

  it('omits a detail row for each field the group leaves empty', () => {
    render(<GroupSummary group={{ ...baseGroup, contactEmail: null, contactPhone: null }} />)

    expect(screen.getByText('adminGroups.contactName')).toBeInTheDocument()
    expect(screen.queryByText('adminGroups.contactEmail')).not.toBeInTheDocument()
    expect(screen.queryByText('adminGroups.contactPhone')).not.toBeInTheDocument()
    expect(screen.getByText('adminGroups.notes')).toBeInTheDocument()
  })

  it('renders no detail list when the group has no contact fields or notes', () => {
    render(
      <GroupSummary
        group={{ ...baseGroup, contactName: null, contactEmail: null, contactPhone: null, notes: null }}
      />,
    )

    expect(screen.getByText(baseGroup.name)).toBeInTheDocument()
    expect(screen.queryByRole('definition')).not.toBeInTheDocument()
    expect(screen.queryByText('adminGroups.contactName')).not.toBeInTheDocument()
  })

  it('links to the group detail page in a new tab', () => {
    render(<GroupSummary group={baseGroup} />)

    const link = screen.getByRole('link', { name: /adminTours\.groupSummary\.viewGroup/ })
    expect(link).toHaveAttribute('href', `/en/admin/groups/${baseGroup.id}`)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})

// The next-intl mock echoes keys, so a renamed or deleted message would not fail
// any assertion above. Check the keys this component resolves actually exist.
describe('GroupSummary messages', () => {
  const keys = [
    'adminGroups.contactName',
    'adminGroups.contactEmail',
    'adminGroups.contactPhone',
    'adminGroups.notes',
    'adminTours.groupSummary.viewGroup',
    ...GroupTypeSchema.options.map((type) => `groupType.${type}`),
  ]

  it.each([['en', en], ['ja', ja]])('resolves every key in %s', (_locale, messages) => {
    for (const key of keys) {
      const value = key.split('.').reduce<unknown>(
        (node, part) => (node as Record<string, unknown> | undefined)?.[part],
        messages,
      )
      expect(value, key).toBeTypeOf('string')
    }
  })
})
