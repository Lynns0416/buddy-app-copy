'use client'

import { useEffect, useState } from 'react'
import type { AdminProfileResponse } from '@peace-buddy/types'
import { fetchAllAdminProfiles } from '../admin.tour'

export function useAllAdmins(): AdminProfileResponse[] {
  const [admins, setAdmins] = useState<AdminProfileResponse[]>([])

  useEffect(() => {
    fetchAllAdminProfiles().then((result) => {
      if (result.ok) setAdmins(result.data)
    })
  }, [])

  return admins
}
