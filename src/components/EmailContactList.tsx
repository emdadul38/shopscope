import type { PublicEmailContact } from '../contacts/contact-types'
import { ContactConfidenceBadge } from './ContactConfidenceBadge'

interface EmailContactListProps {
  emails: PublicEmailContact[]
  onCopy: (value: string) => void
}

export function EmailContactList({ emails, onCopy }: EmailContactListProps) {
  if (emails.length === 0) {
    return (
      <p className="text-xs text-ink-secondary">
        No public business email was found on the inspected storefront pages.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {emails.map((email) => (
        <li key={email.email} className="rounded-md border border-border px-2.5 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="break-all font-mono text-sm text-ink">{email.email}</p>
              <p className="text-[11px] capitalize text-ink-tertiary">
                {email.category.replace(/_/g, ' ')}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <ContactConfidenceBadge confidence={email.confidence} />
                <span className="text-[10px] text-ink-tertiary">{email.evidence}</span>
              </div>
              <a
                href={email.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-link hover:text-link-hover hover:underline break-all"
              >
                Source
              </a>
            </div>
            <button
              type="button"
              className="shrink-0 text-xs text-link hover:text-link-hover hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              onClick={() => onCopy(email.email)}
              aria-label={`Copy email ${email.email}`}
            >
              Copy
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
