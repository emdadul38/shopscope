import { detectCommerceFromSnapshot, isCommerceDetectionResult } from '../detectors/commerce/commerce-detector'
import type { CommerceDetectionResult, ConnectedStoreCandidate, DeepScanProgress } from '../detectors/commerce/commerce-types'
import type { PageInspectionSnapshot } from '../detectors/shopify/detector-types'
import { isPublicContactScanResult } from '../contacts/contact-scanner'
import { CONTACT_SCAN_LIMITS } from '../contacts/contact-types'
import type { PublicContactScanResult } from '../contacts/contact-types'
import type {
  ConnectedStoreMessageResponse,
  ContactScanMessageResponse,
  DeepScanMessageResponse,
  DeepScanProgressMessageResponse,
  DetectionMessageResponse,
  ExtensionMessage,
} from '../messaging/message-types'
import { isExtensionMessage } from '../messaging/message-types'
import { ERROR_CODES } from '../types/page'

const CACHE_TTL_MS = 30_000
const DETECTION_TIMEOUT_MS = 8_000
const CONTACT_SCAN_TIMEOUT_MS = CONTACT_SCAN_LIMITS.totalTimeoutMs + 2_000
const CONNECTED_STORE_DISCOVERY_TIMEOUT_MS = 12_000

/** Statuses eligible for the contact-scan gate and the confirmed-gate cache TTL. */
const CONTACT_SCAN_ELIGIBLE_STATUSES = new Set(['confirmed_shopify', 'likely_shopify', 'shopify_connected'])

interface CacheEntry {
  tabId: number
  normalizedUrl: string
  result: CommerceDetectionResult
  cachedAt: number
}

interface ContactCacheEntry {
  tabId: number
  origin: string
  result: PublicContactScanResult
  cachedAt: number
}

interface ConfirmedGateEntry {
  tabId: number
  normalizedUrl: string
  cachedAt: number
}

/** Longer-lived gate so contact scan can run after the short detection TTL. */
const confirmedGate = new Map<string, ConfirmedGateEntry>()
const CONFIRMED_GATE_TTL_MS = CONTACT_SCAN_LIMITS.cacheTtlMs

/** In-memory short-lived caches. Cleared if the service worker suspends. */
const detectionCache = new Map<string, CacheEntry>()
const contactCache = new Map<string, ContactCacheEntry>()
const deepScanProgress = new Map<number, DeepScanProgress>()

chrome.runtime.onInstalled.addListener(() => {
  if (import.meta.env.DEV) {
    console.log('[ShopScope] Service worker installed')
  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [key, entry] of detectionCache) {
    if (entry.tabId === tabId) detectionCache.delete(key)
  }
  for (const [key, entry] of contactCache) {
    if (entry.tabId === tabId) contactCache.delete(key)
  }
  for (const [key, entry] of confirmedGate) {
    if (entry.tabId === tabId) confirmedGate.delete(key)
  }
  deepScanProgress.delete(tabId)
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === 'loading') {
    for (const [key, entry] of detectionCache) {
      if (entry.tabId === tabId) detectionCache.delete(key)
    }
    for (const [key, entry] of confirmedGate) {
      if (entry.tabId === tabId) confirmedGate.delete(key)
    }
    deepScanProgress.delete(tabId)
    if (changeInfo.url) {
      try {
        const origin = new URL(changeInfo.url).origin
        for (const [key, entry] of contactCache) {
          if (entry.tabId === tabId && entry.origin !== origin) contactCache.delete(key)
        }
      } catch {
        for (const [key, entry] of contactCache) {
          if (entry.tabId === tabId) contactCache.delete(key)
        }
      }
    }
  }
})

