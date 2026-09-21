'use client'

import { Fragment, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { AdminSelfEvaluationResponse } from '@peace-buddy/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon } from '@/components/sort-icon'
import { listAdminSelfEvaluations } from '../../evaluations/admin.evaluation'
import { formatDate } from '@/lib/format-date'

type SortField = 'overallRating' | 'submittedAt'
type SortDir = 'asc' | 'desc'

function sortSelfEvals(
  evals: AdminSelfEvaluationResponse[],
  field: SortField,
  dir: SortDir,
): AdminSelfEvaluationResponse[] {
  return [...evals].sort((a, b) => {
    let cmp = 0
    if (field === 'overallRating') cmp = (a.overallRating ?? 0) - (b.overallRating ?? 0)
    else cmp = a.createdAt.localeCompare(b.createdAt)
    return dir === 'asc' ? cmp : -cmp
  })
}

interface BuddySelfEvaluationsProps {
  buddyId: string
}

export function BuddySelfEvaluations({ buddyId }: BuddySelfEvaluationsProps) {
  const t = useTranslations('adminEvaluations')
  const [evals, setEvals] = useState<AdminSelfEvaluationResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('submittedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    listAdminSelfEvaluations({ buddyId }).then((result) => {
      if (!result.ok) {
        setLoadError(t('error.unknown'))
      } else {
        setEvals(result.data)
      }
      setLoading(false)
    })
  }, [buddyId]) // eslint-disable-line react-hooks/exhaustive-deps

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
    return <p className="rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">{loadError}</p>
  }

  if (evals.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('empty.noSelfEvaluations')}</p>
  }

  const sorted = sortSelfEvals(evals, sortField, sortDir)

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <button
                className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                onClick={() => handleSort('overallRating')}
              >
                {t('table.overallRating')}
                <SortIcon active={sortField === 'overallRating'} dir={sortDir} />
              </button>
            </TableHead>
            <TableHead>
              <button
                className="inline-flex items-center font-medium transition-colors hover:text-foreground"
                onClick={() => handleSort('submittedAt')}
              >
                {t('table.submittedAt')}
                <SortIcon active={sortField === 'submittedAt'} dir={sortDir} />
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((ev) => (
            <Fragment key={ev.id}>
              <TableRow
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
              >
                <TableCell>{ev.overallRating ?? '—'}</TableCell>
                <TableCell className="tabular-nums text-sm text-muted-foreground">
                  {formatDate(ev.createdAt)}
                </TableCell>
              </TableRow>
              {expandedId === ev.id && (
                <TableRow key={`${ev.id}-detail`}>
                  <TableCell colSpan={2}>
                    <dl className="grid grid-cols-2 gap-2 text-sm py-2">
                      {(
                        [
                          [t('fields.communication'), ev.communication, ev.communicationNote],
                          [t('fields.groupEngagement'), ev.groupEngagement, ev.groupEngagementNote],
                          [t('fields.memory'), ev.memory, ev.memoryNote],
                          [t('fields.knowledge'), ev.knowledge, ev.knowledgeNote],
                          [t('fields.dedication'), ev.dedication, ev.dedicationNote],
                          [t('fields.dialogue'), ev.dialogue, ev.dialogueNote],
                          [t('fields.adaptability'), ev.adaptability, ev.adaptabilityNote],
                          [t('fields.confidence'), ev.confidence, ev.confidenceNote],
                        ] as [string, number | null, string | null][]
                      ).map(([label, score, note]) => (
                        <div key={label}>
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd>
                            {score ?? '—'}{note ? ` — ${note}` : ''}
                          </dd>
                        </div>
                      ))}
                      {ev.emotionNote && (
                        <div className="col-span-2">
                          <dt className="text-muted-foreground">{t('fields.emotionNote')}</dt>
                          <dd>{ev.emotionNote}</dd>
                        </div>
                      )}
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
