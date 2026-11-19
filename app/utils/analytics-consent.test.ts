import { beforeEach, describe, expect, mock, test } from 'bun:test'

const memory = new Map<string, string>()
const localMemory = new Map<string, string>()

mock.module('@capacitor/preferences', () => ({
  Preferences: {
    async get({ key }: { key: string }) {
      return { value: memory.get(key) ?? null }
    },
    async set({ key, value }: { key: string; value: string }) {
      memory.set(key, value)
    },
    async remove({ key }: { key: string }) {
      memory.delete(key)
    },
  },
}))

const {
  ANALYTICS_CONSENT_KEY,
  readAnalyticsConsent,
  writeAnalyticsConsent,
} = await import('./analytics-consent')

describe('analytics consent storage', () => {
  beforeEach(() => {
    memory.clear()
    localMemory.clear()
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => localMemory.get(key) ?? null,
          setItem: (key: string, value: string) => {
            localMemory.set(key, value)
          },
          removeItem: (key: string) => {
            localMemory.delete(key)
          },
        },
      },
    })
  })

  test('starts unset and persists granted or declined', async () => {
    expect(await readAnalyticsConsent()).toBe(null)
    await writeAnalyticsConsent('granted')
    expect(await readAnalyticsConsent()).toBe('granted')
    expect(memory.get(ANALYTICS_CONSENT_KEY)).toBe('granted')
    await writeAnalyticsConsent('declined')
    expect(await readAnalyticsConsent()).toBe('declined')
  })

  test('migrates a legacy localStorage consent flag', async () => {
    localMemory.set(ANALYTICS_CONSENT_KEY, 'granted')
    expect(await readAnalyticsConsent()).toBe('granted')
  })
})
