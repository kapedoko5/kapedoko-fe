import type { ProfileRow } from '~/types/shop'
import {
  authEmailRedirectTo,
  authUserId,
  displayNameError,
  emailError,
  friendlyAuthError,
  passwordError,
  safeRedirectPath,
} from '~/utils/auth'

export function useAuth() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const session = useSupabaseSession()

  const currentUserId = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession()
    return data.session?.user?.id ?? session.value?.user?.id ?? authUserId(user.value)
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
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(friendlyAuthError(error.message))
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

  const loadProfile = async (): Promise<ProfileRow | null> => {
    const userId = await currentUserId()
    if (!userId) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, role, created_at, updated_at')
      .eq('id', userId)
      .maybeSingle()
    if (error) throw new Error('Could not load your profile.')
    return (data as ProfileRow | null) ?? null
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