chrome.runtime.onMessage.addListener(
  (message: unknown, sender, sendResponse: (response: unknown) => void): boolean => {
    if (!isExtensionMessage(message)) return false

    if (message.type === 'PING_BACKGROUND') {
      sendResponse({ alive: true })
      return false
    }

    if (message.type === 'GET_LAST_SHOPIFY_DETECTION') {
      void handleGetLast().then(sendResponse)
      return true
    }

    if (message.type === 'RUN_SHOPIFY_DETECTION') {
      void handleRunDetection(message).then(sendResponse)
      return true
    }

    if (message.type === 'SCAN_PUBLIC_CONTACT_INFORMATION') {
      void handleContactScan(message).then(sendResponse)
      return true
    }

    if (message.type === 'GET_LAST_PUBLIC_CONTACT_SCAN') {
      void handleGetLastContact(message).then(sendResponse)
      return true
    }

    if (message.type === 'CANCEL_PUBLIC_CONTACT_SCAN') {
      void forwardCancel().then(sendResponse)
      return true
    }

    if (message.type === 'DISCOVER_CONNECTED_STORE') {
      void handleDiscoverConnectedStore().then(sendResponse)
      return true
    }

    if (message.type === 'RUN_DEEP_SCAN') {
      void handleRunDeepScan().then(sendResponse)
      return true
    }

    if (message.type === 'CANCEL_DEEP_SCAN') {
      void handleCancelDeepScan().then(sendResponse)
      return true
    }

    if (message.type === 'GET_DEEP_SCAN_PROGRESS') {
      void handleGetDeepScanProgress().then(sendResponse)
      return true
    }

    if (message.type === 'DEEP_SCAN_PROGRESS_UPDATE') {
      const tabId = sender.tab?.id
      if (typeof tabId === 'number') {
        deepScanProgress.set(tabId, message.payload.progress)
      }
      return false
    }

    return false
  },
)

async function handleGetLast(): Promise<DetectionMessageResponse> {
  try {
    const tab = await getActiveHttpTab()
    if (!tab.ok) return tab.errorResponse
    const cached = readCache(tab.tabId, tab.normalizedUrl)
    if (!cached) {
      return {
        success: false,
        error: { code: ERROR_CODES.UNKNOWN_ERROR, message: 'No cached detection result' },
      }
    }
    return { success: true, data: cached }
  } catch {
    return {
      success: false,
      error: { code: ERROR_CODES.SHOPIFY_DETECTION_FAILED, message: 'Failed to read cache' },
    }
  }
}

async function handleRunDetection(
  message: Extract<ExtensionMessage, { type: 'RUN_SHOPIFY_DETECTION' }>,
): Promise<DetectionMessageResponse> {
  try {
    const tab = await getActiveHttpTab()
    if (!tab.ok) return tab.errorResponse

    if (!message.force) {
      const cached = readCache(tab.tabId, tab.normalizedUrl)
      if (cached) return { success: true, data: cached }
    } else {
      detectionCache.delete(cacheKey(tab.tabId, tab.normalizedUrl))
    }

    const injected = await ensureContentScript(tab.tabId)
    if (!injected.ok) return injected.errorResponse

    const snapshotRaw = await sendTabMessage(tab.tabId, {
      type: 'RUN_SHOPIFY_DETECTION',
    })

    if (isFailurePayload(snapshotRaw)) {
      return snapshotRaw
    }

    const snapshot = parseSnapshot(snapshotRaw)
    if (!snapshot) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_DETECTION_RESULT,
          message: 'Invalid page inspection snapshot',
        },
      }
    }

    const shopifyGlobal = await probeShopifyGlobalMainWorld(tab.tabId)
    const result = detectCommerceFromSnapshot({
      ...snapshot,
      shopifyGlobal,
    })

    if (!isCommerceDetectionResult(result)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_DETECTION_RESULT,
          message: 'Detection result failed validation',
        },
      }
    }

    writeCache(tab.tabId, tab.normalizedUrl, result)
    return { success: true, data: result }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[ShopScope] Detection failed', err instanceof Error ? err.message : 'unknown')
    }
    const code =
      err instanceof Error && err.message === 'DETECTION_TIMEOUT'
        ? ERROR_CODES.DETECTION_TIMEOUT
        : ERROR_CODES.SHOPIFY_DETECTION_FAILED
    return {
      success: false,
      error: {
        code,
        message:
          code === ERROR_CODES.DETECTION_TIMEOUT
            ? 'Detection timed out'
            : 'Shopify detection failed',
      },
    }
  }
}

type TabOk = { ok: true; tabId: number; normalizedUrl: string }
type TabErr = { ok: false; errorResponse: DetectionMessageResponse }

async function getActiveHttpTab(): Promise<TabOk | TabErr> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (!tab?.id || !tab.url) {
    return {
      ok: false,
      errorResponse: {
        success: false,
        error: { code: ERROR_CODES.ACTIVE_TAB_NOT_FOUND, message: 'No active tab found' },
      },
    }
  }

  let normalizedUrl: string
  try {
    const url = new URL(tab.url)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return {
        ok: false,
        errorResponse: {
          success: false,
          error: {
            code: ERROR_CODES.UNSUPPORTED_DOCUMENT,
            message: 'Only HTTP and HTTPS pages are supported',
          },
        },
      }
    }
    normalizedUrl = normalizeUrl(url)
  } catch {
    return {
      ok: false,
      errorResponse: {
        success: false,
        error: { code: ERROR_CODES.UNSUPPORTED_URL, message: 'Invalid page URL' },
      },
    }
  }

  return { ok: true, tabId: tab.id, normalizedUrl }
}

