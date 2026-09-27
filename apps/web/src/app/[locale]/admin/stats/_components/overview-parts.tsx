'use client'

import { cn } from '@/lib/utils'
import { formatMonth } from '@/lib/format-date'
import { InfoHint } from '@/components/info-hint'

// The building blocks of a stats overview (PRD §11.4): figures, and charts as
// plain HTML bars — no chart library. Every clickable part is a button whose
// `onSelect` narrows the page's table or list to the rows behind it.

export const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`)

// What an ⓘ says about a figure or chart whose name alone does not explain it.
export type Hint = { label: string; text: string }

export type Figure = { id: string; label: string; value: string; hint?: Hint; onSelect?: () => void }

export function FigureTile({ figure }: { figure: Figure }) {
  const body = (
    <>
      <span className="text-2xl font-semibold tabular-nums">{figure.value}</span>
      <span className="text-xs text-muted-foreground">{figure.label}</span>
    </>
  )
  const className = cn(
    'flex h-full w-full flex-col items-start gap-1 rounded-md border bg-background px-3 py-2 text-left',
    figure.hint && 'pr-7',
  )
  const tile = figure.onSelect ? (
    <button
      type="button"
      className={cn(className, 'transition-colors hover:border-primary hover:bg-accent')}
      onClick={figure.onSelect}
    >
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  )
  if (!figure.hint) return tile
  // The ⓘ is a sibling of the tile's button, not inside it: a button cannot
  // hold another, and hovering it must not also filter the table.
  return (
    <div className="relative">
      {tile}
      <InfoHint label={figure.hint.label} text={figure.hint.text} className="absolute right-2 top-2" />
    </div>
  )
}

export function Chart({ title, hint, children }: { title: string; hint?: Hint; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col gap-3 rounded-md border bg-background p-3">
      <figcaption className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {title}
        {hint && <InfoHint label={hint.label} text={hint.text} />}
      </figcaption>
      {children}
    </figure>
  )
}

export type Bar = { id: string; label: string; value: number | null; display?: string; onSelect: () => void }

// Horizontal bars as a list of buttons, readable without a chart library.
export function BarList({ title, hint, bars, max }: { title: string; hint?: Hint; bars: Bar[]; max?: number }) {
  const top = max ?? Math.max(1, ...bars.map((b) => b.value ?? 0))
  return (
    <Chart title={title} hint={hint}>
      <BarItems bars={bars} max={top} />
    </Chart>
  )
}

// The bars alone, for a chart that groups several lists under subheadings.
export function BarItems({ bars, max }: { bars: Bar[]; max: number }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {bars.map((bar) => {
        const display = bar.display ?? String(bar.value ?? '—')
        return (
          <li key={bar.id}>
            <button
              type="button"
              className="grid w-full grid-cols-[minmax(0,8rem)_1fr_3rem] items-center gap-2 rounded px-1 py-0.5 text-left text-sm transition-colors hover:bg-accent"
              aria-label={`${bar.label}: ${display}`}
              onClick={bar.onSelect}
            >
              <span className="truncate">{bar.label}</span>
              <span className="h-3 rounded-sm bg-muted">
                <span
                  className="block h-full rounded-sm bg-primary"
                  style={{ width: `${((bar.value ?? 0) / Math.max(1, max)) * 100}%` }}
                />
              </span>
              <span className="text-right tabular-nums">{display}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export type MonthColumn = { month: string; value: number; label: string; onSelect: () => void }

// One column per month (`YYYY-MM`). Only the first and last month are labelled
// under the axis; each column names its month and count to hover and screen readers.
export function MonthChart({ title, months }: { title: string; months: MonthColumn[] }) {
  if (months.length === 0) return null
  const top = Math.max(1, ...months.map((m) => m.value))
  return (
    <Chart title={title}>
      <div className="flex h-28 items-end gap-px">
        {months.map((m) => (
          <button
            key={m.month}
            type="button"
            title={m.label}
            aria-label={m.label}
            className="group flex h-full min-w-1 flex-1 items-end"
            onClick={m.onSelect}
          >
            <span
              className="block w-full rounded-t-sm bg-primary transition-colors group-hover:bg-primary/70"
              style={{ height: `${(m.value / top) * 100}%` }}
            />
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs tabular-nums text-muted-foreground">
        <span>{formatMonth(months[0].month)}</span>
        <span>{formatMonth(months[months.length - 1].month)}</span>
      </div>
    </Chart>
  )
}
