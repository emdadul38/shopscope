import { CONTACT_SCAN_LIMITS, type ContactPageReference, type PageContactDocument } from './contact-types'
import { sanitizeEvidenceUrl } from './evidence-sanitizer'

const CONTACT_LABEL_RE =
  /\b(contact(?:\s*us)?|about(?:\s*us)?|customer\s*service|support|help|imprint|legal\s*notice)\b/i

const CONTACT_PATH_RE =
  /\/(pages\/)?(contact(?:-us)?|about(?:-us)?|support|help|customer-service|imprint|legal-notice)\b|\/policies\/(contact-information|legal-notice)\b/i

export function isSameOrigin(candidate: string, baseUrl: string): boolean {
  try {
    const base = new URL(baseUrl)
    const url = new URL(candidate, base)
    return url.origin === base.origin && (url.protocol === 'http:' || url.protocol === 'https:')
  } catch {
    return false
  }
}

export function normalizeSameOriginUrl(candidate: string, baseUrl: string): string | null {
  if (!isSameOrigin(candidate, baseUrl)) return null
  try {
    const url = new URL(candidate, baseUrl)
    url.hash = ''
    // Keep path; drop tracking query noise for crawl identity
    const drop = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
    for (const key of drop) url.searchParams.delete(key)
    return url.toString()
  } catch {
    return null
  }
}

export function isContactRelatedLink(href: string, label: string): boolean {
  if (CONTACT_LABEL_RE.test(label)) return true
  try {
    const path = new URL(href, 'https://example.invalid').pathname
    return CONTACT_PATH_RE.test(path)
  } catch {
    return CONTACT_PATH_RE.test(href)
  }
}

export function discoverContactPages(
  doc: PageContactDocument,
  baseUrl: string,
): ContactPageReference[] {
  const found: ContactPageReference[] = []
  const seen = new Set<string>()

  for (const link of doc.linkHrefs) {
    if (!isContactRelatedLink(link.href, link.text)) continue
    const normalized = normalizeSameOriginUrl(link.href, baseUrl)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    // Skip the current page
    try {
      if (new URL(normalized).pathname === new URL(baseUrl).pathname) continue
    } catch {
      continue
    }
    seen.add(key)
    found.push({
      url: sanitizeEvidenceUrl(normalized),
      label: link.text.trim().slice(0, 80) || undefined,
    })
    if (found.length >= CONTACT_SCAN_LIMITS.maxAdditionalPages) break
  }

  return found
}

export function validateRedirectSameOrigin(
  requestUrl: string,
  redirectUrl: string,
): boolean {
  return isSameOrigin(redirectUrl, requestUrl)
}
