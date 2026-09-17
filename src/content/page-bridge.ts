/**
 * Legacy helper kept for unit tests / optional isolated-world fallbacks.
 * Production detection uses chrome.scripting.executeScript({ world: 'MAIN' })
 * from the service worker to avoid storefront CSP blocking inline scripts.
 */
const BRIDGE_RESPONSE = 'SHOPSCOPE_SHOPIFY_BRIDGE_RESPONSE'
const BRIDGE_TIMEOUT_MS = 250

export interface ShopifyGlobalProbe {
  present: boolean
  shop?: string
  evidence: string[]
  hydrogenStorefrontApi?: boolean
}

export function probeShopifyGlobal(timeoutMs = BRIDGE_TIMEOUT_MS): Promise<ShopifyGlobalProbe> {
  return new Promise((resolve) => {
    const requestId = `shopscope-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    let settled = false
    let scriptEl: HTMLScriptElement | null = null

    const cleanup = () => {
      window.removeEventListener('message', onMessage)
      if (scriptEl?.parentNode) scriptEl.parentNode.removeChild(scriptEl)
      scriptEl = null
    }

    const finish = (value: ShopifyGlobalProbe) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      cleanup()
      resolve(value)
    }

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return
      const data = event.data
      if (typeof data !== 'object' || data === null) return
      const payload = data as Record<string, unknown>
      if (payload.source !== BRIDGE_RESPONSE) return
      if (payload.requestId !== requestId) return
      if (payload.ok !== true) {
        finish({ present: false, evidence: [] })
        return
      }
      const shop = typeof payload.shop === 'string' ? payload.shop : undefined
      const evidence = Array.isArray(payload.evidence)
        ? payload.evidence.filter((e): e is string => typeof e === 'string').slice(0, 5)
        : []
      finish({
        present: payload.present === true,
        shop,
        evidence,
        hydrogenStorefrontApi: payload.hydrogenStorefrontApi === true,
      })
    }

    window.addEventListener('message', onMessage)

    const timer = setTimeout(() => {
      finish({ present: false, evidence: [] })
    }, timeoutMs)

    try {
      scriptEl = document.documentElement.appendChild(document.createElement('script'))
      scriptEl.textContent = `(function(){
  try {
    var shopify = window.Shopify;
    var present = !!(shopify && typeof shopify === 'object');
    var shop = present && typeof shopify.shop === 'string' ? shopify.shop : undefined;
    var hydrogenStorefrontApi = present && typeof shopify.storefront === 'object' && shopify.storefront !== null;
    var evidence = [];
    if (present) evidence.push('Public window.Shopify object detected');
    if (shop) evidence.push('Shopify.shop present');
    window.postMessage({
      source: ${JSON.stringify(BRIDGE_RESPONSE)},
      requestId: ${JSON.stringify(requestId)},
      ok: true,
      present: present,
      shop: shop,
      evidence: evidence,
      hydrogenStorefrontApi: hydrogenStorefrontApi
    }, '*');
  } catch (e) {
    window.postMessage({
      source: ${JSON.stringify(BRIDGE_RESPONSE)},
      requestId: ${JSON.stringify(requestId)},
      ok: false
    }, '*');
  }
})();`
      scriptEl.remove()
      scriptEl = null
    } catch {
      finish({ present: false, evidence: [] })
    }
  })
}
