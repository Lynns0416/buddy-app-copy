import { db } from './db'

export type Pool = 'junior' | 'non_junior' | 'anyone'

export const NON_JUNIOR_TIERS: string[] = ['mid', 'senior', 'expert', 'instructor', 'organizer']

const DEFAULT_JUNIOR_PCT = 20
const DEFAULT_NON_JUNIOR_PCT = 30
const DEFAULT_ANYONE_PCT = 50

export async function getPoolCapacities(tourId: string, capacity: number): Promise<Record<Pool, number>> {
  const rows = await db.tierCapacity.findMany({
    where: { tourId },
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
