import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 px-3 py-1.5 text-white hover:bg-brand-600',
  secondary:
    'border border-border px-3 py-1.5 text-ink hover:border-border-strong hover:bg-surface-sunken',
  ghost: 'px-0 py-0 text-link hover:text-link-hover hover:underline',
}

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />
  )
}
