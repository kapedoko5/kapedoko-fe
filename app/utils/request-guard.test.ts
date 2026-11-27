import { describe, expect, test } from 'bun:test'
import { createRequestGuard } from './request-guard'

describe('request guard', () => {
  test('only the newest request is current', () => {
    const guard = createRequestGuard()
    const first = guard.next()
    expect(first()).toBe(true)
    const second = guard.next()
    expect(first()).toBe(false)
    expect(second()).toBe(true)
  })

  test('drops a slow older response that resolves after a newer one', async () => {
    const guard = createRequestGuard()
    let shown = ''
    const load = async (label: string, ms: number) => {
      const current = guard.next()
      await new Promise((resolve) => setTimeout(resolve, ms))
      if (!current()) return
      shown = label
    }
    await Promise.all([load('7 days (slow)', 20), load('30 days (fast)', 1)])
    expect(shown).toBe('30 days (fast)')
  })
})
