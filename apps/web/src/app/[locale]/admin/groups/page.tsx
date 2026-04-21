'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import { apiClient } from '@/lib/api-client'
import type { GroupResponse, GroupType } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const GROUP_TYPE_CLASS: Record<GroupType, string> = {
  school: 'bg-blue-100 text-blue-800 border-blue-200',
  company: 'bg-amber-100 text-amber-800 border-amber-200',
  community: 'bg-green-100 text-green-800 border-green-200',
  other: 'bg-slate-100 text-slate-700 border-slate-200',
}

type SortField = 'name' | 'type'
type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="ml-1 inline h-3.5 w-3.5 opacity-40" />
  return dir === 'asc'
    ? <ChevronUp className="ml-1 inline h-3.5 w-3.5" />
    : <ChevronDown className="ml-1 inline h-3.5 w-3.5" />
}

export default function AdminGroupsPage() {
  const { ready, locale } = useAdminGuard()
  const t = useTranslations('adminGroups')
  const [groups, setGroups] = useState<GroupResponse[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    if (!ready) return
    apiClient.listGroups()
      .then(setGroups)
      .catch(() => setFetchError(t('actionError')))
  }, [ready, t])

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sorted = [...groups].sort((a, b) => {
    const cmp = a[sortField].localeCompare(b[sortField], 'ja')
    return sortDir === 'asc' ? cmp : -cmp
  })

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
              <div key={group.id} className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Link href={routes.adminGroupDetail(locale, group.id)} className="font-medium hover:underline">
                    {group.name}
                  </Link>
                  <Badge className={GROUP_TYPE_CLASS[group.type]}>{group.type}</Badge>
                </div>
                <div className="flex justify-end">
                  <Button asChild variant="ghost" size="sm">
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
                  <TableRow key={group.id}>
                    <TableCell>
                      <Link
                        href={routes.adminGroupDetail(locale, group.id)}
                        className="font-medium hover:underline"
                      >
                        {group.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge className={GROUP_TYPE_CLASS[group.type]}>{group.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
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
