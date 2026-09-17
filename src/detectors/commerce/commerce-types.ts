export type DetectionStatus =
  | 'confirmed_shopify'
  | 'likely_shopify'
  | 'possible_headless'
  | 'shopify_connected'
  | 'unknown'
  | 'confirmed_other'

export type StorefrontType =
  | 'shopify_theme'
  | 'shopify_hydrogen'
  | 'shopify_headless'
  | 'marketing_site'
  | 'unknown'

export type CommercePlatform = 'shopify' | 'other' | 'unknown'

export type EvidenceConfidenceLevel = 'high' | 'medium' | 'low'

export interface DetectionEvidence {
  signalName: string
  category: string
  weight: number
  explanation: string
  sourceUrl?: string
  confidenceLevel: EvidenceConfidenceLevel
}

export interface ConnectedStore {
  domain: string
  url: string
  confidence: number
  evidence: DetectionEvidence[]
}

/** A discovered but not-yet-verified connected-store candidate link. */
export interface ConnectedStoreCandidate {
  domain: string
  url: string
  linkLabel: string
}

export interface CommerceDetectionResult {
  platform: CommercePlatform
  status: DetectionStatus
  storefrontType: StorefrontType
  confidence: number
  evidence: DetectionEvidence[]
  connectedStore?: ConnectedStore
  /** Present when discovery found candidate links but could not verify them (e.g. permission declined). */
  connectedCandidates?: ConnectedStoreCandidate[]
  inspectedAt: string
  durationMs: number
  detectorVersion: string
}

export interface DeepScanProgress {
  phase: 'dom' | 'resources' | 'connected_store' | 'done'
  elapsedMs: number
  partial: CommerceDetectionResult
  spaNavigationDetected: boolean
  /** Populated only on the final 'done' update. */
  connectedCandidates?: ConnectedStoreCandidate[]
}
