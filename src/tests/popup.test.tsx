import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { mockChrome } from './setup'
import { App } from '../popup/App'

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

function setupBackground(alive: boolean) {
  if (alive) {
    mockChrome.runtime.sendMessage.mockImplementation(
      (_msg: unknown, cb: (r: unknown) => void) => cb({ alive: true }),
    )
  } else {
    mockChrome.runtime.sendMessage.mockImplementation(
      (_msg: unknown, cb: (r: unknown) => void) => {
        mockChrome.runtime.lastError = { message: 'Unavailable' }
        cb(undefined)
      },
    )
  }
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
    setupBackground(true)
    render(<App />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders page information on a supported page', async () => {
    setupTab()
    setupBackground(true)
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Example Store')).toBeInTheDocument()
      expect(screen.getByText('example.com')).toBeInTheDocument()
      expect(screen.getByText('https://example.com/products')).toBeInTheDocument()
    })
  })

  it('shows unsupported-page error for chrome:// URLs', async () => {
    setupTab({ url: 'chrome://extensions/', title: 'Extensions' })
    setupBackground(true)
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/only works on regular web pages/i)).toBeInTheDocument()
    })
  })

  it('shows unsupported-page error for new tab URL', async () => {
    setupTab({ url: 'chrome://newtab/', title: 'New Tab' })
    setupBackground(true)
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('shows error state when no active tab is returned', async () => {
    mockChrome.tabs.query.mockResolvedValue([])
    setupBackground(true)
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('shows Unavailable badge when background service worker is down', async () => {
    setupTab()
    setupBackground(false)
    setupStorage()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('Unavailable')).toBeInTheDocument()
    })
  })

  it('calls chrome.tabs.query again on refresh button click', async () => {
    setupTab()
    setupBackground(true)
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
    setupBackground(true)
    setupStorage({})
    render(<App />)
    await waitFor(() => screen.getByRole('combobox'))
    expect(screen.getByRole('combobox')).toHaveValue('system')
  })

  it('loads saved dark theme from storage', async () => {
    setupTab()
    setupBackground(true)
    setupStorage({ userPreferences: { theme: 'dark', showTechnicalDetails: false } })
    render(<App />)
    await waitFor(() => screen.getByRole('combobox'))
    expect(screen.getByRole('combobox')).toHaveValue('dark')
  })

  it('falls back to defaults for corrupt stored preferences', async () => {
    setupTab()
    setupBackground(true)
    setupStorage({ userPreferences: { theme: 42, showTechnicalDetails: 'yes' } })
    render(<App />)
    await waitFor(() => screen.getByRole('combobox'))
    expect(screen.getByRole('combobox')).toHaveValue('system')
  })

  it('toggles technical details panel when switch is clicked', async () => {
    setupTab()
    setupBackground(true)
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
