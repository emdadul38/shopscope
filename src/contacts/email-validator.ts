const PLACEHOLDER_EMAILS = new Set([
  'example@example.com',
  'test@test.com',
  'name@example.com',
  'your@email.com',
  'email@example.com',
  'user@domain.com',
  'someone@example.com',
  'noreply@example.com',
  'no-reply@example.com',
])

const EMAIL_RE =
  /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

export function decodeBasicHtmlEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/gi, (m) => HTML_ENTITIES[m.toLowerCase()] ?? m)
}

export function normalizeEmailCandidate(raw: string): string {
  let value = decodeBasicHtmlEntities(raw)
  value = value.trim()
  value = value.replace(/^mailto:/i, '')
  value = value.split('?')[0] ?? value
  value = value.trim().replace(/^[\s<("']+|[\s>("',;:]+$/g, '')
  return value.toLowerCase()
}

export function isValidBusinessEmail(email: string): boolean {
  if (!email || email.length < 6 || email.length > 254) return false
  if (PLACEHOLDER_EMAILS.has(email)) return false
  if (email.includes('..')) return false
  if (!EMAIL_RE.test(email)) return false
  const [local, domain] = email.split('@')
  if (!local || !domain) return false
  if (local.length > 64) return false
  // Reject image-like or tracking junk
  if (/\.(png|jpe?g|gif|webp|svg|css|js)$/i.test(domain)) return false
  return true
}

export function extractEmailsFromText(text: string): string[] {
  // Avoid matching inside long tokens; basic public-email pattern only
  const re = /[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9][a-z0-9.-]{0,253}\.[a-z]{2,}/gi
  const found: string[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    const normalized = normalizeEmailCandidate(match[0])
    if (!isValidBusinessEmail(normalized)) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    found.push(normalized)
  }
  return found
}
