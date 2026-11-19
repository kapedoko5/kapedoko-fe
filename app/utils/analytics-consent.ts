import { Preferences } from '@capacitor/preferences'

export const ANALYTICS_CONSENT_KEY = 'kapedoko-analytics-consent'

export type ConsentState = 'granted' | 'declined'

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function isConsentState(value: string | null | undefined): value is ConsentState {
  return value === 'granted' || value === 'declined'
}

async function readLegacy(key: string): Promise<string | null> {
  if (!isBrowser()) return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

async function writeBoth(key: string, value: string): Promise<void> {
  if (!isBrowser()) return
  try {
    await Preferences.set({ key, value })
  } catch {
    /* Capacitor Preferences can fail in a browser */
  }
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* private mode cannot persist */
  }
}

async function readFlag(key: string): Promise<string | null> {
  if (!isBrowser()) return null
  try {
    const { value } = await Preferences.get({ key })
    if (value) return value
  } catch {
    /* fall through to localStorage */
  }
  return readLegacy(key)
}

export async function readAnalyticsConsent(): Promise<ConsentState | null> {
  const value = await readFlag(ANALYTICS_CONSENT_KEY)
  return isConsentState(value) ? value : null
}

export async function writeAnalyticsConsent(value: ConsentState): Promise<void> {
  await writeBoth(ANALYTICS_CONSENT_KEY, value)
}
