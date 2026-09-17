export type {
  PageInspectionSnapshot,
  ShopifyDetectionError,
  ShopifyDetectionErrorCode,
  ShopifySignalCategory,
  ShopifySignalDefinition,
  ShopifySignalResult,
} from './detector-types'
export { SHOPIFY_DETECTION_ERROR_CODES } from './detector-types'
export {
  calculateConfidence,
  passesConfirmationSafeguard,
  sumMatchedScore,
  sumMaximumScore,
} from './confidence-calculator'
export { sanitizeSnapshot } from './shopify-detector'
export {
  assertPositiveWeights,
  CONFIRMATION_SCORE_THRESHOLD,
  DETECTOR_VERSION,
  MEDIUM_SIGNAL_WEIGHT,
  SHOPIFY_CONFIDENCE_THRESHOLDS,
  SHOPIFY_SIGNAL_DEFINITIONS,
  SHOPIFY_SIGNAL_WEIGHTS,
  VERY_HIGH_SIGNAL_WEIGHT,
} from './shopify-signals'
export {
  EVIDENCE_LIMITS,
  sanitizeEvidenceList,
  sanitizeEvidenceText,
  sanitizeEvidenceUrl,
} from './evidence-sanitizer'
export {
  evaluateShopifySignals,
  isShopifyCdnUrl,
  isValidMyshopifyHostname,
  SHOPIFY_GID_RE,
  SERIALIZED_STATE_HINT_RE,
} from './signal-matchers'
