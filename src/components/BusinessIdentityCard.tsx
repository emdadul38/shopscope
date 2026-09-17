import type { BusinessIdentity } from '../contacts/contact-types'
import { ContactConfidenceBadge } from './ContactConfidenceBadge'

interface BusinessIdentityCardProps {
  business: BusinessIdentity
  onCopy: (value: string) => void
}

export function BusinessIdentityCard({ business, onCopy }: BusinessIdentityCardProps) {
  if (!business.name) return null

  return (
    <div className="space-y-1.5 rounded-md border border-border px-3 py-2.5">
      <p className="text-[11px] font-medium text-ink-tertiary">Business name</p>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-ink">{business.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <ContactConfidenceBadge confidence={business.confidence} />
            <span className="text-[10px] text-ink-tertiary">{business.evidence}</span>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs text-link hover:text-link-hover hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          onClick={() => onCopy(business.name ?? '')}
          aria-label={`Copy business name ${business.name}`}
        >
          Copy
        </button>
      </div>
    </div>
  )
}
