import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

const chromeMock = {
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
    onRemoved: {
      addListener: vi.fn(),
    },
    onUpdated: {
      addListener: vi.fn(),
    },
  },
  runtime: {
    sendMessage: vi.fn(),
    lastError: null as chrome.runtime.LastError | null,
    onMessage: {
      addListener: vi.fn(),
    },
    onInstalled: {
      addListener: vi.fn(),
    },
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
  scripting: {
    executeScript: vi.fn(),
  },
}

vi.stubGlobal('chrome', chromeMock)

vi.stubGlobal(
  'matchMedia',
  vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
)

beforeEach(() => {
  vi.clearAllMocks()
  chromeMock.runtime.lastError = null
})

export { chromeMock as mockChrome }
