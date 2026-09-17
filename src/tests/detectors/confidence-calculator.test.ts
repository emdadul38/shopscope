import { describe, expect, it } from 'vitest'
import {
  calculateConfidence,
  passesConfirmationSafeguard,
  sumMatchedScore,
} from '../../detectors/shopify/confidence-calculator'
import type { ShopifySignalResult } from '../../detectors/shopify/detector-types'
import {
  assertPositiveWeights,
  CONFIRMATION_SCORE_THRESHOLD,
  SHOPIFY_CONFIDENCE_THRESHOLDS,
  SHOPIFY_SIGNAL_WEIGHTS,
} from '../../detectors/shopify/shopify-signals'

function signal(
  partial: Partial<ShopifySignalResult> &
    Pick<ShopifySignalResult, 'id' | 'category' | 'weight' | 'matched'>,
): ShopifySignalResult {
  return {
    name: partial.id,
    evidence: partial.matched ? ['evidence'] : [],
    ...partial,
  }
}

describe('SHOPIFY_SIGNAL_WEIGHTS', () => {
  it('contains only positive finite weights', () => {
    expect(() => assertPositiveWeights(SHOPIFY_SIGNAL_WEIGHTS)).not.toThrow()
    for (const value of Object.values(SHOPIFY_SIGNAL_WEIGHTS)) {
      expect(Number.isFinite(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
    }
  })

  it('rejects invalid weights', () => {
    expect(() => assertPositiveWeights({ BAD: 0 })).toThrow(/Invalid weight/)
    expect(() => assertPositiveWeights({ BAD: -1 })).toThrow(/Invalid weight/)
    expect(() => assertPositiveWeights({ BAD: Number.NaN })).toThrow(/Invalid weight/)
  })
})

describe('calculateConfidence', () => {
  it('returns 0 for non-positive scores', () => {
    expect(calculateConfidence(0)).toBe(0)
    expect(calculateConfidence(-10)).toBe(0)
    expect(calculateConfidence(Number.NaN)).toBe(0)
  })

  it('maps confirmation threshold to 100', () => {
    expect(calculateConfidence(CONFIRMATION_SCORE_THRESHOLD)).toBe(100)
  })

  it('caps at 100 for scores above threshold', () => {
    expect(calculateConfidence(CONFIRMATION_SCORE_THRESHOLD * 2)).toBe(100)
  })

  it('rounds to nearest integer', () => {
    expect(calculateConfidence(CONFIRMATION_SCORE_THRESHOLD / 2)).toBe(50)
  })

  it('uses central thresholds', () => {
    expect(SHOPIFY_CONFIDENCE_THRESHOLDS.confirmed).toBe(90)
    expect(SHOPIFY_CONFIDENCE_THRESHOLDS.highlyLikely).toBe(70)
    expect(SHOPIFY_CONFIDENCE_THRESHOLDS.possible).toBe(40)
  })
})

describe('confirmation safeguard', () => {
  it('rejects a single weak signal even at high confidence', () => {
    const signals = [signal({ id: 'route', category: 'network', weight: 4, matched: true })]
    expect(passesConfirmationSafeguard(signals)).toBe(false)
  })

  it('accepts very-high signal plus another independent category', () => {
    const signals = [
      signal({ id: 'myshopify', category: 'domain', weight: 30, matched: true }),
      signal({ id: 'cdn', category: 'resource', weight: 18, matched: true }),
    ]
    expect(passesConfirmationSafeguard(signals)).toBe(true)
  })

  it('rejects two matches from the same category alone for three-medium rule', () => {
    const signals = [
      signal({ id: 'a', category: 'resource', weight: 18, matched: true }),
      signal({ id: 'b', category: 'resource', weight: 16, matched: true }),
    ]
    // Has very-high? 18 < 22, so needs 3 medium categories — fails
    expect(passesConfirmationSafeguard(signals)).toBe(false)
  })

  it('accepts three independent medium categories', () => {
    const signals = [
      signal({ id: 'cdn', category: 'resource', weight: 18, matched: true }),
      signal({ id: 'form', category: 'markup', weight: 10, matched: true }),
      signal({ id: 'meta', category: 'metadata', weight: 18, matched: true }),
    ]
    expect(passesConfirmationSafeguard(signals)).toBe(true)
  })

  it('sums matched scores only', () => {
    const signals = [
      signal({ id: 'a', category: 'domain', weight: 30, matched: true }),
      signal({ id: 'b', category: 'resource', weight: 18, matched: false }),
    ]
    expect(sumMatchedScore(signals)).toBe(30)
  })
})
