'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import type { GroupResponse, GroupType, AppError } from '@peace-buddy/types'
import { AppErrorCodeSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon } from '@/components/sort-icon'
import { fetchGroups, sortGroups, nextGroupSort, type GroupSortField } from './admin.group'

const GROUP_TYPE_CLASS: Record<GroupType, string> = {
  school: 'bg-blue-100 text-blue-800 border-blue-200',
  company: 'bg-amber-100 text-amber-800 border-amber-200',
  community: 'bg-green-100 text-green-800 border-green-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
}

export default function AdminGroupsPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const t = useTranslations('adminGroups')
  const [groups, setGroups] = useState<GroupResponse[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<GroupSortField>('name')
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
    fetchGroups().then((result) => {
      if (result.ok) setGroups(result.data)
      else setFetchError(errorMessage(result.error))
    })
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSort(field: GroupSortField) {
    const next = nextGroupSort({ field: sortField, dir: sortDir }, field)
    setSortField(next.field)
    setSortDir(next.dir)
  }

  const sorted = sortGroups(groups, sortField, sortDir)

  if (!ready) return null

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <Button asChild size="sm">
          <Link href={routes.adminGroupNew(locale)}>{t('newGroup')}</Link>
        </Button>
      </div>

      {fetchError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {fetchError}
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noResults')}</p>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {sorted.map((group) => (
              <div
                key={group.id}
                className="cursor-pointer rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
                onClick={() => router.push(routes.adminGroupDetail(locale, group.id))}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-medium">{group.name}</span>
                  <Badge className={GROUP_TYPE_CLASS[group.type]}>{group.type}</Badge>
                </div>
                <div className="flex justify-end">
                  <Button asChild variant="outline" size="sm" onClick={(e) => e.stopPropagation()}>
                    <Link href={routes.adminGroupEdit(locale, group.id)}>{t('edit')}</Link>
                  </Button>
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
                      className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                      onClick={() => handleSort('name')}
                    >
                      {t('name')}
                      <SortIcon active={sortField === 'name'} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                      onClick={() => handleSort('type')}
                    >
                      {t('type')}
                      <SortIcon active={sortField === 'type'} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((group) => (
                  <TableRow
                    key={group.id}
                    className="cursor-pointer"
                    onClick={() => router.push(routes.adminGroupDetail(locale, group.id))}
                  >
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>
                      <Badge className={GROUP_TYPE_CLASS[group.type]}>{group.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button asChild variant="outline" size="sm">
                        <Link href={routes.adminGroupEdit(locale, group.id)}>{t('edit')}</Link>
                      </Button>
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
