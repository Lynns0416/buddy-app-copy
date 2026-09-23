'use client'

import { Fragment, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { REFLECTION_PROMPTS } from '@peace-buddy/types'
import type { AdminTourReflectionResponse } from '@peace-buddy/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon } from '@/components/sort-icon'
import { listAdminReflections } from '../../evaluations/admin.evaluation'
import { formatDate } from '@/lib/format-date'

type SortField = 'tourDate' | 'session' | 'submittedAt'
type SortDir = 'asc' | 'desc'

function sortReflections(
  reflections: AdminTourReflectionResponse[],
  field: SortField,
  dir: SortDir,
): AdminTourReflectionResponse[] {
  return [...reflections].sort((a, b) => {
    let cmp = 0
    if (field === 'tourDate') cmp = a.tourDate.localeCompare(b.tourDate)
    else if (field === 'session') cmp = a.sessionOrder - b.sessionOrder
    else cmp = a.createdAt.localeCompare(b.createdAt)
    return dir === 'asc' ? cmp : -cmp
  })
}

interface BuddyReflectionsProps {
  buddyId: string
}

export function BuddyReflections({ buddyId }: BuddyReflectionsProps) {
  const t = useTranslations('adminEvaluations')
  const tTours = useTranslations('adminTours')
  const [reflections, setReflections] = useState<AdminTourReflectionResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [sortField, setSortField] = useState<SortField>('submittedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    listAdminReflections({ buddyId }).then((result) => {
      if (!result.ok) {
        setLoadError(true)
      } else {
        setReflections(result.data)
      }
      setLoading(false)
    })
  }, [buddyId])

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  if (loading) return null

  if (loadError) {
    return <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{t('error.unknown')}</p>
  }

  if (reflections.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('empty.noReflections')}</p>
  }

  const sorted = sortReflections(reflections, sortField, sortDir)

  const columns: { field: SortField; label: string }[] = [
    { field: 'tourDate', label: t('table.tourDate') },
    { field: 'session', label: t('table.session') },
    { field: 'submittedAt', label: t('table.submittedAt') },
  ]

  return (
    <div className="rounded-lg border bg-card">
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((reflection) => (
            <Fragment key={reflection.id}>
              <TableRow
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedId(expandedId === reflection.id ? null : reflection.id)}
              >
                <TableCell className="tabular-nums">{formatDate(reflection.tourDate)}</TableCell>
                <TableCell>
                  {reflection.sessionLabel ?? tTours(`session.defaultLabel.${reflection.sessionOrder}`)}
                </TableCell>
                <TableCell className="tabular-nums text-sm text-muted-foreground">
                  {formatDate(reflection.createdAt)}
                </TableCell>
              </TableRow>
              {expandedId === reflection.id && (
                <TableRow key={`${reflection.id}-detail`}>
                  <TableCell colSpan={columns.length}>
                    <dl className="space-y-2 py-2 text-sm">
                      {REFLECTION_PROMPTS.filter((key) => reflection[key]).map((key) => (
                        <div key={key}>
                          <dt className="text-muted-foreground">{t(`reflectionPrompts.${key}`)}</dt>
                          <dd className="whitespace-pre-wrap">{reflection[key]}</dd>
                        </div>
                      ))}
                    </dl>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
