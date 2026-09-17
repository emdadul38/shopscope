import { useState, useEffect, useCallback, useRef } from 'react'
import type { PageInformation, UserPreferences, ExtensionError } from '../types/page'
import { ERROR_CODES } from '../types/page'
import { getUserPreferences, setUserPreferences } from '../storage/storage'
import { sendMessage } from '../messaging/chrome-messenger'
import { useApplyTheme } from './apply-theme'
import { ExtensionHeader } from '../components/ExtensionHeader'
import { PageInformationView } from '../components/PageInformation'
import { ErrorState } from '../components/ErrorState'
import { CommerceDetectionCard, type DetectionCardState } from '../components/CommerceDetectionCard'
import type { DeepScanState } from '../components/DeepScanControls'
import type { ConnectedStoreState } from '../components/ConnectedStoreCard'
import { ConnectedStoreCard } from '../components/ConnectedStoreCard'
import {
  PublicContactCard,
  type ContactCardState,
} from '../components/PublicContactCard'
import type {
  PingResponse,
  DetectionMessageResponse,
  ContactScanMessageResponse,
  ConnectedStoreMessageResponse,
  DeepScanMessageResponse,
  DeepScanProgressMessageResponse,
} from '../messaging/message-types'
import { isCommerceDetectionResult } from '../detectors/commerce/commerce-detector'
import { isPublicContactScanResult } from '../contacts/contact-scanner'

type AppState =
  | { status: 'loading' }
  | { status: 'unsupported'; error: ExtensionError }
  | { status: 'error'; error: ExtensionError }
  | { status: 'loaded'; pageInfo: PageInformation; backgroundAlive: boolean; tabId: number }

const UNSUPPORTED_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'data:',
  'javascript:',
  'file://',
  'blob:',
  'ftp://',
]

const DEEP_SCAN_POLL_INTERVAL_MS = 1_000

function isUnsupportedUrl(url: string): boolean {
  if (UNSUPPORTED_PREFIXES.some((p) => url.startsWith(p))) return true
  try {
    if (new URL(url).hostname === 'chrome.google.com') return true
  } catch {
    return true
  }
  return !/^https?:\/\//i.test(url)
}

async function loadPageInfo(): Promise<{
  pageInfo: PageInformation
  backgroundAlive: boolean
  tabId: number
}> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]

  if (!tab?.id || !tab.url) {
    throw { code: ERROR_CODES.ACTIVE_TAB_NOT_FOUND, message: 'No active tab found' }
  }

  if (isUnsupportedUrl(tab.url)) {
    throw { code: ERROR_CODES.UNSUPPORTED_URL, message: 'Page type not supported' }
  }

  const pageInfo: PageInformation = {
    url: tab.url,
    title: tab.title ?? new URL(tab.url).hostname,
    hostname: new URL(tab.url).hostname,
    faviconUrl: tab.favIconUrl,
    collectedAt: new Date().toISOString(),
  }

  const pingResult = await sendMessage<{ type: 'PING_BACKGROUND' }, PingResponse>({
    type: 'PING_BACKGROUND',
  })
  const backgroundAlive = pingResult.success && (pingResult.data?.alive ?? false)

  return { pageInfo, backgroundAlive, tabId: tab.id }
}

function unwrapDetection(payload: DetectionMessageResponse | unknown): DetectionCardState {
  if (typeof payload === 'object' && payload !== null && 'success' in payload) {
    const nested = payload as DetectionMessageResponse
    if (nested.success) return { status: 'ready', result: nested.data }
    return { status: 'error', error: nested.error }
  }
  if (isCommerceDetectionResult(payload)) return { status: 'ready', result: payload }
  return {
    status: 'error',
    error: {
      code: ERROR_CODES.INVALID_DETECTION_RESULT,
      message: 'Invalid detection result',
    },
  }
}

function unwrapContact(payload: ContactScanMessageResponse | unknown): ContactCardState {
  if (typeof payload === 'object' && payload !== null && 'success' in payload) {
    const nested = payload as ContactScanMessageResponse
    if (nested.success) return { status: 'ready', result: nested.data }
    return { status: 'error', error: nested.error }
  }
  if (isPublicContactScanResult(payload)) return { status: 'ready', result: payload }
  return {
    status: 'error',
    error: {
      code: ERROR_CODES.INVALID_CONTACT_RESULT,
      message: 'Invalid contact scan result',
    },
  }
}

