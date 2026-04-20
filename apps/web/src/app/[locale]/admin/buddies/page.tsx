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

export default function AdminBuddiesPage() {
  const { ready } = useAdminGuard()
  const t = useTranslations('adminBuddies')
  const [buddies, setBuddies] = useState<AdminBuddyResponse[]>([])
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

      {buddies.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noResults')}</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('name')}</TableHead>
                <TableHead>{t('email')}</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {buddies.map((buddy) => (
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
