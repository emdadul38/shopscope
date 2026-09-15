import type { PageInformation, UserPreferences } from '../types/page'
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
    <div className="space-y-3">
      <div aria-live="polite">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Page Title</p>
        <p className="text-sm text-gray-900 break-words">{pageInfo.title}</p>
      </div>

      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Hostname</p>
        <p className="text-sm text-gray-900">{pageInfo.hostname}</p>
      </div>

      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">URL</p>
        <p className="text-sm text-gray-900 break-all">{pageInfo.url}</p>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Background</span>
        <StatusBadge
          label={backgroundAlive ? 'Connected' : 'Unavailable'}
          variant={backgroundAlive ? 'success' : 'error'}
        />
      </div>

      <button
        onClick={onRefresh}
        className="w-full px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        Refresh Page Information
      </button>

      <div className="border-t border-gray-100 pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="tech-toggle" className="text-xs text-gray-600 cursor-pointer">
            Show technical details
          </label>
          <button
            id="tech-toggle"
            role="switch"
            aria-checked={showTechnicalDetails}
            onClick={onTechDetailsToggle}
            className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
              showTechnicalDetails ? 'bg-indigo-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                showTechnicalDetails ? 'translate-x-4' : ''
              }`}
            />
            <span className="sr-only">Show technical details</span>
          </button>
        </div>

        <div>
          <label htmlFor="theme-select" className="text-xs text-gray-600">
            Theme
          </label>
          <select
            id="theme-select"
            value={prefs.theme}
            onChange={(e) => onThemeChange(e.target.value as UserPreferences['theme'])}
            className="mt-1 w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      {showTechnicalDetails && (
        <div className="border-t border-gray-100 pt-3 space-y-1">
          <p className="text-xs font-medium text-gray-700">Technical Details</p>
          <p className="text-xs text-gray-500">
            Collected: {new Date(pageInfo.collectedAt).toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">
            Background: {backgroundAlive ? 'Online' : 'Offline'}
          </p>
        </div>
      )}
    </div>
  )
}
