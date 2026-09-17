import type { ExtensionError } from '../types/page'
import type { PublicContactScanResult } from '../contacts/contact-types'
import type { DetectionStatus } from '../detectors/commerce/commerce-types'
import { formatContactSummary } from '../contacts/contact-scanner'
import { BusinessIdentityCard } from './BusinessIdentityCard'
import { Button } from './Button'
import { ContactPrivacyNotice } from './ContactPrivacyNotice'
import { ContactScanStatus } from './ContactScanStatus'
import { EmailContactList } from './EmailContactList'

export type ContactCardState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; result: PublicContactScanResult }
  | { status: 'error'; error: ExtensionError }

const CONTACT_SCAN_ALLOWED_STATUSES = new Set<DetectionStatus>([
  'confirmed_shopify',
  'likely_shopify',
  'shopify_connected',
])

interface PublicContactCardProps {
  detectionStatus: DetectionStatus | null
  detectionError?: boolean
  state: ContactCardState
  websiteUrl: string
  connectedStoreUrl?: string
  onScan: (force: boolean) => void
  onCancel: () => void
  onOpenConnectedStore?: (url: string) => void
  onRetryDetection?: () => void
}

async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    // Clipboard may be unavailable in some contexts
  }
}

const SECTION_HEADING = 'Public Contact Information'

