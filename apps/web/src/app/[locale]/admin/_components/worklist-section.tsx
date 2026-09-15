import Link from 'next/link'

type SectionProps = {
  title: string
  count: number
  empty: string
  action?: { href: string; label: string }
  children: React.ReactNode
}

// An empty queue renders its empty state rather than disappearing, so "nothing
// waiting" is visibly different from "not loaded".
export function WorklistSection({ title, count, empty, action, children }: SectionProps) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {title}
          <span
            className={
              count > 0
                ? 'rounded-full bg-primary px-2 text-xs text-primary-foreground'
                : 'rounded-full bg-muted px-2 text-xs text-muted-foreground'
            }
          >
            {count}
          </span>
        </h2>
        {action && (
          <Link href={action.href} className="shrink-0 text-xs text-muted-foreground underline hover:text-foreground">
            {action.label}
          </Link>
        )}
      </header>
      {count === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y">{children}</ul>
      )}
    </section>
  )
}

type ItemProps = {
  href: string
  title: string
  detail: string
}

export function WorklistItem({ href, title, detail }: ItemProps) {
  return (
    <li>
      <Link href={href} className="block px-4 py-3 transition-colors hover:bg-accent">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
      </Link>
    </li>
  )
}
