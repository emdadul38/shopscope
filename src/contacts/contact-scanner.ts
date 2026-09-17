import { extractBusinessIdentity } from './business-name-extractor'
import { discoverContactPages } from './contact-page-discovery'
import {
  CONTACT_SCAN_LIMITS,
  SCANNER_VERSION,
  type BusinessIdentity,
  type ContactPageReference,
  type PageContactDocument,
  type PublicContactScanResult,
  type PublicEmailContact,
  type PublicPhoneContact,
  type PublicSocialContact,
} from './contact-types'
import { extractPublicEmails } from './email-extractor'
import { extractPublicPhones } from './phone-extractor'
import { extractSocialProfiles } from './social-link-extractor'
import { sanitizeEvidenceUrl } from './evidence-sanitizer'

export interface ContactScanDeps {
  fetchPageHtml: (url: string, signal: AbortSignal) => Promise<string>
  parseHtmlToDocument: (html: string, url: string, pageKind: PageContactDocument['pageKind']) => PageContactDocument
  now?: () => number
}

function mergeEmails(lists: PublicEmailContact[][]): PublicEmailContact[] {
  const map = new Map<string, PublicEmailContact>()
  const rank = { high: 3, medium: 2, low: 1 }
  for (const list of lists) {
    for (const item of list) {
      const existing = map.get(item.email)
      if (!existing || rank[item.confidence] > rank[existing.confidence]) {
        map.set(item.email, item)
      }
    }
  }
  return [...map.values()]
}

function mergePhones(lists: PublicPhoneContact[][]): PublicPhoneContact[] {
  const map = new Map<string, PublicPhoneContact>()
  for (const list of lists) {
    for (const item of list) {
      const key = item.phone.replace(/\D/g, '')
      if (!map.has(key)) map.set(key, item)
    }
  }
  return [...map.values()]
}

function mergeSocial(lists: PublicSocialContact[][]): PublicSocialContact[] {
  const map = new Map<string, PublicSocialContact>()
  for (const list of lists) {
    for (const item of list) {
      const key = item.profileUrl.toLowerCase()
      if (!map.has(key)) map.set(key, item)
    }
  }
  return [...map.values()]
}

function pickBusiness(candidates: Array<BusinessIdentity | undefined>): BusinessIdentity | undefined {
  const rank = { high: 3, medium: 2, low: 1 }
  let best: BusinessIdentity | undefined
  for (const c of candidates) {
    if (!c?.name) continue
    if (!best || rank[c.confidence] > rank[best.confidence]) best = c
  }
  return best
}

function hasAnyContact(result: Pick<PublicContactScanResult, 'business' | 'emails' | 'phones' | 'socialProfiles' | 'contactPages'>): boolean {
  return !!(
    result.business?.name ||
    result.emails.length ||
    result.phones.length ||
    result.socialProfiles.length ||
    result.contactPages.length
  )
}

/**
 * Orchestrate a privacy-preserving public contact scan.
 * Fetches are injected so unit tests never perform network I/O.
 */
