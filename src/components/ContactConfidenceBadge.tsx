import type { ContactConfidence } from '../contacts/contact-types'

const LABELS: Record<ContactConfidence, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
}

const CLASSES: Record<ContactConfidence, string> = {
  high: 'bg-good-bg text-good-fg',
  medium: 'bg-info-bg text-info-fg',
  low: 'bg-surface-sunken text-ink-secondary',
}

export function ContactConfidenceBadge({ confidence }: { confidence: ContactConfidence }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${CLASSES[confidence]}`}
    >
      {LABELS[confidence]}
    </span>
  )
}
