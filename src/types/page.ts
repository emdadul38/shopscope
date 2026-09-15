export interface PageInformation {
  url: string
  title: string
  hostname: string
  faviconUrl?: string
  collectedAt: string
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  showTechnicalDetails: boolean
}

export interface ExtensionError {
  code: string
  message: string
}

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: ExtensionError }

export const ERROR_CODES = {
  ACTIVE_TAB_NOT_FOUND: 'ACTIVE_TAB_NOT_FOUND',
  UNSUPPORTED_URL: 'UNSUPPORTED_URL',
  BACKGROUND_UNAVAILABLE: 'BACKGROUND_UNAVAILABLE',
  CONTENT_SCRIPT_UNAVAILABLE: 'CONTENT_SCRIPT_UNAVAILABLE',
  MESSAGE_TIMEOUT: 'MESSAGE_TIMEOUT',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

export type ErrorCode = keyof typeof ERROR_CODES
