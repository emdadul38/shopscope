const MAX_EVIDENCE_ENTRIES = 5
const MAX_EVIDENCE_LENGTH = 160

const SENSITIVE_QUERY_KEYS = /^(token|access_token|auth|password|secret|key|session|cookie|sid)$/i

/**
 * Sanitize evidence strings for safe display and messaging.
 * Never returns full HTML, cookies, tokens, or raw inline script bodies.
 */
export function sanitizeEvidenceUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  try {
    const base = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed
    const url = new URL(base, 'https://example.invalid')
    // Drop query and hash entirely for evidence.
    url.search = ''
    url.hash = ''
    let out = url.toString()
    if (trimmed.startsWith('//') && out.startsWith('https://')) {
      out = `//${out.slice('https://'.length)}`
    }
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      out = `${url.pathname}`
    }
    return truncate(out)
  } catch {
    return truncate(stripQueryish(trimmed))
  }
}

export function sanitizeEvidenceText(raw: string): string {
  let text = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  text = text.replace(/(?:cookie|authorization|bearer)\s*[:=]\s*\S+/gi, '[redacted]')
  text = stripQueryish(text)
  return truncate(text)
}

export function sanitizeEvidenceList(entries: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const entry of entries) {
    if (typeof entry !== 'string') continue
    const cleaned = sanitizeEvidenceText(entry)
    if (!cleaned) continue
    const key = cleaned.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(cleaned)
    if (result.length >= MAX_EVIDENCE_ENTRIES) break
  }

  return result
}

function truncate(value: string): string {
  if (value.length <= MAX_EVIDENCE_LENGTH) return value
  return `${value.slice(0, MAX_EVIDENCE_LENGTH - 1)}…`
}

function stripQueryish(value: string): string {
  // Remove query strings from URL-like substrings
  let out = value.replace(/(\bhttps?:\/\/[^\s?#]+)\?[^\s]*/gi, '$1')
  out = out.replace(/(\/[^\s?#]+)\?[^\s]*/g, '$1')
  // Redact obvious sensitive key=value pairs left in plain text
  out = out.replace(
    new RegExp(`(?:^|[?&])(${SENSITIVE_QUERY_KEYS.source})=([^&\\s]+)`, 'gi'),
    '[redacted]',
  )
  return out
}

export const EVIDENCE_LIMITS = {
  maxEntries: MAX_EVIDENCE_ENTRIES,
  maxLength: MAX_EVIDENCE_LENGTH,
} as const
