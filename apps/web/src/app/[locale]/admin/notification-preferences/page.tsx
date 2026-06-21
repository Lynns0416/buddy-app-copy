'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api-client'
import {
  EmailModeSchema,
  type EmailMode,
  type NotifEventType,
  type NotificationPreferenceItem,
} from '@peace-buddy/types'

const EVENT_TYPES: NotifEventType[] = [
  'new_signup',
  'new_booking',
  'cancellation',
  'maybe_resolved',
  'maybe_deadline_missed',
]

export default function AdminNotificationPreferencesPage() {
  const { ready } = useAdminGuard()
  const t = useTranslations('adminNotificationPreferences')
  const tEvents = useTranslations('adminNotificationPreferences.events')
  const [prefs, setPrefs] = useState<NotificationPreferenceItem[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    if (!ready) return
    apiClient
      .getAdminNotificationPreferences()
      .then((res) => setPrefs(res.preferences))
      .catch(() => setLoadError(true))
  }, [ready])

  function update(eventType: NotifEventType, patch: Partial<NotificationPreferenceItem>) {
    setSaved(false)
    setSaveError(false)
    setPrefs((current) =>
      current
        ? current.map((p) => (p.eventType === eventType ? { ...p, ...patch } : p))
        : current,
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!prefs) return
    setSaving(true)
    setSaveError(false)
    try {
      const res = await apiClient.updateAdminNotificationPreferences({ preferences: prefs })
      setPrefs(res.preferences)
      setSaved(true)
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  if (!ready) return null

  return (
    <AppShell variant="admin">
      <h1 className="mb-2 text-xl font-semibold">{t('title')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{t('intro')}</p>

      {loadError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {t('loadError')}
        </p>
      )}

      {prefs && (
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{t('eventTypeHeader')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('emailEnabledHeader')}</th>
                  <th className="px-4 py-2 text-left font-medium">{t('emailModeHeader')}</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">{t('slackEnabledHeader')}</th>
                </tr>
              </thead>
              <tbody>
                {EVENT_TYPES.map((eventType) => {
                  const pref = prefs.find((p) => p.eventType === eventType)
                  if (!pref) return null
                  return (
                    <tr key={eventType} className="border-t">
                      <td className="px-4 py-3 font-medium">{tEvents(eventType)}</td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={pref.emailEnabled}
                          onChange={(e) => update(eventType, { emailEnabled: e.target.checked })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={pref.emailMode}
                          disabled={!pref.emailEnabled}
                          onChange={(e) => update(eventType, { emailMode: e.target.value as EmailMode })}
                          className="rounded-md border bg-background px-2 py-1"
                        >
                          <option value={EmailModeSchema.enum.immediate}>{t('modeImmediate')}</option>
                          <option value={EmailModeSchema.enum.digest}>{t('modeDigest')}</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={pref.slackEnabled}
                          onChange={(e) => update(eventType, { slackEnabled: e.target.checked })}
                          disabled
                          title={t('slackDisabledTooltip')}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? t('saving') : t('save')}
            </Button>
            {saved && <span className="text-sm text-green-700">{t('saveSuccess')}</span>}
            {saveError && <span className="text-sm text-destructive">{t('saveError')}</span>}
          </div>
        </form>
      )}
    </AppShell>
  )
}
