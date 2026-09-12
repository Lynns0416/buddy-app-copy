'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { ExternalLink } from 'lucide-react'
import type { GroupResponse } from '@peace-buddy/types'
import { Badge } from '@/components/ui/badge'
import { routes } from '@/lib/routes'
import { getGroupTypeLabel, groupTypeBadgeClass } from '@/lib/status-display'

type Props = {
  group: GroupResponse | null
}

/**
 * Identifying detail for the group picked on the tour form. The link opens in a
 * new tab so the in-progress form is not lost.
 */
export function GroupSummary({ group }: Props) {
  const locale = useLocale()
  const t = useTranslations('adminGroups')
  const tTours = useTranslations('adminTours')
  const tGroupType = useTranslations('groupType')

  if (!group) return null

  const details = [
    { field: 'contactName', value: group.contactName },
    { field: 'contactEmail', value: group.contactEmail },
    { field: 'contactPhone', value: group.contactPhone },
    { field: 'notes', value: group.notes },
  ].filter((detail) => detail.value)

  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{group.name}</span>
          <Badge className={groupTypeBadgeClass[group.type]}>
            {getGroupTypeLabel(tGroupType, group.type)}
          </Badge>
        </div>
        <Link
          href={routes.adminGroupDetail(locale, group.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
        >
          {tTours('groupSummary.viewGroup')}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      {details.length > 0 && (
        <dl className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {details.map((detail) => (
            <div key={detail.field} className="flex gap-1">
              <dt className="text-muted-foreground">{t(detail.field)}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