export function App() {
  const [state, setState] = useState<AppState>({ status: 'loading' })
  const [prefs, setPrefs] = useState<UserPreferences>({
    theme: 'system',
    showTechnicalDetails: false,
  })
  const [detection, setDetection] = useState<DetectionCardState>({ status: 'idle' })
  const [contact, setContact] = useState<ContactCardState>({ status: 'idle' })
  const [connectedStore, setConnectedStore] = useState<ConnectedStoreState>({ status: 'idle' })
  const [deepScan, setDeepScan] = useState<DeepScanState>({ status: 'idle' })
  const [hasScanned, setHasScanned] = useState(false)
  const rescanButtonFocusRef = useRef(false)
  const deepScanPollingRef = useRef(false)

  const runDetection = useCallback(async (force = false) => {
    setDetection({ status: 'loading' })
    setContact({ status: 'idle' })
    setConnectedStore({ status: 'idle' })
    setDeepScan({ status: 'idle' })
    const result = await sendMessage<
      { type: 'RUN_SHOPIFY_DETECTION'; force?: boolean },
      DetectionMessageResponse
    >({ type: 'RUN_SHOPIFY_DETECTION', force }, 10_000)

    if (!result.success) {
      setDetection({ status: 'error', error: result.error })
      setHasScanned(true)
      return
    }

    setDetection(unwrapDetection(result.data))
    setHasScanned(true)
  }, [])

  const runContactScan = useCallback(
    async (force: boolean) => {
      if (state.status !== 'loaded') return
      setContact({ status: 'loading' })
      const result = await sendMessage<
        {
          type: 'SCAN_PUBLIC_CONTACT_INFORMATION'
          payload: { tabId: number; url: string; userInitiated: true; force?: boolean }
        },
        ContactScanMessageResponse
      >(
        {
          type: 'SCAN_PUBLIC_CONTACT_INFORMATION',
          payload: {
            tabId: state.tabId,
            url: state.pageInfo.url,
            userInitiated: true,
            force,
          },
        },
        18_000,
      )

      if (!result.success) {
        setContact({ status: 'error', error: result.error })
        return
      }
      setContact(unwrapContact(result.data))
    },
    [state],
  )

  const cancelContactScan = useCallback(() => {
    void sendMessage({ type: 'CANCEL_PUBLIC_CONTACT_SCAN' }, 3_000)
    setContact({
      status: 'error',
      error: { code: ERROR_CODES.CONTACT_SCAN_CANCELLED, message: 'Contact scan cancelled' },
    })
  }, [])

  const openTab = useCallback((url: string) => {
    void chrome.tabs.create({ url })
  }, [])

  const runDiscoverConnectedStore = useCallback(async () => {
    setConnectedStore({ status: 'loading' })
    const result = await sendMessage<
      { type: 'DISCOVER_CONNECTED_STORE' },
      ConnectedStoreMessageResponse
    >({ type: 'DISCOVER_CONNECTED_STORE' }, 15_000)

    if (!result.success) {
      setConnectedStore({ status: 'error', error: result.error })
      return
    }
    if (!result.data.success) {
      setConnectedStore({ status: 'error', error: result.data.error })
      return
    }

    setConnectedStore({
      status: 'ready',
      connectedStore: result.data.data.connectedStore,
      candidates: result.data.data.connectedCandidates,
    })
  }, [])

  const stopDeepScanPolling = useCallback(() => {
    deepScanPollingRef.current = false
  }, [])

  const pollDeepScanProgress = useCallback(async () => {
    deepScanPollingRef.current = true
    while (deepScanPollingRef.current) {
      const result = await sendMessage<
        { type: 'GET_DEEP_SCAN_PROGRESS' },
        DeepScanProgressMessageResponse
      >({ type: 'GET_DEEP_SCAN_PROGRESS' }, 5_000)

      if (!deepScanPollingRef.current) return

      if (result.success && result.data.success && result.data.data.progress) {
        const progress = result.data.data.progress
        if (progress.phase === 'done') {
          deepScanPollingRef.current = false
          setDeepScan({ status: 'done', progress })
          setDetection({ status: 'ready', result: progress.partial })
          if (progress.connectedCandidates) {
            setConnectedStore((prev) => ({
              status: 'ready',
              connectedStore: prev.status === 'ready' ? prev.connectedStore : undefined,
              candidates: progress.connectedCandidates!,
            }))
          }
          return
        }
        setDeepScan({ status: 'scanning', progress })
      }

      await new Promise((resolve) => setTimeout(resolve, DEEP_SCAN_POLL_INTERVAL_MS))
    }
  }, [])

  const startDeepScan = useCallback(async () => {
    setDeepScan({ status: 'scanning', progress: null })
    const result = await sendMessage<{ type: 'RUN_DEEP_SCAN' }, DeepScanMessageResponse>(
      { type: 'RUN_DEEP_SCAN' },
      10_000,
    )
    if (!result.success || !result.data.success) {
      setDeepScan({ status: 'idle' })
      return
    }
    void pollDeepScanProgress()
  }, [pollDeepScanProgress])

  const cancelDeepScan = useCallback(async () => {
    stopDeepScanPolling()
    await sendMessage({ type: 'CANCEL_DEEP_SCAN' }, 5_000)
    setDeepScan({ status: 'idle' })
  }, [stopDeepScanPolling])

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    setDetection({ status: 'idle' })
    setContact({ status: 'idle' })
    setConnectedStore({ status: 'idle' })
    setDeepScan({ status: 'idle' })
    stopDeepScanPolling()
    try {
      const [result, savedPrefs] = await Promise.all([loadPageInfo(), getUserPreferences()])
      setPrefs(savedPrefs)
      setState({ status: 'loaded', ...result })
      void runDetection(false)
    } catch (err) {
      const e = err as Partial<ExtensionError>
      const error: ExtensionError = {
        code: e.code ?? ERROR_CODES.UNKNOWN_ERROR,
        message: e.message ?? 'Unknown error',
      }
      if (error.code === ERROR_CODES.UNSUPPORTED_URL) {
        setState({ status: 'unsupported', error })
      } else {
        setState({ status: 'error', error })
      }
    }
  }, [runDetection, stopDeepScanPolling])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return () => stopDeepScanPolling()
  }, [stopDeepScanPolling])

  const handleThemeChange = async (theme: UserPreferences['theme']) => {
    const updated: UserPreferences = { ...prefs, theme }
    setPrefs(updated)
    try {
      await setUserPreferences(updated)
    } catch {
      // Storage write failed
    }
  }

  const handleTechDetailsToggle = async () => {
    const updated: UserPreferences = { ...prefs, showTechnicalDetails: !prefs.showTechnicalDetails }
    setPrefs(updated)
    try {
      await setUserPreferences(updated)
    } catch {
      // Storage write failed
    }
  }

  const handleRescan = () => {
    rescanButtonFocusRef.current = true
    void runDetection(true)
  }

  const detectionStatus = detection.status === 'ready' ? detection.result.status : null
  const connectedStoreUrl = connectedStore.status === 'ready' ? connectedStore.connectedStore?.url : undefined
  const connectedStoreEligible =
    detection.status === 'ready' &&
    (detection.result.status === 'unknown' || detection.result.status === 'confirmed_other')

  useApplyTheme(prefs.theme)

  return (
    <div className="w-[380px] min-h-[200px] bg-surface font-sans text-ink">
      <ExtensionHeader />

      <main className="space-y-4 p-4">
        {state.status === 'loading' && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center justify-center gap-2 py-8"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-500" />
            <span className="sr-only">Loading page information…</span>
          </div>
        )}

        {(state.status === 'error' || state.status === 'unsupported') && (
          <ErrorState error={state.error} onRetry={state.status === 'error' ? load : undefined} />
        )}

        {state.status === 'loaded' && (
          <>
            <CommerceDetectionCard
              state={detection}
              onRunDetection={handleRescan}
              hasScanned={hasScanned}
              deepScanState={deepScan}
              onStartDeepScan={() => void startDeepScan()}
              onCancelDeepScan={() => void cancelDeepScan()}
            />
            <ConnectedStoreCard
              visible={connectedStoreEligible}
              currentDomain={state.pageInfo.hostname}
              state={connectedStore}
              onDiscover={() => void runDiscoverConnectedStore()}
              onOpenStore={openTab}
            />
            <PublicContactCard
              detectionStatus={detectionStatus}
              detectionError={detection.status === 'error'}
              state={contact}
              websiteUrl={state.pageInfo.url}
              connectedStoreUrl={connectedStoreUrl}
              onScan={(force) => void runContactScan(force)}
              onCancel={cancelContactScan}
              onOpenConnectedStore={openTab}
              onRetryDetection={handleRescan}
            />
            <PageInformationView
              pageInfo={state.pageInfo}
              backgroundAlive={state.backgroundAlive}
              prefs={prefs}
              showTechnicalDetails={prefs.showTechnicalDetails}
              onRefresh={load}
              onThemeChange={(t) => void handleThemeChange(t)}
              onTechDetailsToggle={() => void handleTechDetailsToggle()}
            />
          </>
        )}
      </main>
    </div>
  )
}
