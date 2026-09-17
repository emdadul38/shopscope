import { describe, expect, it } from 'vitest'
import { detectCommerceFromSnapshot } from '../../../detectors/commerce/commerce-detector'
import type { PageInspectionSnapshot } from '../../../detectors/shopify/detector-types'

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

describe('headless and connected storefront classification', () => {
  it('classifies a Hydrogen storefront as shopify_hydrogen', () => {
    const result = detectCommerceFromSnapshot(
      base({
        generator: 'Hydrogen',
        hostname: 'custom-hydrogen-store.com',
        networkRequestUrls: [
          'https://custom-hydrogen-store.com/api/2024-01/graphql.json',
          'https://custom-hydrogen-store.com/cdn/shopifycloud/hydrogen/runtime.js',
        ],
        shopifyGidReferences: ['gid://shopify/Product/1234567890'],
        shopifyGlobal: { present: false, evidence: [], hydrogenStorefrontApi: true },
        resourceUrls: ['https://cdn.shopify.com/s/files/1/0001/products/hat.jpg'],
      }),
    )
    expect(result.platform).toBe('shopify')
    expect(result.storefrontType).toBe('shopify_hydrogen')
    expect(['confirmed_shopify', 'likely_shopify']).toContain(result.status)
  })

  it('classifies a custom headless storefront (no Hydrogen markers) as shopify_headless', () => {
    const result = detectCommerceFromSnapshot(
      base({
        hostname: 'headless.example.com',
        networkRequestUrls: ['https://headless.example.com/api/2024-01/graphql.json'],
        shopifyGidReferences: [
          'gid://shopify/Product/111',
          'gid://shopify/ProductVariant/222',
          'gid://shopify/Cart/333',
        ],
        linkHrefs: ['https://headless.example.com/cart.js', 'https://checkout.shopify.com/c/abc'],
      }),
    )
    expect(result.platform).toBe('shopify')
    expect(result.storefrontType).toBe('shopify_headless')
    expect(['confirmed_shopify', 'likely_shopify']).toContain(result.status)
  })

  it('classifies weak/single headless evidence as possible_headless, never confirmed', () => {
    const result = detectCommerceFromSnapshot(
      base({
        networkRequestUrls: ['https://headless.example.com/api/2024-01/graphql.json'],
      }),
    )
    expect(result.status).toBe('possible_headless')
    expect(result.storefrontType).toBe('shopify_headless')
    expect(result.status).not.toBe('confirmed_shopify')
    expect(result.status).not.toBe('likely_shopify')
  })

  it('duplicate/repeated signals do not inflate confidence beyond a single match', () => {
    const once = detectCommerceFromSnapshot(
      base({ networkRequestUrls: ['https://a.example/api/2024-01/graphql.json'] }),
    )
    const repeated = detectCommerceFromSnapshot(
      base({
        networkRequestUrls: [
          'https://a.example/api/2024-01/graphql.json',
          'https://a.example/api/2024-01/graphql.json',
          'https://a.example/api/2024-01/graphql.json',
        ],
      }),
    )
    expect(repeated.confidence).toBe(once.confidence)
    expect(repeated.evidence.length).toBe(once.evidence.length)
  })

  it('returns confirmed_other only with explicit non-Shopify platform evidence', () => {
    const result = detectCommerceFromSnapshot(base({ generator: 'WordPress 6.4' }))
    expect(result.status).toBe('confirmed_other')
    expect(result.platform).toBe('other')
  })

  it('returns unknown (not confirmed_other) when there is simply no evidence either way', () => {
    const result = detectCommerceFromSnapshot(base({ generator: 'Some Custom CMS' }))
    expect(result.status).toBe('unknown')
    expect(result.platform).toBe('unknown')
  })

  it('sanitizes evidence: no full HTML, tokens, or raw script contents', () => {
    const result = detectCommerceFromSnapshot(
      base({
        hostname: 'demo.myshopify.com',
        generator: 'Shopify',
        resourceUrls: ['https://cdn.shopify.com/s/files/1/theme.js?access_token=SECRET123'],
        shopifyGlobal: { present: true, shop: 'demo', evidence: ['Shopify.shop present'] },
        formActions: ['/cart/add'],
        markupHints: ['shopify-section', 'shopify-payment-button'],
      }),
    )
    const serialized = JSON.stringify(result.evidence)
    expect(serialized).not.toContain('SECRET123')
    expect(serialized).not.toContain('access_token')
    expect(serialized).not.toContain('<script')
    for (const item of result.evidence) {
      if (item.sourceUrl) expect(item.sourceUrl).not.toContain('?')
    }
  })
})
