import '../globals.css'
import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '../../i18n/routing'
import { AuthProvider } from '../../lib/auth'

// The app is internal to the org. `noindex` is what keeps a URL discovered
// elsewhere out of results, and it only takes effect on pages a crawler is
// allowed to fetch — see app/robots.ts. next.config.ts repeats the signal as an
// `X-Robots-Tag` header, which also covers responses this layout never renders.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

type Props = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params

  if (!routing.locales.includes(locale as 'ja' | 'en')) {
    notFound()
  }

  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
