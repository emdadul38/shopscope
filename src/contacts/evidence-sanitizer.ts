import { CONTACT_SCAN_LIMITS } from './contact-types'

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g // eslint-disable-line no-control-regex

export function sanitizeContactEvidence(raw: string): string {
  let text = raw.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim()
  text = text.replace(/https?:\/\/[^\s]+/gi, (url) => sanitizeEvidenceUrl(url))
  if (text.length > CONTACT_SCAN_LIMITS.evidenceMaxLength) {
    text = `${text.slice(0, CONTACT_SCAN_LIMITS.evidenceMaxLength - 1)}…`
  }
  return text
}

export function sanitizeEvidenceUrl(raw: string): string {
  try {
    const url = new URL(raw)
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return raw.split(/[?#]/)[0] ?? raw
  }
}

export function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const key = v.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(v.trim())
  }
  return out
}