async function ensureContentScript(tabId: number): Promise<{ ok: true } | TabErr> {
  try {
    const ping = await sendTabMessage(tabId, { type: 'PING_CONTENT_SCRIPT' })
    if (typeof ping === 'object' && ping !== null && (ping as { alive?: unknown }).alive === true) {
      return { ok: true }
    }
  } catch {
    // Not injected yet
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-script.js'],
    })
    return { ok: true }
  } catch {
    return {
      ok: false,
      errorResponse: {
        success: false,
        error: {
          code: ERROR_CODES.CONTENT_SCRIPT_INJECTION_FAILED,
          message: 'Could not inject content script into this page',
        },
      },
    }
  }
}

/**
 * Read allowlisted public window.Shopify fields via the page's main world.
 * Avoids inline <script> bridges that storefront CSP often blocks.
 */
async function probeShopifyGlobalMainWorld(
  tabId: number,
): Promise<PageInspectionSnapshot['shopifyGlobal']> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        try {
          const shopify = (
            window as unknown as {
              Shopify?: { shop?: unknown; storefront?: unknown }
            }
          ).Shopify
          const present = !!(shopify && typeof shopify === 'object')
          const shop =
            present && typeof shopify.shop === 'string' ? shopify.shop.slice(0, 80) : undefined
          const hydrogenStorefrontApi =
            present && typeof shopify.storefront === 'object' && shopify.storefront !== null
          const evidence: string[] = []
          if (present) evidence.push('Public window.Shopify object detected')
          if (shop) evidence.push('Shopify.shop present')
          return { present, shop, evidence, hydrogenStorefrontApi }
        } catch {
          return { present: false, evidence: [] as string[], hydrogenStorefrontApi: false }
        }
      },
    })

    const value = results[0]?.result
    if (typeof value !== 'object' || value === null) {
      return { present: false, evidence: [] }
    }
    const v = value as { present?: unknown; shop?: unknown; evidence?: unknown; hydrogenStorefrontApi?: unknown }
    return {
      present: v.present === true,
      shop: typeof v.shop === 'string' ? v.shop : undefined,
      evidence: Array.isArray(v.evidence)
        ? v.evidence.filter((e): e is string => typeof e === 'string').slice(0, 5)
        : [],
      hydrogenStorefrontApi: v.hydrogenStorefrontApi === true,
    }
  } catch {
    return { present: false, evidence: [] }
  }
}

function sendTabMessage(
  tabId: number,
  message: ExtensionMessage,
  timeoutMs: number = DETECTION_TIMEOUT_MS,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('DETECTION_TIMEOUT'))
    }, timeoutMs)

    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timer)
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message ?? 'Tab message failed'))
          return
        }
        resolve(response)
      })
    } catch (err) {
      clearTimeout(timer)
      reject(err)
    }
  })
}

function isFailurePayload(raw: unknown): raw is DetectionMessageResponse & { success: false } {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as { success?: unknown }).success === false &&
    typeof (raw as { error?: unknown }).error === 'object'
  )
}

function parseSnapshot(raw: unknown): PageInspectionSnapshot | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>

  // Prefer explicit snapshot envelope from content script
  if (obj.success === true && typeof obj.data === 'object' && obj.data !== null) {
    return coerceSnapshot(obj.data)
  }

  return coerceSnapshot(raw)
}

