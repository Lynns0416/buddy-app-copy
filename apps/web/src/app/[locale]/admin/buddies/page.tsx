'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import type { AdminBuddyResponse, AppError, BuddyStatus } from '@peace-buddy/types'
import { AppErrorCodeSchema, BuddyStatusSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon } from '@/components/sort-icon'
import { routes } from '@/lib/routes'
import { fetchBuddies, sortBuddies, nextBuddySort, type BuddySortField } from './admin.buddy'

export default function AdminBuddiesPage() {
  const { ready } = useAdminGuard()
  const locale = useLocale()
  const t = useTranslations('adminBuddies')
  const [buddies, setBuddies] = useState<AdminBuddyResponse[]>([])
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
    fetchBuddies(BuddyStatusSchema.enum.active).then((result) => {
      if (result.ok) setBuddies(result.data)
      else setFetchError(errorMessage(result.error))
    })
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSort(field: BuddySortField) {
    const next = nextBuddySort({ field: sortField, dir: sortDir }, field)
    setSortField(next.field)
    setSortDir(next.dir)
  }

  const sorted = sortBuddies(buddies, sortField, sortDir)

  if (!ready) return null

  return (
    <AppShell variant="admin">
      <h1 className="mb-6 text-xl font-semibold">{t('title')}</h1>

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
                <TableHead>
                  <button
                    className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                    onClick={() => handleSort('tier')}
                  >
                    {t('tier')}
                    <SortIcon active={sortField === 'tier'} dir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((buddy) => (
                <TableRow key={buddy.id}>
                  <TableCell className="font-medium">{buddy.displayName}</TableCell>
                  <TableCell className="text-muted-foreground">{buddy.email}</TableCell>
                  <TableCell>{buddy.tier || '—'}</TableCell>
                  <TableCell>
                    <Link
                      href={routes.adminBuddyDetail(locale, buddy.id)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {t('view')}
                    </Link>
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
