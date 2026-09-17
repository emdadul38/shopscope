import { describe, expect, it } from 'vitest'
import { discoverConnectedStoreCandidates } from '../../content/connected-store-inspector'

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

describe('discoverConnectedStoreCandidates', () => {
  it('finds a same-registered-domain shop subdomain labeled "Shop"', () => {
    const doc = parseHtml(`
      <nav>
        <a href="https://shop.example.com/">Shop</a>
      </nav>
    `)
    const candidates = discoverConnectedStoreCandidates(doc, 'https://www.example.com/')
    expect(candidates).toHaveLength(1)
    expect(candidates[0].domain).toBe('shop.example.com')
  })

  it('matches Store, Buy Now, Products, and Equipment labels', () => {
    const doc = parseHtml(`
      <a href="https://store.example.com/">Store</a>
      <a href="https://buy.example.com/">Buy Now</a>
      <a href="https://products.example.com/">Products</a>
      <a href="https://gear.example.com/">Equipment</a>
    `)
    const candidates = discoverConnectedStoreCandidates(doc, 'https://www.example.com/')
    expect(candidates.length).toBeGreaterThanOrEqual(2)
  })

  it('never returns links to unrelated external domains', () => {
    const doc = parseHtml(`<a href="https://totally-unrelated.com/shop">Shop</a>`)
    const candidates = discoverConnectedStoreCandidates(doc, 'https://www.example.com/')
    expect(candidates).toHaveLength(0)
  })

  it('ignores links without a matching label', () => {
    const doc = parseHtml(`<a href="https://shop.example.com/">About us</a>`)
    const candidates = discoverConnectedStoreCandidates(doc, 'https://www.example.com/')
    expect(candidates).toHaveLength(0)
  })

  it('caps discovery at two candidates', () => {
    const doc = parseHtml(`
      <a href="https://a.example.com/">Shop</a>
      <a href="https://b.example.com/">Shop</a>
      <a href="https://c.example.com/">Shop</a>
    `)
    const candidates = discoverConnectedStoreCandidates(doc, 'https://www.example.com/')
    expect(candidates.length).toBeLessThanOrEqual(2)
  })

  it('excludes a link to the exact current hostname (not a distinct connected store)', () => {
    const doc = parseHtml(`<a href="https://www.example.com/shop">Shop</a>`)
    const candidates = discoverConnectedStoreCandidates(doc, 'https://www.example.com/')
    expect(candidates).toHaveLength(0)
  })

  it('allows www.example.com -> shop.example.com per the required example', () => {
    const doc = parseHtml(`<a href="https://shop.example.com/collections/all">Shop</a>`)
    const candidates = discoverConnectedStoreCandidates(doc, 'https://www.example.com/eu')
    expect(candidates[0]?.domain).toBe('shop.example.com')
  })
})
