import type { PageInformation } from '../types/page'
import type { CommerceDetectionResult, ConnectedStoreCandidate, DeepScanProgress } from '../detectors/commerce/commerce-types'
import type { PublicContactScanResult } from '../contacts/contact-types'

export type ExtensionMessage =
  | { type: 'GET_PAGE_INFORMATION' }
  | { type: 'PING_BACKGROUND' }
  | { type: 'PING_CONTENT_SCRIPT' }
  | { type: 'RUN_SHOPIFY_DETECTION'; force?: boolean }
  | { type: 'GET_LAST_SHOPIFY_DETECTION' }
  | {
      type: 'SCAN_PUBLIC_CONTACT_INFORMATION'
      payload: { tabId: number; url: string; userInitiated: true; force?: boolean }
    }
  | {
      type: 'GET_LAST_PUBLIC_CONTACT_SCAN'
      payload: { tabId: number; url: string }
    }
  | { type: 'CANCEL_PUBLIC_CONTACT_SCAN' }
  | { type: 'DISCOVER_CONNECTED_STORE' }
  | { type: 'RUN_DEEP_SCAN' }
  | { type: 'CANCEL_DEEP_SCAN' }
  | { type: 'GET_DEEP_SCAN_PROGRESS' }
  | { type: 'DEEP_SCAN_PROGRESS_UPDATE'; payload: { progress: DeepScanProgress } }

export interface PingResponse {
  alive: boolean
}

export interface ContentScriptResponse {
  pageInfo: PageInformation
}

export type DetectionMessageResponse =
  | { success: true; data: CommerceDetectionResult }
  | { success: false; error: { code: string; message: string } }

export type ContactScanMessageResponse =
  | { success: true; data: PublicContactScanResult }
  | { success: false; error: { code: string; message: string } }

export interface ConnectedStoreDiscoveryResult {
  connectedStore?: CommerceDetectionResult['connectedStore']
  connectedCandidates: ConnectedStoreCandidate[]
}

export type ConnectedStoreMessageResponse =
  | { success: true; data: ConnectedStoreDiscoveryResult }
  | { success: false; error: { code: string; message: string } }

export type DeepScanMessageResponse =
  | { success: true; data: { started: boolean } }
  | { success: false; error: { code: string; message: string } }

export type DeepScanProgressMessageResponse =
  | { success: true; data: { progress: DeepScanProgress | null } }
  | { success: false; error: { code: string; message: string } }

const MESSAGE_TYPES = new Set([
  'GET_PAGE_INFORMATION',
  'PING_BACKGROUND',
  'PING_CONTENT_SCRIPT',
  'RUN_SHOPIFY_DETECTION',
  'GET_LAST_SHOPIFY_DETECTION',
  'SCAN_PUBLIC_CONTACT_INFORMATION',
  'GET_LAST_PUBLIC_CONTACT_SCAN',
  'CANCEL_PUBLIC_CONTACT_SCAN',
  'DISCOVER_CONNECTED_STORE',
  'RUN_DEEP_SCAN',
  'CANCEL_DEEP_SCAN',
  'GET_DEEP_SCAN_PROGRESS',
  'DEEP_SCAN_PROGRESS_UPDATE',
])

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (typeof value !== 'object' || value === null) return false
  const type = (value as Record<string, unknown>).type
  if (typeof type !== 'string' || !MESSAGE_TYPES.has(type)) return false

  if (type === 'RUN_SHOPIFY_DETECTION') {
    const force = (value as Record<string, unknown>).force
    if (force !== undefined && typeof force !== 'boolean') return false
  }

  if (type === 'SCAN_PUBLIC_CONTACT_INFORMATION') {
    const payload = (value as Record<string, unknown>).payload
    if (typeof payload !== 'object' || payload === null) return false
    const p = payload as Record<string, unknown>
    if (!isPositiveInt(p.tabId) || typeof p.url !== 'string') return false
    if (p.userInitiated !== true) return false
    if (p.force !== undefined && typeof p.force !== 'boolean') return false
  }

  if (type === 'GET_LAST_PUBLIC_CONTACT_SCAN') {
    const payload = (value as Record<string, unknown>).payload
    if (typeof payload !== 'object' || payload === null) return false
    const p = payload as Record<string, unknown>
    if (!isPositiveInt(p.tabId) || typeof p.url !== 'string') return false
  }

  if (type === 'DEEP_SCAN_PROGRESS_UPDATE') {
    const payload = (value as Record<string, unknown>).payload
    if (typeof payload !== 'object' || payload === null) return false
    const p = payload as Record<string, unknown>
    if (typeof p.progress !== 'object' || p.progress === null) return false
  }

  return true
}
