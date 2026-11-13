import type { ProfileRole, ShopRow } from '~/types/shop'
import { authUserId } from '~/utils/auth'
import { parseProfileRole } from '~/utils/profile-role'
import {
  canAccessOwnerDesk,
  mergeNoticedClaimIds,
  ownerStaffRedirect,
  unmarkedWaitingClaims,
  waitingOwnerClaims,
} from '~/utils/owner-portal'

export function useOwnerPortal() {
  const ownership = useShopOwnership()
  const user = useSupabaseUser()
  const { loadProfile, signOut } = useAuth()
  const role = useState<ProfileRole | null>('kd-owner-portal-role', () => null)
  const noticedClaimIds = useState<string[]>('kd-owner-noticed-claims', () => [])
  const access = useState<'idle' | 'allowed' | 'forbidden' | 'staff'>('kd-owner-access', () => 'idle')

  const waitingClaims = computed(() => waitingOwnerClaims(ownership.claims.value))
  const unmarkedWaiting = computed(() => unmarkedWaitingClaims(ownership.claims.value, noticedClaimIds.value))
  const liveCafes = computed(() => ownership.ownedShops.value.filter((shop) => shop.status === 'approved'))

  const markClaimsNoticed = () => {
    noticedClaimIds.value = mergeNoticedClaimIds(noticedClaimIds.value, waitingClaims.value)
  }

  const shopById = (shopId: string): ShopRow | null =>
    ownership.ownedShops.value.find((shop) => shop.id === shopId) ?? null

  const refreshAccess = async () => {
    const uid = authUserId(user.value)
    if (!uid) {
      role.value = null
      access.value = 'forbidden'
      return { allowed: false as const, redirect: '/owner/login' }
    }
    try {
      const profile = await loadProfile()
      role.value = profile?.role ? parseProfileRole(profile.role) : 'user'
    } catch {
      role.value = 'user'
    }
    const staffTo = ownerStaffRedirect(role.value)
    if (staffTo) {
      access.value = 'staff'
      return { allowed: false as const, redirect: staffTo }
    }
    if (ownership.status.value === 'idle' || ownership.status.value === 'error') {
      await ownership.load()
    }
    const allowed = canAccessOwnerDesk({
      role: role.value,
      claimCount: ownership.claims.value.length,
    })
    access.value = allowed ? 'allowed' : 'forbidden'
    return { allowed, redirect: allowed ? null : '/app' }
  }

  const loadDesk = async () => {
    await ownership.load()
    return refreshAccess()
  }

  return {
    ...ownership,
    role,
    access,
    waitingClaims,
    unmarkedWaiting,
    liveCafes,
    noticedClaimIds,
    markClaimsNoticed,
    shopById,
    refreshAccess,
    loadDesk,
    signOut,
  }
}
