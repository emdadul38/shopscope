export type {
  CommerceDetectionResult,
  CommercePlatform,
  ConnectedStore,
  ConnectedStoreCandidate,
  DeepScanProgress,
  DetectionEvidence,
  DetectionStatus,
  EvidenceConfidenceLevel,
  StorefrontType,
} from './commerce-types'
export { detectCommerceFromSnapshot, isCommerceDetectionResult } from './commerce-detector'
export { attachConnectedStore, resolveCommerceStatus, toDetectionEvidence } from './status-resolver'
export type { CommerceStatusResolution } from './status-resolver'
