'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { AppShell } from '@/components/app-shell'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon } from '@/components/sort-icon'
import { routes } from '@/lib/routes'
import { sortBuddies, nextBuddySort, buddyName, type BuddySortField } from '../buddies/admin.buddy'
import { useTrainees } from './use-trainees'
import { BuddyAvatar } from '@/components/buddy-avatar'

export default function AdminTraineesPage() {
  const { ready } = useAdminGuard()
  const locale = useLocale()
  const router = useRouter()
  const t = useTranslations('adminTrainees')
  const { trainees, fetchError } = useTrainees(ready)
  const [sortField, setSortField] = useState<BuddySortField>('displayName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(field: BuddySortField) {
    const next = nextBuddySort({ field: sortField, dir: sortDir }, field)
    setSortField(next.field)
    setSortDir(next.dir)
  }

  const sorted = sortBuddies(trainees, sortField, sortDir)

  if (!ready) return null

  return (
    <AppShell variant="admin">
      <h1 className="mb-6 text-xl font-semibold">{t('title')}</h1>

      {fetchError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {t('error.unknown')}
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noResults')}</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            <div className="flex flex-wrap gap-2">
              {([
                { field: 'displayName' as const, label: t('name') },
                { field: 'email' as const, label: t('email') },
              ]).map(({ field, label }) => (
                <button
                  key={field}
                  className="inline-flex items-center gap-0.5 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handleSort(field)}
                >
                  {label}
                  <SortIcon active={sortField === field} dir={sortDir} />
                </button>
              ))}
            </div>
            {sorted.map((trainee) => (
              <div
                key={trainee.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
                onClick={() => router.push(routes.adminBuddyDetail(locale, trainee.id))}
              >
                <BuddyAvatar photoUrl={trainee.photoUrl} displayName={trainee.displayName} size="md" />
                <div>
                  <p className="font-medium">{buddyName(t, trainee)}</p>
                  <p className="text-sm text-muted-foreground">{trainee.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(trainee.createdAt).toLocaleDateString(locale)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* sm+: scrollable table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      className="inline-flex items-center gap-1 whitespace-nowrap font-medium transition-colors hover:text-foreground"
                      onClick={() => handleSort('displayName')}
                    >
                      {t('name')}
                      <SortIcon active={sortField === 'displayName'} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="inline-flex items-center gap-1 whitespace-nowrap font-medium transition-colors hover:text-foreground"
                      onClick={() => handleSort('email')}
                    >
                      {t('email')}
                      <SortIcon active={sortField === 'email'} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead className="whitespace-nowrap">{t('joinedAt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((trainee) => (
                  <TableRow
                    key={trainee.id}
                    className="cursor-pointer"
                    onClick={() => router.push(routes.adminBuddyDetail(locale, trainee.id))}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <BuddyAvatar photoUrl={trainee.photoUrl} displayName={trainee.displayName} />
                        <span className="font-medium">{buddyName(t, trainee)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{trainee.email}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(trainee.createdAt).toLocaleDateString(locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </AppShell>
  )
}