function coerceSnapshot(value: unknown): PageInspectionSnapshot | null {
  if (typeof value !== 'object' || value === null) return null
  const s = value as Record<string, unknown>
  if (typeof s.url !== 'string' || typeof s.hostname !== 'string') return null
  if (!Array.isArray(s.resourceUrls)) return null
  return {
    url: s.url,
    hostname: s.hostname,
    generator: typeof s.generator === 'string' ? s.generator : undefined,
    resourceUrls: s.resourceUrls.filter((v): v is string => typeof v === 'string').slice(0, 200),
    linkHrefs: Array.isArray(s.linkHrefs)
      ? s.linkHrefs.filter((v): v is string => typeof v === 'string').slice(0, 200)
      : [],
    formActions: Array.isArray(s.formActions)
      ? s.formActions.filter((v): v is string => typeof v === 'string').slice(0, 200)
      : [],
    markupHints: Array.isArray(s.markupHints)
      ? s.markupHints.filter((v): v is string => typeof v === 'string').slice(0, 200)
      : [],
    metaContents: Array.isArray(s.metaContents)
      ? s.metaContents.filter((v): v is string => typeof v === 'string').slice(0, 200)
      : [],
    myshopifyHosts: Array.isArray(s.myshopifyHosts)
      ? s.myshopifyHosts.filter((v): v is string => typeof v === 'string').slice(0, 50)
      : [],
    shopifyGlobal: { present: false, evidence: [] },
    networkRequestUrls: Array.isArray(s.networkRequestUrls)
      ? s.networkRequestUrls.filter((v): v is string => typeof v === 'string').slice(0, 150)
      : [],
    shopifyGidReferences: Array.isArray(s.shopifyGidReferences)
      ? s.shopifyGidReferences.filter((v): v is string => typeof v === 'string').slice(0, 10)
      : [],
    serializedStateHints: Array.isArray(s.serializedStateHints)
      ? s.serializedStateHints.filter((v): v is string => typeof v === 'string').slice(0, 10)
      : [],
  }
}

export function normalizeUrl(url: URL): string {
  const normalized = new URL(url.href)
  normalized.hash = ''
  let path = normalized.pathname
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  normalized.pathname = path
  return normalized.href
}

export function normalizeOrigin(url: URL): string {
  return url.origin
}

function cacheKey(tabId: number, normalizedUrl: string): string {
  return `${tabId}::${normalizedUrl}`
}

function readCache(tabId: number, normalizedUrl: string): CommerceDetectionResult | null {
  const key = cacheKey(tabId, normalizedUrl)
  const entry = detectionCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    detectionCache.delete(key)
    return null
  }
  return entry.result
}

function writeCache(tabId: number, normalizedUrl: string, result: CommerceDetectionResult): void {
  detectionCache.set(cacheKey(tabId, normalizedUrl), {
    tabId,
    normalizedUrl,
    result,
    cachedAt: Date.now(),
  })
  if (CONTACT_SCAN_ELIGIBLE_STATUSES.has(result.status)) {
    confirmedGate.set(cacheKey(tabId, normalizedUrl), {
      tabId,
      normalizedUrl,
      cachedAt: Date.now(),
    })
  } else {
    confirmedGate.delete(cacheKey(tabId, normalizedUrl))
  }
}

function isContactScanAllowedForTab(tabId: number, normalizedUrl: string): boolean {
  const detection = readCache(tabId, normalizedUrl)
  if (detection && CONTACT_SCAN_ELIGIBLE_STATUSES.has(detection.status)) return true
  const gate = confirmedGate.get(cacheKey(tabId, normalizedUrl))
  if (!gate) return false
  if (Date.now() - gate.cachedAt > CONFIRMED_GATE_TTL_MS) {
    confirmedGate.delete(cacheKey(tabId, normalizedUrl))
    return false
  }
  return true
}

function contactCacheKey(tabId: number, origin: string): string {
  return `contact:${tabId}::${origin}`
}

function readContactCache(tabId: number, origin: string): PublicContactScanResult | null {
  const key = contactCacheKey(tabId, origin)
  const entry = contactCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > CONTACT_SCAN_LIMITS.cacheTtlMs) {
    contactCache.delete(key)
    return null
  }
  return entry.result
}

function writeContactCache(tabId: number, origin: string, result: PublicContactScanResult): void {
  contactCache.set(contactCacheKey(tabId, origin), {
    tabId,
    origin,
    result,
    cachedAt: Date.now(),
  })
}

async function handleGetLastContact(
  message: Extract<ExtensionMessage, { type: 'GET_LAST_PUBLIC_CONTACT_SCAN' }>,
): Promise<ContactScanMessageResponse> {
  try {
    const origin = new URL(message.payload.url).origin
    const cached = readContactCache(message.payload.tabId, origin)
    if (!cached) {
      return {
        success: false,
        error: { code: ERROR_CODES.UNKNOWN_ERROR, message: 'No cached contact scan' },
      }
    }
    return { success: true, data: cached }
  } catch {
    return {
      success: false,
      error: { code: ERROR_CODES.CONTACT_SCAN_FAILED, message: 'Failed to read contact cache' },
    }
  }
}

