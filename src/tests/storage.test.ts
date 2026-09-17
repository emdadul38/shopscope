import { describe, it, expect } from 'vitest'
import { mockChrome } from './setup'
import { getUserPreferences, setUserPreferences, resetUserPreferences } from '../storage/storage'
import { DEFAULT_PREFERENCES } from '../storage/storage-types'

describe('getUserPreferences', () => {
  it('returns defaults when storage is empty', async () => {
    mockChrome.storage.local.get.mockImplementation(
      (_key: string, cb: (r: Record<string, unknown>) => void) => cb({}),
    )
    const prefs = await getUserPreferences()
    expect(prefs).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns stored preferences when valid', async () => {
    const stored = { theme: 'dark', showTechnicalDetails: true }
    mockChrome.storage.local.get.mockImplementation(
      (_key: string, cb: (r: Record<string, unknown>) => void) => cb({ userPreferences: stored }),
    )
    const prefs = await getUserPreferences()
    expect(prefs).toEqual(stored)
  })

  it('returns defaults when stored theme is invalid', async () => {
    mockChrome.storage.local.get.mockImplementation(
      (_key: string, cb: (r: Record<string, unknown>) => void) =>
        cb({ userPreferences: { theme: 'rainbow', showTechnicalDetails: true } }),
    )
    const prefs = await getUserPreferences()
    expect(prefs).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns defaults when showTechnicalDetails is not boolean', async () => {
    mockChrome.storage.local.get.mockImplementation(
      (_key: string, cb: (r: Record<string, unknown>) => void) =>
        cb({ userPreferences: { theme: 'light', showTechnicalDetails: 'yes' } }),
    )
    const prefs = await getUserPreferences()
    expect(prefs).toEqual(DEFAULT_PREFERENCES)
  })

  it('returns defaults when stored value is null', async () => {
    mockChrome.storage.local.get.mockImplementation(
      (_key: string, cb: (r: Record<string, unknown>) => void) => cb({ userPreferences: null }),
    )
    const prefs = await getUserPreferences()
    expect(prefs).toEqual(DEFAULT_PREFERENCES)
  })
})

describe('setUserPreferences', () => {
  it('calls chrome.storage.local.set with the correct key', async () => {
    mockChrome.storage.local.set.mockImplementation(
      (_data: Record<string, unknown>, cb?: () => void) => cb?.(),
    )
    await setUserPreferences({ theme: 'light', showTechnicalDetails: true })
    expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
      { userPreferences: { theme: 'light', showTechnicalDetails: true } },
      expect.any(Function),
    )
  })
})

describe('resetUserPreferences', () => {
  it('saves DEFAULT_PREFERENCES to storage', async () => {
    mockChrome.storage.local.set.mockImplementation(
      (_data: Record<string, unknown>, cb?: () => void) => cb?.(),
    )
    await resetUserPreferences()
    expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
      { userPreferences: DEFAULT_PREFERENCES },
      expect.any(Function),
    )
  })
})
