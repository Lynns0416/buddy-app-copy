'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink } from 'lucide-react'
import { BUDDY_LINKS } from '../lib/constants'

export function BuddyLinks() {
  const t = useTranslations('home')
  const headingId = useId()

  return (
    // Set apart from the tours above: reference, not something to act on.
    <section aria-labelledby={headingId} className="mt-10 border-t pt-6">
      <div className="rounded-lg bg-muted p-4">
        <h2 id={headingId} className="mb-2 text-sm font-semibold text-muted-foreground">{t('links.title')}</h2>
        <ul className="flex flex-col gap-1">
          {BUDDY_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <ExternalLink size={14} aria-hidden />
                {t(`links.${link.labelKey}`)}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
