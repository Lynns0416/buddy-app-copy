'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import type { PlaceDetailResponse, AppError } from '@peace-buddy/types'
import { AppErrorCodeSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon } from '@/components/sort-icon'
import { fetchPlace, createSpot, updateSpot, sortPlaces, nextPlaceSort, type PlaceSortField } from '../admin.place'
import { PlaceRowForm } from '../_components/place-row-form'

export default function AdminPlaceDetailPage() {
  const { ready, locale } = useAdminGuard()
  const { id } = useParams<{ id: string }>()
  const t = useTranslations('adminPlaces')
  const [place, setPlace] = useState<PlaceDetailResponse | null>(null)
  // Held untranslated so the load effect depends on nothing but `ready` and `id`.
  const [fetchError, setFetchError] = useState<AppError | null>(null)
  const [sortField, setSortField] = useState<PlaceSortField>('sortOrder')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [showNewForm, setShowNewForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

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
    fetchPlace(id).then((result) => {
      if (result.ok) setPlace(result.data)
      else setFetchError(result.error)
    })
  }, [ready, id])

  function handleSort(field: PlaceSortField) {
    const next = nextPlaceSort({ field: sortField, dir: sortDir }, field)
    setSortField(next.field)
    setSortDir(next.dir)
  }

  if (!ready) return null

  if (fetchError) {
    return (
      <AppShell variant="admin">
        <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{errorMessage(fetchError)}</p>
      </AppShell>
    )
  }

  if (!place) return null

  const sortedSpots = sortPlaces(place.spots, sortField, sortDir)
  const columns: { field: PlaceSortField; label: string }[] = [
    { field: 'nameJa', label: t('nameJa') },
    { field: 'nameEn', label: t('nameEn') },
    { field: 'sortOrder', label: t('sortOrder') },
    { field: 'active', label: t('active') },
  ]

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex items-center gap-3">
        <Link href={routes.adminPlaces(locale)} className="text-sm text-muted-foreground hover:text-foreground">
          ← {t('back')}
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{place.nameJa} / {place.nameEn}</h1>
          {!place.active && <Badge variant="secondary" className="mt-1">{t('inactive')}</Badge>}
        </div>
        <Button size="sm" onClick={() => { setShowNewForm(true); setEditingId(null) }}>
          {t('newSpot')}
        </Button>
      </div>

      <h2 className="mb-3 text-base font-semibold">{t('spotsHeading')}</h2>

      {showNewForm && (
        <div className="mb-4">
          <PlaceRowForm
            onCancel={() => setShowNewForm(false)}
            onSubmit={async (values) => {
              const result = await createSpot(place.id, values)
              if (result.ok) {
                setPlace({ ...place, spots: [...place.spots, result.data] })
                setShowNewForm(false)
              } else {
                throw new Error(errorMessage(result.error))
              }
            }}
          />
        </div>
      )}

      {sortedSpots.length === 0 && !showNewForm ? (
        <p className="text-sm text-muted-foreground">{t('noSpots')}</p>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(({ field, label }) => (
                  <TableHead key={field}>
                    <button
                      className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                      onClick={() => handleSort(field)}
                    >
                      {label}
                      <SortIcon active={sortField === field} dir={sortDir} />
                    </button>
                  </TableHead>
                ))}
                <TableHead className="w-px" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSpots.map((spot) =>
                editingId === spot.id ? (
                  <TableRow key={spot.id} className="hover:bg-transparent">
                    <TableCell colSpan={columns.length + 1} className="p-2">
                      <PlaceRowForm
                        initial={spot}
                        onCancel={() => setEditingId(null)}
                        onSubmit={async (values) => {
                          const result = await updateSpot(place.id, spot.id, values)
                          if (result.ok) {
                            setPlace({
                              ...place,
                              spots: place.spots.map((s) => (s.id === spot.id ? result.data : s)),
                            })
                            setEditingId(null)
                          } else {
                            throw new Error(errorMessage(result.error))
                          }
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={spot.id}>
                    <TableCell className="font-medium">{spot.nameJa}</TableCell>
                    <TableCell>{spot.nameEn}</TableCell>
                    <TableCell>{spot.sortOrder}</TableCell>
                    <TableCell>
                      <Badge variant={spot.active ? 'default' : 'secondary'}>
                        {spot.active ? t('active') : t('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditingId(spot.id); setShowNewForm(false) }}
                      >
                        {t('edit')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  )
}
