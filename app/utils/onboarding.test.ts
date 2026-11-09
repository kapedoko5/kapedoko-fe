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
  },
}))

const {
  ONBOARDING_KEY,
  hasFinishedOnboarding,
  markOnboardingDone,
  onboardingFlagIsSet,
  shouldShowOnboarding,
} = await import('./onboarding')

describe('onboarding gate', () => {
  test('shows on first launch into the app', () => {
    expect(shouldShowOnboarding('/app', false)).toBe(true)
    expect(shouldShowOnboarding('/app/map', false)).toBe(true)
  })

  test('does not interrupt the marketing landing, onboarding, auth, or a finished visit', () => {
    expect(shouldShowOnboarding('/', false)).toBe(false)
    expect(shouldShowOnboarding('/app/onboarding', false)).toBe(false)
    expect(shouldShowOnboarding('/app/onboarding/done', false)).toBe(false)
    expect(shouldShowOnboarding('/login', false)).toBe(false)
    expect(shouldShowOnboarding('/register', false)).toBe(false)
    expect(shouldShowOnboarding('/admin', false)).toBe(false)
    expect(shouldShowOnboarding('/app', true)).toBe(false)
    expect(shouldShowOnboarding('/', true)).toBe(false)
  })

  test('treats only the stored done value as finished', () => {
    expect(onboardingFlagIsSet('1')).toBe(true)
    expect(onboardingFlagIsSet(null)).toBe(false)
    expect(onboardingFlagIsSet('0')).toBe(false)
  })
})

describe('onboarding Capacitor flag', () => {
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
        },
      },
    })
  })

  test('starts unfinished and marks done in Preferences', async () => {
    expect(await hasFinishedOnboarding()).toBe(false)
    await markOnboardingDone()
    expect(await hasFinishedOnboarding()).toBe(true)
    expect(memory.get(ONBOARDING_KEY)).toBe('1')
  })

  test('migrates a legacy localStorage completion into Preferences', async () => {
    localMemory.set(ONBOARDING_KEY, '1')
    expect(await hasFinishedOnboarding()).toBe(true)
    expect(memory.get(ONBOARDING_KEY)).toBe('1')
  })
})
