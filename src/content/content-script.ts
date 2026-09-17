import type { PageInspectionSnapshot } from '../detectors/shopify/detector-types'
import { runPublicContactScan } from '../contacts/contact-scanner'
import { isExtensionMessage } from '../messaging/message-types'
import { inspectDocument } from './document-inspector'
import { inspectResources } from './resource-inspector'
import { inspectInlineScriptEvidence, inspectNetworkRequestUrls } from './headless-inspector'
import { discoverConnectedStoreCandidates } from './connected-store-inspector'
import { startDeepScan, type DeepScanHandle } from './deep-scan'
import {
  documentToContactPage,
  fetchSameOriginHtml,
  parseHtmlToContactDocument,
} from './public-contact-inspector'

let activeContactAbort: AbortController | null = null
let activeDeepScan: DeepScanHandle | null = null

function collectSnapshot(): PageInspectionSnapshot {
  if (typeof document === 'undefined' || !document.documentElement) {
    return {
      url: location.href,
      hostname: location.hostname,
      resourceUrls: [],
      linkHrefs: [],
      formActions: [],
      markupHints: [],
      metaContents: [],
      myshopifyHosts: [],
      shopifyGlobal: { present: false, evidence: [] },
      networkRequestUrls: [],
      shopifyGidReferences: [],
      serializedStateHints: [],
    }
  }

  const docPart = inspectDocument(document)
  const resourceUrls = inspectResources(document)
  const inline = inspectInlineScriptEvidence(document)

  return {
    url: location.href,
    hostname: location.hostname,
    generator: docPart.generator,
    resourceUrls,
    linkHrefs: docPart.linkHrefs,
    formActions: docPart.formActions,
    markupHints: docPart.markupHints,
    metaContents: docPart.metaContents,
    myshopifyHosts: docPart.myshopifyHosts,
    shopifyGlobal: { present: false, evidence: [] },
    networkRequestUrls: inspectNetworkRequestUrls(),
    shopifyGidReferences: inline.shopifyGidReferences,
    serializedStateHints: inline.serializedStateHints,
  }
}

async function runContactScan(shopifyShopName?: string) {
  if (activeContactAbort) {
    activeContactAbort.abort()
  }
  activeContactAbort = new AbortController()
  const signal = activeContactAbort.signal

  const currentDoc = documentToContactPage(document, location.href, 'homepage', shopifyShopName)

  try {
    const result = await runPublicContactScan(
      currentDoc,
      {
        fetchPageHtml: fetchSameOriginHtml,
        parseHtmlToDocument: parseHtmlToContactDocument,
      },
      { signal },
    )
    return { success: true as const, data: result }
  } catch (err) {
    if (signal.aborted) {
      return {
        success: false as const,
        error: { code: 'CONTACT_SCAN_CANCELLED', message: 'Contact scan cancelled' },
      }
    }
    return {
      success: false as const,
      error: {
        code: 'CONTACT_SCAN_FAILED',
        message: err instanceof Error ? err.message : 'Contact scan failed',
      },
    }
  } finally {
    activeContactAbort = null
  }
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (response: unknown) => void): boolean => {
    if (!isExtensionMessage(message)) return false

    if (message.type === 'PING_CONTENT_SCRIPT') {
      sendResponse({ alive: true })
      return false
    }

    if (message.type === 'RUN_SHOPIFY_DETECTION') {
      try {
        const data = collectSnapshot()
        sendResponse({ success: true, data })
      } catch (err) {
        sendResponse({
          success: false,
          error: {
            code: 'SHOPIFY_DETECTION_FAILED',
            message: err instanceof Error ? err.message : 'Inspection failed',
          },
        })
      }
      return false
    }

    if (message.type === 'DISCOVER_CONNECTED_STORE') {
      try {
        const candidates = discoverConnectedStoreCandidates(document, location.href)
        sendResponse({ success: true, data: { candidates } })
      } catch (err) {
        sendResponse({
          success: false,
          error: {
            code: 'CONNECTED_STORE_DISCOVERY_FAILED',
            message: err instanceof Error ? err.message : 'Discovery failed',
          },
        })
      }
      return false
    }

    if (message.type === 'RUN_DEEP_SCAN') {
      activeDeepScan?.cancel()
      activeDeepScan = startDeepScan(collectSnapshot, (progress) => {
        void chrome.runtime.sendMessage({
          type: 'DEEP_SCAN_PROGRESS_UPDATE',
          payload: { progress },
        }).catch(() => {
          // Popup or service worker may not be listening; safe to ignore.
        })
      })
      sendResponse({ success: true, data: { started: true } })
      return false
    }

    if (message.type === 'CANCEL_DEEP_SCAN') {
      activeDeepScan?.cancel()
      activeDeepScan = null
      sendResponse({ success: true, data: { cancelled: true } })
      return false
    }

    if (message.type === 'CANCEL_PUBLIC_CONTACT_SCAN') {
      activeContactAbort?.abort()
      sendResponse({ success: true, data: { cancelled: true } })
      return false
    }

    if (message.type === 'SCAN_PUBLIC_CONTACT_INFORMATION') {
      void runContactScan().then(sendResponse)
      return true
    }

    return false
  },
)
