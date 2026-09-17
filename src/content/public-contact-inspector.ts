import { CONTACT_SCAN_LIMITS, type PageContactDocument } from '../contacts/contact-types'
import { isSameOrigin, validateRedirectSameOrigin } from '../contacts/contact-page-discovery'

const MAX_TEXT = 8_000

function textContentLimited(el: Element | null, max = MAX_TEXT): string {
  if (!el) return ''
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  return text.slice(0, max)
}

function collectMailto(doc: Document): string[] {
  return [...doc.querySelectorAll('a[href^="mailto:"], a[href^="MAILTO:"]')]
    .map((a) => a.getAttribute('href') ?? '')
    .filter(Boolean)
    .slice(0, 40)
}

function collectTel(doc: Document): string[] {
  return [...doc.querySelectorAll('a[href^="tel:"], a[href^="TEL:"]')]
    .map((a) => a.getAttribute('href') ?? '')
    .filter(Boolean)
    .slice(0, 20)
}

function collectLinks(doc: Document): Array<{ href: string; text: string }> {
  return [...doc.querySelectorAll('a[href]')]
    .slice(0, 200)
    .map((a) => ({
      href: a.getAttribute('href') ?? '',
      text: (a.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
    }))
    .filter((l) => l.href && !l.href.startsWith('javascript:'))
}

function collectJsonLd(doc: Document): unknown[] {
  const blocks: unknown[] = []
  const nodes = doc.querySelectorAll('script[type="application/ld+json"]')
  for (const node of [...nodes].slice(0, 20)) {
    const raw = node.textContent?.trim()
    if (!raw || raw.length > 200_000) continue
    try {
      blocks.push(JSON.parse(raw) as unknown)
    } catch {
      // skip malformed — never treat script bodies as email sources beyond JSON-LD parse
    }
  }
  return blocks
}

function contactSectionText(doc: Document): string {
  const selectors = [
    '[id*="contact"]',
    '[class*="contact"]',
    '[id*="Contact"]',
    '[class*="Contact"]',
    'section[aria-label*="contact"]',
  ]
  const parts: string[] = []
  for (const sel of selectors) {
    try {
      const el = doc.querySelector(sel)
      if (el) parts.push(textContentLimited(el, 4_000))
    } catch {
      // ignore invalid selector
    }
  }
  return parts.join(' ').slice(0, MAX_TEXT)
}

/**
 * Build a PageContactDocument from a DOM without retaining full HTML.
 */
export function documentToContactPage(
  doc: Document,
  url: string,
  pageKind: PageContactDocument['pageKind'],
  shopifyShopName?: string,
): PageContactDocument {
  const ogSiteName =
    doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content')?.trim() ||
    undefined
  const applicationName =
    doc.querySelector('meta[name="application-name"]')?.getAttribute('content')?.trim() ||
    undefined

  const header = doc.querySelector('header')
  const footer = doc.querySelector('footer')
  const main = doc.querySelector('main') ?? doc.body

  return {
    url,
    title: doc.title ?? '',
    pageKind,
    meta: { ogSiteName, applicationName },
    headerText: textContentLimited(header, 2_000),
    footerText: textContentLimited(footer, 4_000),
    contactSectionText: contactSectionText(doc),
    bodyContactText: textContentLimited(main, MAX_TEXT),
    mailtoHrefs: collectMailto(doc),
    telHrefs: collectTel(doc),
    linkHrefs: collectLinks(doc),
    jsonLdBlocks: collectJsonLd(doc),
    shopifyShopName,
  }
}

export function parseHtmlToContactDocument(
  html: string,
  url: string,
  pageKind: PageContactDocument['pageKind'],
): PageContactDocument {
  const doc = new DOMParser().parseFromString(html.slice(0, CONTACT_SCAN_LIMITS.maxBodyBytes), 'text/html')
  return documentToContactPage(doc, url, pageKind)
}

/**
 * Same-origin HTML fetch with strict limits. Runs in the content-script / page origin context.
 */
export async function fetchSameOriginHtml(url: string, signal: AbortSignal): Promise<string> {
  if (!isSameOrigin(url, location.href)) {
    throw new Error('External origin blocked')
  }

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'omit',
    redirect: 'follow',
    signal,
    headers: { Accept: 'text/html' },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  // Enforce redirect stayed on origin when response.url is available
  if (response.url && !validateRedirectSameOrigin(url, response.url)) {
    throw new Error('Cross-origin redirect blocked')
  }
  if (response.url && !isSameOrigin(response.url, location.href)) {
    throw new Error('External origin blocked')
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('text/html')) {
    throw new Error('Non-HTML response')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    const text = await response.text()
    if (text.length > CONTACT_SCAN_LIMITS.maxBodyBytes) {
      throw new Error('Response too large')
    }
    return text
  }

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    total += value.byteLength
    if (total > CONTACT_SCAN_LIMITS.maxBodyBytes) {
      await reader.cancel()
      throw new Error('Response too large')
    }
    chunks.push(value)
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged)
}
