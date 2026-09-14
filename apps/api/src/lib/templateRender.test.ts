import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  escapePlain,
  escapeSlack,
  interpolate,
  resolvePath,
  safeUrl,
} from './templateRender'

const identity = (s: string) => s

describe('interpolate', () => {
  it('substitutes every placeholder from the payload', () => {
    expect(interpolate('{a} and {b}', { a: 'x', b: 'y' }, identity)).toBe('x and y')
  })

  it('returns null when a placeholder has no value — the caller falls back', () => {
    expect(interpolate('{a} and {b}', { a: 'x' }, identity)).toBeNull()
  })

  it('returns null when a placeholder is present but empty', () => {
    expect(interpolate('{a}', { a: '' }, identity)).toBeNull()
  })

  it('returns null when a placeholder is present but not a string', () => {
    expect(interpolate('{a}', { a: 42 }, identity)).toBeNull()
    expect(interpolate('{a}', { a: null }, identity)).toBeNull()
  })

  it('applies the escaper to every substituted value, not to the template', () => {
    expect(interpolate('a < {v}', { v: '<b>' }, escapeHtml)).toBe('a < &lt;b&gt;')
  })

  it('leaves a template with no placeholders alone', () => {
    expect(interpolate('plain', {}, identity)).toBe('plain')
  })
})

describe('resolvePath', () => {
  it('url-encodes values so a crafted id cannot break out of the path', () => {
    expect(resolvePath('/admin/tours/{tourId}', { tourId: 'a/../b' })).toBe(
      '/admin/tours/a%2F..%2Fb',
    )
  })

  it('returns null rather than a partially-resolved 404 path', () => {
    expect(resolvePath('/admin/tours/{tourId}', {})).toBeNull()
  })
})

describe('escapers', () => {
  it('escapeSlack neutralises link markup', () => {
    expect(escapeSlack('<http://evil|click>')).toBe('&lt;http://evil|click&gt;')
  })

  it('escapeSlack leaves quotes alone — they are not Slack markup', () => {
    expect(escapeSlack(`"it's"`)).toBe(`"it's"`)
  })

  it('escapeHtml covers attribute delimiters as well as tags', () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;')
  })

  it('escapeSlack strips newlines so a value cannot forge extra message lines', () => {
    expect(escapeSlack('Aya\n\n:rotating_light: *SYSTEM*')).toBe('Aya :rotating_light: *SYSTEM*')
  })

  it('escapePlain collapses control characters that would split a subject line', () => {
    expect(escapePlain('Aya\r\nBcc: evil@example.com')).toBe('Aya Bcc: evil@example.com')
  })

  it('escapePlain strips the Unicode line separators too', () => {
    expect(escapePlain('Aya\u2028\u2029x')).toBe('Aya x')
  })

  it('escapePlain leaves ordinary text untouched', () => {
    expect(escapePlain('山田 太郎')).toBe('山田 太郎')
  })
})

describe('safeUrl', () => {
  it('passes http and https through', () => {
    expect(safeUrl('https://example.test/a')).toBe('https://example.test/a')
  })

  it('rejects other schemes', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,x')).toBeNull()
  })

  it('rejects an unparseable url', () => {
    expect(safeUrl('not a url')).toBeNull()
  })
})
