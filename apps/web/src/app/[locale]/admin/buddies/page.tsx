'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { apiClient } from '@/lib/api-client'
import type { AdminBuddyResponse } from '@peace-buddy/types'
import { BuddyStatusSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon, type SortDir } from '@/components/sort-icon'

export default function AdminBuddiesPage() {
  const { ready } = useAdminGuard()
  const t = useTranslations('adminBuddies')
  const [buddies, setBuddies] = useState<AdminBuddyResponse[]>([])
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'displayName' | 'email'>('displayName')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  function handleSort(field: 'displayName' | 'email') {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sorted = [...buddies].sort((a, b) => {
    const cmp = sortField === 'displayName'
      ? a.displayName.localeCompare(b.displayName, 'ja')
      : a.email.localeCompare(b.email)
    return sortDir === 'asc' ? cmp : -cmp
  })

  useEffect(() => {
    if (!ready) return
    apiClient.listBuddies(BuddyStatusSchema.enum.pending)
      .then(setBuddies)
      .catch(() => {})
  }, [ready])

  async function handleApprove(id: string) {
    setPendingAction(id)
    setError(null)
    try {
      await apiClient.updateBuddyStatus(id, { status: BuddyStatusSchema.enum.active })
      setBuddies((prev) => prev.filter((b) => b.id !== id))
    } catch {
      setError(t('actionError'))
    } finally {
      setPendingAction(null)
    }
  }

  async function handleReject(id: string) {
    setPendingAction(id)
    setError(null)
    try {
      await apiClient.updateBuddyStatus(id, { status: BuddyStatusSchema.enum.rejected })
      setBuddies((prev) => prev.filter((b) => b.id !== id))
    } catch {
      setError(t('actionError'))
    } finally {
      setPendingAction(null)
    }
  }

  if (!ready) return null

  return (
    <AppShell variant="admin">
      <h1 className="mb-6 text-xl font-semibold">{t('title')}</h1>

      {error && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
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
                        onClick={() => handleApprove(buddy.id)}
                        disabled={pendingAction !== null}
                      >
                        {t('approve')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(buddy.id)}
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
