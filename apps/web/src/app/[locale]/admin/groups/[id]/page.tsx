'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import type { GroupDetailResponse, AppError } from '@peace-buddy/types'
import { AppErrorCodeSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon } from '@/components/sort-icon'
import { fetchGroup, sortGroupTours, nextGroupTourSort, type GroupTourSortField } from '../admin.group'
import { getTourStatusLabel, getGroupTypeLabel, tourStatusBadgeVariant, groupTypeBadgeClass } from '@/lib/status-display'
import { formatDate } from '@/lib/format-date'
import { MarkdownText } from '@/components/markdown-text'

export default function AdminGroupDetailPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('adminGroups')
  const tTourStatus = useTranslations('tourStatus')
  const tGroupType = useTranslations('groupType')
  const [group, setGroup] = useState<GroupDetailResponse | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [tourSortField, setTourSortField] = useState<GroupTourSortField>('tourDate')
  const [tourSortDir, setTourSortDir] = useState<'asc' | 'desc'>('asc')

  function errorMessage(error: AppError): string {
    switch (error.code) {
      case AppErrorCodeSchema.enum.not_found:  return t('error.notFound')
      case AppErrorCodeSchema.enum.forbidden:  return t('error.forbidden')
      case AppErrorCodeSchema.enum.conflict:   return t('error.conflict')
      case AppErrorCodeSchema.enum.network:    return t('error.network')
      default:                                 return t('error.unknown')
    }
  }

  function handleTourSort(field: GroupTourSortField) {
    const next = nextGroupTourSort({ field: tourSortField, dir: tourSortDir }, field)
    setTourSortField(next.field)
    setTourSortDir(next.dir)
  }

  useEffect(() => {
    if (!ready) return
    fetchGroup(id).then((result) => {
      if (result.ok) setGroup(result.data)
      else setFetchError(errorMessage(result.error))
    })
  }, [ready, id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready) return null

  if (fetchError) {
    return (
      <AppShell variant="admin">
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{fetchError}</p>
      </AppShell>
    )
  }

  if (!group) return null

  const sortedTours = sortGroupTours(group.tours, tourSortField, tourSortDir)

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex items-center justify-between">
        <Link href={routes.adminGroups(locale)} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('back')}
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link href={routes.adminGroupEdit(locale, group.id)}>{t('edit')}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={routes.adminTourNew(locale, group.id)}>{t('newTour')}</Link>
          </Button>
        </div>
      </div>

      <div className="mb-6 rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-xl font-semibold">{group.name}</h1>
          <Badge className={groupTypeBadgeClass[group.type]}>{getGroupTypeLabel(tGroupType, group.type)}</Badge>
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
              <dd className="font-medium"><MarkdownText>{group.notes}</MarkdownText></dd>
            </div>
          )}
        </dl>
      </div>

      <h2 className="mb-3 text-base font-semibold">{t('tours')}</h2>
      {group.tours.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noTours')}</p>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {sortedTours.map((tour) => (
              <div
                key={tour.id}
                className="cursor-pointer rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
                onClick={() => router.push(routes.adminTourDetail(locale, tour.id))}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="tabular-nums text-sm font-medium">{formatDate(tour.tourDate)}</span>
                  <Badge variant={tourStatusBadgeVariant[tour.status]}>
                    {getTourStatusLabel(tTourStatus, tour.status)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{tour.location}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('capacity')} {tour.sessions.reduce((s, x) => s + x.capacity, 0)}</p>
              </div>
            ))}
          </div>

          {/* sm+: scrollable table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  {([
                    { field: 'tourDate' as const, label: t('tourDate') },
                    { field: 'status' as const, label: t('status') },
                    { field: 'location' as const, label: t('location') },
                    { field: 'capacity' as const, label: t('capacity') },
                  ]).map(({ field, label }) => (
                    <TableHead key={field} className="whitespace-nowrap">
                      <button
                        className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                        onClick={() => handleTourSort(field)}
                      >
                        {label}
                        <SortIcon active={tourSortField === field} dir={tourSortDir} />
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTours.map((tour) => (
                  <TableRow
                    key={tour.id}
                    className="cursor-pointer"
                    onClick={() => router.push(routes.adminTourDetail(locale, tour.id))}
                  >
                    <TableCell className="tabular-nums">{formatDate(tour.tourDate)}</TableCell>
                    <TableCell>
                      <Badge variant={tourStatusBadgeVariant[tour.status]}>
                        {getTourStatusLabel(tTourStatus, tour.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{tour.location}</TableCell>
                    <TableCell>{tour.sessions.reduce((s, x) => s + x.capacity, 0)}</TableCell>
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
