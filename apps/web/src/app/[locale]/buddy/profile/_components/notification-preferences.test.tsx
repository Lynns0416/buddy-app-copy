import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotificationPreferences } from './notification-preferences'
import { BuddyNotifEventTypeSchema } from '@peace-buddy/types'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const getBuddyNotificationPreferences = vi.fn()
const updateBuddyNotificationPreferences = vi.fn()
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getBuddyNotificationPreferences: (...args: unknown[]) =>
      getBuddyNotificationPreferences(...args) as unknown,
    updateBuddyNotificationPreferences: (...args: unknown[]) =>
      updateBuddyNotificationPreferences(...args) as unknown,
  },
}))

const allOn = BuddyNotifEventTypeSchema.options.map((eventType) => ({
  eventType,
  emailEnabled: true,
}))

describe('NotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getBuddyNotificationPreferences.mockResolvedValue({ preferences: allOn })
    updateBuddyNotificationPreferences.mockResolvedValue({ preferences: allOn })
  })

  it('renders one checkbox per mutable event, checked when email is on', async () => {
    render(<NotificationPreferences />)
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(allOn.length))
    for (const { eventType } of allOn) {
      expect(screen.getByRole('checkbox', { name: new RegExp(`^${eventType}`) })).toBeChecked()
    }
  })

  // The unmutable events are absent from the schema, so they cannot reach the
  // page. Asserting on their absence keeps the guarantee visible here too.
  it('offers no toggle for an event a buddy may not mute', async () => {
    render(<NotificationPreferences />)
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(allOn.length))
    for (const unmutable of [
      'tour_cancelled',
      'waitlist_promoted',
      'account_approved',
      'account_rejected',
    ]) {
      expect(screen.queryByRole('checkbox', { name: new RegExp(`^${unmutable}`) })).toBeNull()
    }
  })

  it('sends the whole set with the toggled event flipped off', async () => {
    render(<NotificationPreferences />)
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(allOn.length))

    await userEvent.click(screen.getByRole('checkbox', { name: /^tour_published/ }))
    await userEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(updateBuddyNotificationPreferences).toHaveBeenCalledTimes(1))
    expect(updateBuddyNotificationPreferences).toHaveBeenCalledWith({
      preferences: allOn.map((p) =>
        p.eventType === 'tour_published' ? { ...p, emailEnabled: false } : p,
      ),
    })
    expect(await screen.findByText('saveSuccess')).toBeInTheDocument()
  })

  it('reports a failed save and keeps the edited state', async () => {
    updateBuddyNotificationPreferences.mockRejectedValueOnce(new Error('boom'))
    render(<NotificationPreferences />)
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(allOn.length))

    await userEvent.click(screen.getByRole('checkbox', { name: /^tour_reminder/ }))
    await userEvent.click(screen.getByRole('button', { name: 'save' }))

    expect(await screen.findByText('saveError')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /^tour_reminder/ })).not.toBeChecked()
  })

  it('shows a placeholder while the fetch is in flight, and drops it once loaded', async () => {
    render(<NotificationPreferences />)
    expect(screen.getByText('loading')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('checkbox')).toHaveLength(allOn.length))
    expect(screen.queryByText('loading')).toBeNull()
  })

  it('shows a load error and no toggles when the fetch fails', async () => {
    getBuddyNotificationPreferences.mockRejectedValueOnce(new Error('boom'))
    render(<NotificationPreferences />)
    expect(await screen.findByText('loadError')).toBeInTheDocument()
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByText('loading')).toBeNull()
  })
})
