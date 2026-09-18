'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api-client'
import {
  BuddyNotifEventTypeSchema,
  type BuddyNotifEventType,
  type BuddyNotificationPreferenceItem,
} from '@peace-buddy/types'

/**
 * Per-event email opt-out for a buddy (#213). Before this, every buddy-targeted
 * event mailed unconditionally — `tour_published` alone reaches every Active
 * buddy on every publish.
 *
 * Only the mutable events appear, and the list is the schema's own, not a copy
 * of it: an event a buddy may not mute is absent from
 * `BuddyNotifEventTypeSchema` and from the Prisma enum, so it can neither be
 * rendered here nor stored if someone hand-rolls the request.
 *
 * In-app delivery is not configurable. The preference is about what lands in an
 * inbox; a muted event is still in the notification list.
 */
export function NotificationPreferences() {
  const t = useTranslations('profile.notificationPreferences')
  const tEvents = useTranslations('profile.notificationPreferences.events')
  const [prefs, setPrefs] = useState<BuddyNotificationPreferenceItem[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    apiClient
      .getBuddyNotificationPreferences()
      .then((res) => setPrefs(res.preferences))
      .catch(() => setLoadError(true))
  }, [])

  function toggle(eventType: BuddyNotifEventType, emailEnabled: boolean) {
    setSaved(false)
    setSaveError(false)
    setPrefs((current) =>
      current
        ? current.map((p) => (p.eventType === eventType ? { ...p, emailEnabled } : p))
        : current,
    )
  }

  async function onSave() {
    if (!prefs) return
    setSaving(true)
    setSaveError(false)
    try {
      const res = await apiClient.updateBuddyNotificationPreferences({ preferences: prefs })
      setPrefs(res.preferences)
      setSaved(true)
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-8 rounded-lg border p-4">
      <h2 className="text-base font-semibold">{t('title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>

      {loadError && (
        <p className="mt-3 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {t('loadError')}
        </p>
      )}

      {!prefs && !loadError && <p className="mt-3 text-sm text-muted-foreground">{t('loading')}</p>}

      {prefs && (
        <>
          <ul className="mt-4 space-y-3">
            {BuddyNotifEventTypeSchema.options.map((eventType) => {
              const pref = prefs.find((p) => p.eventType === eventType)
              if (!pref) return null
              return (
                <li key={eventType} className="flex items-start gap-3">
                  <input
                    id={`notif-${eventType}`}
                    type="checkbox"
                    className="mt-1"
                    checked={pref.emailEnabled}
                    onChange={(e) => toggle(eventType, e.target.checked)}
                  />
                  <label htmlFor={`notif-${eventType}`} className="text-sm">
                    <span className="font-medium">{tEvents(eventType)}</span>
                    <span className="block text-muted-foreground">
                      {tEvents(`${eventType}Help`)}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>

          <p className="mt-4 text-sm text-muted-foreground">{t('alwaysOnNotice')}</p>

          <div className="mt-4 flex items-center gap-3">
            <Button type="button" onClick={onSave} disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
            {saved && <span className="text-sm text-green-700">{t('saveSuccess')}</span>}
            {saveError && <span className="text-sm text-destructive">{t('saveError')}</span>}
          </div>
        </>
      )}
    </section>
  )
}
