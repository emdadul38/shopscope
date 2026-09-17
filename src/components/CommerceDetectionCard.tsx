import type { ExtensionError } from '../types/page'
import type { CommerceDetectionResult } from '../detectors/commerce/commerce-types'
import { Button } from './Button'
import { ConfidenceMeter } from './ConfidenceMeter'
import { DeepScanControls, type DeepScanState } from './DeepScanControls'
import { DetectionEvidence } from './DetectionEvidence'
import { DetectionStatusBadge } from './DetectionStatusBadge'
import { StorefrontTypeBadge } from './StorefrontTypeBadge'

export type DetectionCardState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: CommerceDetectionResult }
  | { status: 'error'; error: ExtensionError }

const DEEP_SCAN_ELIGIBLE_STATUSES = new Set(['unknown', 'likely_shopify', 'possible_headless'])

interface CommerceDetectionCardProps {
  state: DetectionCardState
  onRunDetection: () => void
  hasScanned: boolean
  deepScanState: DeepScanState
  onStartDeepScan: () => void
  onCancelDeepScan: () => void
}

export function CommerceDetectionCard({
  state,
  onRunDetection,
  hasScanned,
  deepScanState,
  onStartDeepScan,
  onCancelDeepScan,
}: CommerceDetectionCardProps) {
  const buttonLabel = hasScanned || state.status === 'ready' ? 'Rescan' : 'Run Detection'
  const deepScanEligible =
    state.status === 'ready' && DEEP_SCAN_ELIGIBLE_STATUSES.has(state.result.status)

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-surface-raised p-4 shadow-card"
      aria-labelledby="commerce-detection-heading"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="commerce-detection-heading" className="text-sm font-semibold text-ink">
          Commerce Detection
        </h2>
        <Button
          onClick={onRunDetection}
          disabled={state.status === 'loading'}
          aria-label={state.status === 'loading' ? 'Detection in progress' : buttonLabel}
        >
          {state.status === 'loading' ? 'Scanning…' : buttonLabel}
        </Button>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {state.status === 'loading' && (
          <div role="status" className="flex items-center gap-2 py-2 text-xs text-ink-secondary">
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
              aria-hidden="true"
            />
            <span>Inspecting page for commerce signals…</span>
          </div>
        )}

        {state.status === 'error' && (
          <div role="alert" className="space-y-1 rounded-md bg-bad-bg px-3 py-2 text-xs text-bad-fg">
            <p className="font-medium">Detection could not complete</p>
            <p>{friendlyError(state.error)}</p>
          </div>
        )}

        {state.status === 'ready' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <DetectionStatusBadge status={state.result.status} />
              <StorefrontTypeBadge storefrontType={state.result.storefrontType} />
            </div>
            <ConfidenceMeter confidence={state.result.confidence} status={state.result.status} />
            <dl className="grid grid-cols-2 gap-3 rounded-md bg-surface-sunken p-3 text-xs">
              <div>
                <dt className="text-ink-tertiary">Matched signals</dt>
                <dd className="mt-0.5 font-mono text-sm font-medium text-ink">
                  {state.result.evidence.length}
                </dd>
              </div>
              <div className="text-right">
                <dt className="text-ink-tertiary">Duration</dt>
                <dd className="mt-0.5 font-mono text-sm font-medium text-ink">
                  {state.result.durationMs} ms
                </dd>
              </div>
            </dl>

            {state.result.status === 'possible_headless' && (
              <p className="text-xs text-ink-secondary">
                The commerce platform could not be confirmed because the site does not expose
                sufficient client-side evidence.
              </p>
            )}
            {state.result.status === 'unknown' && (
              <p className="text-xs text-ink-secondary">
                Not enough public evidence was found to determine the commerce platform.
              </p>
            )}
            {state.result.status === 'confirmed_other' && (
              <p className="text-xs text-ink-secondary">
                This page shows clear evidence of a different platform, not Shopify.
              </p>
            )}

            <DetectionEvidence evidence={state.result.evidence} />

            <DeepScanControls
              visible={deepScanEligible}
              state={deepScanState}
              onStart={onStartDeepScan}
              onCancel={onCancelDeepScan}
            />
          </div>
        )}

        {state.status === 'idle' && (
          <p className="text-xs text-ink-tertiary">Run detection to inspect this page.</p>
        )}
      </div>
    </section>
  )
}

function friendlyError(error: ExtensionError): string {
  switch (error.code) {
    case 'DETECTION_TIMEOUT':
      return 'The page took too long to respond. Try Rescan.'
    case 'CONTENT_SCRIPT_INJECTION_FAILED':
      return 'ShopScope could not access this page. Try a regular http(s) storefront.'
    case 'UNSUPPORTED_DOCUMENT':
      return 'This document type cannot be inspected.'
    case 'INVALID_DETECTION_RESULT':
      return 'Received an invalid detection response.'
    default:
      return 'Something went wrong while detecting the commerce platform. Try Rescan.'
  }
}
