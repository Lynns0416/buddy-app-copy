'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import type { PlaceResponse, AppError } from '@peace-buddy/types'
import { AppErrorCodeSchema } from '@peace-buddy/types'
import { AppShell } from '@/components/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon } from '@/components/sort-icon'
import { fetchPlaces, createPlace, updatePlace, sortPlaces, nextPlaceSort, type PlaceSortField } from './admin.place'
import { PlaceRowForm } from './_components/place-row-form'

export default function AdminPlacesPage() {
  const { ready, locale } = useAdminGuard()
  const router = useRouter()
  const t = useTranslations('adminPlaces')
  const [places, setPlaces] = useState<PlaceResponse[]>([])
  // Held untranslated so the load effect depends on nothing but `ready`.
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
    fetchPlaces().then((result) => {
      if (result.ok) setPlaces(result.data)
      else setFetchError(result.error)
    })
  }, [ready])

  function handleSort(field: PlaceSortField) {
    const next = nextPlaceSort({ field: sortField, dir: sortDir }, field)
    setSortField(next.field)
    setSortDir(next.dir)
  }

  const sorted = sortPlaces(places, sortField, sortDir)

  const columns: { field: PlaceSortField; label: string }[] = [
    { field: 'nameJa', label: t('nameJa') },
    { field: 'nameEn', label: t('nameEn') },
    { field: 'sortOrder', label: t('sortOrder') },
    { field: 'active', label: t('active') },
  ]

  if (!ready) return null

  return (
    <AppShell variant="admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <Button size="sm" onClick={() => { setShowNewForm(true); setEditingId(null) }}>
          {t('newPlace')}
        </Button>
      </div>

      {fetchError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{errorMessage(fetchError)}</p>
      )}

      {showNewForm && (
        <div className="mb-4">
          <PlaceRowForm
            onCancel={() => setShowNewForm(false)}
            onSubmit={async (values) => {
              const result = await createPlace(values)
              if (result.ok) {
                setPlaces((prev) => [...prev, result.data])
                setShowNewForm(false)
              } else {
                throw new Error(errorMessage(result.error))
              }
            }}
          />
        </div>
      )}

      {sorted.length === 0 && !showNewForm ? (
        <p className="text-sm text-muted-foreground">{t('noResults')}</p>
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
              {sorted.map((place) =>
                editingId === place.id ? (
                  <TableRow key={place.id} className="hover:bg-transparent">
                    <TableCell colSpan={columns.length + 1} className="p-2">
                      <PlaceRowForm
                        initial={place}
                        onCancel={() => setEditingId(null)}
                        onSubmit={async (values) => {
                          const result = await updatePlace(place.id, values)
                          if (result.ok) {
                            setPlaces((prev) => prev.map((p) => (p.id === place.id ? result.data : p)))
                            setEditingId(null)
                          } else {
                            throw new Error(errorMessage(result.error))
                          }
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow
                    key={place.id}
                    className="cursor-pointer"
                    onClick={() => router.push(routes.adminPlaceDetail(locale, place.id))}
                  >
                    <TableCell className="font-medium">{place.nameJa}</TableCell>
                    <TableCell>{place.nameEn}</TableCell>
                    <TableCell>{place.sortOrder}</TableCell>
                    <TableCell>
                      <Badge variant={place.active ? 'default' : 'secondary'}>
                        {place.active ? t('active') : t('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditingId(place.id); setShowNewForm(false) }}
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
