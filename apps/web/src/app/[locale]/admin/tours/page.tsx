'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import { apiClient } from '@/lib/api-client'
import type { AdminTourSummaryResponse, TourStatus } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon, type SortDir } from '@/components/sort-icon'

const STATUS_VARIANT: Record<TourStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  published: 'default',
  cancelled: 'destructive',
  completed: 'secondary',
}

type SortField = 'tourDate' | 'group' | 'location' | 'capacity' | 'confirmedCount' | 'status'

export default function AdminToursPage() {
  const { ready, locale } = useAdminGuard()
  const t = useTranslations('adminTours')
  const [tours, setTours] = useState<AdminTourSummaryResponse[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('tourDate')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(() => {
    if (!ready) return
    apiClient.listAdminTours()
      .then(setTours)
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

  const sorted = [...tours].sort((a, b) => {
    let cmp = 0
    switch (sortField) {
      case 'tourDate': cmp = a.tourDate.localeCompare(b.tourDate); break
      case 'group': cmp = a.group.name.localeCompare(b.group.name, 'ja'); break
      case 'location': cmp = a.location.localeCompare(b.location, 'ja'); break
      case 'capacity': cmp = a.capacity - b.capacity; break
      case 'confirmedCount': cmp = a.confirmedCount - b.confirmedCount; break
      case 'status': cmp = a.status.localeCompare(b.status); break
    }
    return sortDir === 'asc' ? cmp : -cmp
  })

  if (!ready) return null

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <Button asChild size="sm">
          <Link href={routes.adminTourNew(locale)}>{t('newTour')}</Link>
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
            {sorted.map((tour) => (
              <div key={tour.id} className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="tabular-nums text-sm font-medium">{tour.tourDate.slice(0, 10)}</span>
                  <Badge variant={STATUS_VARIANT[tour.status]}>
                    {t(`status${tour.status.charAt(0).toUpperCase()}${tour.status.slice(1)}` as 'statusDraft')}
                  </Badge>
                </div>
                <p className="mb-2 font-medium">{tour.group.name}</p>
                <p className="mb-3 text-sm text-muted-foreground">{tour.location}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {t('confirmedCount')} {tour.confirmedCount} / {tour.capacity}
                  </span>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={routes.adminTourDetail(locale, tour.id)}>{t('edit')}</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* sm+: scrollable table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border bg-card">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  {([
                    { field: 'tourDate', label: t('tourDate') },
                    { field: 'group', label: t('group') },
                    { field: 'location', label: t('location') },
                    { field: 'capacity', label: t('capacity') },
                    { field: 'confirmedCount', label: t('confirmedCount') },
                    { field: 'status', label: t('status') },
                  ] as { field: SortField; label: string }[]).map(({ field, label }) => (
                    <TableHead key={field} className="whitespace-nowrap">
                      <button
                        className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                        onClick={() => handleSort(field)}
                      >
                        {label}
                        <SortIcon active={sortField === field} dir={sortDir} />
                      </button>
                    </TableHead>
                  ))}
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((tour) => (
                  <TableRow key={tour.id}>
                    <TableCell className="tabular-nums">{tour.tourDate.slice(0, 10)}</TableCell>
                    <TableCell>{tour.group.name}</TableCell>
                    <TableCell>{tour.location}</TableCell>
                    <TableCell>{tour.capacity}</TableCell>
                    <TableCell>{tour.confirmedCount}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[tour.status]}>
                        {t(`status${tour.status.charAt(0).toUpperCase()}${tour.status.slice(1)}` as 'statusDraft')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={routes.adminTourDetail(locale, tour.id)}>{t('edit')}</Link>
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
