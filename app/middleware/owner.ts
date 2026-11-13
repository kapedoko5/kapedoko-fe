import { canAccessOwnerDesk, ownerStaffRedirect } from '~/utils/owner-portal'
import { parseProfileRole } from '~/utils/profile-role'

export default defineNuxtRouteMiddleware(async (to) => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id ?? user.value?.id
  if (!userId) {
    return navigateTo({ path: '/owner/login', query: { redirect: to.fullPath } }, { replace: true })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  const role = parseProfileRole(profile?.role)
  const staffTo = ownerStaffRedirect(role)
  if (staffTo) return navigateTo(staffTo)

  if (role === 'cafe-owner') return

  const { count, error } = await supabase
    .from('shop_claims')
    .select('id', { count: 'exact', head: true })
    .eq('claimant_id', userId)

  if (error) return navigateTo('/app')
  if (!canAccessOwnerDesk({ role, claimCount: count ?? 0 })) {
    return navigateTo('/app')
  }
})
