import { describe, expect, it } from 'vitest'
import { isExtensionMessage } from '../../messaging/message-types'
import { isPublicContactScanResult } from '../../contacts/contact-scanner'
import { CONTACT_SCAN_LIMITS } from '../../contacts/contact-types'

describe('contact messaging validation', () => {
  it('requires userInitiated true for scan messages', () => {
    expect(
      isExtensionMessage({
        type: 'SCAN_PUBLIC_CONTACT_INFORMATION',
        payload: { tabId: 1, url: 'https://a.test/', userInitiated: true },
      }),
    ).toBe(true)

    expect(
      isExtensionMessage({
        type: 'SCAN_PUBLIC_CONTACT_INFORMATION',
        payload: { tabId: 1, url: 'https://a.test/', userInitiated: false },
      }),
    ).toBe(false)

    expect(
      isExtensionMessage({
        type: 'SCAN_PUBLIC_CONTACT_INFORMATION',
        payload: { tabId: 1, url: 'https://a.test/' },
      }),
    ).toBe(false)
  })

  it('validates contact scan result shape', () => {
    expect(
      isPublicContactScanResult({
        status: 'not_found',
        emails: [],
        phones: [],
        socialProfiles: [],
        contactPages: [],
        inspectedPages: [],
        warnings: [],
        scannedAt: new Date().toISOString(),
        durationMs: 1,
        scannerVersion: '1.0.0',
      }),
    ).toBe(true)
    expect(isPublicContactScanResult({ status: 'ok' })).toBe(false)
  })

  it('documents cache and crawl limits', () => {
    expect(CONTACT_SCAN_LIMITS.maxAdditionalPages).toBe(5)
    expect(CONTACT_SCAN_LIMITS.cacheTtlMs).toBe(30 * 60 * 1000)
    expect(CONTACT_SCAN_LIMITS.totalTimeoutMs).toBe(15_000)
  })
})
