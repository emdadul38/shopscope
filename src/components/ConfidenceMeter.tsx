import type { DetectionStatus } from '../detectors/commerce/commerce-types'

interface ConfidenceMeterProps {
  confidence: number
  status: DetectionStatus
}

const BAR_COLORS: Record<DetectionStatus, string> = {
  confirmed_shopify: 'bg-[var(--good-fg)]',
  likely_shopify: 'bg-[var(--info-fg)]',
  possible_headless: 'bg-[var(--warn-fg)]',
  shopify_connected: 'bg-[var(--info-fg)]',
  confirmed_other: 'bg-[var(--text-tertiary)]',
  unknown: 'bg-[var(--text-tertiary)]',
}

export function ConfidenceMeter({ confidence, status }: ConfidenceMeterProps) {
  const value = Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs text-ink-secondary">
        <span>Confidence</span>
        <span className="font-mono text-ink">{value}%</span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-label={`Detection confidence ${value} percent`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken"
      >
        <div
          className={`h-full rounded-full transition-all ${BAR_COLORS[status]}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}
