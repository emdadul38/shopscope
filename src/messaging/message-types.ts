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
