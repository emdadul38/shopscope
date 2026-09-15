interface StatusBadgeProps {
  label: string
  variant: 'success' | 'warning' | 'error' | 'info'
}

const variantClasses: Record<StatusBadgeProps['variant'], string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
}

export function StatusBadge({ label, variant }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantClasses[variant]}`}
    >
      {label}
    </span>
  )
}
