const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const MS_PER_DAY = 24 * 60 * 60 * 1000

// The value a `@db.Date` column holds for the JST calendar day containing
// `now`. Date columns store midnight UTC of their date, so comparing against
// this selects by JST day.
export function jstStartOfDayUtc(now: Date): Date {
  const jst = new Date(now.getTime() + JST_OFFSET_MS)
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()))
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}
