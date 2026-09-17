import type { DetectionStatus } from '../detectors/commerce/commerce-types'

interface DetectionStatusBadgeProps {
  status: DetectionStatus
}

const LABELS: Record<DetectionStatus, string> = {
  confirmed_shopify: 'Confirmed Shopify Store',
  likely_shopify: 'Likely Shopify Store',
  possible_headless: 'Possible Headless Commerce',
  shopify_connected: 'Shopify-Connected Website',
  confirmed_other: 'Confirmed Non-Shopify Platform',
  unknown: 'Platform Unknown',
}

const CLASSES: Record<DetectionStatus, string> = {
  confirmed_shopify: 'bg-good-bg text-good-fg',
  likely_shopify: 'bg-info-bg text-info-fg',
  possible_headless: 'bg-warn-bg text-warn-fg',
  shopify_connected: 'bg-info-bg text-info-fg',
  confirmed_other: 'bg-surface-sunken text-ink-secondary',
  unknown: 'bg-surface-sunken text-ink-secondary',
}

export function DetectionStatusBadge({ status }: DetectionStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${CLASSES[status]}`}
      data-status={status}
    >
      {LABELS[status]}
    </span>
  )
}

export { LABELS as DETECTION_STATUS_LABELS }
