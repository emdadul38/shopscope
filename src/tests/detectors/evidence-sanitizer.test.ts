import { describe, expect, it } from 'vitest'
import {
  EVIDENCE_LIMITS,
  sanitizeEvidenceList,
  sanitizeEvidenceText,
  sanitizeEvidenceUrl,
} from '../../detectors/shopify/evidence-sanitizer'

describe('evidence sanitizer', () => {
  it('redacts query parameters from URLs', () => {
    expect(sanitizeEvidenceUrl('https://cdn.shopify.com/s/files/x.js?token=secret&a=1')).toBe(
      'https://cdn.shopify.com/s/files/x.js',
    )
  })

  it('handles protocol-relative URLs', () => {
    const out = sanitizeEvidenceUrl('//cdn.shopify.com/s/file.js?x=1')
    expect(out).toContain('cdn.shopify.com')
    expect(out).not.toContain('x=1')
  })

  it('strips HTML tags from text', () => {
    expect(sanitizeEvidenceText('<script>alert(1)</script>Shopify CDN')).toContain('Shopify CDN')
    expect(sanitizeEvidenceText('<div>hi</div>')).not.toContain('<')
  })

  it('redacts cookie-like fragments', () => {
    expect(sanitizeEvidenceText('cookie: abc123; path=/')).toContain('[redacted]')
  })

  it('deduplicates evidence case-insensitively', () => {
    expect(
      sanitizeEvidenceList([
        'Resource loaded from cdn.shopify.com',
        'resource loaded from cdn.shopify.com',
      ]),
    ).toHaveLength(1)
  })

  it('limits evidence entries', () => {
    const many = Array.from({ length: 20 }, (_, i) => `Evidence item ${i}`)
    expect(sanitizeEvidenceList(many)).toHaveLength(EVIDENCE_LIMITS.maxEntries)
  })

  it('limits evidence length', () => {
    const long = 'x'.repeat(500)
    expect(sanitizeEvidenceText(long).length).toBeLessThanOrEqual(EVIDENCE_LIMITS.maxLength)
  })

  it('ignores non-string entries', () => {
    expect(sanitizeEvidenceList(['ok', 1 as unknown as string, '', '  '])).toEqual(['ok'])
  })
})
