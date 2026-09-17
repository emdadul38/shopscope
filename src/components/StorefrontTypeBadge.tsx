import type { StorefrontType } from '../detectors/commerce/commerce-types'

interface StorefrontTypeBadgeProps {
  storefrontType: StorefrontType
}

const LABELS: Partial<Record<StorefrontType, string>> = {
  shopify_theme: 'Shopify theme',
  shopify_hydrogen: 'Hydrogen',
  shopify_headless: 'Custom headless',
  marketing_site: 'Marketing site',
}

export function StorefrontTypeBadge({ storefrontType }: StorefrontTypeBadgeProps) {
  const label = LABELS[storefrontType]
  if (!label) return null

  return (
    <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs font-medium text-ink-secondary">
      {label}
    </span>
  )
}
