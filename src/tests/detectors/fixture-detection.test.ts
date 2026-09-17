import { describe, expect, it } from 'vitest'
import { detectCommerceFromSnapshot } from '../../detectors/commerce/commerce-detector'
import type { PageInspectionSnapshot } from '../../detectors/shopify/detector-types'
import { inspectDocument } from '../../content/document-inspector'
import { inspectResources } from '../../content/resource-inspector'

import shopifyStoreHtml from '../fixtures/shopify-store.html?raw'
import highlyLikelyHtml from '../fixtures/highly-likely-shopify-store.html?raw'
import possibleHtml from '../fixtures/possible-shopify-store.html?raw'
import nonShopifyHtml from '../fixtures/non-shopify-store.html?raw'
import confirmedNonShopifyHtml from '../fixtures/confirmed-non-shopify.html?raw'
import blogHtml from '../fixtures/blog-mentioning-shopify.html?raw'
import queryFalsePositiveHtml from '../fixtures/query-false-positive.html?raw'
import malformedHtml from '../fixtures/malformed.html?raw'
import emptyHtml from '../fixtures/empty-page.html?raw'
import hydrogenHtml from '../fixtures/hydrogen-storefront.html?raw'
import headlessHtml from '../fixtures/headless-storefront.html?raw'
import insufficientHeadlessHtml from '../fixtures/regression-insufficient-headless-evidence.html?raw'
import connectedCandidateHtml from '../fixtures/regression-connected-storefront-candidate.html?raw'

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

function snapshotFromDocument(doc: Document, url: string): PageInspectionSnapshot {
  const hostname = new URL(url).hostname
  const docPart = inspectDocument(doc)
  return {
    url,
    hostname,
    generator: docPart.generator,
    resourceUrls: inspectResources(doc),
    linkHrefs: docPart.linkHrefs,
    formActions: docPart.formActions,
    markupHints: docPart.markupHints,
    metaContents: docPart.metaContents,
    myshopifyHosts: docPart.myshopifyHosts,
    shopifyGlobal: { present: false, evidence: [] },
    networkRequestUrls: [],
    shopifyGidReferences: [],
    serializedStateHints: [],
  }
}

describe('HTML fixture detection — traditional theme', () => {
  it('confirms a synthetic Shopify storefront fixture', () => {
    const doc = parseHtml(shopifyStoreHtml)
    const result = detectCommerceFromSnapshot(
      snapshotFromDocument(doc, 'https://demo-store.myshopify.com/'),
    )
    expect(result.confidence).toBeGreaterThanOrEqual(70)
    expect(['confirmed_shopify', 'likely_shopify']).toContain(result.status)
    expect(result.storefrontType).toBe('shopify_theme')
    expect(result.platform).toBe('shopify')
  })

  it('marks highly-likely fixture as a confirmed/likely theme storefront', () => {
    const doc = parseHtml(highlyLikelyHtml)
    const result = detectCommerceFromSnapshot(
      snapshotFromDocument(doc, 'https://custom-domain.example/'),
    )
    expect(result.confidence).toBeGreaterThanOrEqual(40)
    expect(['confirmed_shopify', 'likely_shopify']).toContain(result.status)
  })

  it('marks possible fixture as unknown, never confirmed', () => {
    const doc = parseHtml(possibleHtml)
    const result = detectCommerceFromSnapshot(snapshotFromDocument(doc, 'https://maybe.example/'))
    expect(result.status).not.toBe('confirmed_shopify')
    expect(result.status).not.toBe('likely_shopify')
  })

  it('does not detect non-Shopify ecommerce fixture as Shopify', () => {
    const doc = parseHtml(nonShopifyHtml)
    const result = detectCommerceFromSnapshot(snapshotFromDocument(doc, 'https://woo.example/'))
    expect(result.status).not.toBe('confirmed_shopify')
    expect(result.status).not.toBe('likely_shopify')
    expect(result.platform).not.toBe('shopify')
  })

  it('returns confirmed_other for a clean non-Shopify platform with zero Shopify signals', () => {
    const doc = parseHtml(confirmedNonShopifyHtml)
    const result = detectCommerceFromSnapshot(snapshotFromDocument(doc, 'https://blog.example.com/'))
    expect(result.status).toBe('confirmed_other')
    expect(result.platform).toBe('other')
  })

  it('ignores blog text that merely mentions Shopify', () => {
    const doc = parseHtml(blogHtml)
    const result = detectCommerceFromSnapshot(
      snapshotFromDocument(doc, 'https://blog.example/shopify-article'),
    )
    expect(result.status).not.toBe('confirmed_shopify')
    expect(result.status).not.toBe('likely_shopify')
  })

  it('ignores shopify only in unrelated query strings', () => {
    const doc = parseHtml(queryFalsePositiveHtml)
    const result = detectCommerceFromSnapshot(
      snapshotFromDocument(doc, 'https://marketing.example/'),
    )
    expect(result.status).toBe('unknown')
  })

  it('handles malformed HTML without throwing', () => {
    const doc = parseHtml(malformedHtml)
    expect(() =>
      detectCommerceFromSnapshot(snapshotFromDocument(doc, 'https://broken.example/')),
    ).not.toThrow()
  })

  it('handles empty pages', () => {
    const doc = parseHtml(emptyHtml)
    const result = detectCommerceFromSnapshot(snapshotFromDocument(doc, 'https://empty.example/'))
    expect(result.status).toBe('unknown')
    expect(result.evidence).toHaveLength(0)
  })
})

describe('HTML fixture detection — headless and Hydrogen', () => {
  it('recognizes Hydrogen generator/asset markers', () => {
    const doc = parseHtml(hydrogenHtml)
    const result = detectCommerceFromSnapshot(
      snapshotFromDocument(doc, 'https://custom-hydrogen-store.com/'),
    )
    expect(result.evidence.some((e) => e.signalName.toLowerCase().includes('hydrogen'))).toBe(true)
  })

  it('finds weak headless checkout/cart evidence in a minimal DOM shell', () => {
    const doc = parseHtml(headlessHtml)
    const result = detectCommerceFromSnapshot(
      snapshotFromDocument(doc, 'https://headless.example.com/'),
    )
    expect(result.status).not.toBe('confirmed_shopify')
    expect(['possible_headless', 'unknown']).toContain(result.status)
  })

  it('regression: minimal client-rendered product page yields possible_headless or unknown, never a false confirmation', () => {
    const doc = parseHtml(insufficientHeadlessHtml)
    const result = detectCommerceFromSnapshot(
      snapshotFromDocument(doc, 'https://helixsleep.example/products/kids/twin'),
    )
    expect(['possible_headless', 'unknown']).toContain(result.status)
    expect(result.status).not.toBe('confirmed_shopify')
    expect(result.status).not.toBe('likely_shopify')
  })

  it('regression: connected storefront candidate page detects as a Shopify theme storefront', () => {
    const doc = parseHtml(connectedCandidateHtml)
    const result = detectCommerceFromSnapshot(
      snapshotFromDocument(doc, 'https://eu-example-marketing-site.myshopify.com/collections/equipment'),
    )
    expect(['confirmed_shopify', 'likely_shopify']).toContain(result.status)
    expect(result.platform).toBe('shopify')
  })
})
