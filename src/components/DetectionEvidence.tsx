import type { DetectionEvidence as CommerceEvidence } from '../detectors/commerce/commerce-types'

interface DetectionEvidenceProps {
  evidence: CommerceEvidence[]
}

export function DetectionEvidence({ evidence }: DetectionEvidenceProps) {
  if (evidence.length === 0) {
    return <p className="text-xs text-ink-tertiary">No Shopify signals matched on this page.</p>
  }

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
        <span>
          Evidence ({evidence.length} matched signal{evidence.length === 1 ? '' : 's'})
        </span>
        <span
          className="text-ink-tertiary transition-transform duration-150 group-open:rotate-90"
          aria-hidden="true"
        >
          &rsaquo;
        </span>
      </summary>
      <ul className="mt-2 space-y-2.5 rounded-md bg-surface-sunken p-3">
        {evidence.map((item) => (
          <li key={`${item.signalName}-${item.explanation}`} className="text-xs">
            <p className="font-medium text-ink">
              {item.signalName}{' '}
              <span className="font-normal text-ink-tertiary">
                ({item.category} · {item.confidenceLevel})
              </span>
            </p>
            {item.explanation && (
              <p className="mt-1 break-all font-mono text-[11px] text-ink-secondary">
                {item.explanation}
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}
