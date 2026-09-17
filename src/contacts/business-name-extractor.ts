import { confidenceForBusinessName } from './contact-confidence'
import type { BusinessIdentity, BusinessNameSource, PageContactDocument } from './contact-types'
import { sanitizeContactEvidence } from './evidence-sanitizer'
import { parseJsonLdBlocks } from './structured-data-parser'

function cleanName(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const name = raw.replace(/\s+/g, ' ').trim()
  if (name.length < 2 || name.length > 120) return undefined
  // Reject clearly generic titles
  if (/^(home|welcome|shop|store)$/i.test(name)) return undefined
  return name
}

function sanitizeTitleFallback(title: string): string | undefined {
  const cleaned = title
    .split(/[|\-–—•·]/)[0]
    ?.replace(/\s+/g, ' ')
    .trim()
  return cleanName(cleaned)
}

export function extractBusinessIdentity(doc: PageContactDocument): BusinessIdentity | undefined {
  const ld = parseJsonLdBlocks(doc.jsonLdBlocks)

  const candidates: Array<{
    name: string
    sourceType: BusinessNameSource
    evidence: string
  }> = []

  for (const name of ld.organizationNames) {
    const n = cleanName(name)
    if (n)
      candidates.push({
        name: n,
        sourceType: 'json_ld_organization',
        evidence: 'Found in Organization structured data',
      })
  }
  for (const name of ld.storeNames) {
    const n = cleanName(name)
    if (n)
      candidates.push({
        name: n,
        sourceType: 'json_ld_store',
        evidence: 'Found in Store structured data',
      })
  }

  const og = cleanName(doc.meta.ogSiteName)
  if (og) {
    candidates.push({
      name: og,
      sourceType: 'og_site_name',
      evidence: 'Found in Open Graph site name metadata',
    })
  }

  const app = cleanName(doc.meta.applicationName)
  if (app) {
    candidates.push({
      name: app,
      sourceType: 'application_name',
      evidence: 'Found in application-name metadata',
    })
  }

  const shop = cleanName(doc.shopifyShopName)
  if (shop) {
    candidates.push({
      name: shop,
      sourceType: 'shopify_shop',
      evidence: 'Found in public Shopify shop name',
    })
  }

  const logo = cleanName(doc.headerText.split('\n')[0])
  if (logo && logo.length <= 60) {
    candidates.push({
      name: logo,
      sourceType: 'header_logo',
      evidence: 'Found in clearly labeled header text',
    })
  }

  const title = sanitizeTitleFallback(doc.title)
  if (title) {
    candidates.push({
      name: title,
      sourceType: 'document_title',
      evidence: 'Derived from sanitized document title',
    })
  }

  const priority: BusinessNameSource[] = [
    'json_ld_organization',
    'json_ld_store',
    'og_site_name',
    'application_name',
    'shopify_shop',
    'header_logo',
    'document_title',
  ]

  for (const source of priority) {
    const hit = candidates.find((c) => c.sourceType === source)
    if (!hit) continue
    return {
      name: hit.name,
      sourceUrl: doc.url,
      sourceType: hit.sourceType,
      confidence: confidenceForBusinessName(hit.sourceType),
      evidence: sanitizeContactEvidence(hit.evidence),
    }
  }

  return undefined
}
