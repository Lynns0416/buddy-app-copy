import { useState, useEffect } from 'react'
import type { AdminBuddyResponse, AppError } from '@peace-buddy/types'
import { BuddyStatusSchema } from '@peace-buddy/types'
import { fetchBuddies } from './admin.buddy'

export function useBuddies(ready: boolean) {
  const [buddies, setBuddies] = useState<AdminBuddyResponse[]>([])
  const [fetchError, setFetchError] = useState<AppError | null>(null)

  useEffect(() => {
    if (!ready) return
    fetchBuddies(BuddyStatusSchema.enum.active).then((result) => {
      if (result.ok) setBuddies(result.data)
      else setFetchError(result.error)
    })
  }, [ready])

  return { buddies, fetchError }
}
