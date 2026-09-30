'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import type { MyTourBookingEntry } from '@peace-buddy/types'

export function useMyBookings(ready: boolean) {
  const [bookings, setBookings] = useState<MyTourBookingEntry[] | null>(null)
  const [error, setError] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!ready) return
    apiClient.getMyBookings()
      .then(setBookings)
      .catch(() => setError(true))
  }, [ready, version])

  // After the buddy books from a page that lists their bookings.
  const reload = useCallback(() => setVersion((v) => v + 1), [])

  return { bookings, error, reload }
}