export async function runPublicContactScan(
  currentDoc: PageContactDocument,
  deps: ContactScanDeps,
  options: { signal?: AbortSignal } = {},
): Promise<PublicContactScanResult> {
  const started = (deps.now ?? (() => performance.now()))()
  const warnings: string[] = []
  const inspectedPages: string[] = [sanitizeEvidenceUrl(currentDoc.url)]
  const signal = options.signal ?? new AbortController().signal

  const emailLists: PublicEmailContact[][] = [extractPublicEmails(currentDoc)]
  const phoneLists: PublicPhoneContact[][] = [extractPublicPhones(currentDoc)]
  const socialLists: PublicSocialContact[][] = [
    extractSocialProfiles(currentDoc, currentDoc.url),
  ]
  const businessCandidates: Array<BusinessIdentity | undefined> = [
    extractBusinessIdentity(currentDoc),
  ]

  const discovered = discoverContactPages(currentDoc, currentDoc.url)
  const contactPages: ContactPageReference[] = [...discovered]

  const totalDeadline = Date.now() + CONTACT_SCAN_LIMITS.totalTimeoutMs

  for (const page of discovered.slice(0, CONTACT_SCAN_LIMITS.maxAdditionalPages)) {
    if (signal.aborted) {
      warnings.push('Scan cancelled by user')
      break
    }
    if (Date.now() > totalDeadline) {
      warnings.push('Total scan timeout reached; returning partial results')
      break
    }

    try {
      const remaining = Math.max(250, totalDeadline - Date.now())
      const timeout = Math.min(CONTACT_SCAN_LIMITS.perRequestTimeoutMs, remaining)
      const controller = new AbortController()
      const onAbort = () => controller.abort()
      if (signal.aborted) {
        warnings.push('Scan cancelled by user')
        break
      }
      signal.addEventListener('abort', onAbort, { once: true })
      const timer = setTimeout(() => controller.abort(), timeout)
      try {
        const html = await deps.fetchPageHtml(page.url, controller.signal)
        const kind =
          /policy/i.test(page.url) || /legal/i.test(page.url)
            ? 'policy_page'
            : /about/i.test(page.url)
              ? 'about_page'
              : 'contact_page'
        const doc = deps.parseHtmlToDocument(html, page.url, kind)
        inspectedPages.push(sanitizeEvidenceUrl(page.url))
        emailLists.push(extractPublicEmails(doc))
        phoneLists.push(extractPublicPhones(doc))
        socialLists.push(extractSocialProfiles(doc, currentDoc.url))
        businessCandidates.push(extractBusinessIdentity(doc))
      } finally {
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
      }
    } catch (err) {
      if (signal.aborted) {
        warnings.push('Scan cancelled by user')
        break
      }
      warnings.push(
        `Could not fetch ${sanitizeEvidenceUrl(page.url)}: ${
          err instanceof Error ? err.message : 'request failed'
        }`,
      )
    }
  }

  if (discovered.length > 0 && inspectedPages.length === 1) {
    warnings.push(
      'Same-origin contact pages could not be fetched; results are limited to the current page',
    )
  }

  const emails = mergeEmails(emailLists)
  const phones = mergePhones(phoneLists)
  const socialProfiles = mergeSocial(socialLists)
  const business = pickBusiness(businessCandidates)
  const durationMs = Math.max(0, Math.round((deps.now ?? (() => performance.now()))() - started))

  const base = {
    business,
    emails,
    phones,
    socialProfiles,
    contactPages,
    inspectedPages: [...new Set(inspectedPages)],
    warnings,
    scannedAt: new Date().toISOString(),
    durationMs,
    scannerVersion: SCANNER_VERSION,
  }

  if (signal.aborted && !hasAnyContact(base)) {
    return { ...base, status: 'failed' }
  }

  if (!hasAnyContact(base)) {
    return { ...base, status: 'not_found' }
  }

  if (warnings.length > 0) {
    return { ...base, status: 'partial' }
  }

  return { ...base, status: 'completed' }
}

export function isPublicContactScanResult(value: unknown): value is PublicContactScanResult {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (!['completed', 'partial', 'not_found', 'failed'].includes(v.status as string)) return false
  if (!Array.isArray(v.emails) || !Array.isArray(v.phones)) return false
  if (!Array.isArray(v.socialProfiles) || !Array.isArray(v.contactPages)) return false
  if (!Array.isArray(v.inspectedPages) || !Array.isArray(v.warnings)) return false
  if (typeof v.scannedAt !== 'string' || typeof v.durationMs !== 'number') return false
  if (typeof v.scannerVersion !== 'string') return false
  return true
}

export function formatContactSummary(
  result: PublicContactScanResult,
  websiteUrl: string,
): string {
  const lines: string[] = []
  if (result.business?.name) lines.push(`Store: ${result.business.name}`)
  lines.push(`Website: ${websiteUrl}`)
  for (const email of result.emails) {
    lines.push(`Email: ${email.email}`)
    lines.push(`Category: ${email.category}`)
  }
  for (const phone of result.phones) {
    lines.push(`Phone: ${phone.phone}`)
  }
  if (result.contactPages[0]) {
    lines.push(`Contact page: ${result.contactPages[0].url}`)
  }
  for (const social of result.socialProfiles) {
    lines.push(`${social.platform}: ${social.profileUrl}`)
  }
  lines.push('Source: Public storefront contact information')
  lines.push(`Scanned: ${result.scannedAt}`)
  return lines.join('\n')
}
