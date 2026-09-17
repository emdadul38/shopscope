import { detectCommerceFromSnapshot } from '../detectors/commerce/commerce-detector'
import type { CommerceDetectionResult, ConnectedStoreCandidate, DeepScanProgress } from '../detectors/commerce/commerce-types'
import type { PageInspectionSnapshot } from '../detectors/shopify/detector-types'
import { discoverConnectedStoreCandidates } from './connected-store-inspector'
import { inspectInlineScriptEvidence, inspectNetworkRequestUrls } from './headless-inspector'

export const DEEP_SCAN_RESOURCE_WINDOW_MS = 10_000
export const DEEP_SCAN_HARD_LIMIT_MS = 15_000
const POLL_INTERVAL_MS = 1_000

export type DeepScanCollectSnapshot = () => PageInspectionSnapshot

export interface DeepScanHandle {
  cancel: () => void
  /** Resolves when the scan finishes, is cancelled, or hits the hard time limit. */
  done: Promise<{ finalResult: CommerceDetectionResult; connectedCandidates: ConnectedStoreCandidate[] }>
}

/**
 * User-triggered deep scan: re-inspects the DOM, observes newly-loaded
 * resource URLs for up to DEEP_SCAN_RESOURCE_WINDOW_MS, detects SPA
 * navigation via location changes, then discovers connected-store links.
 * Hard-stops at DEEP_SCAN_HARD_LIMIT_MS and is cancellable at any point.
 */
export function startDeepScan(
  collectSnapshot: DeepScanCollectSnapshot,
  onProgress: (progress: DeepScanProgress) => void,
): DeepScanHandle {
  const startedAt = Date.now()
  let cancelled = false
  const initialUrl = location.href
  let spaNavigationDetected = false

  const baselineSnapshot = collectSnapshot()
  const baselineResourceUrls = new Set(inspectNetworkRequestUrls())
  const discoveredResourceUrls = new Set<string>()

  const buildResult = (): CommerceDetectionResult => {
    const snapshot = collectSnapshot()
    const inline = inspectInlineScriptEvidence()
    const merged: PageInspectionSnapshot = {
      ...snapshot,
      networkRequestUrls: [...inspectNetworkRequestUrls(), ...discoveredResourceUrls],
      shopifyGidReferences: [...baselineSnapshot.shopifyGidReferences, ...inline.shopifyGidReferences],
      serializedStateHints: [
        ...baselineSnapshot.serializedStateHints,
        ...inline.serializedStateHints,
      ],
    }
    return detectCommerceFromSnapshot(merged)
  }

  let resolveDone!: (value: {
    finalResult: CommerceDetectionResult
    connectedCandidates: ConnectedStoreCandidate[]
  }) => void
  const done = new Promise<{
    finalResult: CommerceDetectionResult
    connectedCandidates: ConnectedStoreCandidate[]
  }>((resolve) => {
    resolveDone = resolve
  })

  const emit = (phase: DeepScanProgress['phase'], connectedCandidates?: ConnectedStoreCandidate[]) => {
    onProgress({
      phase,
      elapsedMs: Date.now() - startedAt,
      partial: buildResult(),
      spaNavigationDetected,
      connectedCandidates,
    })
  }

  const finish = () => {
    clearInterval(timer)
    clearTimeout(hardStopTimer)
    const candidates = cancelled ? [] : discoverConnectedStoreCandidates()
    emit('connected_store', candidates)
    const finalResult = buildResult()
    emit('done', candidates)
    resolveDone({ finalResult, connectedCandidates: candidates })
  }

  // Phase 1: immediate DOM re-inspection.
  emit('dom')

  // Phase 2: observe new resource URLs + SPA navigation for up to the resource window.
  emit('resources')
  const timer: ReturnType<typeof setInterval> = setInterval(() => {
    if (cancelled) return
    for (const url of inspectNetworkRequestUrls()) {
      if (!baselineResourceUrls.has(url)) discoveredResourceUrls.add(url)
    }
    if (location.href !== initialUrl) spaNavigationDetected = true
    emit('resources')
  }, POLL_INTERVAL_MS)

  const resourceWindowTimer = setTimeout(() => {
    clearInterval(timer)
    if (!cancelled) finish()
  }, DEEP_SCAN_RESOURCE_WINDOW_MS)

  const hardStopTimer: ReturnType<typeof setTimeout> = setTimeout(() => {
    clearTimeout(resourceWindowTimer)
    clearInterval(timer)
    if (!cancelled) finish()
  }, DEEP_SCAN_HARD_LIMIT_MS)

  return {
    cancel: () => {
      if (cancelled) return
      cancelled = true
      clearTimeout(resourceWindowTimer)
      clearInterval(timer)
      clearTimeout(hardStopTimer)
      const finalResult = buildResult()
      emit('done')
      resolveDone({ finalResult, connectedCandidates: [] })
    },
    done,
  }
}
