'use client'

import { useTranslations } from 'next-intl'
import type { NotifEventKind, NotificationResponse } from '@peace-buddy/types'

type Props = {
  item: NotificationResponse
  onMarkRead: () => void
}

export function NotificationRow({ item, onMarkRead }: Props) {
  const t = useTranslations('notifications.event')
  const unread = item.readAt === null

  return (
    <li
      className={`flex items-start justify-between gap-4 px-4 py-3 ${unread ? 'bg-accent/30' : ''}`}
    >
      <div>
        <p className="text-sm">{t(item.type as NotifEventKind)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
      </div>
      {unread && (
        <button
          type="button"
          onClick={onMarkRead}
          className="shrink-0 text-xs text-muted-foreground underline hover:text-foreground"
        >
          ✓
        </button>
      )}
    </li>
  )
}
