'use client'

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'
import type { BuddyProfileResponse } from '@peace-buddy/types'

export function useMyProfile(enabled: boolean) {
  const [profile, setProfile] = useState<BuddyProfileResponse | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!enabled) return
    apiClient
      .getMyProfile()
      .then((data) => {
        setProfile(data)
        setError(false)
      })
      .catch(() => setError(true))
  }, [enabled])

  const refetch = async () => {
    const updated = await apiClient.getMyProfile()
    setProfile(updated)
  }

  const updateProfile = (updated: BuddyProfileResponse) => setProfile(updated)

  return { profile, error, refetch, updateProfile }
}
