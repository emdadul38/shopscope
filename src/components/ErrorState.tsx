import type { ExtensionError } from '../types/page'
import { Button } from './Button'

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
    <div role="alert" className="space-y-3 px-4 py-8 text-center">
      <p className="text-sm text-ink-secondary">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
