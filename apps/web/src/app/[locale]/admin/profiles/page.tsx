'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { useAuth } from '@/lib/auth'
import { AppShell } from '@/components/app-shell'
import { SortIcon } from '@/components/sort-icon'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import type { AdminProfileResponse } from '@peace-buddy/types'
import { AppErrorCodeSchema } from '@peace-buddy/types'
import {
  listAdminProfiles,
  softDeleteAdminProfile,
  sortAdminProfiles,
  nextAdminProfileSort,
  type AdminProfileSortField,
} from './admin-profiles'
import { DeleteAdminModal } from './_components/delete-admin-modal'
import { formatDate } from '@/lib/format-date'

export default function AdminProfilesPage() {
  const { ready } = useAdminGuard()
  const { dbUser } = useAuth()
  const t = useTranslations('adminProfiles')
  const [profiles, setProfiles] = useState<AdminProfileResponse[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmUserId, setConfirmUserId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<AdminProfileSortField>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const isSuperAdmin = dbUser?.role === 'super_admin'

  useEffect(() => {
    if (!ready) return
    listAdminProfiles().then((result) => {
      if (result.ok) {
        setProfiles(result.data)
      } else {
        setLoadError(t('error.unknown'))
      }
    })
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSort(field: AdminProfileSortField) {
    const next = nextAdminProfileSort({ field: sortField, dir: sortDir }, field)
    setSortField(next.field)
    setSortDir(next.dir)
  }

  async function handleConfirmDelete() {
    if (!confirmUserId) return
    const userId = confirmUserId
    setDeleting(userId)
    setConfirmUserId(null)
    setActionError(null)
    const result = await softDeleteAdminProfile(userId)
    setDeleting(null)
    if (result.ok) {
      setProfiles((prev) => prev.filter((p) => p.userId !== userId))
    } else {
      setActionError(result.error.code === AppErrorCodeSchema.enum.conflict ? t('conflictError') : t('actionError'))
    }
  }

  if (!ready) return null

  const sorted = sortAdminProfiles(profiles, sortField, sortDir)

  return (
    <AppShell variant="admin">
      <h1 className="mb-6 text-xl font-semibold">{t('title')}</h1>

      {loadError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{loadError}</p>
      )}
      {actionError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{actionError}</p>
      )}

      {profiles.length === 0 && !loadError ? (
        <p className="text-sm text-muted-foreground">{t('noResults')}</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    className="flex items-center gap-1"
                    onClick={() => handleSort('name')}
                  >
                    {t('name')}
                    <SortIcon active={sortField === 'name'} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="flex items-center gap-1"
                    onClick={() => handleSort('createdAt')}
                  >
                    {t('createdAt')}
                    <SortIcon active={sortField === 'createdAt'} dir={sortDir} />
                  </button>
                </TableHead>
                {isSuperAdmin && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.name}
                    {p.userId === dbUser?.id && (
                      <span className="ml-2 text-xs text-muted-foreground">{t('you')}</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm text-muted-foreground">
                    {formatDate(p.createdAt)}
                  </TableCell>
                  {isSuperAdmin && (
                    <TableCell className="text-right">
                      {p.userId !== dbUser?.id && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deleting === p.userId}
                          onClick={() => setConfirmUserId(p.userId)}
                        >
                          {t('delete')}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DeleteAdminModal
        open={confirmUserId !== null}
        loading={deleting !== null}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setConfirmUserId(null)}
      />
    </AppShell>
  )
}
