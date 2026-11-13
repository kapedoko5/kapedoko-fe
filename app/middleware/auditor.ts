import { authUserId } from '~/utils/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  const supabase = useSupabaseClient()
  const { ensureLiveSession } = useAuth()
  const userId = authUserId(await ensureLiveSession())
  if (!userId) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  const role = profile?.role
  if (error || (role !== 'admin' && role !== 'auditor')) {
    return navigateTo('/app')
  }
})
