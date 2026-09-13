import { describe, it, expect } from 'vitest'
import robots from './robots'
import { metadata } from './[locale]/layout'
import nextConfig from '../../next.config'

// The three mechanisms behind "keep the app out of search results" — see
// docs/decisions.md. The robots.txt assertion guards against a `Disallow`
// being added back, which would stop crawlers ever reading the `noindex`.
describe('search-index exclusion', () => {
  it('allows crawling, so the noindex signals are readable', () => {
    expect(robots().rules).toEqual({ userAgent: '*', allow: '/' })
  })

  it('marks every page under [locale] noindex', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  it('sends X-Robots-Tag on every path, including non-HTML responses', async () => {
    const headers = await nextConfig.headers!()
    const rule = headers.find((h) => h.source === '/:path*')
    expect(rule?.headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' })
  })
})
