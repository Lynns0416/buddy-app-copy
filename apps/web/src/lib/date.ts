export function getTodayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

// Tours run in Japan and their dates are Japanese calendar dates, so "today" is the
// date there, not the UTC date or the viewer's clock. Japan has no daylight saving,
// so a fixed offset is exact. Only /buddy uses this so far (#209).
export function getTodayJst(now: Date = new Date()): string {
  return new Date(now.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10)
}
