import type { UserPreferences } from '../types/page'
import { DEFAULT_PREFERENCES, STORAGE_KEY } from './storage-types'

function isValidPreferences(value: unknown): value is UserPreferences {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (!(['light', 'dark', 'system'] as const).includes(v.theme as 'light' | 'dark' | 'system'))
    return false
  if (typeof v.showTechnicalDetails !== 'boolean') return false
  return true
}

export function getUserPreferences(): Promise<UserPreferences> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      if (chrome.runtime.lastError) {
        resolve({ ...DEFAULT_PREFERENCES })
        return
      }
      const stored = result[STORAGE_KEY]
      resolve(isValidPreferences(stored) ? stored : { ...DEFAULT_PREFERENCES })
    })
  })
}

export function setUserPreferences(preferences: UserPreferences): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: preferences }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message ?? 'Storage write failed'))
        return
      }
      resolve()
    })
  })
}

export function resetUserPreferences(): Promise<void> {
  return setUserPreferences({ ...DEFAULT_PREFERENCES })
}
