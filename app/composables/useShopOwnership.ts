import type { ShopClaimRow, ShopRow, WeeklyHours } from '~/types/shop'
import { adminLogoPayload } from '~/utils/admin-logos'
import { authUserId } from '~/utils/auth'

type ListedClaimRow = ShopClaimRow & { shop_name?: string | null }

let loadSeq = 0

async function uploadOwnerLogo(file: File): Promise<string> {
  const supabase = useSupabaseClient()
  const form = new FormData()
  form.append('file', file)
  form.append('purpose', 'shop-logo')
  const { data, error } = await supabase.functions.invoke('presign-upload', { body: form })
  const payload = (data ?? null) as { objectKey?: string; error?: string } | null
  if (error || !payload?.objectKey) {
    throw new Error(payload?.error || 'Could not upload that file. Try again.')
  }
  return payload.objectKey
}

function asClaimRow(row: ListedClaimRow): ShopClaimRow {
  return {
    id: row.id,
    shop_id: row.shop_id,
    claimant_id: row.claimant_id,
    status: row.status,
    evidence_note: row.evidence_note,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    rejection_reason: row.rejection_reason,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function useShopOwnership() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const session = useSupabaseSession()
  const claims = useState<ShopClaimRow[]>('kd-shop-claims', () => [])
  const ownedShops = useState<ShopRow[]>('kd-owned-shops', () => [])
  const claimShopNames = useState<Record<string, string>>('kd-claim-shop-names', () => ({}))
  const verifiedOwnerByShop = useState<Record<string, boolean>>('kd-shop-verified-owner', () => ({}))
  const status = useState<'idle' | 'loading' | 'ready' | 'error'>('kd-owner-status', () => 'idle')
  const error = useState('kd-owner-error', () => '')
  const saving = useState('kd-owner-saving', () => false)

  const currentUserId = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession()
    return data.session?.user?.id ?? session.value?.user?.id ?? authUserId(user.value)
  }

  const userId = computed(() => session.value?.user?.id ?? authUserId(user.value))

  const applyClaims = (rows: ListedClaimRow[]) => {
    claims.value = rows.map(asClaimRow)
    claimShopNames.value = Object.fromEntries(
      rows
        .filter((row) => row.shop_name)
        .map((row) => [row.shop_id, row.shop_name as string]),
    )
  }

  const loadOwnedShops = async (verifiedIds: string[]) => {
    if (!verifiedIds.length) {
      ownedShops.value = []
      return
    }
    const { data: shops, error: shopsError } = await supabase
      .from('shops')
      .select('*')
      .in('id', verifiedIds)
      .order('name', { ascending: true })
    if (shopsError) throw shopsError
    ownedShops.value = (shops ?? []) as ShopRow[]
  }

  const loadViaTable = async (uid: string) => {
    const { data, error: claimsError } = await supabase
      .from('shop_claims')
      .select('*')
      .eq('claimant_id', uid)
      .order('created_at', { ascending: false })
    if (claimsError) throw claimsError
    const rows = (data ?? []) as ShopClaimRow[]
    claims.value = rows
    const shopIds = [...new Set(rows.map((claim) => claim.shop_id))]
    if (!shopIds.length) {
      claimShopNames.value = {}
      return
    }
    const { data: named } = await supabase.from('shops').select('id, name').in('id', shopIds)
    claimShopNames.value = Object.fromEntries(
      ((named ?? []) as Array<{ id: string; name: string }>).map((shop) => [shop.id, shop.name]),
    )
  }

  const load = async () => {
    const seq = ++loadSeq
    const uid = await currentUserId()
    if (seq !== loadSeq) return
    if (!uid) {
      claims.value = []
      ownedShops.value = []
      claimShopNames.value = {}
      status.value = 'ready'
      error.value = ''
      return
    }
    status.value = 'loading'
    error.value = ''
    try {
      const { data, error: rpcError } = await supabase.rpc('list_my_shop_claims')
      if (seq !== loadSeq) return
      if (rpcError) {
        await loadViaTable(uid)
      } else {
        applyClaims((data ?? []) as ListedClaimRow[])
      }
      if (seq !== loadSeq) return
      const verifiedIds = claims.value.filter((claim) => claim.status === 'verified').map((claim) => claim.shop_id)
      try {
        await loadOwnedShops(verifiedIds)
      } catch {
        ownedShops.value = []
      }
      if (seq !== loadSeq) return
      status.value = 'ready'
    } catch (err) {
      if (seq !== loadSeq) return
      status.value = 'error'
      error.value = err instanceof Error ? err.message : 'Could not load your cafes.'
    }
  }

  const claimForShop = (shopId: string): ShopClaimRow | null =>
    claims.value.find((claim) => claim.shop_id === shopId) ?? null

  const isOwner = (shopId: string): boolean =>
    claims.value.some((claim) => claim.shop_id === shopId && claim.status === 'verified')

  const shopHasVerifiedOwner = (shopId: string): boolean =>
    verifiedOwnerByShop.value[shopId] === true

  const shopOwnerFlagKnown = (shopId: string): boolean =>
    Object.prototype.hasOwnProperty.call(verifiedOwnerByShop.value, shopId)

  const loadShopOwnerFlag = async (shopId: string): Promise<boolean> => {
    if (!shopId) return false
    const { data, error } = await supabase.rpc('shop_has_verified_owner', { p_shop_id: shopId })
    const owned = error ? true : data === true
    verifiedOwnerByShop.value = { ...verifiedOwnerByShop.value, [shopId]: owned }
    return owned
  }

  const shopNameForClaim = (shopId: string): string =>
    claimShopNames.value[shopId]
    || ownedShops.value.find((shop) => shop.id === shopId)?.name
    || 'This cafe'

  const loadClaimForShop = async (shopId: string): Promise<ShopClaimRow | null> => {
    const uid = await currentUserId()
    if (!uid) return null
    const { data, error: rpcError } = await supabase.rpc('list_my_shop_claims')
    if (!rpcError) {
      const rows = (data ?? []) as ListedClaimRow[]
      applyClaims(rows)
      return rows.map(asClaimRow).find((claim) => claim.shop_id === shopId) ?? null
    }
    const { data: tableData, error: claimError } = await supabase
      .from('shop_claims')
      .select('*')
      .eq('shop_id', shopId)
      .eq('claimant_id', uid)
      .order('created_at', { ascending: false })
      .limit(1)

    if (claimError) throw claimError
    const row = ((tableData ?? [])[0] ?? null) as ShopClaimRow | null
    if (row) {
      claims.value = claims.value.some((item) => item.id === row.id)
        ? claims.value.map((item) => (item.id === row.id ? row : item))
        : [row, ...claims.value]
    }
    return row
  }

  const submitClaim = async (input: {
    shopId: string
    note: string
    email: string
    phone: string
  }) => {
    saving.value = true
    error.value = ''
    try {
      const { data, error: rpcError } = await supabase.rpc('submit_shop_claim', {
        p_shop_id: input.shopId,
        p_evidence_note: input.note,
        p_contact_email: input.email.trim() || null,
        p_contact_phone: input.phone.trim() || null,
      })
      const row = (Array.isArray(data) ? data[0] : data) as ShopClaimRow | null
      if (rpcError || !row) throw new Error(rpcError?.message || 'Could not send this claim.')
      claims.value = [row, ...claims.value.filter((item) => item.id !== row.id)]
      return row
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not send this claim.'
      throw err
    } finally {
      saving.value = false
    }
  }

  const withdrawClaim = async (claimId: string) => {
    saving.value = true
    error.value = ''
    try {
      const { error: rpcError } = await supabase.rpc('withdraw_shop_claim', {
        p_claim_id: claimId,
      })
      if (rpcError) throw new Error(rpcError.message || 'Could not withdraw this claim.')
      const removed = claims.value.find((claim) => claim.id === claimId)
      claims.value = claims.value.filter((claim) => claim.id !== claimId)
      if (removed && !claims.value.some((claim) => claim.shop_id === removed.shop_id)) {
        const nextNames = { ...claimShopNames.value }
        delete nextNames[removed.shop_id]
        claimShopNames.value = nextNames
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not withdraw this claim.'
      throw err
    } finally {
      saving.value = false
    }
  }

  const updateOwnedShop = async (
    shopId: string,
    input: {
      name: string
      address: string
      latitude: number
      longitude: number
      hours: WeeklyHours
      contact_number: string | null
      logoFile: File | null
      logoObjectKey: string | null
    },
  ) => {
    saving.value = true
    error.value = ''
    try {
      let logoKey = adminLogoPayload({
        logoFile: input.logoFile,
        logoObjectKey: input.logoObjectKey,
      }).logoObjectKey
      if (input.logoFile) logoKey = await uploadOwnerLogo(input.logoFile)
      const { data, error: rpcError } = await supabase.rpc('update_owner_shop', {
        p_shop_id: shopId,
        p_name: input.name,
        p_address: input.address,
        p_latitude: input.latitude,
        p_longitude: input.longitude,
        p_hours: input.hours,
        p_contact_number: input.contact_number,
        p_logo_object_key: logoKey,
      })
      const updated = (Array.isArray(data) ? data[0] : data) as ShopRow | null
      if (rpcError || !updated) throw new Error(rpcError?.message || 'Could not save this cafe.')
      ownedShops.value = ownedShops.value.map((item) => (item.id === shopId ? updated : item))
      if (updated.name) {
        claimShopNames.value = { ...claimShopNames.value, [shopId]: updated.name }
      }
      return updated
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not save this cafe.'
      throw err
    } finally {
      saving.value = false
    }
  }

  return {
    claims,
    ownedShops,
    claimShopNames,
    status,
    error,
    saving,
    userId,
    load,
    claimForShop,
    isOwner,
    shopHasVerifiedOwner,
    shopOwnerFlagKnown,
    loadShopOwnerFlag,
    shopNameForClaim,
    loadClaimForShop,
    submitClaim,
    withdrawClaim,
    updateOwnedShop,
  }
}
