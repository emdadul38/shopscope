import type { PageInformation, UserPreferences } from '../types/page'
import { Button } from './Button'
import { StatusBadge } from './StatusBadge'

interface PageInformationViewProps {
  pageInfo: PageInformation
  backgroundAlive: boolean
  prefs: UserPreferences
  showTechnicalDetails: boolean
  onRefresh: () => void
  onThemeChange: (theme: UserPreferences['theme']) => void
  onTechDetailsToggle: () => void
}

export function PageInformationView({
  pageInfo,
  backgroundAlive,
  prefs,
  showTechnicalDetails,
  onRefresh,
  onThemeChange,
  onTechDetailsToggle,
}: PageInformationViewProps) {
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div aria-live="polite">
        <p className="text-[11px] font-medium text-ink-tertiary">Page title</p>
        <p className="break-words text-sm text-ink">{pageInfo.title}</p>
      </div>

      <div>
        <p className="text-[11px] font-medium text-ink-tertiary">Hostname</p>
        <p className="font-mono text-sm text-ink">{pageInfo.hostname}</p>
      </div>

      <div>
        <p className="text-[11px] font-medium text-ink-tertiary">URL</p>
        <p className="break-all font-mono text-xs text-ink-secondary">{pageInfo.url}</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-secondary">Background</span>
        <StatusBadge
          label={backgroundAlive ? 'Connected' : 'Unavailable'}
          variant={backgroundAlive ? 'success' : 'error'}
        />
      </div>

      <Button className="w-full" onClick={onRefresh}>
        Refresh Page Information
      </Button>

      <div className="space-y-2.5 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <label htmlFor="tech-toggle" className="cursor-pointer text-xs text-ink-secondary">
            Show technical details
          </label>
          <button
            id="tech-toggle"
            role="switch"
            aria-checked={showTechnicalDetails}
            onClick={onTechDetailsToggle}
            className={`relative h-5 w-9 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
              showTechnicalDetails ? 'bg-brand-500' : 'bg-surface-sunken border border-border-strong'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                showTechnicalDetails ? 'translate-x-4' : ''
              }`}
            />
            <span className="sr-only">Show technical details</span>
          </button>
        </div>

        <div>
          <label htmlFor="theme-select" className="text-xs text-ink-secondary">
            Theme
          </label>
          <select
            id="theme-select"
            value={prefs.theme}
            onChange={(e) => onThemeChange(e.target.value as UserPreferences['theme'])}
            className="mt-1 w-full rounded-md border border-border bg-surface-sunken px-2 py-1 text-xs text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      {showTechnicalDetails && (
        <div className="space-y-1 border-t border-border pt-3">
          <p className="text-xs font-medium text-ink-secondary">Technical Details</p>
          <p className="font-mono text-[11px] text-ink-tertiary">
            Collected: {new Date(pageInfo.collectedAt).toLocaleString()}
          </p>
          <p className="font-mono text-[11px] text-ink-tertiary">
            Background: {backgroundAlive ? 'Online' : 'Offline'}
          </p>
        </div>
      )}
    </div>
  )
}
