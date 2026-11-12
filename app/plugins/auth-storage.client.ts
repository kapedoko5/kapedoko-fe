import { Capacitor } from '@capacitor/core'
import { AUTH_NATIVE_SESSION_KEY, shouldDeferSessionCheck } from '~/utils/auth'

interface StoredSession {
  access_token: string
  refresh_token: string
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(AUTH_NATIVE_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredSession>
    if (!parsed.access_token || !parsed.refresh_token) return null
    return { access_token: parsed.access_token, refresh_token: parsed.refresh_token }
  } catch {
    return null
  }
}

export default defineNuxtPlugin({
  name: 'kapedoko-auth-storage',
  enforce: 'post',
  async setup() {
    const supabase = useSupabaseClient()
    const { ensureLiveSession } = useAuth()

    if (Capacitor.isNativePlatform()) {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        const stored = readStoredSession()
        if (stored) await supabase.auth.setSession(stored)
      }

      supabase.auth.onAuthStateChange((_event, session) => {
        try {
          if (!session) {
            window.localStorage.removeItem(AUTH_NATIVE_SESSION_KEY)
            return
          }
          const stored: StoredSession = {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          }
          window.localStorage.setItem(AUTH_NATIVE_SESSION_KEY, JSON.stringify(stored))
        } catch {
          /* private mode cannot persist the native session */
        }
      })
    }

    if (!shouldDeferSessionCheck(window.location.href)) {
      await ensureLiveSession({ force: true })
    }

    const recheck = () => {
      if (shouldDeferSessionCheck(window.location.href)) return
      void ensureLiveSession({ force: true })
    }
    window.addEventListener('focus', recheck)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') recheck()
    })
  },
})
