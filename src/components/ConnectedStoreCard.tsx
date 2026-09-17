import type { ExtensionError } from '../types/page'
import type { ConnectedStore, ConnectedStoreCandidate } from '../detectors/commerce/commerce-types'
import { Button } from './Button'

export type ConnectedStoreState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; connectedStore?: ConnectedStore; candidates: ConnectedStoreCandidate[] }
  | { status: 'error'; error: ExtensionError }

interface ConnectedStoreCardProps {
  visible: boolean
  currentDomain: string
  state: ConnectedStoreState
  onDiscover: () => void
  onOpenStore: (url: string) => void
}

export function ConnectedStoreCard({
  visible,
  currentDomain,
  state,
  onDiscover,
  onOpenStore,
}: ConnectedStoreCardProps) {
  if (!visible && state.status === 'idle') return null

  return (
    <section className="space-y-2 border-t border-border pt-4" aria-labelledby="connected-store-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="connected-store-heading" className="text-sm font-semibold text-ink">
          Connected Store
        </h2>
        {state.status !== 'loading' && (
          <Button variant="secondary" onClick={onDiscover}>
            {state.status === 'ready' ? 'Rescan links' : 'Find Connected Store'}
          </Button>
        )}
      </div>

      {state.status === 'idle' && (
        <p className="text-xs text-ink-tertiary">
          Looks for a linked Shopify storefront (Shop / Store / Buy Now / Products / Equipment)
          on this page.
        </p>
      )}

      {state.status === 'loading' && (
        <div role="status" className="flex items-center gap-2 text-xs text-ink-secondary">
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
            aria-hidden="true"
          />
          <span>Looking for a connected storefront…</span>
        </div>
      )}

      {state.status === 'error' && (
        <p role="alert" className="text-xs text-bad-fg">
          Could not check for a connected store. Try again.
        </p>
      )}

      {state.status === 'ready' && state.connectedStore && (
        <div className="space-y-2 rounded-md bg-info-bg px-3 py-2.5 text-xs text-info-fg">
          <p className="font-semibold">Shopify-Connected Website</p>
          <p>
            Current site: <span className="font-mono">{currentDomain}</span>
          </p>
          <p>
            Shopify storefront: <span className="font-mono">{state.connectedStore.domain}</span>
          </p>
          <Button onClick={() => onOpenStore(state.connectedStore!.url)}>Open Storefront</Button>
        </div>
      )}

      {state.status === 'ready' && !state.connectedStore && state.candidates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-ink-secondary">
            Found {state.candidates.length} possible storefront link
            {state.candidates.length === 1 ? '' : 's'}. Opening one lets ShopScope verify it on
            its own page — nothing is fetched automatically.
          </p>
          <ul className="space-y-1.5">
            {state.candidates.map((candidate) => (
              <li
                key={candidate.domain}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5"
              >
                <span className="truncate font-mono text-xs text-ink">{candidate.domain}</span>
                <Button variant="secondary" onClick={() => onOpenStore(candidate.url)}>
                  Open &amp; Scan
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.status === 'ready' && !state.connectedStore && state.candidates.length === 0 && (
        <p className="text-xs text-ink-tertiary">No connected storefront links were found.</p>
      )}
    </section>
  )
}
