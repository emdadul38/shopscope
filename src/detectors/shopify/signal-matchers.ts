import type { PageInspectionSnapshot, ShopifySignalResult } from './detector-types'
import { sanitizeEvidenceList, sanitizeEvidenceUrl } from './evidence-sanitizer'
import { SHOPIFY_SIGNAL_DEFINITIONS, SHOPIFY_SIGNAL_WEIGHTS } from './shopify-signals'

const SHOPIFY_CDN_HOSTS = new Set(['cdn.shopify.com', 'cdn.shopifycdn.net', 'shopifycdn.com'])

const STOREFRONT_API_ENDPOINT_RE = /\/api\/(?:\d{4}-\d{2}|unstable)\/graphql\.json(?:$|[/?#])/i

/** Exported for reuse by the content-script inline-state scanner. */
export const SHOPIFY_GID_RE =
  /gid:\/\/shopify\/(?:Product|ProductVariant|Collection|Cart)\/[A-Za-z0-9_-]+/g

const HYDROGEN_ASSET_RE = /(?:hydrogen|oxygen\.shopifyapps\.com|shopifycloud\.com\/hydrogen)/i

const HEADLESS_CHECKOUT_RE = /(?:checkout\.shopify\.com|myshopify\.com\/checkout|\/cart\.js(?:$|[/?#]))/i

const CHECKOUT_WEB_COMPONENT_HINTS = ['shop-pay-button', 'shopify-payment-terms', 'shopify-accelerated-checkout']

/** Exported for reuse by the content-script inline-state scanner. */
export const SERIALIZED_STATE_HINT_RE =
  /"@type"\s*:\s*"(?:Product|Offer)"|"shop_id"\s*:|"variantId"\s*:|"shopify(?:Product|Variant|CartId)"\s*:/i

const STOREFRONT_SCRIPT_PATTERNS: RegExp[] = [
  /cdn\.shopify\.com\/.*(shopify|shop_events|trekkie|shopify_pay|web-pixels)/i,
  /\/cdn\/wpm\//i,
  /\/cdn\/shopifycloud\//i,
  /shopifycloud\.com\/.*(checkout|shopify)/i,
  /monorail-edge\.shopifysvc\.com/i,
]

const MYSHOPIFY_HOST_RE = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+myshopify\.com$/i

const CART_FORM_ACTIONS = [
  /\/cart\/add(?:\.js)?$/i,
  /\/cart\/update(?:\.js)?$/i,
  /\/cart\/change(?:\.js)?$/i,
]

const SECTION_HINTS = [
  'data-shopify',
  'shopify-section',
  'shopify-payment-button',
  'shopify-product-form',
  'data-product-id',
  'name="id"',
]

const ROUTE_PATTERNS: { id: string; re: RegExp }[] = [
  { id: 'products', re: /\/products\//i },
  { id: 'collections', re: /\/collections\//i },
  { id: 'cart', re: /\/cart(?:\/|$|\?)/i },
  { id: 'cart_add', re: /\/cart\/add/i },
  { id: 'checkouts', re: /\/checkouts?\//i },
  { id: 'account', re: /\/account(?:\/|$|\?)/i },
]

export function evaluateShopifySignals(snapshot: PageInspectionSnapshot): ShopifySignalResult[] {
  return SHOPIFY_SIGNAL_DEFINITIONS.map((def) => {
    switch (def.id) {
      case 'myshopify_domain':
        return matchMyshopify(def.id, def.name, def.category, def.weight, snapshot)
      case 'shopify_global':
        return matchGlobal(def.id, def.name, def.category, def.weight, snapshot)
      case 'shopify_cdn':
        return matchCdn(def.id, def.name, def.category, def.weight, snapshot)
      case 'shopify_generator':
        return matchGenerator(def.id, def.name, def.category, def.weight, snapshot)
      case 'shopify_storefront_script':
        return matchStorefrontScripts(def.id, def.name, def.category, def.weight, snapshot)
      case 'shopify_form_action':
        return matchFormActions(def.id, def.name, def.category, def.weight, snapshot)
      case 'shopify_section_markup':
        return matchSectionMarkup(def.id, def.name, def.category, def.weight, snapshot)
      case 'shopify_route_pattern':
        return matchRoutes(def.id, def.name, def.category, def.weight, snapshot)
      case 'storefront_api_endpoint':
        return matchStorefrontApiEndpoint(def.id, def.name, def.category, def.weight, snapshot)
      case 'shopify_gid_reference':
        return matchGidReferences(def.id, def.name, def.category, def.weight, snapshot)
      case 'hydrogen_runtime':
        return matchHydrogenRuntime(def.id, def.name, def.category, def.weight, snapshot)
      case 'headless_cdn_product_resource':
        return matchHeadlessCdnProduct(def.id, def.name, def.category, def.weight, snapshot)
      case 'headless_checkout_cart_evidence':
        return matchHeadlessCheckoutCart(def.id, def.name, def.category, def.weight, snapshot)
      case 'serialized_state_hint':
        return matchSerializedStateHint(def.id, def.name, def.category, def.weight, snapshot)
      default:
        return {
          id: def.id,
          name: def.name,
          category: def.category,
          matched: false,
          weight: def.weight,
          evidence: [],
        }
    }
  })
}

function isShopifyCdnHost(host: string): boolean {
  for (const entry of SHOPIFY_CDN_HOSTS) {
    if (host === entry || host.endsWith(`.${entry}`)) return true
  }
  return false
}

export function isValidMyshopifyHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!MYSHOPIFY_HOST_RE.test(host)) return false
  // Reject bare myshopify.com and invalid labels
  const labels = host.split('.')
  if (labels.length < 3) return false
  if (labels.some((l) => l.length === 0 || l.startsWith('-') || l.endsWith('-'))) return false
  return true
}

export function isShopifyCdnUrl(rawUrl: string): boolean {
  try {
    const normalized = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl
    const url = new URL(normalized, 'https://example.invalid')
    const host = url.hostname.toLowerCase()
    if (isShopifyCdnHost(host)) return true
    if (/\/cdn\/shop\//i.test(url.pathname)) return true
    if (/\/cdn\/wpm\//i.test(url.pathname)) return true
    if (/\/cdn\/shopifycloud\//i.test(url.pathname)) return true
    return false
  } catch {
    return /(?:cdn\.shopify\.com|\/cdn\/shop\/|\/cdn\/wpm\/)/i.test(rawUrl)
  }
}

function matchMyshopify(
  id: string,
  name: string,
  category: ShopifySignalResult['category'],
  weight: number,
  snapshot: PageInspectionSnapshot,
): ShopifySignalResult {
  const hosts = new Set<string>()
  if (isValidMyshopifyHostname(snapshot.hostname)) hosts.add(snapshot.hostname.toLowerCase())
  for (const h of snapshot.myshopifyHosts) {
    if (isValidMyshopifyHostname(h)) hosts.add(h.toLowerCase())
  }
  const evidence = [...hosts].map((h) => `Validated myshopify.com hostname reference: ${h}`)
  return result(id, name, category, weight, evidence)
}

function matchGlobal(
  id: string,
  name: string,
  category: ShopifySignalResult['category'],
  weight: number,
  snapshot: PageInspectionSnapshot,
): ShopifySignalResult {
  if (!snapshot.shopifyGlobal.present) {
    return result(id, name, category, weight, [])
  }
  const evidence = sanitizeEvidenceList([
    'Public window.Shopify object detected',
    ...(snapshot.shopifyGlobal.shop
      ? [`Shopify.shop present: ${snapshot.shopifyGlobal.shop}`]
      : []),
    ...snapshot.shopifyGlobal.evidence,
  ])
  return result(id, name, category, weight, evidence)
}

function matchCdn(
  id: string,
  name: string,
  category: ShopifySignalResult['category'],
  weight: number,
  snapshot: PageInspectionSnapshot,
): ShopifySignalResult {
  const matches = dedupeUrls(snapshot.resourceUrls).filter(isShopifyCdnUrl)
  const evidence = matches.slice(0, 5).map((u) => {
    try {
      const host = new URL(u.startsWith('//') ? `https:${u}` : u, 'https://example.invalid')
        .hostname
      if (host.includes('shopify')) return `Resource loaded from ${host}`
    } catch {
      /* fall through */
    }
    if (/\/cdn\/shop\//i.test(u)) return 'Resource matched /cdn/shop/ asset path'
    if (/\/cdn\/wpm\//i.test(u)) return 'Resource matched /cdn/wpm/ asset path'
    return `Shopify CDN resource: ${sanitizeEvidenceUrl(u)}`
  })
  return result(id, name, category, weight, evidence)
}

function matchGenerator(
  id: string,
  name: string,
  category: ShopifySignalResult['category'],
  weight: number,
  snapshot: PageInspectionSnapshot,
): ShopifySignalResult {
  const evidence: string[] = []
  const gen = snapshot.generator?.trim() ?? ''
  if (/shopify/i.test(gen)) {
    evidence.push('Shopify generator metadata detected')
  }
  for (const meta of snapshot.metaContents) {
    if (/shopify/i.test(meta) && !/shopify\s+is\s+great/i.test(meta)) {
      // Prefer structured indicators over arbitrary prose
      if (/generator|shopify-digital-wallet|shopify-checkout/i.test(meta) || meta.length < 80) {
        evidence.push('Shopify-related metadata detected')
        break
      }
    }
  }
  return result(id, name, category, weight, sanitizeEvidenceList(evidence))
}

function matchStorefrontScripts(
  id: string,
  name: string,
  category: ShopifySignalResult['category'],
  weight: number,
  snapshot: PageInspectionSnapshot,
): ShopifySignalResult {
  const matches = dedupeUrls(snapshot.resourceUrls).filter((u) =>
    STOREFRONT_SCRIPT_PATTERNS.some((re) => re.test(u)),
  )
  const evidence = matches
    .slice(0, 5)
    .map((u) => `Shopify storefront/analytics script: ${sanitizeEvidenceUrl(u)}`)
  return result(id, name, category, weight, evidence)
}

function matchFormActions(
  id: string,
  name: string,
  category: ShopifySignalResult['category'],
  weight: number,
  snapshot: PageInspectionSnapshot,
): ShopifySignalResult {
  const matches = snapshot.formActions.filter((action) =>
    CART_FORM_ACTIONS.some((re) => re.test(action)),
  )
  const evidence = matches.slice(0, 5).map((a) => `Form action matched ${sanitizeEvidenceUrl(a)}`)
  return result(id, name, category, weight, evidence)
}

function matchSectionMarkup(
  id: string,
  name: string,
  category: ShopifySignalResult['category'],
  weight: number,
  snapshot: PageInspectionSnapshot,
): ShopifySignalResult {
  const found = SECTION_HINTS.filter((hint) =>
    snapshot.markupHints.some((h) => h.toLowerCase().includes(hint.toLowerCase())),
  )
  // Require at least two distinct markup hints — one CSS class alone is not enough
  if (found.length < 2) {
    return result(id, name, category, weight, [])
  }
  const evidence = found.slice(0, 5).map((h) => `Shopify markup indicator: ${h}`)
  return result(id, name, category, weight, evidence)
}

function matchRoutes(
  id: string,
  name: string,
  category: ShopifySignalResult['category'],
  weight: number,
  snapshot: PageInspectionSnapshot,
): ShopifySignalResult {
  const urls = [...snapshot.linkHrefs, ...snapshot.formActions, snapshot.url]
  const matchedIds = ROUTE_PATTERNS.filter(({ re }) => urls.some((u) => re.test(u))).map(
    (p) => p.id,
  )
  // Generic routes alone are weak — require at least two distinct route families
  if (matchedIds.length < 2) {
    return result(id, name, category, weight, [])
  }
  const evidence = matchedIds.map(
    (rid) => `Storefront route pattern matched: /${rid.replace('_', '/')}`,
  )
  return result(id, name, category, SHOPIFY_SIGNAL_WEIGHTS.SHOPIFY_ROUTE_PATTERN, evidence)
}

function matchStorefrontApiEndpoint(
  id: string,
  name: string,
  category: ShopifySignalResult['category'],
  weight: number,
  snapshot: PageInspectionSnapshot,
): ShopifySignalResult {
  const candidates = dedupeUrls([...snapshot.networkRequestUrls, ...snapshot.resourceUrls])
  const matches = candidates.filter((u) => STOREFRONT_API_ENDPOINT_RE.test(u))
  const evidence = matches
    .slice(0, 5)
    .map((u) => `Storefront API request observed: ${sanitizeEvidenceUrl(u)}`)
  return result(id, name, category, weight, evidence)
}

function matchGidReferences(
  id: string,
  name: string,
  category: ShopifySignalResult['category'],
  weight: number,
  snapshot: PageInspectionSnapshot,
): ShopifySignalResult {
  const evidence = snapshot.shopifyGidReferences
    .slice(0, 5)
    .map((gid) => `Shopify global ID reference: ${gid}`)
  return result(id, name, category, weight, evidence)
}

function matchHydrogenRuntime(
  id: string,
  name: string,
  category: ShopifySignalResult['category'],
  weight: number,
  snapshot: PageInspectionSnapshot,
): ShopifySignalResult {
  const evidence: string[] = []
  const gen = snapshot.generator?.trim() ?? ''
  if (/hydrogen/i.test(gen)) {
    evidence.push('Hydrogen generator metadata detected')
  }
  const candidates = dedupeUrls([...snapshot.networkRequestUrls, ...snapshot.resourceUrls])
  const assetMatch = candidates.find((u) => HYDROGEN_ASSET_RE.test(u))
  if (assetMatch) {
    evidence.push(`Hydrogen/Oxygen asset reference: ${sanitizeEvidenceUrl(assetMatch)}`)
  }
  if (snapshot.shopifyGlobal.hydrogenStorefrontApi === true) {
    evidence.push('Public window.Shopify.storefront object detected')
  }
  return result(id, name, category, weight, evidence)
}

function matchHeadlessCdnProduct(
  id: string,
  name: string,
  category: ShopifySignalResult['category'],
  weight: number,
  snapshot: PageInspectionSnapshot,
): ShopifySignalResult {
  const candidates = dedupeUrls([...snapshot.networkRequestUrls, ...snapshot.resourceUrls])
  const matches = candidates.filter((u) => isShopifyCdnUrl(u) && /\/products\//i.test(u))
  const evidence = matches
    .slice(0, 5)
    .map((u) => `Shopify CDN product resource: ${sanitizeEvidenceUrl(u)}`)
  return result(id, name, category, weight, evidence)
}

function matchHeadlessCheckoutCart(
  id: string,
  name: string,
  category: ShopifySignalResult['category'],
  weight: number,
  snapshot: PageInspectionSnapshot,
): ShopifySignalResult {
  const urlCandidates = dedupeUrls([
    ...snapshot.linkHrefs,
    ...snapshot.formActions,
    ...snapshot.resourceUrls,
    ...snapshot.networkRequestUrls,
  ])
  const urlMatches = urlCandidates.filter((u) => HEADLESS_CHECKOUT_RE.test(u))
  const evidence = urlMatches
    .slice(0, 4)
    .map((u) => `Headless checkout/cart evidence: ${sanitizeEvidenceUrl(u)}`)

  const componentHints = CHECKOUT_WEB_COMPONENT_HINTS.filter((hint) =>
    snapshot.markupHints.some((h) => h.toLowerCase().includes(hint)),
  )
  for (const hint of componentHints) {
    evidence.push(`Shopify checkout web component: ${hint}`)
  }

  return result(id, name, category, weight, evidence)
}

function matchSerializedStateHint(
  id: string,
  name: string,
  category: ShopifySignalResult['category'],
  weight: number,
  snapshot: PageInspectionSnapshot,
): ShopifySignalResult {
  const evidence = snapshot.serializedStateHints.slice(0, 5)
  return result(id, name, category, weight, evidence)
}

function result(
  id: string,
  name: string,
  category: ShopifySignalResult['category'],
  weight: number,
  evidence: string[],
): ShopifySignalResult {
  const cleaned = sanitizeEvidenceList(evidence)
  return {
    id,
    name,
    category,
    matched: cleaned.length > 0,
    weight,
    evidence: cleaned,
  }
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of urls) {
    const key = u.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(u.trim())
  }
  return out
}
