import createIntlMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'
import { routes } from './lib/routes'

const intlMiddleware = createIntlMiddleware(routing)

const PUBLIC_PATHS = ['/login', '/pending']

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Strip locale prefix to get the bare path for auth checks
  const localePrefix = routing.locales.map((l) => `/${l}`).join('|')
  const bare = pathname.replace(new RegExp(`^(${localePrefix})`), '') || '/'

  const isPublic = PUBLIC_PATHS.some((p) => bare === p || bare.startsWith(`${p}/`))

  if (!isPublic) {
    const token = request.cookies.get('__session')?.value
    if (!token) {
      const localeMatch = pathname.match(/^\/(ja|en)/)
      const locale = localeMatch ? localeMatch[1] : routing.defaultLocale
      return NextResponse.redirect(new URL(routes.login(locale), request.url))
    }
  }

  return intlMiddleware(request)
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
}
