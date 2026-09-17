import { SERIALIZED_STATE_HINT_RE, SHOPIFY_GID_RE } from '../detectors/shopify/signal-matchers'

const MAX_NETWORK_URLS = 150
const MAX_INLINE_SCRIPTS = 40
const MAX_SCRIPT_TEXT_LENGTH = 20_000
const MAX_GID_REFERENCES = 10
const MAX_STATE_HINTS = 10

/**
 * Public network request URLs observed via the Resource Timing API.
 * URL only — never headers, bodies, or timing/auth data.
 */
export function inspectNetworkRequestUrls(perf: Performance = performance): string[] {
  try {
    const entries = perf.getEntriesByType('resource') as PerformanceResourceTiming[]
    const urls = entries.map((e) => e.name).filter(Boolean)
    return dedupe(urls).slice(0, MAX_NETWORK_URLS)
  } catch {
    return []
  }
}

/**
 * Bounded scan of inline <script> text (JSON-LD and embedded app state) for
 * Shopify-shaped identifiers. Only the matched substrings are extracted and
 * returned — never the surrounding script content.
 */
export function inspectInlineScriptEvidence(doc: Document = document): {
  shopifyGidReferences: string[]
  serializedStateHints: string[]
} {
  const gidReferences = new Set<string>()
  const stateHints = new Set<string>()

  const scripts = doc.querySelectorAll('script[type="application/ld+json"], script[type="application/json"], script:not([src]):not([type])')

  let inspected = 0
  for (const script of scripts) {
    if (inspected >= MAX_INLINE_SCRIPTS) break
    inspected += 1

    const text = (script.textContent ?? '').slice(0, MAX_SCRIPT_TEXT_LENGTH)
    if (!text) continue

    SHOPIFY_GID_RE.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = SHOPIFY_GID_RE.exec(text)) !== null) {
      gidReferences.add(match[0])
      if (gidReferences.size >= MAX_GID_REFERENCES) break
    }

    if (SERIALIZED_STATE_HINT_RE.test(text)) {
      const scriptType = script.getAttribute('type') ?? 'inline script'
      stateHints.add(`Shopify-shaped commerce fields found in ${scriptType}`)
    }

    if (gidReferences.size >= MAX_GID_REFERENCES && stateHints.size >= MAX_STATE_HINTS) break
  }

  return {
    shopifyGidReferences: [...gidReferences].slice(0, MAX_GID_REFERENCES),
    serializedStateHints: [...stateHints].slice(0, MAX_STATE_HINTS),
  }
}

function dedupe(values: string[]): string[] {
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