export function PublicContactCard({
  detectionStatus,
  detectionError,
  state,
  websiteUrl,
  connectedStoreUrl,
  onScan,
  onCancel,
  onOpenConnectedStore,
  onRetryDetection,
}: PublicContactCardProps) {
  if (detectionError) {
    return (
      <section className="space-y-2 border-t border-border pt-4" aria-labelledby="contact-scan-heading">
        <h2 id="contact-scan-heading" className="text-sm font-semibold text-ink">
          {SECTION_HEADING}
        </h2>
        <p className="text-xs text-ink-secondary">
          Detection did not complete, so contact scanning is unavailable.
        </p>
        {onRetryDetection && <Button onClick={onRetryDetection}>Retry detection</Button>}
      </section>
    )
  }

  if (!detectionStatus || !CONTACT_SCAN_ALLOWED_STATUSES.has(detectionStatus)) {
    if (detectionStatus === 'possible_headless' || detectionStatus === 'unknown') {
      return (
        <section className="space-y-2 border-t border-border pt-4" aria-labelledby="contact-scan-heading">
          <h2 id="contact-scan-heading" className="text-sm font-semibold text-ink">
            {SECTION_HEADING}
          </h2>
          <p className="text-xs text-ink-secondary">
            Contact scan is unavailable because the commerce platform could not be confirmed.
          </p>
        </section>
      )
    }
    return null
  }

  const hasResult = state.status === 'ready'
  const buttonLabel =
    state.status === 'loading' ? 'Scanning…' : hasResult ? 'Rescan' : 'Find Public Contact Information'

  return (
    <section className="space-y-3 border-t border-border pt-4" aria-labelledby="contact-scan-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="contact-scan-heading" className="text-sm font-semibold text-ink">
          {SECTION_HEADING}
        </h2>
        <div className="flex items-center gap-3">
          {state.status === 'loading' && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          {detectionStatus !== 'shopify_connected' && (
            <Button
              onClick={() => onScan(hasResult)}
              disabled={state.status === 'loading'}
              aria-label={buttonLabel}
            >
              {buttonLabel}
            </Button>
          )}
        </div>
      </div>

      {detectionStatus === 'likely_shopify' && (
        <p role="note" className="rounded-md bg-warn-bg px-3 py-2 text-xs text-warn-fg">
          This storefront could not be fully confirmed as Shopify. Contact details may be less
          reliable — verify before relying on them.
        </p>
      )}

      {detectionStatus === 'shopify_connected' && (
        <div className="space-y-2 rounded-md bg-info-bg px-3 py-2.5 text-xs text-info-fg">
          <p>Choose which site to scan for public contact information:</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => onScan(hasResult)} disabled={state.status === 'loading'}>
              {buttonLabel} (current site)
            </Button>
            {connectedStoreUrl && onOpenConnectedStore && (
              <Button variant="secondary" onClick={() => onOpenConnectedStore(connectedStoreUrl)}>
                Open &amp; scan connected storefront
              </Button>
            )}
          </div>
        </div>
      )}

      <ContactPrivacyNotice />

      <div aria-live="polite" aria-atomic="true" className="space-y-3">
        <ContactScanStatus
          status={state.status === 'ready' ? 'idle' : state.status}
          message={
            state.status === 'error'
              ? friendlyContactError(state.error)
              : state.status === 'loading'
                ? 'Scanning public contact information…'
                : undefined
          }
        />

        {state.status === 'ready' && (
          <>
            {state.result.warnings.length > 0 && (
              <ul className="list-disc space-y-0.5 rounded-md bg-warn-bg px-3 py-2 pl-6 text-[11px] text-warn-fg">
                {state.result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}

            {state.result.business && (
              <BusinessIdentityCard
                business={state.result.business}
                onCopy={(v) => void copyText(v)}
              />
            )}

            <div>
              <p className="mb-1 text-[11px] font-medium text-ink-tertiary">Public emails</p>
              <EmailContactList emails={state.result.emails} onCopy={(v) => void copyText(v)} />
            </div>

            {state.result.phones.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-medium text-ink-tertiary">Phone</p>
                <ul className="space-y-1">
                  {state.result.phones.map((phone) => (
                    <li
                      key={phone.phone}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm"
                    >
                      <span className="font-mono text-ink">{phone.phone}</span>
                      <button
                        type="button"
                        className="text-xs text-link hover:text-link-hover hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                        onClick={() => void copyText(phone.phone)}
                        aria-label={`Copy phone ${phone.phone}`}
                      >
                        Copy
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {state.result.contactPages.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-medium text-ink-tertiary">Contact pages</p>
                <ul className="space-y-1">
                  {state.result.contactPages.map((page) => (
                    <li key={page.url}>
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-xs text-link hover:text-link-hover hover:underline"
                      >
                        {page.label ?? page.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {state.result.socialProfiles.length > 0 && (
              <div>
                <p className="mb-1 text-[11px] font-medium text-ink-tertiary">Social profiles</p>
                <ul className="space-y-1">
                  {state.result.socialProfiles.map((s) => (
                    <li key={s.profileUrl}>
                      <a
                        href={s.profileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all text-xs text-link hover:text-link-hover hover:underline"
                      >
                        {s.platform}: {s.profileUrl}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button variant="secondary" className="w-full" onClick={() => void copyText(formatContactSummary(state.result, websiteUrl))}>
              Copy Contact Summary
            </Button>

            <p className="font-mono text-[10px] text-ink-tertiary">
              {state.result.inspectedPages.length} page
              {state.result.inspectedPages.length === 1 ? '' : 's'} · {state.result.durationMs}ms ·{' '}
              {state.result.status}
            </p>
          </>
        )}
      </div>
    </section>
  )
}

function friendlyContactError(error: ExtensionError): string {
  switch (error.code) {
    case 'SHOPIFY_NOT_CONFIRMED':
      return 'This storefront could not be confirmed. Rescan detection, then try again.'
    case 'TAB_URL_CHANGED':
      return 'The page changed. Refresh detection, then try again.'
    case 'CONTACT_SCAN_TIMEOUT':
      return 'The contact scan timed out. Try again.'
    case 'CONTACT_SCAN_CANCELLED':
      return 'Contact scan cancelled.'
    case 'CONTACT_SCAN_NOT_USER_INITIATED':
      return 'Contact scanning only runs when you click the button.'
    default:
      return 'Contact scan could not complete. Try again.'
  }
}
