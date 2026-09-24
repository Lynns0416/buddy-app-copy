import type { PlaceSummary } from '@peace-buddy/types'

export const placeSummarySelect = { id: true, nameJa: true, nameEn: true } as const

// A tour's places are its sessions' places, each once, in session order — a
// place belongs to a session, not a tour (docs/decisions.md 2026-09-24).
// Callers select sessions ordered by `order`.
export function sessionPlaces(sessions: { place: PlaceSummary }[]): PlaceSummary[] {
  const seen = new Set<string>()
  return sessions.flatMap(({ place }) => {
    if (seen.has(place.id)) return []
    seen.add(place.id)
    return [place]
  })
}
