'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import { apiClient } from '@/lib/api-client'
import type { GroupDetailResponse, GroupType } from '@peace-buddy/types'
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

export default function AdminGroupDetailPage() {
  const { ready, locale } = useAdminGuard()
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('adminGroups')
  const [group, setGroup] = useState<GroupDetailResponse | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    apiClient.getGroup(id)
      .then(setGroup)
      .catch(() => setFetchError(t('actionError')))
  }, [ready, id, t])

  if (!ready) return null

  if (fetchError) {
    return (
      <AppShell variant="admin">
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{fetchError}</p>
      </AppShell>
    )
  }

  if (!group) return null

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex items-center justify-between">
        <Link href={routes.adminGroups(locale)} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('back')}
        </Link>
        <Button asChild size="sm">
          <Link href={routes.adminGroupEdit(locale, group.id)}>{t('edit')}</Link>
        </Button>
      </div>

      <div className="mb-6 rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-xl font-semibold">{group.name}</h1>
          <Badge className={GROUP_TYPE_CLASS[group.type]}>{group.type}</Badge>
        </div>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          {group.contactName && (
            <div>
              <dt className="text-muted-foreground">{t('contactName')}</dt>
              <dd className="font-medium">{group.contactName}</dd>
            </div>
          )}
          {group.contactEmail && (
            <div>
              <dt className="text-muted-foreground">{t('contactEmail')}</dt>
              <dd className="font-medium">{group.contactEmail}</dd>
            </div>
          )}
          {group.contactPhone && (
            <div>
              <dt className="text-muted-foreground">{t('contactPhone')}</dt>
              <dd className="font-medium">{group.contactPhone}</dd>
            </div>
          )}
          {group.notes && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">{t('notes')}</dt>
              <dd className="font-medium">{group.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      <h2 className="mb-3 text-base font-semibold">{t('tours')}</h2>
      {group.tours.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noTours')}</p>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('tourDate')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('location')}</TableHead>
                <TableHead>{t('capacity')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.tours.map((tour) => (
                <TableRow key={tour.id}>
                  <TableCell>{tour.tourDate.slice(0, 10)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{tour.status}</Badge>
                  </TableCell>
                  <TableCell>{tour.location}</TableCell>
                  <TableCell>{tour.capacity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}
