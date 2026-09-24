// Places carry both nameJa and nameEn — every JSON response is locale-agnostic
// (docs/decisions.md, "Places and spots replace free-text location") and the
// web app picks which to render, same as every other bilingual field. `locale`
// is the raw route param (`string`), matching every other locale-typed helper
// in this app (e.g. TourCalendar's `locale` prop) rather than the API's
// `Locale` enum.
export function placeName(place: { nameJa: string; nameEn: string }, locale: string): string {
  return locale === 'en' ? place.nameEn : place.nameJa
}

export function placeNames(places: { nameJa: string; nameEn: string }[], locale: string): string {
  return places.map((p) => placeName(p, locale)).join(locale === 'en' ? ', ' : '、')
}

type MomentSpot = { nameJa: string; nameEn: string; place: { nameJa: string; nameEn: string } } | null

// Where a reflection moment happened: "Place — Spot" when tied to a spot,
// otherwise the buddy's own free text (or the auto-filled place name).
export function momentLocation(moment: { spot: MomentSpot; placeNote: string | null }, locale: string): string {
  if (moment.spot) return `${placeName(moment.spot.place, locale)} — ${placeName(moment.spot, locale)}`
  return moment.placeNote ?? ''
}
