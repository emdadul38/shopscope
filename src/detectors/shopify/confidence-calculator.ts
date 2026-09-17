import type { ShopifySignalResult } from './detector-types'
import { CONFIRMATION_SCORE_THRESHOLD, MEDIUM_SIGNAL_WEIGHT, VERY_HIGH_SIGNAL_WEIGHT } from './shopify-signals'

export function calculateConfidence(
  matchedScore: number,
  threshold = CONFIRMATION_SCORE_THRESHOLD,
): number {
  if (!Number.isFinite(matchedScore) || matchedScore <= 0) return 0
  if (!Number.isFinite(threshold) || threshold <= 0) return 0
  return Math.round(Math.min(100, (matchedScore / threshold) * 100))
}

/**
 * Confirmation requires independent evidence:
 * - at least one very-high signal plus another independent category, or
 * - at least three medium+ signals from distinct categories
 */
export function passesConfirmationSafeguard(matchedSignals: ShopifySignalResult[]): boolean {
  const matched = matchedSignals.filter((s) => s.matched)
  if (matched.length === 0) return false

  const categories = new Set(matched.map((s) => s.category))
  const veryHigh = matched.filter((s) => s.weight >= VERY_HIGH_SIGNAL_WEIGHT)
  if (veryHigh.length >= 1 && categories.size >= 2) return true

  const mediumOrHigher = matched.filter((s) => s.weight >= MEDIUM_SIGNAL_WEIGHT)
  const mediumCategories = new Set(mediumOrHigher.map((s) => s.category))
  return mediumCategories.size >= 3
}

export function sumMatchedScore(signals: ShopifySignalResult[]): number {
  return signals.filter((s) => s.matched).reduce((sum, s) => sum + s.weight, 0)
}

export function sumMaximumScore(signals: ShopifySignalResult[]): number {
  return signals.reduce((sum, s) => sum + s.weight, 0)
}
