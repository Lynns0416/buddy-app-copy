'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { AdminAnnouncementResponse } from '@peace-buddy/types'
import { AnnouncementAudienceSchema, getTodayJst } from '@peace-buddy/types'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { routes } from '@/lib/routes'
import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon, type SortDir } from '@/components/sort-icon'
import { formatDate } from '@/lib/format-date'
import { getBuddyStatusLabel, getBuddyTierLabel } from '@/lib/status-display'
import { ASC } from '@/lib/constants'
import {
  type AnnouncementSortField,
  type AnnouncementState,
  announcementState,
  deleteAnnouncement,
  fetchAnnouncements,
  moveAnnouncement,
  nextAnnouncementSort,
  reorderAnnouncements,
  sortAnnouncements,
} from './admin.announcement'
import { useAnnouncementErrorMessage } from './use-announcement-error'

const stateBadgeVariant: Record<AnnouncementState, 'default' | 'secondary' | 'outline'> = {
  showing: 'default',
  scheduled: 'secondary',
  ended: 'outline',
}

function useAudienceLabel() {
  const t = useTranslations('adminAnnouncements')
  const tStatus = useTranslations('buddyStatus')
  const tTier = useTranslations('buddyTier')
  return (a: AdminAnnouncementResponse): string => {
    if (a.audience === AnnouncementAudienceSchema.enum.selected) return t('audienceSelected', { count: a.buddies.length })
    const parts = [
      a.statuses.length > 0 ? a.statuses.map((s) => getBuddyStatusLabel(tStatus, s)).join('・') : null,
      a.tiers.length > 0 ? a.tiers.map((tier) => getBuddyTierLabel(tTier, tier)).join('・') : null,
    ].filter((p): p is string => p !== null)
    return parts.length > 0 ? parts.join(' × ') : t('audienceAll')
  }
}

