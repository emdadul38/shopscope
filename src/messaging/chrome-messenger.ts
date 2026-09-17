import type { ExtensionError, Result } from '../types/page'
import { ERROR_CODES } from '../types/page'

const DEFAULT_TIMEOUT_MS = 5000

function makeError(code: keyof typeof ERROR_CODES, message: string): ExtensionError {
  return { code, message }
}

export function sendMessage<TReq, TRes = unknown>(
  message: TReq,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Result<TRes>> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({
        success: false,
        error: makeError('MESSAGE_TIMEOUT', 'Message timed out after ' + timeoutMs + 'ms'),
      })
    }, timeoutMs)

    try {
      chrome.runtime.sendMessage(message, (response: unknown) => {
        clearTimeout(timer)
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: makeError(
              'BACKGROUND_UNAVAILABLE',
              chrome.runtime.lastError.message ?? 'Background unavailable',
            ),
          })
          return
        }
        resolve({ success: true, data: response as TRes })
      })
    } catch (err) {
      clearTimeout(timer)
      resolve({
        success: false,
        error: makeError('UNKNOWN_ERROR', err instanceof Error ? err.message : 'Unknown error'),
      })
    }
  })
}
