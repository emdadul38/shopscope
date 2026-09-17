import { sanitizeSnapshot } from '../shopify/shopify-detector'
import { evaluateShopifySignals } from '../shopify/signal-matchers'
import { DETECTOR_VERSION } from '../shopify/shopify-signals'
import { resolveCommerceStatus, sumMatchedScore, sumMaximumScore, toDetectionEvidence } from './status-resolver'
import type { CommerceDetectionResult } from './commerce-types'
import type { PageInspectionSnapshot } from '../shopify/detector-types'

const DETECTION_STATUSES = new Set([
  'confirmed_shopify',
  'likely_shopify',
  'possible_headless',
  'shopify_connected',
  'unknown',
  'confirmed_other',
])

const STOREFRONT_TYPES = new Set([
  'shopify_theme',
  'shopify_hydrogen',
  'shopify_headless',
  'marketing_site',
  'unknown',
])

const PLATFORMS = new Set(['shopify', 'other', 'unknown'])

export function detectCommerceFromSnapshot(
  snapshot: unknown,
  startedAt = performance.now(),
): CommerceDetectionResult {
  const safeSnapshot: PageInspectionSnapshot = sanitizeSnapshot(snapshot)
  const signals = evaluateShopifySignals(safeSnapshot)
  const resolution = resolveCommerceStatus(signals, safeSnapshot.generator)
  const durationMs = Math.max(0, Math.round(performance.now() - startedAt))

  return {
    platform: resolution.platform,
    status: resolution.status,
    storefrontType: resolution.storefrontType,
    confidence: resolution.confidence,
    evidence: toDetectionEvidence(signals),
    inspectedAt: new Date().toISOString(),
    durationMs,
    detectorVersion: DETECTOR_VERSION,
  }
}

export function isCommerceDetectionResult(value: unknown): value is CommerceDetectionResult {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.platform !== 'string' || !PLATFORMS.has(v.platform)) return false
  if (typeof v.status !== 'string' || !DETECTION_STATUSES.has(v.status)) return false
  if (typeof v.storefrontType !== 'string' || !STOREFRONT_TYPES.has(v.storefrontType)) return false
  if (typeof v.confidence !== 'number' || !Number.isInteger(v.confidence)) return false
  if (v.confidence < 0 || v.confidence > 100) return false
  if (!Array.isArray(v.evidence)) return false
  if (typeof v.inspectedAt !== 'string') return false
  if (typeof v.durationMs !== 'number') return false
  if (typeof v.detectorVersion !== 'string') return false
  return true
}

export { sumMatchedScore, sumMaximumScore }
