import type { BuddyTier } from '@peace-buddy/types'
import { db } from './db'

export type Pool = 'junior' | 'non_junior' | 'anyone'

/** The pool a tier claims its seat from. `anyone` is overflow, not membership. */
export type TierPool = Exclude<Pool, 'anyone'>

// The one place a tier is mapped to a pool. Exhaustive by type: add a value to
// BuddyTierSchema without adding it here and the build fails, rather than the
// new tier silently joining non_junior and taking seats no capacity query counts.
export const TIER_POOL: Record<BuddyTier, TierPool> = {
  junior: 'junior',
  buddy: 'non_junior',
  star: 'non_junior',
  blackstar: 'non_junior',
}

export function poolForTier(tier: BuddyTier): TierPool {
  return TIER_POOL[tier]
}

/** Every tier whose seats come from the given pool. */
export function tiersInPool(pool: TierPool): string[] {
  return Object.entries(TIER_POOL)
    .filter(([, p]) => p === pool)
    .map(([tier]) => tier)
}

export const NON_JUNIOR_TIERS: string[] = tiersInPool('non_junior')

const DEFAULT_JUNIOR_PCT = 20
const DEFAULT_NON_JUNIOR_PCT = 30
const DEFAULT_ANYONE_PCT = 50

export async function getPoolCapacities(sessionId: string, capacity: number): Promise<Record<Pool, number>> {
  const rows = await db.tierCapacity.findMany({
    where: { sessionId },
    select: { pool: true, percent: true },
  })

  if (rows.length === 0) {
    return {
      junior: Math.floor(capacity * DEFAULT_JUNIOR_PCT / 100),
      non_junior: Math.floor(capacity * DEFAULT_NON_JUNIOR_PCT / 100),
      anyone: Math.floor(capacity * DEFAULT_ANYONE_PCT / 100),
    }
  }

  const pctMap: Record<Pool, number> = { junior: 0, non_junior: 0, anyone: 0 }
  for (const row of rows) {
    pctMap[row.pool as Pool] = row.percent
  }
  return {
    junior: Math.floor(capacity * pctMap.junior / 100),
    non_junior: Math.floor(capacity * pctMap.non_junior / 100),
    anyone: Math.floor(capacity * pctMap.anyone / 100),
  }
}
