'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import type { MyBookingEntry } from '@peace-buddy/types'

export function useMyBookings(ready: boolean) {
  const [bookings, setBookings] = useState<MyBookingEntry[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!ready) return
    apiClient.getMyBookings()
      .then(setBookings)
      .catch(() => setError(true))
  }, [ready])

  return { bookings, error }
}
