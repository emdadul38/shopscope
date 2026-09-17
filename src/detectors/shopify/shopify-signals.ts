import type { ShopifySignalDefinition } from './detector-types'

export const DETECTOR_VERSION = '2.0.0'

/**
 * Central signal weights. Tuned so a realistic storefront can reach
 * "confirmed" without needing every weak route signal, while a single
 * weak signal cannot confirm.
 */
export const SHOPIFY_SIGNAL_WEIGHTS = {
  MYSHOPIFY_DOMAIN: 30,
  SHOPIFY_GLOBAL: 22,
  SHOPIFY_CDN: 18,
  SHOPIFY_GENERATOR: 18,
  SHOPIFY_STOREFRONT_SCRIPT: 16,
  SHOPIFY_FORM_ACTION: 10,
  SHOPIFY_SECTION_MARKUP: 8,
  SHOPIFY_ROUTE_PATTERN: 4,
  STOREFRONT_API_ENDPOINT: 22,
  SHOPIFY_GID_REFERENCE: 16,
  HYDROGEN_RUNTIME: 20,
  HEADLESS_CDN_PRODUCT: 10,
  HEADLESS_CHECKOUT_CART: 14,
  SERIALIZED_STATE_HINT: 12,
} as const

export type ShopifySignalWeightKey = keyof typeof SHOPIFY_SIGNAL_WEIGHTS

/**
 * Score at which confidence maps to 100%.
 * Sum of the strongest independent storefront signals is enough;
 * we intentionally do not divide by the sum of all available weights.
 */
export const CONFIRMATION_SCORE_THRESHOLD = 55

export const SHOPIFY_CONFIDENCE_THRESHOLDS = {
  confirmed: 90,
  highlyLikely: 70,
  possible: 40,
} as const

/** Weights at or above this are treated as very-high for confirmation safeguard. */
export const VERY_HIGH_SIGNAL_WEIGHT = 22

/** Weights at or above this (and below very-high) count as medium. */
export const MEDIUM_SIGNAL_WEIGHT = 8

export const SHOPIFY_SIGNAL_DEFINITIONS: readonly ShopifySignalDefinition[] = [
  {
    id: 'myshopify_domain',
    name: 'myshopify.com hostname',
    description: 'Valid public *.myshopify.com hostname reference',
    category: 'domain',
    weight: SHOPIFY_SIGNAL_WEIGHTS.MYSHOPIFY_DOMAIN,
  },
  {
    id: 'shopify_global',
    name: 'Shopify global object',
    description: 'Public window.Shopify storefront properties',
    category: 'javascript',
    weight: SHOPIFY_SIGNAL_WEIGHTS.SHOPIFY_GLOBAL,
  },
  {
    id: 'shopify_cdn',
    name: 'Shopify CDN assets',
    description: 'Trusted Shopify-owned CDN resource URLs',
    category: 'resource',
    weight: SHOPIFY_SIGNAL_WEIGHTS.SHOPIFY_CDN,
  },
  {
    id: 'shopify_generator',
    name: 'Shopify generator metadata',
    description: 'Shopify generator or storefront metadata indicators',
    category: 'metadata',
    weight: SHOPIFY_SIGNAL_WEIGHTS.SHOPIFY_GENERATOR,
  },
  {
    id: 'shopify_storefront_script',
    name: 'Shopify storefront scripts',
    description: 'Known Shopify storefront, analytics, or Web Pixels scripts',
    category: 'resource',
    weight: SHOPIFY_SIGNAL_WEIGHTS.SHOPIFY_STOREFRONT_SCRIPT,
  },
  {
    id: 'shopify_form_action',
    name: 'Shopify cart form actions',
    description: 'Forms posting to Shopify cart routes',
    category: 'markup',
    weight: SHOPIFY_SIGNAL_WEIGHTS.SHOPIFY_FORM_ACTION,
  },
  {
    id: 'shopify_section_markup',
    name: 'Shopify section markup',
    description: 'Shopify section identifiers and payment button markup',
    category: 'markup',
    weight: SHOPIFY_SIGNAL_WEIGHTS.SHOPIFY_SECTION_MARKUP,
  },
  {
    id: 'shopify_route_pattern',
    name: 'Shopify route patterns',
    description: 'Combinations of common Shopify storefront routes',
    category: 'network',
    weight: SHOPIFY_SIGNAL_WEIGHTS.SHOPIFY_ROUTE_PATTERN,
  },
  {
    id: 'storefront_api_endpoint',
    name: 'Storefront API GraphQL endpoint',
    description: 'Public request to a *.myshopify.com/api/{version}/graphql.json endpoint',
    category: 'api',
    weight: SHOPIFY_SIGNAL_WEIGHTS.STOREFRONT_API_ENDPOINT,
  },
  {
    id: 'shopify_gid_reference',
    name: 'Shopify global ID references',
    description: 'gid://shopify/Product, ProductVariant, Collection, or Cart identifiers',
    category: 'api',
    weight: SHOPIFY_SIGNAL_WEIGHTS.SHOPIFY_GID_REFERENCE,
  },
  {
    id: 'hydrogen_runtime',
    name: 'Hydrogen/headless runtime indicators',
    description: 'Hydrogen generator metadata, Oxygen asset paths, or window.Shopify.storefront',
    category: 'runtime',
    weight: SHOPIFY_SIGNAL_WEIGHTS.HYDROGEN_RUNTIME,
  },
  {
    id: 'headless_cdn_product_resource',
    name: 'Shopify CDN product resources',
    description: 'Product asset URLs from cdn.shopify.com or shopifycdn.com',
    category: 'resource',
    weight: SHOPIFY_SIGNAL_WEIGHTS.HEADLESS_CDN_PRODUCT,
  },
  {
    id: 'headless_checkout_cart_evidence',
    name: 'Headless checkout and cart evidence',
    description: 'checkout.shopify.com, myshopify.com/checkout, /cart.js, or Shopify checkout web components',
    category: 'checkout',
    weight: SHOPIFY_SIGNAL_WEIGHTS.HEADLESS_CHECKOUT_CART,
  },
  {
    id: 'serialized_state_hint',
    name: 'Shopify-shaped serialized page state',
    description: 'JSON-LD or embedded application state containing Shopify-shaped commerce fields',
    category: 'state',
    weight: SHOPIFY_SIGNAL_WEIGHTS.SERIALIZED_STATE_HINT,
  },
] as const

export function assertPositiveWeights(weights: Record<string, number>): void {
  for (const [key, value] of Object.entries(weights)) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Invalid weight for ${key}: ${String(value)}`)
    }
  }
}

assertPositiveWeights(SHOPIFY_SIGNAL_WEIGHTS)
