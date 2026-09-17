import { confidenceForPhone } from './contact-confidence'
import type { PageContactDocument, PublicPhoneContact } from './contact-types'
import { sanitizeContactEvidence, sanitizeEvidenceUrl } from './evidence-sanitizer'
import { parseJsonLdBlocks } from './structured-data-parser'

const PHONE_IN_TEXT = /(?:\+?\d[\d\s().-]{7,}\d)/g

function normalizePhone(raw: string): string | undefined {
  const cleaned = raw.replace(/^tel:/i, '').trim()
  const digits = cleaned.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return undefined
  // Keep a readable form without inventing a country code
  return cleaned.replace(/\s+/g, ' ').slice(0, 32)
}

export function extractPublicPhones(doc: PageContactDocument): PublicPhoneContact[] {
  const map = new Map<string, PublicPhoneContact>()
  const pageKind = doc.pageKind

  const add = (raw: string, sourceType: PublicPhoneContact['sourceType'], evidence: string) => {
    const phone = normalizePhone(raw)
    if (!phone) return
    const key = phone.replace(/\D/g, '')
    if (map.has(key)) return
    map.set(key, {
      phone,
      confidence: confidenceForPhone(sourceType, pageKind),
      sourceType,
      sourceUrl: sanitizeEvidenceUrl(doc.url),
      evidence: sanitizeContactEvidence(evidence),
    })
  }

  for (const href of doc.telHrefs) {
    add(href, 'visible_text', 'Found in a visible tel: link')
  }

  const ld = parseJsonLdBlocks(doc.jsonLdBlocks)
  for (const phone of ld.phones) {
    add(phone, 'json_ld', 'Found in Organization structured data')
  }

  const textPools = [doc.contactSectionText, doc.footerText]
  if (doc.pageKind === 'contact_page' || doc.pageKind === 'about_page' || doc.pageKind === 'policy_page') {
    textPools.push(doc.bodyContactText)
  }
  for (const text of textPools) {
    const matches = text.match(PHONE_IN_TEXT) ?? []
    for (const m of matches) {
      add(m, 'visible_text', 'Found in a clearly labeled contact section')
    }
  }

  return [...map.values()]
}
