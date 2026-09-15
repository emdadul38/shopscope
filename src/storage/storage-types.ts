import type { UserPreferences } from '../types/page'

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  showTechnicalDetails: false,
}

export const STORAGE_KEY = 'userPreferences'
