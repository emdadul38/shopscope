type ContactScanUiStatus = 'idle' | 'loading' | 'ready' | 'error'

interface ContactScanStatusProps {
  status: ContactScanUiStatus
  message?: string
}

export function ContactScanStatus({ status, message }: ContactScanStatusProps) {
  if (status === 'loading') {
    return (
      <div role="status" className="flex items-center gap-2 text-xs text-ink-secondary">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
          aria-hidden="true"
        />
        <span>{message ?? 'Scanning public contact information…'}</span>
      </div>
    )
  }

  if (status === 'error' && message) {
    return (
      <p role="alert" className="text-xs text-bad-fg">
        {message}
      </p>
    )
  }

  return null
}
