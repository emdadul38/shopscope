import type { PingResponse } from '../messaging/message-types'
import { isExtensionMessage } from '../messaging/message-types'

chrome.runtime.onInstalled.addListener(() => {
  if (import.meta.env.DEV) {
    console.log('[ShopScope] Service worker installed')
  }
})

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse: (response: unknown) => void): boolean => {
    if (!isExtensionMessage(message)) return false

    if (message.type === 'PING_BACKGROUND') {
      const response: PingResponse = { alive: true }
      sendResponse(response)
    }

    return false
  },
)
