// Public base URL of the web app, used to build deep links in notifications.
// Shared by the email and Slack template renderers.
export function webBase(): string {
  const url = process.env.WEB_BASE_URL
  if (url) return url
  if (process.env.NODE_ENV === 'production') {
    throw new Error('WEB_BASE_URL is required in production')
  }
  return 'http://localhost:3000'
}
