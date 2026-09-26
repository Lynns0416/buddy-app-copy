'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { STAT_GROUPS, type StatColumn } from '../admin.buddy-stats'

type Props = {
  columns: StatColumn[]
  visible: string[]
  labelOf: (column: StatColumn) => string
  onChange: (visible: string[]) => void
  onReset: () => void
}

// Which numbers the table shows. Each admin picks their own; nothing is
// computed differently for a hidden column.
export function ColumnPicker({ columns, visible, labelOf, onChange, onReset }: Props) {
  const t = useTranslations('adminBuddyStats')
  const shown = columns.filter((c) => visible.includes(c.id)).length

  function toggle(id: string) {
    onChange(visible.includes(id) ? visible.filter((v) => v !== id) : [...visible, id])
  }

  return (
    <details className="mb-4 rounded-lg border bg-card">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        {t('columnPicker.title', { count: shown, total: columns.length })}
      </summary>
      <div className="flex flex-col gap-4 border-t px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STAT_GROUPS.map((group) => (
            <fieldset key={group} className="flex flex-col gap-1.5">
              <legend className="mb-1 text-xs font-medium text-muted-foreground">{t(`groups.${group}`)}</legend>
              {columns.filter((c) => c.group === group).map((column) => (
                <label key={column.id} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={visible.includes(column.id)}
                    onChange={() => toggle(column.id)}
                  />
                  {labelOf(column)}
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onChange(columns.map((c) => c.id))}>
            {t('columnPicker.showAll')}
          </Button>
          <Button variant="outline" size="sm" onClick={onReset}>
            {t('columnPicker.reset')}
          </Button>
        </div>
      </div>
    </details>
  )
}
