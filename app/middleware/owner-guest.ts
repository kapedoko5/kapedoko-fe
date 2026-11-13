import { canAccessOwnerDesk, ownerStaffRedirect } from '~/utils/owner-portal'
import { parseProfileRole } from '~/utils/profile-role'

export default defineNuxtRouteMiddleware(async () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const sessionUser = user.value ?? (await supabase.auth.getSession()).data.session?.user
  if (!sessionUser) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', sessionUser.id)
    .maybeSingle()

  const role = parseProfileRole(profile?.role)
  const staffTo = ownerStaffRedirect(role)
  if (staffTo) return navigateTo(staffTo, { replace: true })

  if (role === 'cafe-owner') return navigateTo('/owner', { replace: true })

  const { count } = await supabase
    .from('shop_claims')
    .select('id', { count: 'exact', head: true })
    .eq('claimant_id', sessionUser.id)

  if (canAccessOwnerDesk({ role, claimCount: count ?? 0 })) {
    return navigateTo('/owner', { replace: true })
  }
})
