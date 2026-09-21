// The calendar date a notification message displays.
//
// `Tour.tourDate` is a Postgres DATE, which Prisma returns as UTC midnight.
// Slicing the ISO string takes the day as stored, which is the Japanese calendar
// date — the same day `formatDate` shows in the web app, so a Slack post and the
// admin table never disagree about when a tour is. The separator differs: message
// payloads stay `YYYY-MM-DD`, the UI renders `yyyy/MM/dd`.
export function payloadTourDate(tourDate: Date): string {
  return tourDate.toISOString().slice(0, 10)
}

// The columns a cron job has to select from `Tour` to name it in a message.
// Shared by the three reminder/deadline jobs, which all pass the row straight
// through to `payloadTourDate`.
export type TourNameRef = { id: string; tourDate: Date; group: { name: string } }
