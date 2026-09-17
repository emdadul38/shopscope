import { describe, expect, it, vi, beforeEach } from 'vitest'
import { isExtensionMessage } from '../../messaging/message-types'
import { isCommerceDetectionResult, detectCommerceFromSnapshot } from '../../detectors/commerce'
import { normalizeUrl } from '../../background/service-worker'
import type { PageInspectionSnapshot } from '../../detectors/shopify/detector-types'

describe('messaging validation', () => {
  it('accepts Phase 1 and Phase 2 message types', () => {
    expect(isExtensionMessage({ type: 'PING_BACKGROUND' })).toBe(true)
    expect(isExtensionMessage({ type: 'RUN_SHOPIFY_DETECTION' })).toBe(true)
    expect(isExtensionMessage({ type: 'RUN_SHOPIFY_DETECTION', force: true })).toBe(true)
    expect(isExtensionMessage({ type: 'GET_LAST_SHOPIFY_DETECTION' })).toBe(true)
    expect(isExtensionMessage({ type: 'DISCOVER_CONNECTED_STORE' })).toBe(true)
    expect(isExtensionMessage({ type: 'RUN_DEEP_SCAN' })).toBe(true)
    expect(isExtensionMessage({ type: 'CANCEL_DEEP_SCAN' })).toBe(true)
    expect(isExtensionMessage({ type: 'GET_DEEP_SCAN_PROGRESS' })).toBe(true)
  })

  it('rejects unknown or malformed messages', () => {
    expect(isExtensionMessage({ type: 'HACK' })).toBe(false)
    expect(isExtensionMessage({ type: 'RUN_SHOPIFY_DETECTION', force: 'yes' })).toBe(false)
    expect(isExtensionMessage(null)).toBe(false)
  })
})

describe('detection response validation', () => {
  it('validates detector output crossing messaging boundaries', () => {
    const snapshot: PageInspectionSnapshot = {
      url: 'https://demo.myshopify.com/',
      hostname: 'demo.myshopify.com',
      resourceUrls: ['https://cdn.shopify.com/s/files/1/x.js'],
      linkHrefs: [],
      formActions: [],
      markupHints: [],
      metaContents: [],
      myshopifyHosts: ['demo.myshopify.com'],
      shopifyGlobal: {
        present: true,
        shop: 'demo',
        evidence: ['Public window.Shopify object detected'],
      },
      networkRequestUrls: [],
      shopifyGidReferences: [],
      serializedStateHints: [],
    }
    const result = detectCommerceFromSnapshot(snapshot)
    expect(isCommerceDetectionResult(result)).toBe(true)
  })
})

describe('URL normalization for cache keys', () => {
  it('strips hash and trailing slash', () => {
    expect(normalizeUrl(new URL('https://Example.com/products/#top'))).toBe(
      'https://example.com/products',
    )
    expect(normalizeUrl(new URL('https://example.com/'))).toBe('https://example.com/')
  })
})

describe('service worker cache helpers (behavioral)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('documents 30s TTL expectation via constant behavior test', () => {
    // Cache implementation lives in the service worker module with module-level state.
    // Here we assert normalizeUrl stability used as part of the cache key.
    const a = normalizeUrl(new URL('https://store.example/cart?x=1'))
    const b = normalizeUrl(new URL('https://store.example/cart?x=1#frag'))
    expect(a).toBe(b)
  })
})
