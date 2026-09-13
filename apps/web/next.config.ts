import path from 'node:path'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin()

const nextConfig: NextConfig = {
  // Container image: ship the pruned server bundle, not the whole node_modules tree.
  output: 'standalone',
  // next build runs with cwd = apps/web; trace from the monorepo root so the
  // workspace `@peace-buddy/types` link is followed.
  outputFileTracingRoot: path.join(process.cwd(), '../..'),
  // Belt to the meta tag's braces: the header covers every response, including
  // routes that render outside app/[locale]/layout.tsx and non-HTML bodies that
  // carry no <meta> at all. See docs/decisions.md.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ]
  },
  images: {
    // In local dev photos come from Azurite at localhost:10000, which the web
    // container cannot reach, so the browser loads them directly instead.
    unoptimized: process.env.NODE_ENV === 'development',
    // One storage account per environment, named in scripts/azure.env.example.
    // Named rather than *.blob.core.windows.net, which would let the optimizer
    // proxy any Azure account's blobs.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'stpeacebuddy.blob.core.windows.net',
      },
      {
        protocol: 'https',
        hostname: 'stpeacebuddystg.blob.core.windows.net',
      },
    ],
  },
}

export default withNextIntl(nextConfig)
