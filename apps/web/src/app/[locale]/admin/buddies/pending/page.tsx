'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import type { AdminBuddyResponse, AppError, BuddyStatus } from '@peace-buddy/types'
import { AppErrorCodeSchema, BuddyStatusSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon } from '@/components/sort-icon'
import { fetchBuddies, sortBuddies, nextBuddySort, updateBuddyStatus, type BuddySortField } from '../admin.buddy'

export default function AdminBuddiesPendingPage() {
  const { ready } = useAdminGuard()
  const t = useTranslations('adminBuddies')
  const [buddies, setBuddies] = useState<AdminBuddyResponse[]>([])
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<BuddySortField>('displayName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function errorMessage(error: AppError): string {
    switch (error.code) {
      case AppErrorCodeSchema.enum.not_found:  return t('error.notFound')
      case AppErrorCodeSchema.enum.forbidden:  return t('error.forbidden')
      case AppErrorCodeSchema.enum.conflict:   return t('error.conflict')
      case AppErrorCodeSchema.enum.network:    return t('error.network')
      default:                                 return t('error.unknown')
    }
  }

  useEffect(() => {
    if (!ready) return
    fetchBuddies(BuddyStatusSchema.enum.pending).then((result) => {
      if (result.ok) setBuddies(result.data)
      else setFetchError(errorMessage(result.error))
    })
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSort(field: BuddySortField) {
    const next = nextBuddySort({ field: sortField, dir: sortDir }, field)
    setSortField(next.field)
    setSortDir(next.dir)
  }

  async function handleStatusChange(id: string, newStatus: BuddyStatus) {
    setPendingAction(id)
    const result = await updateBuddyStatus(id, newStatus)
    if (result.ok) {
      setBuddies((prev) => prev.filter((b) => b.id !== id))
    } else {
      // Generic error message, could add specific handling if needed
    }
    setPendingAction(null)
  }

  const sorted = sortBuddies(buddies, sortField, sortDir)

  if (!ready) return null

  return (
    <AppShell variant="admin">
      <h1 className="mb-6 text-xl font-semibold">{t('titlePending')}</h1>

      {fetchError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {fetchError}
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noResults')}</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort('displayName')}
                  >
                    {t('name')}
                    <SortIcon active={sortField === 'displayName'} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort('email')}
                  >
                    {t('email')}
                    <SortIcon active={sortField === 'email'} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((buddy) => (
                <TableRow key={buddy.id}>
                  <TableCell className="font-medium">{buddy.displayName}</TableCell>
                  <TableCell className="text-muted-foreground">{buddy.email}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleStatusChange(buddy.id, BuddyStatusSchema.enum.active)}
                        disabled={pendingAction !== null}
                      >
                        {t('approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleStatusChange(buddy.id, BuddyStatusSchema.enum.rejected)}
                        disabled={pendingAction !== null}
                      >
                        {t('reject')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}
