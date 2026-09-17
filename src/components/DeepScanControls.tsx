import type { DeepScanProgress } from '../detectors/commerce/commerce-types'
import { Button } from './Button'

export type DeepScanState =
  | { status: 'idle' }
  | { status: 'scanning'; progress: DeepScanProgress | null }
  | { status: 'done'; progress: DeepScanProgress }

interface DeepScanControlsProps {
  visible: boolean
  state: DeepScanState
  onStart: () => void
  onCancel: () => void
}

const PHASE_LABELS: Record<DeepScanProgress['phase'], string> = {
  dom: 'Re-inspecting page…',
  resources: 'Observing new network resources…',
  connected_store: 'Checking for a connected store…',
  done: 'Deep scan complete',
}

export function DeepScanControls({ visible, state, onStart, onCancel }: DeepScanControlsProps) {
  if (!visible && state.status === 'idle') return null

  return (
    <div className="space-y-2 rounded-md border border-border px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-ink">Deep Scan</p>
          <p className="text-[11px] text-ink-tertiary">
            Re-inspects the page, watches for new resources for up to 10s, and looks for a
            connected store. Stops automatically after 15s.
          </p>
        </div>
        {state.status !== 'scanning' && (
          <Button variant="secondary" onClick={onStart}>
            Deep Scan
          </Button>
        )}
        {state.status === 'scanning' && (
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>

      {state.status === 'scanning' && (
        <div role="status" className="flex items-center gap-2 text-xs text-ink-secondary">
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
            aria-hidden="true"
          />
          <span>
            {state.progress ? PHASE_LABELS[state.progress.phase] : 'Starting deep scan…'}
            {state.progress ? ` · ${Math.round(state.progress.elapsedMs / 1000)}s` : ''}
          </span>
        </div>
      )}

      {state.status === 'done' && (
        <p className="text-xs text-ink-secondary">
          {PHASE_LABELS.done} · {Math.round(state.progress.elapsedMs / 1000)}s
          {state.progress.spaNavigationDetected ? ' · SPA navigation detected' : ''}
        </p>
      )}
    </div>
  )
}
