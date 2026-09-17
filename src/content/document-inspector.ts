const MAX_LINKS = 80
const MAX_FORMS = 40
const MAX_HINTS = 40
const MAX_META = 30

const MYSHOPIFY_EXTRACT_RE =
  /\b(?:https?:)?\/\/((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+myshopify\.com)\b/gi

/**
 * Collect targeted markup signals without serializing the full document.
 */
export function inspectDocument(doc: Document = document): {
  generator?: string
  linkHrefs: string[]
  formActions: string[]
  markupHints: string[]
  metaContents: string[]
  myshopifyHosts: string[]
} {
  const generator =
    doc.querySelector('meta[name="generator"]')?.getAttribute('content')?.trim() || undefined

  const linkHrefs = unique(
    [...doc.querySelectorAll('a[href]')]
      .slice(0, MAX_LINKS)
      .map((el) => el.getAttribute('href') ?? '')
      .filter(Boolean),
  )

  const formActions = unique(
    [...doc.querySelectorAll('form[action]')]
      .slice(0, MAX_FORMS)
      .map((el) => el.getAttribute('action') ?? '')
      .filter(Boolean),
  )

  const markupHints: string[] = []
  const hintSelectors = [
    '[data-shopify]',
    '.shopify-section',
    '[id^="shopify-section"]',
    '.shopify-payment-button',
    '.shopify-product-form',
    'form[action*="/cart/add"]',
    'input[name="id"]',
  ]
  for (const selector of hintSelectors) {
    if (doc.querySelector(selector)) {
      markupHints.push(selectorToHint(selector))
      if (markupHints.length >= MAX_HINTS) break
    }
  }

  const metaContents = unique(
    [...doc.querySelectorAll('meta[content]')]
      .slice(0, MAX_META)
      .map((el) => {
        const name = el.getAttribute('name') ?? el.getAttribute('property') ?? ''
        const content = el.getAttribute('content') ?? ''
        return `${name}: ${content}`.trim()
      })
      .filter(Boolean),
  )

  const myshopifyHosts = new Set<string>()
  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')
  collectMyshopify(canonical, myshopifyHosts)
  for (const href of linkHrefs) collectMyshopify(href, myshopifyHosts)
  for (const action of formActions) collectMyshopify(action, myshopifyHosts)
  for (const meta of metaContents) collectMyshopify(meta, myshopifyHosts)

  return {
    generator,
    linkHrefs,
    formActions,
    markupHints: unique(markupHints),
    metaContents,
    myshopifyHosts: [...myshopifyHosts],
  }
}

function selectorToHint(selector: string): string {
  if (selector.includes('data-shopify')) return 'data-shopify'
  if (selector.includes('shopify-section')) return 'shopify-section'
  if (selector.includes('shopify-payment-button')) return 'shopify-payment-button'
  if (selector.includes('shopify-product-form')) return 'shopify-product-form'
  if (selector.includes('/cart/add')) return 'form[action*=/cart/add]'
  if (selector.includes('name="id"')) return 'name="id"'
  return selector
}

function collectMyshopify(value: string | null | undefined, into: Set<string>): void {
  if (!value) return
  MYSHOPIFY_EXTRACT_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = MYSHOPIFY_EXTRACT_RE.exec(value)) !== null) {
    into.add(match[1].toLowerCase())
  }
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const key = v.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(key)
  }
  return out
}
