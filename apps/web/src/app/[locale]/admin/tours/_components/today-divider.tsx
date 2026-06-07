interface Props {
  date: string
  label: string
}

export function TodayDivider({ date, label }: Props) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-amber-300" />
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
        {label} · {date}
      </span>
      <div className="h-px flex-1 bg-amber-300" />
    </div>
  )
}
