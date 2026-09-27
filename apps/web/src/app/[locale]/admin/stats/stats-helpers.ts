// Arithmetic shared by the stats pages (PRD §11.4).

// A rate with nothing to divide by is null (shown `—`), never 0.
export function ratio(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole
}

// The month after a `YYYY-MM`.
export function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
}
