interface StatusBadgeProps {
  label: string
  variant: 'success' | 'warning' | 'error' | 'info'
}

const variantClasses: Record<StatusBadgeProps['variant'], string> = {
  success: 'bg-good-bg text-good-fg',
  warning: 'bg-warn-bg text-warn-fg',
  error: 'bg-bad-bg text-bad-fg',
  info: 'bg-info-bg text-info-fg',
}

export function StatusBadge({ label, variant }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${variantClasses[variant]}`}
    >
      {label}
    </span>
  )
}