export default function AdminAnnouncementsPage() {
  const { ready, locale } = useAdminGuard()
  const t = useTranslations('adminAnnouncements')
  const errorMessage = useAnnouncementErrorMessage()
  const audienceLabel = useAudienceLabel()
  const [announcements, setAnnouncements] = useState<AdminAnnouncementResponse[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sortField, setSortField] = useState<AnnouncementSortField>('position')
  const [sortDir, setSortDir] = useState<SortDir>(ASC)

  useEffect(() => {
    if (!ready) return
    void fetchAnnouncements().then((result) => {
      if (result.ok) setAnnouncements(result.data)
      else setError(errorMessage(result.error))
    })
  }, [ready, errorMessage])

  const today = getTodayJst()
  const list = announcements ?? []
  const ordered = sortAnnouncements(list, 'position', ASC, { today, audienceLabel })
  const sorted = sortAnnouncements(list, sortField, sortDir, { today, audienceLabel })
  // Moving only makes sense while the list shows the members' order.
  const canMove = sortField === 'position' && sortDir === ASC && !busy

  function handleSort(field: AnnouncementSortField) {
    const next = nextAnnouncementSort({ field: sortField, dir: sortDir }, field)
    setSortField(next.field)
    setSortDir(next.dir)
  }

  async function move(id: string, delta: -1 | 1) {
    const ids = moveAnnouncement(ordered, id, delta)
    if (!ids) return
    setBusy(true)
    setError(null)
    const result = await reorderAnnouncements(ids)
    if (result.ok) setAnnouncements(result.data)
    else setError(errorMessage(result.error))
    setBusy(false)
  }

  async function remove(a: AdminAnnouncementResponse) {
    if (!window.confirm(t('confirmDelete', { title: a.titleJa }))) return
    setBusy(true)
    setError(null)
    const result = await deleteAnnouncement(a.id)
    if (result.ok) setAnnouncements((prev) => (prev ?? []).filter((x) => x.id !== a.id))
    else setError(errorMessage(result.error))
    setBusy(false)
  }

  if (!ready) return null

  const columns: Array<{ field: AnnouncementSortField; label: string }> = [
    { field: 'position', label: t('column.position') },
    { field: 'title', label: t('column.title') },
    { field: 'audience', label: t('column.audience') },
    { field: 'period', label: t('column.period') },
    { field: 'state', label: t('column.state') },
  ]

  const moveButtons = (a: AdminAnnouncementResponse) => {
    const index = ordered.findIndex((x) => x.id === a.id)
    return (
      <div className="inline-flex items-center gap-1">
        <span className="w-5 text-right tabular-nums text-muted-foreground">{index + 1}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          aria-label={t('moveUp', { title: a.titleJa })}
          disabled={!canMove || index === 0}
          onClick={() => void move(a.id, -1)}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          aria-label={t('moveDown', { title: a.titleJa })}
          disabled={!canMove || index === ordered.length - 1}
          onClick={() => void move(a.id, 1)}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  const period = (a: AdminAnnouncementResponse) => `${formatDate(a.startDate)} – ${formatDate(a.endDate)}`
  const tourCell = (a: AdminAnnouncementResponse) =>
    a.tour ? (
      <Link href={routes.adminTourDetail(locale, a.tour.id)} className="text-primary hover:underline">
        {formatDate(a.tour.tourDate)} {a.tour.groupName}
      </Link>
    ) : (
      <span className="text-muted-foreground">—</span>
    )
  const author = (a: AdminAnnouncementResponse) => (
    <div className="text-xs text-muted-foreground">
      <div>{a.createdBy.name}</div>
      {a.updatedAt !== a.createdAt && (
        <div>
          {t('updatedBy', { name: a.updatedBy.name, date: formatDate(a.updatedAt) })}
        </div>
      )}
    </div>
  )
  const stateBadge = (a: AdminAnnouncementResponse) => {
    const state = announcementState(a, today)
    return <Badge variant={stateBadgeVariant[state]} className="shrink-0 whitespace-nowrap">{t(`state.${state}`)}</Badge>
  }
  const actions = (a: AdminAnnouncementResponse) => (
    <div className="flex items-center justify-end gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={routes.adminAnnouncementEdit(locale, a.id)}>{t('edit')}</Link>
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void remove(a)}>
        {t('delete')}
      </Button>
    </div>
  )

  return (
    <AppShell variant="admin">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <Button asChild size="sm">
          <Link href={routes.adminAnnouncementNew(locale)}>{t('new')}</Link>
        </Button>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">{t('intro')}</p>

      {error && <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}

      {announcements === null ? null : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            <div className="flex flex-wrap gap-2">
              {columns.map(({ field, label }) => (
                <button
                  key={field}
                  type="button"
                  className="inline-flex items-center gap-0.5 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handleSort(field)}
                >
                  {label}
                  <SortIcon active={sortField === field} dir={sortDir} />
                </button>
              ))}
            </div>
            {sorted.map((a) => (
              <div key={a.id} className="flex flex-col gap-2 rounded-lg border bg-card p-4 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{a.titleJa}</span>
                  {stateBadge(a)}
                </div>
                <div className="text-muted-foreground">{audienceLabel(a)}</div>
                <div className="tabular-nums text-muted-foreground">{period(a)}</div>
                {a.tour && <div>{tourCell(a)}</div>}
                {author(a)}
                <div className="flex items-center justify-between gap-2">
                  {moveButtons(a)}
                  {actions(a)}
                </div>
              </div>
            ))}
          </div>

          {/* sm+: table */}
          <div className="hidden overflow-x-auto rounded-lg border bg-card lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map(({ field, label }) => (
                    <TableHead key={field}>
                      <button
                        type="button"
                        className="inline-flex items-center whitespace-nowrap font-medium transition-colors hover:text-foreground"
                        onClick={() => handleSort(field)}
                      >
                        {label}
                        <SortIcon active={sortField === field} dir={sortDir} />
                      </button>
                    </TableHead>
                  ))}
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap">{moveButtons(a)}</TableCell>
                    <TableCell className="min-w-48">
                      <div className="font-medium">{a.titleJa}</div>
                      {a.tour && <div className="text-xs">{tourCell(a)}</div>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{audienceLabel(a)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="tabular-nums">{period(a)}</div>
                      {author(a)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{stateBadge(a)}</TableCell>
                    <TableCell className="whitespace-nowrap">{actions(a)}</TableCell>
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
