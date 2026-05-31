'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { AdminTourDetailResponse, AdminProfileResponse } from '@peace-buddy/types'
import { AppErrorCodeSchema } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { assignTourAdmin, unassignTourAdmin, setTourStaffInCharge } from '../admin.tour'

interface Props {
  tourId: string
  assignedAdmins: AdminTourDetailResponse['assignedAdmins']
  staffInChargeId: string | null
  allAdmins: AdminProfileResponse[]
  onUpdate: (tour: AdminTourDetailResponse) => void
}

export function TourAdminAssignment({ tourId, assignedAdmins, staffInChargeId, allAdmins, onUpdate }: Props) {
  const t = useTranslations('adminTours')
  const [selectedAdminId, setSelectedAdminId] = useState('')
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const assignedIds = new Set(assignedAdmins.map((a) => a.adminId))
  const available = allAdmins.filter((a) => !assignedIds.has(a.id))

  async function handleAssign() {
    if (!selectedAdminId) return
    setActing(true)
    setError(null)
    const result = await assignTourAdmin(tourId, selectedAdminId)
    if (result.ok) {
      onUpdate(result.data)
      setSelectedAdminId('')
    } else {
      setError(t('error.unknown'))
    }
    setActing(false)
  }

  async function handleUnassign(adminId: string) {
    setActing(true)
    setError(null)
    const result = await unassignTourAdmin(tourId, adminId)
    if (result.ok) onUpdate(result.data)
    else if (result.error.code === AppErrorCodeSchema.enum.conflict) setError(t('error.conflict'))
    else if (result.error.code === AppErrorCodeSchema.enum.not_found) setError(t('error.notFound'))
    else if (result.error.code === AppErrorCodeSchema.enum.network) setError(t('error.network'))
    else setError(t('error.unknown'))
    setActing(false)
  }

  async function handleStaffInCharge(adminId: string) {
    setActing(true)
    setError(null)
    const result = await setTourStaffInCharge(tourId, adminId)
    if (result.ok) onUpdate(result.data)
    else setError(t('error.unknown'))
    setActing(false)
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-base font-semibold">{t('assignedAdmins.title')}</h2>
        {assignedAdmins.length === 0 && (
          <Badge variant="warning">{t('assignedAdmins.noAdmins')}</Badge>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {assignedAdmins.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {assignedAdmins.map((a) => (
            <li key={a.adminId} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{a.name}</span>
                {a.adminId === staffInChargeId && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {t('assignedAdmins.staffInCharge')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {a.adminId !== staffInChargeId && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    disabled={acting}
                    onClick={() => void handleStaffInCharge(a.adminId)}
                  >
                    {t('assignedAdmins.setStaffInCharge')}
                  </button>
                )}
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  disabled={acting}
                  onClick={() => void handleUnassign(a.adminId)}
                >
                  {t('assignedAdmins.unassign')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            value={selectedAdminId}
            onChange={(e) => setSelectedAdminId(e.target.value)}
            disabled={acting}
          >
            <option value="">{t('assignedAdmins.selectAdmin')}</option>
            {available.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <Button size="sm" disabled={acting || !selectedAdminId} onClick={() => void handleAssign()}>
            {t('assignedAdmins.assign')}
          </Button>
        </div>
      )}
    </div>
  )
}
