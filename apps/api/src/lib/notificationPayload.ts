// The calendar date a notification message displays.
//
// `Tour.tourDate` is a Postgres DATE, which Prisma returns as UTC midnight, and
// the API serialises it with `.toISOString()` for the web app to `.slice(0, 10)`.
// Slicing the same way here keeps a Slack post and the admin table from
// disagreeing about which day a tour is on.
export function payloadTourDate(tourDate: Date): string {
  return tourDate.toISOString().slice(0, 10)
}

// The columns a cron job has to select from `Tour` to name it in a message.
// Shared by the three reminder/deadline jobs, which all pass the row straight
// through to `payloadTourDate`.
export type TourNameRef = { id: string; tourDate: Date; group: { name: string } }
