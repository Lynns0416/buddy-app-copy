import { useState, useEffect } from 'react'
import type { AdminBuddyResponse, AppError } from '@peace-buddy/types'
import { fetchTrainees } from '../buddies/admin.buddy'

export function useTrainees(ready: boolean) {
  const [trainees, setTrainees] = useState<AdminBuddyResponse[]>([])
  const [fetchError, setFetchError] = useState<AppError | null>(null)

  useEffect(() => {
    if (!ready) return
    fetchTrainees().then((result) => {
      if (result.ok) setTrainees(result.data)
      else setFetchError(result.error)
    })
  }, [ready])

  return { trainees, fetchError }
}
