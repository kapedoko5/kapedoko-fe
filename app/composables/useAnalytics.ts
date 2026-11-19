import { readAnalyticsConsent, writeAnalyticsConsent, type ConsentState } from '~/utils/analytics-consent'

export function useAnalytics() {
  const consent = useState<ConsentState | 'pending' | null>('kd-analytics-consent', () => 'pending')

  const setConsent = async (next: ConsentState) => {
    await writeAnalyticsConsent(next)
    consent.value = next
  }

  return {
    consent,
    setConsent,
  }
}

export async function hydrateAnalyticsConsent() {
  const consent = useState<ConsentState | 'pending' | null>('kd-analytics-consent', () => 'pending')
  try {
    consent.value = await readAnalyticsConsent()
  } catch {
    consent.value = null
  }
  return consent.value === 'pending' ? null : consent.value
}
