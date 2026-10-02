'use client'

import { useTranslations } from 'next-intl'
import { MemberTypeSchema, type MemberType } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SuggestInput } from '@/components/suggest-input'
import { formatDate } from '@/lib/format-date'
import { MONTH_STATUSES, daysOf, emptyMonthFilters, isMonthFilterActive, type MonthFilters, type MonthStatus } from '@/lib/attendance'
import { memberTypeLabelKey } from '../../buddies/admin.buddy'

type Props = {
  filters: MonthFilters
  onChange: (filters: MonthFilters) => void
  // `YYYY-MM` shown; the date range only picks days inside it.
  month: string
  buddyNames: string[]
  groupNames: string[]
  resultCount: number
  totalCount: number
}

// Radix Select takes no empty value, so "no bound" has its own.
const ANY_DAY = 'any'

function DaySelect({ id, label, anyLabel, days, value, onChange }: {
  id: string
  label: string
  anyLabel: string
  days: string[]
  value: string
  onChange: (day: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Select value={value || ANY_DAY} onValueChange={(v) => onChange(v === ANY_DAY ? '' : v)}>
        <SelectTrigger id={id} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY_DAY}>{anyLabel}</SelectItem>
          {days.map((d) => (
            <SelectItem key={d} value={d}>{formatDate(d)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}

export function AttendanceFilterBar({ filters, onChange, month, buddyNames, groupNames, resultCount, totalCount }: Props) {
  const t = useTranslations('adminAttendance.filters')
  const tBuddies = useTranslations('adminBuddies')
  const days = daysOf(month)

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <SuggestInput
          suggestions={buddyNames}
          aria-label={t('buddyLabel')}
          placeholder={t('buddyPlaceholder')}
          value={filters.buddy}
          onChange={(buddy) => onChange({ ...filters, buddy })}
        />
        <SuggestInput
          suggestions={groupNames}
          aria-label={t('tourLabel')}
          placeholder={t('tourPlaceholder')}
          value={filters.tour}
          onChange={(tour) => onChange({ ...filters, tour })}
        />
      </div>

      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-muted-foreground">{t('memberType')}</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {MemberTypeSchema.options.map((m: MemberType) => (
              <label key={m} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={filters.memberTypes.includes(m)}
                  onChange={() => onChange({ ...filters, memberTypes: toggle(filters.memberTypes, m) })}
                />
                {tBuddies(memberTypeLabelKey(m) as Parameters<typeof tBuddies>[0])}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium text-muted-foreground">{t('status')}</legend>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {MONTH_STATUSES.map((s: MonthStatus) => (
              <label key={s} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={filters.statuses.includes(s)}
                  onChange={() => onChange({ ...filters, statuses: toggle(filters.statuses, s) })}
                />
                {t(`statusOption.${s}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-end gap-2">
          <DaySelect
            id="attendanceFrom"
            label={t('from')}
            anyLabel={t('anyDay')}
            days={days.filter((d) => !filters.to || d <= filters.to)}
            value={filters.from}
            onChange={(from) => onChange({ ...filters, from })}
          />
          <span className="pb-2">–</span>
          <DaySelect
            id="attendanceTo"
            label={t('to')}
            anyLabel={t('anyDay')}
            days={days.filter((d) => !filters.from || d >= filters.from)}
            value={filters.to}
            onChange={(to) => onChange({ ...filters, to })}
          />
        </div>
      </div>

      {isMonthFilterActive(filters) && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{t('resultCount', { count: resultCount, total: totalCount })}</p>
          <Button variant="outline" size="sm" onClick={() => onChange(emptyMonthFilters)}>
            {t('clearAll')}
          </Button>
        </div>
      )}
    </div>
  )
}
