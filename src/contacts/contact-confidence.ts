import type { ContactConfidence, ContactSourceType } from './contact-types'

export function confidenceForEmail(sourceType: ContactSourceType, pageKind: string): ContactConfidence {
  if (sourceType === 'mailto' && (pageKind === 'contact_page' || pageKind === 'policy_page')) {
    return 'high'
  }
  if (sourceType === 'mailto' && pageKind === 'footer') return 'medium'
  if (sourceType === 'json_ld') return 'high'
  if (sourceType === 'mailto') return 'high'
  if (
    sourceType === 'visible_text' &&
    (pageKind === 'contact_page' || pageKind === 'policy_page' || pageKind === 'about_page')
  ) {
    return 'medium'
  }
  if (sourceType === 'visible_text' && pageKind === 'footer') return 'medium'
  return 'low'
}

export function confidenceForBusinessName(source: string): ContactConfidence {
  if (source === 'json_ld_organization' || source === 'json_ld_store') return 'high'
  if (source === 'og_site_name' || source === 'application_name' || source === 'shopify_shop') {
    return 'medium'
  }
  if (source === 'header_logo') return 'medium'
  return 'low'
}

export function confidenceForPhone(sourceType: ContactSourceType, pageKind: string): ContactConfidence {
  if (sourceType === 'json_ld') return 'high'
  if (sourceType === 'mailto' || sourceType === 'visible_text') {
    if (pageKind === 'contact_page' || pageKind === 'policy_page') return 'high'
    if (pageKind === 'footer' || pageKind === 'about_page') return 'medium'
  }
  if (sourceType === 'footer' || pageKind === 'footer') return 'medium'
  return 'low'
}
