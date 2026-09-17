import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { mockChrome } from './setup'
import { App } from '../popup/App'
import type { CommerceDetectionResult } from '../detectors/commerce/commerce-types'
import type { DetectionMessageResponse } from '../messaging/message-types'

const sampleDetection: CommerceDetectionResult = {
  platform: 'unknown',
  status: 'unknown',
  storefrontType: 'unknown',
  confidence: 0,
  evidence: [],
  inspectedAt: '2026-09-15T12:00:00.000Z',
  durationMs: 12,
  detectorVersion: '2.0.0',
}

function setupTab(overrides: Partial<chrome.tabs.Tab> = {}) {
  const tab: Partial<chrome.tabs.Tab> = {
    id: 1,
    url: 'https://example.com/products',
    title: 'Example Store',
    favIconUrl: 'https://example.com/favicon.ico',
    ...overrides,
  }
  mockChrome.tabs.query.mockResolvedValue([tab])
}

function setupRuntime(
  options: {
    backgroundAlive?: boolean
    detection?: DetectionMessageResponse
  } = {},
) {
  const backgroundAlive = options.backgroundAlive ?? true
  const detection: DetectionMessageResponse = options.detection ?? {
    success: true,
    data: sampleDetection,
  }

  mockChrome.runtime.sendMessage.mockImplementation((msg: unknown, cb: (r: unknown) => void) => {
    const type =
      typeof msg === 'object' && msg !== null ? (msg as { type?: string }).type : undefined

    if (!backgroundAlive) {
      mockChrome.runtime.lastError = { message: 'Unavailable' }
      cb(undefined)
      return
    }

    if (type === 'PING_BACKGROUND') {
      cb({ alive: true })
      return
    }

    if (type === 'RUN_SHOPIFY_DETECTION' || type === 'GET_LAST_SHOPIFY_DETECTION') {
      cb(detection)
      return
    }

    cb(undefined)
  })
}

function setupStorage(stored: Record<string, unknown> = {}) {
  mockChrome.storage.local.get.mockImplementation(
    (_key: string, cb: (r: Record<string, unknown>) => void) => cb(stored),
  )
  mockChrome.storage.local.set.mockImplementation(
    (_data: Record<string, unknown>, cb?: () => void) => cb?.(),
  )
}

describe('App', () => {
  it('shows loading spinner initially', () => {
    mockChrome.tabs.query.mockReturnValue(new Promise(() => {}))
    setupStorage()
    setupRuntime()
    render(<App />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders page information on a supported page', async () => {
    setupTab()
    setupRuntime()
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Example Store')).toBeInTheDocument()
      expect(screen.getByText('example.com')).toBeInTheDocument()
      expect(screen.getByText('https://example.com/products')).toBeInTheDocument()
    })
  })

  it('auto-runs detection and shows unknown state', async () => {
    setupTab()
    setupRuntime()
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Platform Unknown')).toBeInTheDocument()
    })
  })

  it('shows confirmed detection result', async () => {
    setupTab()
    setupRuntime({
      detection: {
        success: true,
        data: {
          ...sampleDetection,
          platform: 'shopify',
          status: 'confirmed_shopify',
          storefrontType: 'shopify_theme',
          confidence: 100,
          evidence: [
            {
              signalName: 'Shopify CDN assets',
              category: 'resource',
              weight: 18,
              explanation: 'Resource loaded from cdn.shopify.com',
              confidenceLevel: 'medium',
            },
          ],
        },
      },
    })
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Confirmed Shopify Store')).toBeInTheDocument()
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })

  it('shows detection timeout error without treating unknown as error', async () => {
    setupTab()
    setupRuntime({
      detection: {
        success: false,
        error: { code: 'DETECTION_TIMEOUT', message: 'Detection timed out' },
      },
    })
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/took too long/i)).toBeInTheDocument()
    })
    expect(screen.queryByText('Platform Unknown')).not.toBeInTheDocument()
  })

  it('rescans when Rescan is clicked', async () => {
    setupTab()
    setupRuntime()
    setupStorage()
    render(<App />)
    await waitFor(() => screen.getByRole('button', { name: /rescan/i }))
    fireEvent.click(screen.getByRole('button', { name: /rescan/i }))
    await waitFor(() => {
      const calls = mockChrome.runtime.sendMessage.mock.calls.filter(
        (c) => (c[0] as { type?: string }).type === 'RUN_SHOPIFY_DETECTION',
      )
      expect(calls.length).toBeGreaterThanOrEqual(2)
      expect(calls.some((c) => (c[0] as { force?: boolean }).force === true)).toBe(true)
    })
  })

  it('preserves page information alongside detection', async () => {
    setupTab()
    setupRuntime()
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Example Store')).toBeInTheDocument()
      expect(screen.getByText('Commerce Detection')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /refresh page information/i })).toBeInTheDocument()
    })
  })

  it('shows unsupported-page error for chrome:// URLs', async () => {
    setupTab({ url: 'chrome://extensions/', title: 'Extensions' })
    setupRuntime()
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/only works on regular web pages/i)).toBeInTheDocument()
    })
  })

  it('shows unsupported-page error for new tab URL', async () => {
    setupTab({ url: 'chrome://newtab/', title: 'New Tab' })
    setupRuntime()
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('shows error state when no active tab is returned', async () => {
    mockChrome.tabs.query.mockResolvedValue([])
    setupRuntime()
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('shows Unavailable badge when background service worker is down', async () => {
    setupTab()
    setupRuntime({ backgroundAlive: false })
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Unavailable')).toBeInTheDocument()
    })
  })

  it('calls chrome.tabs.query again on refresh button click', async () => {
    setupTab()
    setupRuntime()
    setupStorage()
    render(<App />)
    await waitFor(() => screen.getByRole('button', { name: /refresh/i }))

    setupTab({ title: 'Refreshed Title' })
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() => {
      expect(screen.getByText('Refreshed Title')).toBeInTheDocument()
    })
  })

  it('loads system theme as default when storage is empty', async () => {
    setupTab()
    setupRuntime()
    setupStorage({})
    render(<App />)
    await waitFor(() => screen.getByRole('combobox'))
    expect(screen.getByRole('combobox')).toHaveValue('system')
  })

  it('loads saved dark theme from storage', async () => {
    setupTab()
    setupRuntime()
    setupStorage({ userPreferences: { theme: 'dark', showTechnicalDetails: false } })
    render(<App />)
    await waitFor(() => screen.getByRole('combobox'))
    expect(screen.getByRole('combobox')).toHaveValue('dark')
  })

  it('falls back to defaults for corrupt stored preferences', async () => {
    setupTab()
    setupRuntime()
    setupStorage({ userPreferences: { theme: 42, showTechnicalDetails: 'yes' } })
    render(<App />)
    await waitFor(() => screen.getByRole('combobox'))
    expect(screen.getByRole('combobox')).toHaveValue('system')
  })

  it('toggles technical details panel when switch is clicked', async () => {
    setupTab()
    setupRuntime()
    setupStorage()
    render(<App />)
    await waitFor(() => screen.getByRole('switch'))

    expect(screen.queryByText('Technical Details')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch'))

    await waitFor(() => {
      expect(screen.getByText('Technical Details')).toBeInTheDocument()
    })
  })
})
