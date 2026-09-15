import type { ExtensionMessage } from '../messaging/message-types'

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (response: unknown) => void): boolean => {
    if (!isExtensionMessage(message)) return false

    if (message.type === 'PING_CONTENT_SCRIPT') {
      sendResponse({ alive: true })
    }

    return false
  },
)

function isExtensionMessage(value: unknown): value is ExtensionMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>).type === 'string'
  )
}
