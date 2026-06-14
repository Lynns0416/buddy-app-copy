'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import type { NotificationsListResponse, MarkNotificationsRead } from '@peace-buddy/types'

const POLL_INTERVAL_MS = 60_000

export function useNotifications(ready: boolean) {
  const [data, setData] = useState<NotificationsListResponse | null>(null)
  const [error, setError] = useState(false)

  const refetch = useCallback(() => {
    return apiClient
      .listNotifications()
      .then((res) => {
        setData(res)
        setError(false)
      })
      .catch(() => setError(true))
  }, [])

  useEffect(() => {
    if (!ready) return
    void refetch()
    const t = setInterval(() => {
      void refetch()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [ready, refetch])

  const markRead = useCallback(
    async (body: MarkNotificationsRead) => {
      await apiClient.markNotificationsRead(body)
      await refetch()
    },
    [refetch],
  )

  return { data, error, refetch, markRead }
}
