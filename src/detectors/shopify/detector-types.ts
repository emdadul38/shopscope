export type ShopifySignalCategory =
  | 'resource'
  | 'markup'
  | 'metadata'
  | 'javascript'
  | 'network'
  | 'domain'
  | 'api'
  | 'runtime'
  | 'checkout'
  | 'state'

export interface ShopifySignalDefinition {
  id: string
  name: string
  description: string
  category: ShopifySignalCategory
  weight: number
}

export interface ShopifySignalResult {
  id: string
  name: string
  category: ShopifySignalCategory
  matched: boolean
  weight: number
  evidence: string[]
}

export interface ShopifyDetectionError {
  code: string
  message: string
}

export type ShopifyDetectionErrorCode =
  | 'DETECTION_TIMEOUT'
  | 'CONTENT_SCRIPT_INJECTION_FAILED'
  | 'PAGE_BRIDGE_FAILED'
  | 'INVALID_DETECTION_RESULT'
  | 'UNSUPPORTED_DOCUMENT'
  | 'SHOPIFY_DETECTION_FAILED'

export const SHOPIFY_DETECTION_ERROR_CODES = {
  DETECTION_TIMEOUT: 'DETECTION_TIMEOUT',
  CONTENT_SCRIPT_INJECTION_FAILED: 'CONTENT_SCRIPT_INJECTION_FAILED',
  PAGE_BRIDGE_FAILED: 'PAGE_BRIDGE_FAILED',
  INVALID_DETECTION_RESULT: 'INVALID_DETECTION_RESULT',
  UNSUPPORTED_DOCUMENT: 'UNSUPPORTED_DOCUMENT',
  SHOPIFY_DETECTION_FAILED: 'SHOPIFY_DETECTION_FAILED',
} as const

/** Snapshot collected from the page for pure, testable detection. */
export interface PageInspectionSnapshot {
  url: string
  hostname: string
  generator?: string
  resourceUrls: string[]
  linkHrefs: string[]
  formActions: string[]
  markupHints: string[]
  metaContents: string[]
  myshopifyHosts: string[]
  shopifyGlobal: {
    present: boolean
    shop?: string
    evidence: string[]
    /** Best-effort marker for a Hydrogen/headless runtime (window.Shopify.storefront). */
    hydrogenStorefrontApi?: boolean
  }
  /**
   * Public network request URLs observed via performance.getEntriesByType('resource').
   * URL only — never headers, bodies, or auth data.
   */
  networkRequestUrls: string[]
  /** Sanitized gid://shopify/... references found in inline script/JSON-LD text. */
  shopifyGidReferences: string[]
  /** Sanitized indicators that Shopify-shaped fields appear in serialized page state / JSON-LD. */
  serializedStateHints: string[]
}
