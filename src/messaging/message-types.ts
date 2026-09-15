import type { PageInformation } from '../types/page'

export type ExtensionMessage =
  | { type: 'GET_PAGE_INFORMATION' }
  | { type: 'PING_BACKGROUND' }
  | { type: 'PING_CONTENT_SCRIPT' }

export interface PingResponse {
  alive: boolean
}

export interface ContentScriptResponse {
  pageInfo: PageInformation
}

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).type === 'string'
  )
}
