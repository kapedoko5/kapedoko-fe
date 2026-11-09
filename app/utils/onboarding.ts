import { Preferences } from '@capacitor/preferences'

export const ONBOARDING_KEY = 'kapedoko-onboarding-done'
export const ONBOARDING_DONE_VALUE = '1'

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function onboardingFlagIsSet(value: string | null | undefined): boolean {
  return value === ONBOARDING_DONE_VALUE
}

export function shouldShowOnboarding(path: string, finished: boolean): boolean {
  if (finished) return false
  if (path.startsWith('/app/onboarding')) return false
  if (path.startsWith('/app')) return true
  return false
}

async function readLegacyFlag(): Promise<string | null> {
  if (!isBrowser()) return null
  try {
    return window.localStorage.getItem(ONBOARDING_KEY)
  } catch {
    return null
  }
}

export async function hasFinishedOnboarding(): Promise<boolean> {
  if (!isBrowser()) return false

  try {
    const { value } = await Preferences.get({ key: ONBOARDING_KEY })
    if (onboardingFlagIsSet(value)) return true
  } catch {
    /* native storage can fail; fall through to the web key */
  }

  const legacy = await readLegacyFlag()
  if (!onboardingFlagIsSet(legacy)) return false

  await markOnboardingDone()
  return true
}

export async function markOnboardingDone(): Promise<void> {
  if (!isBrowser()) return

  try {
    await Preferences.set({ key: ONBOARDING_KEY, value: ONBOARDING_DONE_VALUE })
  } catch {
    /* the visitor can still leave onboarding */
  }

  try {
    window.localStorage.setItem(ONBOARDING_KEY, ONBOARDING_DONE_VALUE)
  } catch {
    /* Capacitor Preferences is the source of truth on device */
  }
}
