import type { ConnectedStoreCandidate } from '../detectors/commerce/commerce-types'

const MAX_CANDIDATES = 2
const LINK_LABEL_RE = /\b(shop|store|buy now|products|equipment)\b/i

/**
 * Registered-domain heuristic (last two labels, e.g. "example.com").
 * Does not implement a full public-suffix list, so multi-part TLDs like
 * "co.uk" are treated as three labels — documented as a known limitation.
 */
function registeredDomain(hostname: string): string {
  const labels = hostname.toLowerCase().split('.').filter(Boolean)
  if (labels.length <= 2) return labels.join('.')
  return labels.slice(-2).join('.')
}

function linkText(el: Element): string {
  const aria = el.getAttribute('aria-label')?.trim()
  const text = el.textContent?.trim()
  return `${aria ?? ''} ${text ?? ''}`.trim()
}

/**
 * Scan same-registered-domain anchor links for a "shop/store/buy now/products/
 * equipment" label, e.g. discovering shop.example.com from www.example.com.
 * Never returns links to unrelated external domains. Runs only when invoked
 * explicitly (user-triggered discovery / deep scan), never automatically.
 */
export function discoverConnectedStoreCandidates(
  doc: Document = document,
  currentUrl: string = location.href,
): ConnectedStoreCandidate[] {
  let currentHostname: string
  try {
    currentHostname = new URL(currentUrl).hostname.toLowerCase()
  } catch {
    return []
  }
  const currentRegistrable = registeredDomain(currentHostname)

  const candidates: ConnectedStoreCandidate[] = []
  const seenDomains = new Set<string>()
  const anchors = doc.querySelectorAll('a[href]')

  for (const anchor of anchors) {
    if (candidates.length >= MAX_CANDIDATES) break

    const label = linkText(anchor)
    if (!LINK_LABEL_RE.test(label)) continue

    const href = anchor.getAttribute('href')
    if (!href) continue

    let url: URL
    try {
      url = new URL(href, currentUrl)
    } catch {
      continue
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue

    const hostname = url.hostname.toLowerCase()
    if (hostname === currentHostname) continue
    if (registeredDomain(hostname) !== currentRegistrable) continue
    if (seenDomains.has(hostname)) continue

    seenDomains.add(hostname)
    candidates.push({
      domain: hostname,
      url: `${url.origin}${url.pathname}`,
      linkLabel: label.slice(0, 60),
    })
  }

  return candidates
}
