import type { ShopifySignalResult } from '../shopify/detector-types'
import {
  calculateConfidence,
  passesConfirmationSafeguard,
  sumMatchedScore,
  sumMaximumScore,
} from '../shopify/confidence-calculator'
import {
  MEDIUM_SIGNAL_WEIGHT,
  SHOPIFY_CONFIDENCE_THRESHOLDS,
  VERY_HIGH_SIGNAL_WEIGHT,
} from '../shopify/shopify-signals'
import type {
  CommerceDetectionResult,
  CommercePlatform,
  ConnectedStore,
  DetectionEvidence,
  DetectionStatus,
  EvidenceConfidenceLevel,
  StorefrontType,
} from './commerce-types'

const THEME_SIGNAL_IDS = new Set([
  'myshopify_domain',
  'shopify_global',
  'shopify_cdn',
  'shopify_generator',
  'shopify_storefront_script',
  'shopify_form_action',
  'shopify_section_markup',
  'shopify_route_pattern',
])

const HEADLESS_SIGNAL_IDS = new Set([
  'storefront_api_endpoint',
  'shopify_gid_reference',
  'headless_cdn_product_resource',
  'headless_checkout_cart_evidence',
  'serialized_state_hint',
])

const HYDROGEN_SIGNAL_ID = 'hydrogen_runtime'

const NON_SHOPIFY_GENERATOR_RE =
  /^(wordpress|woocommerce|wix|squarespace|webflow|bigcommerce|magento|prestashop|joomla|drupal|shopware|ghost|opencart|volusion)\b/i

type ConfidenceTier = 'confirmed' | 'likely' | 'possible' | 'none'

function classifyTier(confidence: number): ConfidenceTier {
  const c = Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : 0
  if (c >= SHOPIFY_CONFIDENCE_THRESHOLDS.confirmed) return 'confirmed'
  if (c >= SHOPIFY_CONFIDENCE_THRESHOLDS.highlyLikely) return 'likely'
  if (c >= SHOPIFY_CONFIDENCE_THRESHOLDS.possible) return 'possible'
  return 'none'
}

function demote(tier: ConfidenceTier): ConfidenceTier {
  if (tier === 'confirmed') return 'likely'
  if (tier === 'likely') return 'possible'
  return tier
}

export interface CommerceStatusResolution {
  platform: CommercePlatform
  status: DetectionStatus
  storefrontType: StorefrontType
  confidence: number
}

/**
 * Maps matched signals to the new DetectionStatus/StorefrontType model.
 * Reuses the existing weighted-signal confidence math; the independent-category
 * safeguard now also gates the "likely" tier so weak same-category stacks
 * (e.g. two "api" signals alone) cannot reach a contact-scan-eligible status.
 */
export function resolveCommerceStatus(
  signals: ShopifySignalResult[],
  generator: string | undefined,
): CommerceStatusResolution {
  const matched = signals.filter((s) => s.matched)
  const score = sumMatchedScore(signals)
  const confidence = calculateConfidence(score)

  let tier = classifyTier(confidence)
  if ((tier === 'confirmed' || tier === 'likely') && !passesConfirmationSafeguard(matched)) {
    tier = demote(tier)
  }

  const hydrogenMatched = matched.some((s) => s.id === HYDROGEN_SIGNAL_ID)
  const themeMatched = matched.some((s) => THEME_SIGNAL_IDS.has(s.id))
  const headlessMatched = matched.some((s) => HEADLESS_SIGNAL_IDS.has(s.id))

  if (tier === 'confirmed' || tier === 'likely') {
    const status: DetectionStatus = tier === 'confirmed' ? 'confirmed_shopify' : 'likely_shopify'
    const storefrontType: StorefrontType = hydrogenMatched
      ? 'shopify_hydrogen'
      : themeMatched
        ? 'shopify_theme'
        : headlessMatched
          ? 'shopify_headless'
          : 'unknown'
    return { platform: 'shopify', status, storefrontType, confidence }
  }

  if (headlessMatched) {
    return {
      platform: 'shopify',
      status: 'possible_headless',
      storefrontType: hydrogenMatched ? 'shopify_hydrogen' : 'shopify_headless',
      confidence,
    }
  }

  if (score === 0 && generator && NON_SHOPIFY_GENERATOR_RE.test(generator.trim())) {
    return { platform: 'other', status: 'confirmed_other', storefrontType: 'unknown', confidence }
  }

  return { platform: 'unknown', status: 'unknown', storefrontType: 'unknown', confidence }
}

function evidenceConfidenceLevel(weight: number): EvidenceConfidenceLevel {
  if (weight >= VERY_HIGH_SIGNAL_WEIGHT) return 'high'
  if (weight >= MEDIUM_SIGNAL_WEIGHT) return 'medium'
  return 'low'
}

const URL_IN_TEXT_RE = /https?:\/\/[^\s]+|\/\/[^\s]+|(?<=: )\/[^\s]+/

function extractSourceUrl(evidenceStrings: string[]): string | undefined {
  for (const text of evidenceStrings) {
    const match = URL_IN_TEXT_RE.exec(text)
    if (match) return match[0].split('?')[0].split('#')[0]
  }
  return undefined
}

/**
 * Overlays a verified connected store onto a base (marketing-site) result.
 * The marketing site itself is never classified as a Shopify storefront —
 * only the discovered, independently-verified connected store is.
 */
export function attachConnectedStore(
  base: CommerceDetectionResult,
  connectedStore: ConnectedStore,
): CommerceDetectionResult {
  return {
    ...base,
    platform: 'shopify',
    status: 'shopify_connected',
    storefrontType: 'marketing_site',
    connectedStore,
  }
}

export function toDetectionEvidence(signals: ShopifySignalResult[]): DetectionEvidence[] {
  return signals
    .filter((s) => s.matched)
    .map((s) => ({
      signalName: s.name,
      category: s.category,
      weight: s.weight,
      explanation: s.evidence.join('; '),
      sourceUrl: extractSourceUrl(s.evidence),
      confidenceLevel: evidenceConfidenceLevel(s.weight),
    }))
}

export { sumMatchedScore, sumMaximumScore }
