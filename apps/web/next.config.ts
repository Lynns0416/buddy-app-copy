import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.dev',
      },
      {
        protocol: 'https',
        hostname: 'staging-buddy-photos.plab.jp',
      },
      {
        protocol: 'https',
        hostname: 'buddy-photos.plab.jp',
      },
    ],
  },
}

export default withNextIntl(nextConfig)
