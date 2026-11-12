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

  if (error || profile?.role !== 'admin') {
    return navigateTo('/app')
  }
})
