import type { PageInspectionSnapshot } from './detector-types'
import { SHOPIFY_GID_RE } from './signal-matchers'

const MAX_LIST_LENGTH = 200
const MAX_GID_REFERENCES = 10
const MAX_STATE_HINTS = 10

/**
 * Sanitize a raw, untrusted snapshot payload (crossed a messaging boundary)
 * into a well-typed PageInspectionSnapshot. Shared by the traditional and
 * headless/commerce signal evaluators.
 */
export function sanitizeSnapshot(input: unknown): PageInspectionSnapshot {
  const empty: PageInspectionSnapshot = {
    url: '',
    hostname: '',
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
  }

  if (typeof input !== 'object' || input === null) return empty
  const s = input as Record<string, unknown>

  return {
    url: asString(s.url),
    hostname: asString(s.hostname),
    generator: optionalString(s.generator),
    resourceUrls: asStringArray(s.resourceUrls),
    linkHrefs: asStringArray(s.linkHrefs),
    formActions: asStringArray(s.formActions),
    markupHints: asStringArray(s.markupHints),
    metaContents: asStringArray(s.metaContents),
    myshopifyHosts: asStringArray(s.myshopifyHosts),
    shopifyGlobal: sanitizeGlobal(s.shopifyGlobal),
    networkRequestUrls: asStringArray(s.networkRequestUrls),
    shopifyGidReferences: sanitizeGidReferences(s.shopifyGidReferences),
    serializedStateHints: asStringArray(s.serializedStateHints).slice(0, MAX_STATE_HINTS),
  }
}

function sanitizeGlobal(value: unknown): PageInspectionSnapshot['shopifyGlobal'] {
  if (typeof value !== 'object' || value === null) {
    return { present: false, evidence: [] }
  }
  const g = value as Record<string, unknown>
  return {
    present: g.present === true,
    shop: optionalString(g.shop),
    evidence: asStringArray(g.evidence),
    hydrogenStorefrontApi: g.hydrogenStorefrontApi === true,
  }
}

function sanitizeGidReferences(value: unknown): string[] {
  return asStringArray(value)
    .filter((v) => {
      SHOPIFY_GID_RE.lastIndex = 0
      return SHOPIFY_GID_RE.test(v)
    })
    .slice(0, MAX_GID_REFERENCES)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string').slice(0, MAX_LIST_LENGTH)
}
