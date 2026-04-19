'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { useAuth } from '../../../../lib/auth'
import { routes } from '../../../../lib/routes'
import { apiRequest } from '../../../../lib/api'
import type { GroupResponse } from '@peace-buddy/types'
import { UserRoleSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type SortField = 'name' | 'type'
type SortDir = 'asc' | 'desc'

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="ml-1 inline h-3.5 w-3.5 opacity-40" />
  return dir === 'asc'
    ? <ChevronUp className="ml-1 inline h-3.5 w-3.5" />
    : <ChevronDown className="ml-1 inline h-3.5 w-3.5" />
}

export default function AdminGroupsPage() {
  const { firebaseUser, dbUser, loading } = useAuth()
  const router = useRouter()
  const { locale } = useParams<{ locale: string }>()
  const t = useTranslations('adminGroups')
  const [groups, setGroups] = useState<GroupResponse[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    if (!loading) {
      if (!firebaseUser) {
        router.replace(routes.login(locale))
      } else if (dbUser && dbUser.role !== UserRoleSchema.enum.admin && dbUser.role !== UserRoleSchema.enum.super_admin) {
        router.replace(routes.home(locale))
      }
    }
  }, [loading, firebaseUser, dbUser, locale, router])

  useEffect(() => {
    if (!loading && firebaseUser && dbUser && (dbUser.role === UserRoleSchema.enum.admin || dbUser.role === UserRoleSchema.enum.super_admin)) {
      apiRequest<GroupResponse[]>('/admin/groups')
        .then(setGroups)
        .catch(() => setFetchError(t('actionError')))
    }
  }, [loading, firebaseUser, dbUser])

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

  if (loading || !dbUser) return null

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
        <div className="rounded-lg border bg-card">
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
                    <Badge variant="secondary">{group.type}</Badge>
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
      )}
    </AppShell>
  )
}
