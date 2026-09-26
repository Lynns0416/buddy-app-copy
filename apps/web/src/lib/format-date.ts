import { JST_OFFSET_MS } from '@peace-buddy/types'

// Every date in the UI reads `yyyy/MM/dd`, in both locales and whatever the
// viewer's browser is set to. The calendar date is the one in Japan: tour and
// deadline dates are Japanese calendar dates (`@db.Date`, serialised as UTC
// midnight, so the shift leaves the day intact), and a timestamp is shown on the
// day it happened there. See docs/decisions.md.
function jstIso(iso: string): string {
  return new Date(new Date(iso).getTime() + JST_OFFSET_MS).toISOString()
}

export function formatDate(iso: string): string {
  return jstIso(iso).slice(0, 10).replaceAll('-', '/')
}

// `yyyy/MM/dd HH:mm`, for the places that show when something happened rather
// than which day it is for.
export function formatDateTime(iso: string): string {
  const jst = jstIso(iso)
  return `${jst.slice(0, 10).replaceAll('-', '/')} ${jst.slice(11, 16)}`
}

// `yyyy/MM`, for a calendar month already given as `YYYY-MM` in JST (a chart
// axis, a per-month count).
export function formatMonth(month: string): string {
  return month.replace('-', '/')
}
