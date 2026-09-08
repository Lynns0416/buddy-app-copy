import path from 'node:path'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  // Cloud Run: ship the pruned server bundle, not the whole node_modules tree.
  output: 'standalone',
  // next build runs with cwd = apps/web; trace from the monorepo root so the
  // workspace `@peace-buddy/types` link is followed.
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
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