async function forwardCancel(): Promise<{ success: true; data: { cancelled: boolean } }> {
  try {
    const tab = await getActiveHttpTab()
    if (tab.ok) {
      await sendTabMessage(tab.tabId, { type: 'CANCEL_PUBLIC_CONTACT_SCAN' }, DETECTION_TIMEOUT_MS)
    }
  } catch {
    // ignore
  }
  return { success: true, data: { cancelled: true } }
}

async function handleContactScan(
  message: Extract<ExtensionMessage, { type: 'SCAN_PUBLIC_CONTACT_INFORMATION' }>,
): Promise<ContactScanMessageResponse> {
  try {
    if (message.payload.userInitiated !== true) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.CONTACT_SCAN_NOT_USER_INITIATED,
          message: 'Contact scan requires an explicit user action',
        },
      }
    }

    const tab = await getActiveHttpTab()
    if (!tab.ok) {
      return {
        success: false,
        error: tab.errorResponse.success
          ? { code: ERROR_CODES.CONTACT_SCAN_FAILED, message: 'Unexpected tab error' }
          : tab.errorResponse.error,
      }
    }

    if (tab.tabId !== message.payload.tabId) {
      return {
        success: false,
        error: { code: ERROR_CODES.ACTIVE_TAB_NOT_FOUND, message: 'Active tab mismatch' },
      }
    }

    let requestedNormalized: string
    let origin: string
    try {
      const requested = new URL(message.payload.url)
      if (requested.protocol !== 'http:' && requested.protocol !== 'https:') {
        return {
          success: false,
          error: { code: ERROR_CODES.UNSUPPORTED_URL, message: 'Unsupported URL' },
        }
      }
      requestedNormalized = normalizeUrl(requested)
      origin = normalizeOrigin(requested)
    } catch {
      return {
        success: false,
        error: { code: ERROR_CODES.UNSUPPORTED_URL, message: 'Invalid URL' },
      }
    }

    if (tab.normalizedUrl !== requestedNormalized) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.TAB_URL_CHANGED,
          message: 'The tab URL changed before the contact scan started',
        },
      }
    }

    if (!isContactScanAllowedForTab(tab.tabId, tab.normalizedUrl)) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.SHOPIFY_NOT_CONFIRMED,
          message: 'Contact scan requires a confirmed or likely Shopify storefront',
        },
      }
    }

    if (message.payload.force) {
      contactCache.delete(contactCacheKey(tab.tabId, origin))
    } else {
      const cachedContact = readContactCache(tab.tabId, origin)
      if (cachedContact) {
        return { success: true, data: cachedContact }
      }
    }

    const injected = await ensureContentScript(tab.tabId)
    if (!injected.ok) {
      return {
        success: false,
        error: injected.errorResponse.success
          ? {
              code: ERROR_CODES.CONTENT_SCRIPT_INJECTION_FAILED,
              message: 'Could not inject content script',
            }
          : injected.errorResponse.error,
      }
    }

    const raw = await sendTabMessage(
      tab.tabId,
      {
        type: 'SCAN_PUBLIC_CONTACT_INFORMATION',
        payload: {
          tabId: tab.tabId,
          url: message.payload.url,
          userInitiated: true,
        },
      },
      CONTACT_SCAN_TIMEOUT_MS,
    )

    if (isFailurePayload(raw)) {
      return {
        success: false,
        error: {
          code: typeof raw.error.code === 'string' ? raw.error.code : ERROR_CODES.CONTACT_SCAN_FAILED,
          message:
            typeof raw.error.message === 'string' ? raw.error.message : 'Contact scan failed',
        },
      }
    }

    const data =
      typeof raw === 'object' &&
      raw !== null &&
      (raw as { success?: unknown }).success === true &&
      isPublicContactScanResult((raw as { data?: unknown }).data)
        ? (raw as { data: PublicContactScanResult }).data
        : isPublicContactScanResult(raw)
          ? raw
          : null

    if (!data) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.INVALID_CONTACT_RESULT,
          message: 'Invalid contact scan result',
        },
      }
    }

    writeContactCache(tab.tabId, origin, data)
    return { success: true, data }
  } catch (err) {
    const code =
      err instanceof Error && err.message === 'DETECTION_TIMEOUT'
        ? ERROR_CODES.CONTACT_SCAN_TIMEOUT
        : ERROR_CODES.CONTACT_SCAN_FAILED
    return {
      success: false,
      error: {
        code,
        message:
          code === ERROR_CODES.CONTACT_SCAN_TIMEOUT ? 'Contact scan timed out' : 'Contact scan failed',
      },
    }
  }
}

