import { describe, expect, it } from 'vitest'
import { attachConnectedStore } from '../../../detectors/commerce/status-resolver'
import { detectCommerceFromSnapshot } from '../../../detectors/commerce/commerce-detector'
import type { PageInspectionSnapshot } from '../../../detectors/shopify/detector-types'

function base(partial: Partial<PageInspectionSnapshot> = {}): PageInspectionSnapshot {
  return {
    url: 'https://www.example.com/',
    hostname: 'www.example.com',
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

describe('attachConnectedStore', () => {
  it('marks the marketing site as shopify_connected without classifying it as a storefront itself', () => {
    const marketingSiteResult = detectCommerceFromSnapshot(base())
    expect(marketingSiteResult.status).toBe('unknown')

    const connected = attachConnectedStore(marketingSiteResult, {
      domain: 'shop.example.com',
      url: 'https://shop.example.com',
      confidence: 94,
      evidence: [],
    })

    expect(connected.status).toBe('shopify_connected')
    expect(connected.storefrontType).toBe('marketing_site')
    expect(connected.platform).toBe('shopify')
    expect(connected.connectedStore?.domain).toBe('shop.example.com')
    expect(connected.connectedStore?.confidence).toBe(94)
  })

  it('regression: connected-store redirect — final verified URL differs from the discovered link', () => {
    const marketingSiteResult = detectCommerceFromSnapshot(base())
    const connected = attachConnectedStore(marketingSiteResult, {
      domain: 'eu.example.com',
      url: 'https://eu.example.com/collections/equipment',
      confidence: 88,
      evidence: [],
    })
    expect(connected.connectedStore?.url).toBe('https://eu.example.com/collections/equipment')
    expect(connected.status).toBe('shopify_connected')
  })
})
