export type ContactConfidence = 'high' | 'medium' | 'low'

export type ContactSourceType =
  | 'mailto'
  | 'visible_text'
  | 'json_ld'
  | 'meta'
  | 'header'
  | 'footer'
  | 'contact_page'
  | 'about_page'
  | 'policy_page'

export type BusinessEmailCategory =
  | 'general'
  | 'support'
  | 'sales'
  | 'privacy'
  | 'legal'
  | 'press'
  | 'personal_business_contact'
  | 'unknown'

export type BusinessNameSource =
  | 'json_ld_organization'
  | 'json_ld_store'
  | 'og_site_name'
  | 'application_name'
  | 'shopify_shop'
  | 'header_logo'
  | 'document_title'

export interface BusinessIdentity {
  name?: string
  sourceUrl: string
  sourceType: BusinessNameSource
  confidence: ContactConfidence
  evidence: string
}

export interface PublicEmailContact {
  email: string
  category: BusinessEmailCategory
  confidence: ContactConfidence
  sourceType: ContactSourceType
  sourceUrl: string
  evidence: string
}

export interface PublicPhoneContact {
  phone: string
  confidence: ContactConfidence
  sourceType: ContactSourceType
  sourceUrl: string
  evidence: string
}

export interface PublicSocialContact {
  platform: string
  profileUrl: string
  sourceUrl: string
}

export interface ContactPageReference {
  url: string
  label?: string
}

export interface PublicContactScanResult {
  status: 'completed' | 'partial' | 'not_found' | 'failed'
  business?: BusinessIdentity
  emails: PublicEmailContact[]
  phones: PublicPhoneContact[]
  socialProfiles: PublicSocialContact[]
  contactPages: ContactPageReference[]
  inspectedPages: string[]
  warnings: string[]
  scannedAt: string
  durationMs: number
  scannerVersion: string
}

export type ContactScanErrorCode =
  | 'SHOPIFY_NOT_CONFIRMED'
  | 'CONTACT_SCAN_NOT_USER_INITIATED'
  | 'ACTIVE_TAB_NOT_FOUND'
  | 'TAB_URL_CHANGED'
  | 'UNSUPPORTED_URL'
  | 'CONTACT_SCAN_TIMEOUT'
  | 'CONTACT_PAGE_FETCH_FAILED'
  | 'INVALID_CONTACT_RESULT'
  | 'CONTACT_SCAN_CANCELLED'
  | 'CONTACT_SCAN_FAILED'

export const CONTACT_SCAN_ERROR_CODES = {
  SHOPIFY_NOT_CONFIRMED: 'SHOPIFY_NOT_CONFIRMED',
  CONTACT_SCAN_NOT_USER_INITIATED: 'CONTACT_SCAN_NOT_USER_INITIATED',
  ACTIVE_TAB_NOT_FOUND: 'ACTIVE_TAB_NOT_FOUND',
  TAB_URL_CHANGED: 'TAB_URL_CHANGED',
  UNSUPPORTED_URL: 'UNSUPPORTED_URL',
  CONTACT_SCAN_TIMEOUT: 'CONTACT_SCAN_TIMEOUT',
  CONTACT_PAGE_FETCH_FAILED: 'CONTACT_PAGE_FETCH_FAILED',
  INVALID_CONTACT_RESULT: 'INVALID_CONTACT_RESULT',
  CONTACT_SCAN_CANCELLED: 'CONTACT_SCAN_CANCELLED',
  CONTACT_SCAN_FAILED: 'CONTACT_SCAN_FAILED',
} as const

export const SCANNER_VERSION = '1.0.0'

export const CONTACT_SCAN_LIMITS = {
  maxAdditionalPages: 5,
  maxBodyBytes: 1_000_000,
  perRequestTimeoutMs: 5_000,
  totalTimeoutMs: 15_000,
  maxRedirects: 1,
  evidenceMaxLength: 160,
  cacheTtlMs: 30 * 60 * 1000,
} as const

/** Intermediate page extraction input (no full HTML retained). */
export interface PageContactDocument {
  url: string
  title: string
  pageKind: ContactSourceType | 'homepage'
  meta: {
    ogSiteName?: string
    applicationName?: string
  }
  headerText: string
  footerText: string
  contactSectionText: string
  bodyContactText: string
  mailtoHrefs: string[]
  telHrefs: string[]
  linkHrefs: Array<{ href: string; text: string }>
  jsonLdBlocks: unknown[]
  shopifyShopName?: string
}

export interface ContactScanProgress {
  phase: 'current_page' | 'discovering' | 'fetching' | 'done'
  inspectedCount: number
  message: string
}
