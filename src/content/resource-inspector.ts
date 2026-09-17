const MAX_RESOURCES = 120

/**
 * Collect script/stylesheet/image/preload/prefetch URLs without full HTML dumps.
 */
export function inspectResources(doc: Document = document): string[] {
  const urls: string[] = []

  const selectors = [
    'script[src]',
    'link[rel="stylesheet"][href]',
    'link[rel="preload"][href]',
    'link[rel="prefetch"][href]',
    'img[src]',
    'source[src]',
  ]

  for (const selector of selectors) {
    const nodes = doc.querySelectorAll(selector)
    for (const node of nodes) {
      const attr = node.tagName === 'LINK' || node.tagName === 'A' ? 'href' : 'src'
      const value = node.getAttribute(attr)
      if (value) urls.push(value)
      if (urls.length >= MAX_RESOURCES) break
    }
    if (urls.length >= MAX_RESOURCES) break
  }

  return dedupe(urls).slice(0, MAX_RESOURCES)
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
