import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEEP_SCAN_HARD_LIMIT_MS, DEEP_SCAN_RESOURCE_WINDOW_MS, startDeepScan } from '../../content/deep-scan'
import type { PageInspectionSnapshot } from '../../detectors/shopify/detector-types'

function baseSnapshot(): PageInspectionSnapshot {
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

describe('startDeepScan', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    history.replaceState({}, '', '/')
  })

  it('stops automatically at the hard limit and reports done', async () => {
    const progressPhases: string[] = []
    const handle = startDeepScan(baseSnapshot, (p) => progressPhases.push(p.phase))

    await vi.advanceTimersByTimeAsync(DEEP_SCAN_HARD_LIMIT_MS + 500)
    const { finalResult } = await handle.done

    expect(progressPhases).toContain('dom')
    expect(progressPhases).toContain('resources')
    expect(progressPhases[progressPhases.length - 1]).toBe('done')
    expect(finalResult).toBeDefined()
  })

  it('stops the resource-observation window at DEEP_SCAN_RESOURCE_WINDOW_MS', async () => {
    const handle = startDeepScan(baseSnapshot, () => {})
    await vi.advanceTimersByTimeAsync(DEEP_SCAN_RESOURCE_WINDOW_MS + 200)
    const result = await handle.done
    expect(result.finalResult).toBeDefined()
  })

  it('detects SPA navigation via pushState during the scan window', async () => {
    let sawSpaNav = false
    const handle = startDeepScan(baseSnapshot, (p) => {
      if (p.spaNavigationDetected) sawSpaNav = true
    })

    await vi.advanceTimersByTimeAsync(1_000)
    history.pushState({}, '', '/new-spa-route')
    await vi.advanceTimersByTimeAsync(2_000)

    await handle.cancel()
    expect(sawSpaNav).toBe(true)
  })

  it('supports cancellation and resolves immediately with empty candidates', async () => {
    const handle = startDeepScan(baseSnapshot, () => {})
    handle.cancel()
    const result = await handle.done
    expect(result.connectedCandidates).toEqual([])
  })

  it('cancelling twice does not throw or double-resolve', async () => {
    const handle = startDeepScan(baseSnapshot, () => {})
    expect(() => {
      handle.cancel()
      handle.cancel()
    }).not.toThrow()
    await handle.done
  })
})
