import type { MetadataRoute } from 'next'

// Crawling is deliberately *not* blocked. The `noindex` in [locale]/layout.tsx
// and the `X-Robots-Tag` header in next.config.ts are what keep URLs out of
// results, and a crawler refused the page never reads either. This file exists
// to say that, so a `Disallow` does not get re-added.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
  }
}