/**
 * Connected-store discovery: content script scans the current page for up to
 * two same-registered-domain candidate links (zero extra permissions — the
 * scan reads only the current tab's own DOM). No new Chrome permission
 * exists to fetch an arbitrary discovered domain automatically (that would
 * require a broad optional_host_permissions wildcard, which we deliberately
 * do not add), so candidates are always returned for the UI's "Open & Scan"
 * fallback: opening one in a new tab lets the existing activeTab-scoped
 * detector verify it automatically, same as any other page.
 */
async function handleDiscoverConnectedStore(): Promise<ConnectedStoreMessageResponse> {
  try {
    const tab = await getActiveHttpTab()
    if (!tab.ok) {
      return {
        success: false,
        error: tab.errorResponse.success
          ? { code: ERROR_CODES.CONTACT_SCAN_FAILED, message: 'Unexpected tab error' }
          : tab.errorResponse.error,
      }
    }

    const injected = await ensureContentScript(tab.tabId)
    if (!injected.ok) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.CONTENT_SCRIPT_INJECTION_FAILED,
          message: 'Could not inject content script',
        },
      }
    }

    const raw = await sendTabMessage(
      tab.tabId,
      { type: 'DISCOVER_CONNECTED_STORE' },
      CONNECTED_STORE_DISCOVERY_TIMEOUT_MS,
    )

    return { success: true, data: { connectedCandidates: extractCandidates(raw) } }
  } catch {
    return {
      success: false,
      error: {
        code: 'CONNECTED_STORE_DISCOVERY_FAILED',
        message: 'Connected store discovery failed',
      },
    }
  }
}

function extractCandidates(raw: unknown): ConnectedStoreCandidate[] {
  if (typeof raw !== 'object' || raw === null) return []
  const success = (raw as { success?: unknown }).success
  const data = (raw as { data?: unknown }).data
  if (success !== true || typeof data !== 'object' || data === null) return []
  const candidates = (data as { candidates?: unknown }).candidates
  if (!Array.isArray(candidates)) return []
  return candidates.filter(
    (c): c is ConnectedStoreCandidate =>
      typeof c === 'object' &&
      c !== null &&
      typeof (c as ConnectedStoreCandidate).domain === 'string' &&
      typeof (c as ConnectedStoreCandidate).url === 'string',
  )
}

async function handleRunDeepScan(): Promise<DeepScanMessageResponse> {
  try {
    const tab = await getActiveHttpTab()
    if (!tab.ok) {
      return {
        success: false,
        error: tab.errorResponse.success
          ? { code: ERROR_CODES.CONTACT_SCAN_FAILED, message: 'Unexpected tab error' }
          : tab.errorResponse.error,
      }
    }
    const injected = await ensureContentScript(tab.tabId)
    if (!injected.ok) {
      return {
        success: false,
        error: {
          code: ERROR_CODES.CONTENT_SCRIPT_INJECTION_FAILED,
          message: 'Could not inject content script',
        },
      }
    }
    deepScanProgress.delete(tab.tabId)
    await sendTabMessage(tab.tabId, { type: 'RUN_DEEP_SCAN' }, DETECTION_TIMEOUT_MS)
    return { success: true, data: { started: true } }
  } catch {
    return {
      success: false,
      error: { code: 'DEEP_SCAN_FAILED', message: 'Could not start deep scan' },
    }
  }
}

async function handleCancelDeepScan(): Promise<DeepScanMessageResponse> {
  try {
    const tab = await getActiveHttpTab()
    if (tab.ok) {
      await sendTabMessage(tab.tabId, { type: 'CANCEL_DEEP_SCAN' }, DETECTION_TIMEOUT_MS)
    }
    return { success: true, data: { started: false } }
  } catch {
    return { success: true, data: { started: false } }
  }
}

async function handleGetDeepScanProgress(): Promise<DeepScanProgressMessageResponse> {
  try {
    const tab = await getActiveHttpTab()
    if (!tab.ok) {
      return { success: true, data: { progress: null } }
    }
    return { success: true, data: { progress: deepScanProgress.get(tab.tabId) ?? null } }
  } catch {
    return { success: true, data: { progress: null } }
  }
}
