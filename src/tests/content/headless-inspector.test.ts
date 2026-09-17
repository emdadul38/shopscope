import { describe, expect, it } from 'vitest'
import { inspectInlineScriptEvidence, inspectNetworkRequestUrls } from '../../content/headless-inspector'

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

describe('inspectInlineScriptEvidence', () => {
  it('extracts gid://shopify/... references from JSON-LD without the surrounding content', () => {
    const doc = parseHtml(`
      <script type="application/ld+json">
        {"@type":"Product","productId":"gid://shopify/Product/1234567890","secretToken":"do-not-leak-me"}
      </script>
    `)
    const { shopifyGidReferences } = inspectInlineScriptEvidence(doc)
    expect(shopifyGidReferences).toContain('gid://shopify/Product/1234567890')
    expect(shopifyGidReferences.join(' ')).not.toContain('do-not-leak-me')
  })

  it('detects Shopify-shaped serialized state hints', () => {
    const doc = parseHtml(`
      <script type="application/json">{"shop_id": 123, "variantId": "456"}</script>
    `)
    const { serializedStateHints } = inspectInlineScriptEvidence(doc)
    expect(serializedStateHints.length).toBeGreaterThan(0)
  })

  it('returns nothing for unrelated inline scripts', () => {
    const doc = parseHtml(`<script type="application/json">{"hello":"world"}</script>`)
    const { shopifyGidReferences, serializedStateHints } = inspectInlineScriptEvidence(doc)
    expect(shopifyGidReferences).toHaveLength(0)
    expect(serializedStateHints).toHaveLength(0)
  })

  it('caps gid references at 10', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `"gid://shopify/Product/${i}"`).join(',')
    const doc = parseHtml(`<script type="application/json">[${ids}]</script>`)
    const { shopifyGidReferences } = inspectInlineScriptEvidence(doc)
    expect(shopifyGidReferences.length).toBeLessThanOrEqual(10)
  })
})

describe('inspectNetworkRequestUrls', () => {
  it('returns resource timing entry names, deduped', () => {
    const fakePerf = {
      getEntriesByType: () => [
        { name: 'https://a.example/api/2024-01/graphql.json' },
        { name: 'https://a.example/api/2024-01/graphql.json' },
        { name: 'https://a.example/app.js' },
      ],
    } as unknown as Performance
    const urls = inspectNetworkRequestUrls(fakePerf)
    expect(urls).toHaveLength(2)
  })

  it('never throws if performance APIs are unavailable', () => {
    const brokenPerf = {
      getEntriesByType: () => {
        throw new Error('unsupported')
      },
    } as unknown as Performance
    expect(inspectNetworkRequestUrls(brokenPerf)).toEqual([])
  })
})
