'use client'

import { useTranslations } from 'next-intl'
import { TourStatusSchema, GroupTypeSchema, type TourStatus, type GroupType } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { SuggestInput } from '@/components/suggest-input'
import { Label } from '@/components/ui/label'
import { getTourStatusLabel, getGroupTypeLabel } from '@/lib/status-display'
import { TourDateRangeSchema, emptyTourFilters, isTourFilterActive, type TourFilters } from '../admin.tour'

type Props = {
  filters: TourFilters
  onChange: (filters: TourFilters) => void
  // Group and place names the search can match.
  suggestions: string[]
  resultCount: number
  totalCount: number
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}

export function TourFilterBar({ filters, onChange, suggestions, resultCount, totalCount }: Props) {
  const t = useTranslations('adminTours')
  const tTourStatus = useTranslations('tourStatus')
  const tGroupType = useTranslations('groupType')
  const active = isTourFilterActive(filters)

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border bg-card p-4">
      <SuggestInput
        id="tourSearch"
        suggestions={suggestions}
        aria-label={t('search.label')}
        placeholder={t('search.placeholder')}
        value={filters.search}
        onChange={(search) => onChange({ ...filters, search })}
      />

      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-muted-foreground">{t('filters.status')}</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {TourStatusSchema.options.map((status: TourStatus) => (
              <label key={status} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={filters.statuses.includes(status)}
                  onChange={() => onChange({ ...filters, statuses: toggle(filters.statuses, status) })}
                />
                {getTourStatusLabel(tTourStatus, status)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-muted-foreground">{t('filters.groupType')}</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {GroupTypeSchema.options.map((groupType: GroupType) => (
              <label key={groupType} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={filters.groupTypes.includes(groupType)}
                  onChange={() => onChange({ ...filters, groupTypes: toggle(filters.groupTypes, groupType) })}
                />
                {getGroupTypeLabel(tGroupType, groupType)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tourDateRange" className="text-xs font-medium text-muted-foreground">
            {t('filters.dateRange')}
          </Label>
          <select
            id="tourDateRange"
            className="border-input bg-background flex h-9 rounded-md border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={filters.dateRange}
            onChange={(e) => onChange({ ...filters, dateRange: TourDateRangeSchema.parse(e.target.value) })}
          >
            {TourDateRangeSchema.options.map((range) => (
              <option key={range} value={range}>{t(`filters.dateRangeOption.${range}`)}</option>
            ))}
          </select>
        </div>
      </div>

      {active && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {t('filters.resultCount', { count: resultCount, total: totalCount })}
          </p>
          <Button variant="outline" size="sm" onClick={() => onChange(emptyTourFilters)}>
            {t('filters.clearAll')}
          </Button>
        </div>
      )}
    </div>
  )
}
