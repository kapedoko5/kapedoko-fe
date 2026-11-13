import type { ProfileRow } from '~/types/shop'
import {
  authEmailRedirectTo,
  authUserId,
  clearNativeAuthSession,
  displayNameError,
  displayNameFromAuthUser,
  emailError,
  friendlyAuthError,
  localSessionShouldClear,
  passwordError,
  safeRedirectPath,
} from '~/utils/auth'

const LIVE_SESSION_TTL_MS = 20_000

export function useAuth() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const session = useSupabaseSession()
  const liveCheck = useState<{ at: number; userId: string | null }>('kd-auth-live', () => ({
    at: 0,
    userId: null,
  }))

  const dropLocalSession = async () => {
    liveCheck.value = { at: Date.now(), userId: null }
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      /* local sign-out can fail when Auth already has no user */
    }
    if (import.meta.client) {
      try {
        clearNativeAuthSession(window.localStorage)
      } catch {
        /* private mode cannot clear the native session copy */
      }
    }
  }

  const ensureLiveSession = async (options?: { force?: boolean }): Promise<unknown | null> => {
    const { data: sessionData } = await supabase.auth.getSession()
    const sessionUser = sessionData.session?.user ?? session.value?.user ?? user.value ?? null
    if (!sessionUser) {
      liveCheck.value = { at: Date.now(), userId: null }
      return null
    }
    const sessionId = authUserId(sessionUser)
    if (
      !options?.force
      && liveCheck.value.userId
      && liveCheck.value.userId === sessionId
      && Date.now() - liveCheck.value.at < LIVE_SESSION_TTL_MS
    ) {
      return sessionUser
    }
    try {
      const { data, error } = await supabase.auth.getUser()
      if (
        localSessionShouldClear({
          hasLocalSession: true,
          remoteUser: data.user,
          error,
        })
      ) {
        await dropLocalSession()
        return null
      }
      const liveUser = data.user ?? sessionUser
      liveCheck.value = { at: Date.now(), userId: authUserId(liveUser) }
      return liveUser
    } catch {
      return sessionUser
    }
  }

  const currentUserId = async (): Promise<string | null> => {
    return authUserId(await ensureLiveSession())
  }

  const signIn = async (email: string, password: string) => {
    const emailIssue = emailError(email)
    if (emailIssue) throw new Error(emailIssue)
    if (!password) throw new Error('Enter your password.')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw new Error(friendlyAuthError(error.message))
  }

  const signUp = async (name: string, email: string, password: string) => {
    const nameIssue = displayNameError(name)
    const emailIssue = emailError(email)
    const passwordIssue = passwordError(password)
    if (nameIssue) throw new Error(nameIssue)
    if (emailIssue) throw new Error(emailIssue)
    if (passwordIssue) throw new Error(passwordIssue)

    const origin = import.meta.client ? window.location.origin : ''
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim() },
        emailRedirectTo: authEmailRedirectTo(origin, '/confirm'),
      },
    })
    if (error) throw new Error(friendlyAuthError(error.message))
    return { needsConfirmation: !data.session }
  }

  const resendConfirmation = async (email: string) => {
    const emailIssue = emailError(email)
    if (emailIssue) throw new Error(emailIssue)
    const origin = import.meta.client ? window.location.origin : ''
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: authEmailRedirectTo(origin, '/confirm'),
      },
    })
    if (error) throw new Error(friendlyAuthError(error.message))
  }

  const signInWithGoogle = async () => {
    const origin = import.meta.client ? window.location.origin : ''
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authEmailRedirectTo(origin, '/confirm'),
        skipBrowserRedirect: false,
      },
    })
    if (error) throw new Error(friendlyAuthError(error.message))
  }

  const signOut = async () => {
    liveCheck.value = { at: Date.now(), userId: null }
    const { error } = await supabase.auth.signOut()
    if (!error) {
      if (import.meta.client) {
        try {
          clearNativeAuthSession(window.localStorage)
        } catch {
          /* private mode cannot clear the native session copy */
        }
      }
      return
    }
    await dropLocalSession()
  }

  const resetPassword = async (email: string) => {
    const emailIssue = emailError(email)
    if (emailIssue) throw new Error(emailIssue)
    const origin = import.meta.client ? window.location.origin : ''
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authEmailRedirectTo(origin, '/reset-password'),
    })
    if (error) {
      const text = error.message.toLowerCase()
      if (text.includes('not found') || text.includes('user')) return
      throw new Error(friendlyAuthError(error.message))
    }
  }

  const updatePassword = async (password: string) => {
    const passwordIssue = passwordError(password)
    if (passwordIssue) throw new Error(passwordIssue)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(friendlyAuthError(error.message))
  }

  const loadProfile = async (authUser?: unknown): Promise<ProfileRow | null> => {
    const userId = (await currentUserId()) ?? authUserId(authUser)
    if (!userId) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, role, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw new Error('Could not load your profile.')
    const profile = (data as ProfileRow | null) ?? null
    if (!profile) return null
    if (profile.display_name?.trim()) return profile
    const fromAuth = displayNameFromAuthUser(authUser ?? user.value)
    if (!fromAuth) return profile
    const { error: saveError } = await supabase
      .from('profiles')
      .update({ display_name: fromAuth })
      .eq('id', userId)
    if (saveError) return profile
    return { ...profile, display_name: fromAuth }
  }

  const updateDisplayName = async (name: string) => {
    const nameIssue = displayNameError(name)
    if (nameIssue) throw new Error(nameIssue)
    const userId = await currentUserId()
    if (!userId) throw new Error('Sign in to update your name.')
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim() })
      .eq('id', userId)
    if (error) throw new Error('Could not save your name. Try again.')
  }

  const goToLogin = async (returnPath?: string) => {
    const redirect = safeRedirectPath(returnPath ?? (import.meta.client ? window.location.pathname + window.location.search : '/app'))
    await navigateTo({ path: '/login', query: { redirect } })
  }

  return {
    user,
    session,
    currentUserId,
    ensureLiveSession,
    signIn,
    signUp,
    signInWithGoogle,
    resendConfirmation,
    signOut,
    resetPassword,
    updatePassword,
    loadProfile,
    updateDisplayName,
    goToLogin,
  }
}
