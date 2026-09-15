import type { ExtensionError } from '../types/page'

interface ErrorStateProps {
  error: ExtensionError
  onRetry?: () => void
}

const FRIENDLY: Record<string, string> = {
  ACTIVE_TAB_NOT_FOUND: 'No active tab found. Click on a webpage first.',
  UNSUPPORTED_URL: 'ShopScope only works on regular web pages (http:// and https://).',
  BACKGROUND_UNAVAILABLE: 'Extension background is unavailable. Try reloading the extension.',
  CONTENT_SCRIPT_UNAVAILABLE: 'Could not connect to the page. Try refreshing the tab.',
  MESSAGE_TIMEOUT: 'Connection timed out. Please try again.',
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  const message = FRIENDLY[error.code] ?? FRIENDLY['UNKNOWN_ERROR']

  return (
    <div role="alert" className="p-4 text-center space-y-3">
      <p className="text-sm text-gray-600">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Try again
        </button>
      )}
    </div>
  )
}
