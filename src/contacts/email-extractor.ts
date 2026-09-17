import { classifyBusinessEmail } from './email-classifier'
import { extractEmailsFromText, isValidBusinessEmail, normalizeEmailCandidate } from './email-validator'
import { confidenceForEmail } from './contact-confidence'
import type {
  ContactSourceType,
  PageContactDocument,
  PublicEmailContact,
} from './contact-types'
import { sanitizeContactEvidence, sanitizeEvidenceUrl } from './evidence-sanitizer'
import { parseJsonLdBlocks } from './structured-data-parser'

function pageKindForConfidence(doc: PageContactDocument): string {
  if (doc.pageKind === 'contact_page' || doc.pageKind === 'policy_page') return doc.pageKind
  if (doc.pageKind === 'about_page') return 'about_page'
  if (doc.pageKind === 'footer') return 'footer'
  return doc.pageKind
}

function pushEmail(
  into: Map<string, PublicEmailContact>,
  emailRaw: string,
  sourceType: ContactSourceType,
  sourceUrl: string,
  evidence: string,
  pageKind: string,
): void {
  const email = normalizeEmailCandidate(emailRaw)
  if (!isValidBusinessEmail(email)) return
  const existing = into.get(email)
  const confidence = confidenceForEmail(sourceType, pageKind)
  const rank = { high: 3, medium: 2, low: 1 }
  if (existing && rank[existing.confidence] >= rank[confidence]) return

  into.set(email, {
    email,
    category: classifyBusinessEmail(email),
    confidence,
    sourceType,
    sourceUrl: sanitizeEvidenceUrl(sourceUrl),
    evidence: sanitizeContactEvidence(evidence),
  })
}

/**
 * Extract publicly published business emails only.
 * Does not scan scripts, comments, or invent addresses.
 */
export function extractPublicEmails(doc: PageContactDocument): PublicEmailContact[] {
  const map = new Map<string, PublicEmailContact>()
  const pageKind = pageKindForConfidence(doc)

  for (const href of doc.mailtoHrefs) {
    const email = normalizeEmailCandidate(href)
    pushEmail(
      map,
      email,
      'mailto',
      doc.url,
      pageKind === 'footer'
        ? 'Found in a visible mailto link in the site footer'
        : pageKind === 'contact_page' || pageKind === 'policy_page'
          ? 'Published on the store’s contact-information page'
          : 'Found in a visible mailto link',
      pageKind,
    )
  }

  const ld = parseJsonLdBlocks(doc.jsonLdBlocks)
  for (const email of ld.emails) {
    pushEmail(
      map,
      email,
      'json_ld',
      doc.url,
      'Found in Organization structured data',
      pageKind,
    )
  }

  // Visible contact sections / footer / labeled body text only — not arbitrary page copy alone for reviews
  const visibleBuckets: Array<{ text: string; kind: string; evidence: string }> = [
    {
      text: doc.contactSectionText,
      kind: pageKind === 'homepage' ? 'contact_page' : pageKind,
      evidence: 'Found in a visible contact section',
    },
    {
      text: doc.footerText,
      kind: 'footer',
      evidence: 'Found in visible footer contact text',
    },
  ]

  if (
    doc.pageKind === 'contact_page' ||
    doc.pageKind === 'about_page' ||
    doc.pageKind === 'policy_page'
  ) {
    visibleBuckets.push({
      text: doc.bodyContactText,
      kind: doc.pageKind,
      evidence: 'Found in visible text on a contact or about page',
    })
  }

  for (const bucket of visibleBuckets) {
    for (const email of extractEmailsFromText(bucket.text)) {
      pushEmail(map, email, 'visible_text', doc.url, bucket.evidence, bucket.kind)
    }
  }

  return [...map.values()]
}
