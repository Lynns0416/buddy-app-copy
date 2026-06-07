'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import type { TourDetailResponse } from '@peace-buddy/types'

export function useTourDetail(tourId: string, enabled: boolean) {
  const [tour, setTour] = useState<TourDetailResponse | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled) return
    apiClient
      .getTour(tourId)
      .then((data) => {
        setTour(data)
        setError(false)
      })
      .catch(() => {
        setError(true)
      })
  }, [tourId, enabled])

  const refetch = async () => {
    const updated = await apiClient.getTour(tourId)
    setTour(updated)
  }

  return { tour, loading: tour === null && !error, error, refetch }
}
