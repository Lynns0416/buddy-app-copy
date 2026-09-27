'use client'

import { useLocale, useTranslations } from 'next-intl'
import { GroupTypeSchema, type GroupType, type PlaceSummary } from '@peace-buddy/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getGroupTypeLabel } from '@/lib/status-display'
import { placeName } from '@/lib/place-names'

// The scope every stats page sends to the API: tours inside it are the only
// ones counted (PRD §11.4).
export type StatsScope = {
  from: string
  to: string
  groupType: GroupType | ''
  placeId: string
}

export const emptyStatsScope: StatsScope = { from: '', to: '', groupType: '', placeId: '' }

export const statsSelectClass =
  'border-input bg-background flex h-9 rounded-md border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

type Props<S extends StatsScope> = {
  scope: S
  onScopeChange: (scope: S) => void
  // What the page counts inside the scope; each page words it for itself.
  hint: string
  places: PlaceSummary[]
  children?: React.ReactNode
}

export function StatsScopeFields<S extends StatsScope>({ scope, onScopeChange, hint, places, children }: Props<S>) {
  const t = useTranslations('adminStats')
  const tGroupType = useTranslations('groupType')
  const locale = useLocale()

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-medium text-muted-foreground">{t('scope.title')}</legend>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="statsFrom" className="text-xs text-muted-foreground">{t('scope.from')}</Label>
          <Input
            id="statsFrom"
            type="date"
            className="w-auto"
            value={scope.from}
            max={scope.to || undefined}
            onChange={(e) => onScopeChange({ ...scope, from: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="statsTo" className="text-xs text-muted-foreground">{t('scope.to')}</Label>
          <Input
            id="statsTo"
            type="date"
            className="w-auto"
            value={scope.to}
            min={scope.from || undefined}
            onChange={(e) => onScopeChange({ ...scope, to: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="statsGroupType" className="text-xs text-muted-foreground">{t('scope.groupType')}</Label>
          <select
            id="statsGroupType"
            className={statsSelectClass}
            value={scope.groupType}
            onChange={(e) => {
              const value = e.target.value
              onScopeChange({ ...scope, groupType: value === '' ? '' : GroupTypeSchema.parse(value) })
            }}
          >
            <option value="">{t('scope.all')}</option>
            {GroupTypeSchema.options.map((groupType) => (
              <option key={groupType} value={groupType}>{getGroupTypeLabel(tGroupType, groupType)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="statsPlace" className="text-xs text-muted-foreground">{t('scope.place')}</Label>
          <select
            id="statsPlace"
            className={statsSelectClass}
            value={scope.placeId}
            onChange={(e) => onScopeChange({ ...scope, placeId: e.target.value })}
          >
            <option value="">{t('scope.all')}</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>{placeName(place, locale)}</option>
            ))}
          </select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onScopeChange({ ...scope, from: '', to: '', groupType: '', placeId: '' })}
        >
          {t('scope.allTime')}
        </Button>
      </div>
      {children}
    </fieldset>
  )
}
