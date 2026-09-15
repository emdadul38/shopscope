import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

const chromeMock = {
  tabs: {
    query: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks()
  chromeMock.runtime.lastError = null
})

export { chromeMock as mockChrome }
