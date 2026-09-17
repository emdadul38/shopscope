import { describe, expect, it } from 'vitest'
import { detectCommerceFromSnapshot, isCommerceDetectionResult } from '../../detectors/commerce/commerce-detector'
import type { PageInspectionSnapshot } from '../../detectors/shopify/detector-types'
import { isShopifyCdnUrl, isValidMyshopifyHostname } from '../../detectors/shopify/signal-matchers'

function base(partial: Partial<PageInspectionSnapshot> = {}): PageInspectionSnapshot {
  return {
    url: 'https://example.com/',
    hostname: 'example.com',
    resourceUrls: [],
    linkHrefs: [],
    formActions: [],
    markupHints: [],
    metaContents: [],
    myshopifyHosts: [],
    shopifyGlobal: { present: false, evidence: [] },
    networkRequestUrls: [],
    shopifyGidReferences: [],
    serializedStateHints: [],
    ...partial,
  }
}

describe('myshopify hostname matching', () => {
  it('accepts valid store hostnames', () => {
    expect(isValidMyshopifyHostname('cool-store.myshopify.com')).toBe(true)
    expect(isValidMyshopifyHostname('a1.myshopify.com')).toBe(true)
  })

  it('rejects invalid hostnames and substrings', () => {
    expect(isValidMyshopifyHostname('myshopify.com')).toBe(false)
    expect(isValidMyshopifyHostname('evil.com')).toBe(false)
    expect(isValidMyshopifyHostname('notmyshopify.com')).toBe(false)
    expect(isValidMyshopifyHostname('store.myshopify.com.evil.com')).toBe(false)
    expect(isValidMyshopifyHostname('-bad.myshopify.com')).toBe(false)
    expect(isValidMyshopifyHostname('mention of cool-store.myshopify.com in text')).toBe(false)
  })
})

describe('Shopify CDN matching', () => {
  it('matches trusted CDN hosts and paths', () => {
    expect(isShopifyCdnUrl('https://cdn.shopify.com/s/files/1/x.js')).toBe(true)
    expect(isShopifyCdnUrl('//cdn.shopify.com/s/files/1/x.css')).toBe(true)
    expect(isShopifyCdnUrl('https://store.com/cdn/shop/t/1/assets/theme.css')).toBe(true)
    expect(isShopifyCdnUrl('https://store.com/cdn/wpm/boomerang.js')).toBe(true)
    expect(isShopifyCdnUrl('https://shopifycdn.com/s/files/1/x.js')).toBe(true)
    expect(isShopifyCdnUrl('https://assets.shopifycdn.com/s/files/1/x.js')).toBe(true)
  })

  it('does not match Shopify mentioned only in query values', () => {
    expect(isShopifyCdnUrl('https://cdn.unrelated.com/script.js?ref=shopify')).toBe(false)
    expect(isShopifyCdnUrl('https://example.com/assets/app.js')).toBe(false)
  })
})

describe('detectCommerceFromSnapshot — traditional theme detection', () => {
  it('returns unknown for empty pages', () => {
    const result = detectCommerceFromSnapshot(base())
    expect(result.status).toBe('unknown')
    expect(result.platform).toBe('unknown')
    expect(result.confidence).toBe(0)
    expect(result.evidence).toHaveLength(0)
  })

  it('handles invalid detector input safely', () => {
    const result = detectCommerceFromSnapshot(null)
    expect(result.status).toBe('unknown')
    expect(Array.isArray(result.evidence)).toBe(true)
  })

  it('confirms a strong multi-signal storefront as shopify_theme', () => {
    const result = detectCommerceFromSnapshot(
      base({
        hostname: 'demo.myshopify.com',
        generator: 'Shopify',
        resourceUrls: [
          'https://cdn.shopify.com/s/files/1/theme.js',
          'https://cdn.shopify.com/shopifycloud/checkout-web/assets/app.js',
        ],
        formActions: ['/cart/add'],
        markupHints: ['shopify-section', 'shopify-payment-button'],
        shopifyGlobal: { present: true, shop: 'demo', evidence: ['Shopify.shop present'] },
        linkHrefs: ['/products/hat', '/collections/all', '/cart'],
      }),
    )
    expect(result.status).toBe('confirmed_shopify')
    expect(result.platform).toBe('shopify')
    expect(result.storefrontType).toBe('shopify_theme')
    expect(result.confidence).toBeGreaterThanOrEqual(90)
    expect(result.evidence.length).toBeGreaterThanOrEqual(3)
  })

  it('does not confirm from a blog merely mentioning Shopify', () => {
    const result = detectCommerceFromSnapshot(
      base({
        metaContents: ['We love Shopify as a platform for merchants'],
        linkHrefs: ['/blog/why-shopify-wins'],
      }),
    )
    expect(result.status).toBe('unknown')
  })

  it('does not confirm from a query-string false positive', () => {
    const result = detectCommerceFromSnapshot(
      base({
        resourceUrls: ['https://cdn.example.com/app.js?utm_source=shopify'],
      }),
    )
    expect(result.status).toBe('unknown')
  })

  it('a CDN URL alone never confirms Shopify', () => {
    const result = detectCommerceFromSnapshot(
      base({ resourceUrls: ['https://cdn.shopify.com/s/files/1/theme.js'] }),
    )
    expect(result.status).not.toBe('confirmed_shopify')
    expect(result.status).not.toBe('likely_shopify')
  })

  it('a generic /products route alone never confirms Shopify', () => {
    const result = detectCommerceFromSnapshot(base({ linkHrefs: ['/products/hat'] }))
    expect(result.status).not.toBe('confirmed_shopify')
    expect(result.status).not.toBe('likely_shopify')
  })

  it('includes duration and version metadata', () => {
    const result = detectCommerceFromSnapshot(base())
    expect(result.detectorVersion).toMatch(/^\d+\.\d+\.\d+$/)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
    expect(typeof result.inspectedAt).toBe('string')
  })
})

describe('isCommerceDetectionResult', () => {
  it('validates well-formed results', () => {
    const result = detectCommerceFromSnapshot(base())
    expect(isCommerceDetectionResult(result)).toBe(true)
  })

  it('rejects malformed payloads', () => {
    expect(isCommerceDetectionResult({})).toBe(false)
    expect(isCommerceDetectionResult({ status: 'confirmed_shopify', confidence: 150 })).toBe(false)
    expect(isCommerceDetectionResult(null)).toBe(false)
  })
})
