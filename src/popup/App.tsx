import { useState, useEffect, useCallback } from 'react'
import type { PageInformation, UserPreferences, ExtensionError } from '../types/page'
import { ERROR_CODES } from '../types/page'
import { getUserPreferences, setUserPreferences } from '../storage/storage'
import { sendMessage } from '../messaging/chrome-messenger'
import { ExtensionHeader } from '../components/ExtensionHeader'
import { PageInformationView } from '../components/PageInformation'
import { StatusBadge } from '../components/StatusBadge'
import { ErrorState } from '../components/ErrorState'
import type { PingResponse } from '../messaging/message-types'

type AppState =
  | { status: 'loading' }
  | { status: 'unsupported'; error: ExtensionError }
  | { status: 'error'; error: ExtensionError }
  | { status: 'loaded'; pageInfo: PageInformation; backgroundAlive: boolean }

const UNSUPPORTED_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'data:',
  'javascript:',
]

function isUnsupportedUrl(url: string): boolean {
  if (UNSUPPORTED_PREFIXES.some((p) => url.startsWith(p))) return true
  try {
    if (new URL(url).hostname === 'chrome.google.com') return true
  } catch {
    return true
  }
  return !/^https?:\/\//i.test(url)
}

async function loadPageInfo(): Promise<{ pageInfo: PageInformation; backgroundAlive: boolean }> {
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
  const backgroundAlive = pingResult.success && pingResult.data.alive

  return { pageInfo, backgroundAlive }
}

export function App() {
  const [state, setState] = useState<AppState>({ status: 'loading' })
  const [prefs, setPrefs] = useState<UserPreferences>({ theme: 'system', showTechnicalDetails: false })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const [result, savedPrefs] = await Promise.all([loadPageInfo(), getUserPreferences()])
      setPrefs(savedPrefs)
      setState({ status: 'loaded', ...result })
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
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleThemeChange = async (theme: UserPreferences['theme']) => {
    const updated: UserPreferences = { ...prefs, theme }
    setPrefs(updated)
    await setUserPreferences(updated)
  }

  const handleTechDetailsToggle = async () => {
    const updated: UserPreferences = { ...prefs, showTechnicalDetails: !prefs.showTechnicalDetails }
    setPrefs(updated)
    await setUserPreferences(updated)
  }

  return (
    <div className="w-[380px] min-h-[200px] bg-white text-gray-900 font-sans">
      <ExtensionHeader />
      <div className="px-4 pt-2">
        <StatusBadge label="Foundation Ready" variant="success" />
      </div>

      <main className="p-4">
        {state.status === 'loading' && (
          <div
            role="status"
            aria-live="polite"
            className="flex flex-col items-center justify-center py-8 gap-2"
          >
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            <span className="sr-only">Loading page information…</span>
          </div>
        )}

        {(state.status === 'error' || state.status === 'unsupported') && (
          <ErrorState
            error={state.error}
            onRetry={state.status === 'error' ? load : undefined}
          />
        )}

        {state.status === 'loaded' && (
          <PageInformationView
            pageInfo={state.pageInfo}
            backgroundAlive={state.backgroundAlive}
            prefs={prefs}
            showTechnicalDetails={prefs.showTechnicalDetails}
            onRefresh={load}
            onThemeChange={(t) => void handleThemeChange(t)}
            onTechDetailsToggle={() => void handleTechDetailsToggle()}
          />
        )}
      </main>
    </div>
  )
}
