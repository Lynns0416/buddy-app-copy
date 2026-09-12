'use client'

import { useState } from 'react'
import type { BuddyTier, MemberType } from '@peace-buddy/types'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAdminGuard } from '@/hooks/use-admin-guard'
import { AppShell } from '@/components/app-shell'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SortIcon } from '@/components/sort-icon'
import { routes } from '@/lib/routes'
import { sortBuddies, nextBuddySort, mapBuddyError, buddyName, memberTypeLabelKey, type BuddySortField } from './admin.buddy'
import { useBuddies } from './use-buddies'
import { BuddyAvatar } from '@/components/buddy-avatar'
import { getBuddyTierLabel } from '@/lib/status-display'

export default function AdminBuddiesPage() {
  const { ready } = useAdminGuard()
  const locale = useLocale()
  const router = useRouter()
  const t = useTranslations('adminBuddies')
  const tBuddyTier = useTranslations('buddyTier')
  const { buddies, fetchError } = useBuddies(ready)
  const [sortField, setSortField] = useState<BuddySortField>('displayName')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function handleSort(field: BuddySortField) {
    const next = nextBuddySort({ field: sortField, dir: sortDir }, field)
    setSortField(next.field)
    setSortDir(next.dir)
  }

  const sorted = sortBuddies(buddies, sortField, sortDir)

  function tierLabel(tier: BuddyTier | null): string {
    if (!tier) return '—'
    return getBuddyTierLabel(tBuddyTier, tier)
  }

  function memberTypeLabel(memberType: MemberType): string {
    return t(memberTypeLabelKey(memberType) as Parameters<typeof t>[0])
  }

  if (!ready) return null

  return (
    <AppShell variant="admin">
      <h1 className="mb-6 text-xl font-semibold">{t('title')}</h1>

      {fetchError && (
        <p className="mb-4 rounded-md bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {mapBuddyError(t, fetchError)}
        </p>
      )}

      <p className="mb-4 text-sm text-muted-foreground">
        <Link href={routes.adminTrainees(locale)} className="text-blue-600 hover:underline">
          {t('viewTrainees')}
        </Link>
      </p>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noResults')}</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            <div className="flex flex-wrap gap-2">
              {([
                { field: 'displayName' as const, label: t('name') },
                { field: 'email' as const, label: t('email') },
                { field: 'tier' as const, label: t('tier') },
                { field: 'memberType' as const, label: t('memberType') },
              ]).map(({ field, label }) => (
                <button
                  key={field}
                  className="inline-flex items-center gap-0.5 rounded-md border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handleSort(field)}
                >
                  {label}
                  <SortIcon active={sortField === field} dir={sortDir} />
                </button>
              ))}
            </div>
            {sorted.map((buddy) => (
              <div
                key={buddy.id}
                className="flex justify-between cursor-pointer items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent/50"
                onClick={() => router.push(routes.adminBuddyDetail(locale, buddy.id))}
              >
                <div>
                  <p className="font-medium">{buddyName(t, buddy)}</p>
                  <p className="text-sm text-muted-foreground">{buddy.email}</p>
                  {/* Both lines can read "Buddy" — tier `buddy` and member type
                      `buddy` are different statements — so the card names the
                      field the way the table's column headers do. */}
                  {buddy.tier && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium">{t('tier')}</span> {tierLabel(buddy.tier)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-medium">{t('memberType')}</span> {memberTypeLabel(buddy.memberType)}
                  </p>
                </div>
                <div>
                  <BuddyAvatar photoUrl={buddy.photoUrl} displayName={buddy.displayName} size="lg" />
                </div>
              </div>
            ))}
          </div>

          {/* sm+: scrollable table */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-px" />
                  <TableHead>
                    <button
                      className="inline-flex items-center gap-1 whitespace-nowrap font-medium transition-colors hover:text-foreground"
                      onClick={() => handleSort('displayName')}
                    >
                      {t('name')}
                      <SortIcon active={sortField === 'displayName'} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="inline-flex items-center gap-1 whitespace-nowrap font-medium transition-colors hover:text-foreground"
                      onClick={() => handleSort('email')}
                    >
                      {t('email')}
                      <SortIcon active={sortField === 'email'} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="inline-flex items-center gap-1 whitespace-nowrap font-medium transition-colors hover:text-foreground"
                      onClick={() => handleSort('tier')}
                    >
                      {t('tier')}
                      <SortIcon active={sortField === 'tier'} dir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="inline-flex items-center gap-1 whitespace-nowrap font-medium transition-colors hover:text-foreground"
                      onClick={() => handleSort('memberType')}
                    >
                      {t('memberType')}
                      <SortIcon active={sortField === 'memberType'} dir={sortDir} />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((buddy) => (
                  <TableRow
                    key={buddy.id}
                    className="cursor-pointer"
                    onClick={() => router.push(routes.adminBuddyDetail(locale, buddy.id))}
                  >
                    <TableCell>
                      <BuddyAvatar photoUrl={buddy.photoUrl} displayName={buddy.displayName} size="md" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{buddyName(t, buddy)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{buddy.email}</TableCell>
                    <TableCell>{tierLabel(buddy.tier)}</TableCell>
                    <TableCell>{memberTypeLabel(buddy.memberType)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </AppShell>
  )
}
