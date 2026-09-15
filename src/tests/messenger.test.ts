import { describe, it, expect } from 'vitest'
import { mockChrome } from './setup'
import { sendMessage } from '../messaging/chrome-messenger'

describe('sendMessage', () => {
  it('resolves with success result on normal response', async () => {
    mockChrome.runtime.sendMessage.mockImplementation(
      (_msg: unknown, cb: (r: unknown) => void) => cb({ alive: true }),
    )
    const result = await sendMessage<{ type: 'PING_BACKGROUND' }, { alive: boolean }>({
      type: 'PING_BACKGROUND',
    })
    expect(result).toEqual({ success: true, data: { alive: true } })
  })

  it('resolves with error when runtime.lastError is set', async () => {
    mockChrome.runtime.sendMessage.mockImplementation(
      (_msg: unknown, cb: (r: unknown) => void) => {
        mockChrome.runtime.lastError = { message: 'Extension context invalid' }
        cb(undefined)
      },
    )
    const result = await sendMessage({ type: 'PING_BACKGROUND' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('BACKGROUND_UNAVAILABLE')
      expect(result.error.message).toBe('Extension context invalid')
    }
  })

  it('resolves with MESSAGE_TIMEOUT when callback is never called', async () => {
    mockChrome.runtime.sendMessage.mockImplementation(() => {
      // never calls callback
    })
    const result = await sendMessage({ type: 'PING_BACKGROUND' }, 50)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('MESSAGE_TIMEOUT')
    }
  }, 1000)

  it('resolves with UNKNOWN_ERROR when sendMessage throws', async () => {
    mockChrome.runtime.sendMessage.mockImplementation(() => {
      throw new Error('Unexpected crash')
    })
    const result = await sendMessage({ type: 'PING_BACKGROUND' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.code).toBe('UNKNOWN_ERROR')
    }
  })
})
