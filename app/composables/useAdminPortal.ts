import type { AdCampaignRow, AdminDashboardCounts, AdminUserRow, AdminUsersResponse } from '~/types/admin'
import type { ContentReportRow, MarkerTier, ProfileRole, ProfileRow, ShopCheckinTotalsRow, ShopClaimRow, ShopPlacementRow, ShopRow, ShopStatus, WeeklyHours } from '~/types/shop'
import { authUserId } from '~/utils/auth'
import { adminLogoPayload } from '~/utils/admin-logos'
import {
  missingDeleteAdminShopCopy,
  parseDeletedAdminShop,
  uniqueDeletableAdminObjectKeys,
} from '~/utils/admin-shop'
import { fetchAdminShopRows } from '~/utils/approved-shops'
import { chunkImportDrafts, pendingImportDrafts } from '~/utils/cafe-csv-import'
import { isValidWeeklyHours } from '~/utils/hours'
import { effectiveMarkerTier } from '~/utils/marker-tier'
import { parseProfileRole } from '~/utils/profile-role'
import { edgeFunctionErrorMessage } from '~/utils/admin-users'
import { withReportedReviewText, type ReportedReviewSource } from '~/utils/moderation'

type AdminDatabase = {
  public: {
    Tables: Record<string, {
      Row: ShopRow & ProfileRow & ContentReportRow & ShopPlacementRow & ShopClaimRow & AdCampaignRow
      Insert: Record<string, unknown>
      Update: Record<string, unknown>
      Relationships: []
    }>
    Views: Record<string, {
      Row: Record<string, unknown>
      Relationships: []
    }>
    Functions: Record<string, {
      Args: Record<string, unknown>
      Returns: unknown
    }>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export async function requireAdminUserId(): Promise<string> {
  const supabase = useSupabaseClient<AdminDatabase>()
  const user = useSupabaseUser()
  const { data } = await supabase.auth.getSession()
  const userId = data.session?.user?.id ?? authUserId(user.value)
  if (!userId) throw new Error('Sign in as an admin.')
  return userId
}

export async function uploadAdminAsset(file: File, purpose: 'shop-logo' | 'ad-banner'): Promise<string> {
  const supabase = useSupabaseClient<AdminDatabase>()
  const form = new FormData()
  form.append('file', file)
  form.append('purpose', purpose)
  const { data, error } = await supabase.functions.invoke('presign-upload', { body: form })
  const payload = (data ?? null) as { objectKey?: string; error?: string } | null
  if (error || !payload?.objectKey) {
    throw new Error(payload?.error || 'Could not upload that file. Try again.')
  }
  return payload.objectKey
}

export async function deleteAdminAssets(objectKeys: string[]): Promise<void> {
  const keys = uniqueDeletableAdminObjectKeys(objectKeys)
  if (keys.length === 0) return
  const supabase = useSupabaseClient<AdminDatabase>()
  await supabase.functions.invoke('presign-upload', {
    body: { action: 'delete-objects', objectKeys: keys },
  }).catch(() => undefined)
}

export function useAdminData() {
  const supabase = useSupabaseClient<AdminDatabase>()
  const shops = useState<ShopRow[]>('kd-admin-shops', () => [])
  const placements = useState<ShopPlacementRow[]>('kd-admin-placements', () => [])
  const reports = useState<ContentReportRow[]>('kd-admin-reports', () => [])
  const ads = useState<AdCampaignRow[]>('kd-admin-ads', () => [])
  const claims = useState<ShopClaimRow[]>('kd-admin-claims', () => [])
  const checkIns30d = useState('kd-admin-checkins-30d', () => 0)
  const status = useState<'idle' | 'loading' | 'ready' | 'forbidden' | 'error'>('kd-admin-status', () => 'idle')
  const loadSeq = useState('kd-admin-load-seq', () => 0)
  const error = ref('')
  const savingId = useState<string | null>('kd-admin-saving-id', () => null)

  const putShop = (row: ShopRow, at: 'start' | 'inline' = 'inline') => {
    loadSeq.value += 1
    const exists = shops.value.some((item) => item.id === row.id)
    if (!exists) {
      shops.value = at === 'start' ? [row, ...shops.value] : [...shops.value, row]
      return
    }
    shops.value = shops.value.map((item) => (item.id === row.id ? row : item))
  }

  const dropShop = (shopId: string) => {
    loadSeq.value += 1
    shops.value = shops.value.filter((item) => item.id !== shopId)
    placements.value = placements.value.filter((row) => row.shop_id !== shopId)
    ads.value = ads.value.filter((row) => row.shop_id !== shopId)
    claims.value = claims.value.filter((row) => row.shop_id !== shopId)
    reports.value = reports.value.filter((row) => row.shop_id !== shopId)
  }

  const placementsByShop = computed(() => {
    const grouped = new Map<string, ShopPlacementRow[]>()
    for (const row of placements.value) {
      const list = grouped.get(row.shop_id) ?? []
      list.push(row)
      grouped.set(row.shop_id, list)
    }
    return grouped
  })

  const counts = computed<AdminDashboardCounts>(() => {
    const now = Date.now()
    return {
      pending: shops.value.filter((shop) => shop.status === 'pending').length,
      approved: shops.value.filter((shop) => shop.status === 'approved').length,
      rejected: shops.value.filter((shop) => shop.status === 'rejected').length,
      hidden: shops.value.filter((shop) => shop.status === 'hidden').length,
      pendingClaims: claims.value.filter((claim) => claim.status === 'pending').length,
      openReports: reports.value.filter((report) => report.status === 'open').length,
      activePlacements: placements.value.filter((row) => new Date(row.starts_at).getTime() <= now && new Date(row.ends_at).getTime() > now).length,
      activeAds: ads.value.filter((row) => row.enabled && !row.cancelled_at && new Date(row.starts_at).getTime() <= now && new Date(row.ends_at).getTime() > now).length,
      users: 0,
      checkIns30d: checkIns30d.value,
    }
  })

  const loadPlacements = async () => {
    const { data, error: placementError } = await supabase
      .from('shop_placements')
      .select('*')
      .order('starts_at', { ascending: false })
    if (placementError) throw placementError
    placements.value = (data ?? []) as ShopPlacementRow[]
  }

  const loadReports = async () => {
    const { data, error: reportError } = await supabase
      .from('content_reports')
      .select('*')
      .order('created_at', { ascending: false })
    if (reportError) {
      reports.value = []
      return
    }
    const rows = (data ?? []) as ContentReportRow[]
    const reviewIds = [...new Set(rows.flatMap((row) => row.review_id ? [row.review_id] : []))]
    let reviewRows: ReportedReviewSource[] = []
    if (reviewIds.length > 0) {
      const { data: reviewData, error: reviewError } = await supabase
        .from('reviews')
        .select('id, comment, wifi_available, wifi_speed, power_available, power_access, recommend')
        .in('id', reviewIds)
      if (!reviewError) reviewRows = (reviewData ?? []) as ReportedReviewSource[]
    }
    reports.value = withReportedReviewText(rows, reviewRows)
  }

  const loadAds = async () => {
    const { data, error: adsError } = await supabase
      .from('ad_campaigns')
      .select('*')
      .order('starts_at', { ascending: false })
    if (adsError) {
      ads.value = []
      return
    }
    ads.value = (data ?? []) as AdCampaignRow[]
  }

  const loadClaims = async () => {
    const { data, error: claimsError } = await supabase
      .from('shop_claims')
      .select('*')
      .order('created_at', { ascending: false })
    if (claimsError) {
      claims.value = []
      return
    }
    claims.value = (data ?? []) as ShopClaimRow[]
  }

  const loadCheckIns = async () => {
    const { data, error: checkInError } = await supabase
      .from('shop_checkin_totals')
      .select('checkins_30d')
      .limit(1)
    if (checkInError) {
      checkIns30d.value = 0
      return
    }
    const row = Array.isArray(data) ? data[0] : data
    const count = (row as ShopCheckinTotalsRow | null)?.checkins_30d
    checkIns30d.value = typeof count === 'number' && Number.isFinite(count) ? count : 0
  }

  const loadShops = async (seq: number) => {
    const rows = await fetchAdminShopRows(supabase)
    if (seq !== loadSeq.value) return false
    shops.value = rows
    return true
  }

  const load = async (opts?: { silent?: boolean }) => {
    const seq = loadSeq.value + 1
    loadSeq.value = seq
    const keep = Boolean(opts?.silent) && status.value === 'ready'
    if (!keep) {
      status.value = 'loading'
      error.value = ''
    }
    try {
      const userId = await requireAdminUserId()
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle()
      if (profileError || profile?.role !== 'admin') {
        if (seq !== loadSeq.value) return
        status.value = 'forbidden'
        return
      }
      const applied = await loadShops(seq)
      if (!applied) return
      if (!keep) await Promise.all([loadPlacements(), loadReports(), loadAds(), loadClaims(), loadCheckIns()])
      if (seq !== loadSeq.value) return
      status.value = 'ready'
    } catch (err) {
      if (seq !== loadSeq.value) return
      if (keep) return
      status.value = 'error'
      error.value = err instanceof Error ? err.message : 'Could not load the admin portal.'
    }
  }

  const fetchShop = async (shopId: string): Promise<ShopRow | null> => {
    const { data, error: shopError } = await supabase
      .from('shops')
      .select('*')
      .eq('id', shopId)
      .maybeSingle()
    if (shopError) throw shopError
    const row = (data ?? shops.value.find((item) => item.id === shopId) ?? null) as ShopRow | null
    if (row) putShop(row, 'start')
    return row
  }

  const markerTierFor = (shopId: string): MarkerTier =>
    effectiveMarkerTier(placementsByShop.value.get(shopId) ?? [])

  const applyShopStatus = async (
    shop: ShopRow,
    next: ShopStatus,
    rejectionReason = '',
  ) => {
    const { data, error: rpcError } = await supabase.rpc('moderate_admin_shop', {
      p_shop_id: shop.id,
      p_status: next,
      p_rejection_reason: next === 'rejected' ? rejectionReason : null,
    })
    const rpcRow = Array.isArray(data) ? data[0] : data
    let updated = rpcRow as ShopRow | null
    if (rpcError || !updated) {
      const reviewerId = await requireAdminUserId()
      const now = new Date().toISOString()
      const { data: row, error: updateError } = await supabase
        .from('shops')
        .update({
          status: next,
          rejection_reason: next === 'rejected' ? rejectionReason.trim() || 'Does not meet listing standards' : null,
          reviewed_by: next === 'approved' || next === 'rejected'
            ? reviewerId
            : next === 'hidden'
              ? shop.reviewed_by
              : null,
          reviewed_at: next === 'approved' || next === 'rejected'
            ? now
            : next === 'hidden'
              ? shop.reviewed_at
              : null,
        })
        .eq('id', shop.id)
        .select()
        .single()
      if (updateError || !row) {
        throw new Error(rpcError?.message || updateError?.message || 'Could not update this cafe.')
      }
      updated = row as ShopRow
    }
    return updated
  }

  const applyModerationSideEffects = (
    shopId: string,
    next: ShopStatus,
  ) => {
    if (next === 'approved') return
    const now = new Date().toISOString()
    placements.value = placements.value.map((row) =>
      row.shop_id === shopId && row.ends_at > now ? { ...row, ends_at: now } : row,
    )
    ads.value = ads.value.map((row) =>
      row.shop_id === shopId && !row.cancelled_at
        ? { ...row, cancelled_at: now, enabled: false, ends_at: row.ends_at > now ? now : row.ends_at }
        : row,
    )
  }

  const moderate = async (
    shop: ShopRow,
    next: ShopStatus,
    rejectionReason = '',
  ) => {
    savingId.value = shop.id
    error.value = ''
    try {
      const updated = await applyShopStatus(shop, next, rejectionReason)
      putShop(updated)
      applyModerationSideEffects(shop.id, next)
      return updated
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not update this cafe.'
      throw err
    } finally {
      savingId.value = null
    }
  }

  const moderateMany = async (
    queue: ShopRow[],
    next: Extract<ShopStatus, 'approved' | 'rejected'>,
    rejectionReason = '',
    onProgress?: (done: number, total: number) => void,
  ) => {
    if (queue.length === 0) throw new Error('There are no pending cafes to stamp.')
    savingId.value = 'bulk'
    error.value = ''
    const done: ShopRow[] = []
    const failed: string[] = []
    try {
      const chunkSize = 4
      for (let i = 0; i < queue.length; i += chunkSize) {
        const chunk = queue.slice(i, i + chunkSize)
        const results = await Promise.allSettled(
          chunk.map((shop) => applyShopStatus(shop, next, rejectionReason)),
        )
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') done.push(result.value)
          else failed.push(chunk[index]?.name || 'a cafe')
        })
        onProgress?.(done.length + failed.length, queue.length)
      }
      const byId = new Map(done.map((row) => [row.id, row]))
      loadSeq.value += 1
      shops.value = shops.value.map((item) => byId.get(item.id) ?? item)
      for (const row of done) applyModerationSideEffects(row.id, next)
      if (failed.length > 0) {
        const verb = next === 'approved' ? 'Approved' : 'Rejected'
        const names = failed.slice(0, 3).join(', ')
        throw new Error(`${verb} ${done.length} of ${queue.length}. Could not update ${names}${failed.length > 3 ? '…' : ''}.`)
      }
      return done
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not update these cafes.'
      throw err
    } finally {
      savingId.value = null
    }
  }

  const savePlacement = async (shop: ShopRow, kind: 'standard' | 'partner' | 'sponsored', startsAt: string, endsAt: string) => {
    if (shop.status !== 'approved') throw new Error('Approve the cafe before setting a map pin.')
    savingId.value = shop.id
    error.value = ''
    try {
      const { error: rpcError } = await supabase.rpc('save_shop_placement', {
        p_shop_id: shop.id,
        p_kind: kind,
        p_starts_at: kind === 'standard' ? null : new Date(startsAt).toISOString(),
        p_ends_at: kind === 'standard' ? null : new Date(endsAt).toISOString(),
      })
      if (rpcError) throw new Error(rpcError.message)
      await loadPlacements()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not save this map pin.'
      throw err
    } finally {
      savingId.value = null
    }
  }

  const endPlacement = async (placementId: string) => {
    savingId.value = placementId
    try {
      const { error: rpcError } = await supabase.rpc('end_shop_placement', { p_placement_id: placementId })
      if (rpcError) throw new Error(rpcError.message)
      await loadPlacements()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not end this placement.'
      throw err
    } finally {
      savingId.value = null
    }
  }

  const createShop = async (input: {
    name: string
    address: string
    latitude: number
    longitude: number
    hours: WeeklyHours
    contact_number: string | null
    logoFile: File | null
    logoObjectKey?: string | null
  }) => {
    const planned = adminLogoPayload({
      logoFile: input.logoFile,
      logoObjectKey: input.logoObjectKey ?? null,
    })
    let logoKey = planned.logoObjectKey
    if (planned.shouldUpload && input.logoFile) logoKey = await uploadAdminAsset(input.logoFile, 'shop-logo')
    const { data, error: rpcError } = await supabase.rpc('create_admin_shop', {
      p_name: input.name,
      p_address: input.address,
      p_latitude: input.latitude,
      p_longitude: input.longitude,
      p_hours: input.hours,
      p_contact_number: input.contact_number,
      p_logo_object_key: logoKey,
    })
    if (rpcError || !data) throw new Error(rpcError?.message || 'Could not create this cafe.')
    const created = (Array.isArray(data) ? data[0] : data) as ShopRow
    putShop(created, 'start')
    return created
  }

  const importShops = async (drafts: {
    name: string
    address: string
    latitude: number
    longitude: number
    hours: WeeklyHours
    contact_number: string | null
  }[]) => {
    if (drafts.length === 0) throw new Error('Confirm at least one cafe before importing.')
    const queued = pendingImportDrafts(drafts, shops.value)
    if (queued.length === 0) throw new Error('Those cafes are already listed.')

    const created: ShopRow[] = []
    try {
      for (const chunk of chunkImportDrafts(queued)) {
        const { data, error: rpcError } = await supabase.rpc('import_admin_shops', {
          p_shops: chunk,
        })
        if (rpcError) {
          const message = rpcError.message || 'Could not import these cafes.'
          if (/schema cache|does not exist|import_admin_shops/i.test(message)) {
            throw new Error('Apply db/20261008_admin_shop_csv_import.sql in the SQL editor, then try again.')
          }
          if (created.length > 0) {
            throw new Error(`Imported ${created.length} cafes, then stopped. ${message}`)
          }
          throw new Error(message)
        }
        const batch = (Array.isArray(data) ? data : data ? [data] : []) as ShopRow[]
        created.push(...batch)
      }
    } finally {
      if (created.length > 0) {
        loadSeq.value += 1
        const createdIds = new Set(created.map((row) => row.id))
        shops.value = [...created, ...shops.value.filter((item) => !createdIds.has(item.id))]
      }
    }
    if (created.length === 0) throw new Error('Could not import these cafes.')
    return created
  }

  const updateShop = async (
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
    let logoKey = adminLogoPayload({
      logoFile: input.logoFile,
      logoObjectKey: input.logoObjectKey,
    }).logoObjectKey
    if (input.logoFile) logoKey = await uploadAdminAsset(input.logoFile, 'shop-logo')
    const { data, error: rpcError } = await supabase.rpc('update_admin_shop', {
      p_shop_id: shopId,
      p_name: input.name,
      p_address: input.address,
      p_latitude: input.latitude,
      p_longitude: input.longitude,
      p_hours: input.hours,
      p_contact_number: input.contact_number,
      p_logo_object_key: logoKey,
    })
    if (rpcError || !data) throw new Error(rpcError?.message || 'Could not save this cafe.')
    const updated = (Array.isArray(data) ? data[0] : data) as ShopRow
    putShop(updated)
    return updated
  }

  const mergeUpdatedShops = (updated: ShopRow[]) => {
    if (updated.length === 0) return
    const byId = new Map(updated.map((row) => [row.id, row]))
    shops.value = shops.value.map((item) => byId.get(item.id) ?? item)
  }

  const applyLogoWithShopWrite = async (shop: ShopRow, logoKey: string) => {
    const hours = shop.hours
    if (!hours || !isValidWeeklyHours(hours)) {
      throw new Error('Open this cafe and set hours before changing the logo.')
    }
    return await updateShop(shop.id, {
      name: shop.name,
      address: shop.address,
      latitude: shop.latitude,
      longitude: shop.longitude,
      hours,
      contact_number: shop.contact_number,
      logoFile: null,
      logoObjectKey: logoKey,
    })
  }

  const updateShopLogos = async (
    targets: ShopRow[],
    input: { logoFile: File | null; logoObjectKey: string | null },
    onProgress?: (done: number, total: number) => void,
  ) => {
    const queue = [...new Map(targets.map((shop) => [shop.id, shop])).values()]
    if (queue.length === 0) {
      error.value = 'Tick at least one cafe.'
      throw new Error(error.value)
    }
    savingId.value = queue.length === 1 ? queue[0].id : 'logos'
    error.value = ''
    try {
      let logoKey = adminLogoPayload(input).logoObjectKey
      if (input.logoFile) logoKey = await uploadAdminAsset(input.logoFile, 'shop-logo')
      if (!logoKey) {
        throw new Error('Choose a logo to stamp.')
      }

      const { data, error: rpcError } = await supabase.rpc('apply_admin_shop_logos', {
        p_shop_ids: queue.map((shop) => shop.id),
        p_logo_object_key: logoKey,
      })
      const rows = (Array.isArray(data) ? data : data ? [data] : []) as ShopRow[]
      if (!rpcError && rows.length > 0) {
        mergeUpdatedShops(rows)
        onProgress?.(rows.length, queue.length)
        return rows
      }
      const missingFn = rpcError && /schema cache|does not exist|apply_admin_shop_logos/i.test(rpcError.message)
      if (rpcError && !missingFn) {
        throw new Error(rpcError.message)
      }

      const done: ShopRow[] = []
      const failed: string[] = []
      const chunkSize = 4
      for (let i = 0; i < queue.length; i += chunkSize) {
        const chunk = queue.slice(i, i + chunkSize)
        const results = await Promise.allSettled(
          chunk.map((shop) => applyLogoWithShopWrite(shop, logoKey)),
        )
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') done.push(result.value)
          else failed.push(chunk[index]?.name || 'a cafe')
        })
        onProgress?.(done.length + failed.length, queue.length)
      }
      mergeUpdatedShops(done)
      if (failed.length > 0) {
        const names = failed.slice(0, 3).join(', ')
        throw new Error(`Stamped ${done.length} of ${queue.length}. Could not update ${names}${failed.length > 3 ? '…' : ''}.`)
      }
      return done
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not stamp this logo.'
      throw err
    } finally {
      savingId.value = null
    }
  }

  const updateShopLogo = async (
    shop: ShopRow,
    input: { logoFile: File | null; logoObjectKey: string | null },
  ) => {
    const [updated] = await updateShopLogos([shop], input)
    return updated
  }

  const deleteShop = async (shop: ShopRow) => {
    savingId.value = shop.id
    error.value = ''
    try {
      const { data, error: rpcError } = await supabase.rpc('delete_admin_shop', {
        p_shop_id: shop.id,
      })
      if (rpcError) {
        throw new Error(
          missingDeleteAdminShopCopy(rpcError.message)
          || rpcError.message
          || 'Could not delete this cafe.',
        )
      }
      const deleted = parseDeletedAdminShop(data) ?? { id: shop.id, name: shop.name, objectKeys: [] }
      dropShop(deleted.id)
      void deleteAdminAssets(deleted.objectKeys)
      return deleted
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not delete this cafe.'
      throw err
    } finally {
      savingId.value = null
    }
  }

  const resolveReport = async (reportId: string, outcome: 'hidden' | 'dismissed') => {
    savingId.value = reportId
    try {
      const { error: rpcError } = await supabase.rpc('moderate_report', {
        p_report_id: reportId,
        p_outcome: outcome,
      })
      if (rpcError) throw rpcError
      reports.value = reports.value.map((report) =>
        report.id === reportId ? { ...report, status: outcome } : report,
      )
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not update this report.'
      throw err
    } finally {
      savingId.value = null
    }
  }

  const saveAd = async (payload: {
    id?: string
    shop_id: string
    bannerFile: File | null
    banner_object_key?: string | null
    starts_at: string
    ends_at: string
    label: string
    priority: number
    enabled: boolean
  }) => {
    let bannerKey = payload.banner_object_key ?? null
    if (payload.bannerFile) bannerKey = await uploadAdminAsset(payload.bannerFile, 'ad-banner')
    if (!bannerKey) throw new Error('Upload a banner image.')
    const row = {
      shop_id: payload.shop_id,
      banner_object_key: bannerKey,
      starts_at: new Date(payload.starts_at).toISOString(),
      ends_at: new Date(payload.ends_at).toISOString(),
      label: payload.label.trim() || null,
      priority: payload.priority,
      enabled: payload.enabled,
      cancelled_at: payload.enabled ? null : new Date().toISOString(),
    }
    if (payload.id) {
      const { data, error: updateError } = await supabase.from('ad_campaigns').update(row).eq('id', payload.id).select().single()
      if (updateError || !data) throw new Error(updateError?.message || 'Could not save this ad.')
      ads.value = ads.value.map((item) => (item.id === payload.id ? (data as AdCampaignRow) : item))
      return data as AdCampaignRow
    }
    const { data, error: insertError } = await supabase.from('ad_campaigns').insert(row).select().single()
    if (insertError || !data) throw new Error(insertError?.message || 'Could not save this ad.')
    ads.value = [data as AdCampaignRow, ...ads.value]
    return data as AdCampaignRow
  }

  const cancelAd = async (id: string) => {
    const now = new Date().toISOString()
    const { data, error: updateError } = await supabase
      .from('ad_campaigns')
      .update({ enabled: false, cancelled_at: now, ends_at: now })
      .eq('id', id)
      .select()
      .single()
    if (updateError || !data) throw new Error(updateError?.message || 'Could not end this ad.')
    ads.value = ads.value.map((item) => (item.id === id ? (data as AdCampaignRow) : item))
  }

  const moderateClaim = async (
    claim: ShopClaimRow,
    next: Extract<ShopClaimRow['status'], 'verified' | 'rejected'>,
    rejectionReason = '',
  ) => {
    savingId.value = claim.id
    error.value = ''
    try {
      const { data, error: rpcError } = await supabase.rpc('moderate_shop_claim', {
        p_claim_id: claim.id,
        p_status: next,
        p_rejection_reason: next === 'rejected' ? rejectionReason : null,
      })
      const rpcRow = Array.isArray(data) ? data[0] : data
      if (rpcError || !rpcRow) {
        throw new Error(rpcError?.message || 'Could not update this claim.')
      }
      const updated = rpcRow as ShopClaimRow
      claims.value = claims.value.map((item) => (item.id === claim.id ? updated : item))
      return updated
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Could not update this claim.'
      throw err
    } finally {
      savingId.value = null
    }
  }

  return {
    supabase,
    shops,
    placements,
    placementsByShop,
    reports,
    ads,
    claims,
    counts,
    status,
    error,
    savingId,
    load,
    fetchShop,
    loadPlacements,
    loadAds,
    loadClaims,
    markerTierFor,
    moderate,
    moderateMany,
    savePlacement,
    endPlacement,
    createShop,
    importShops,
    updateShop,
    updateShopLogo,
    updateShopLogos,
    deleteShop,
    resolveReport,
    saveAd,
    cancelAd,
    moderateClaim,
  }
}

export function useAdminUsers() {
  const supabase = useSupabaseClient<AdminDatabase>()
  const users = ref<AdminUserRow[]>([])
  const total = ref(0)
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')
  const savingId = ref<string | null>(null)

  const loadFromProfiles = async (query = '', page = 1) => {
    const perPage = 20
    const from = (page - 1) * perPage
    const term = query.replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim()
    let request = supabase
      .from('profiles')
      .select('id, display_name, role, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + perPage - 1)
    if (term) request = request.ilike('display_name', `%${term}%`)
    const { data, error: profileError, count } = await request
    if (profileError) throw profileError
    const rows = (data ?? []) as Array<{ id: string; display_name: string | null; role: ProfileRole; created_at: string }>
    const ids = rows.map((row) => row.id)
    const shopCounts = new Map<string, number>()
    const reviewCounts = new Map<string, number>()
    if (ids.length) {
      const [{ data: shopRows }, { data: reviewRows }] = await Promise.all([
        supabase.from('shops').select('submitted_by').in('submitted_by', ids),
        supabase.from('reviews').select('user_id').in('user_id', ids),
      ])
      for (const row of shopRows ?? []) {
        const id = String((row as { submitted_by?: string }).submitted_by ?? '')
        if (id) shopCounts.set(id, (shopCounts.get(id) ?? 0) + 1)
      }
      for (const row of reviewRows ?? []) {
        const id = String((row as { user_id?: string }).user_id ?? '')
        if (id) reviewCounts.set(id, (reviewCounts.get(id) ?? 0) + 1)
      }
    }
    users.value = rows.map((row) => ({
      id: row.id,
      email: null,
      displayName: row.display_name,
      role: parseProfileRole(row.role),
      banned: false,
      createdAt: row.created_at,
      lastSignInAt: null,
      shopCount: shopCounts.get(row.id) ?? 0,
      reviewCount: reviewCounts.get(row.id) ?? 0,
    }))
    total.value = count ?? rows.length
  }

  const load = async (query = '', page = 1) => {
    status.value = 'loading'
    error.value = ''
    try {
      const { data, error: fnError } = await supabase.functions.invoke('admin-users', {
        body: { action: 'list', query, page, perPage: 20 },
      })
      const payload = data as (AdminUsersResponse & { error?: string }) | null
      const fnMessage = edgeFunctionErrorMessage(fnError, payload)
      if (!fnError && payload && !payload.error) {
        users.value = payload.users ?? []
        total.value = payload.total ?? 0
        status.value = 'ready'
        return
      }
      await loadFromProfiles(query, page)
      status.value = 'ready'
      if (fnMessage && !/non-2xx/i.test(fnMessage)) {
        error.value = ''
      }
    } catch (err) {
      status.value = 'error'
      error.value = err instanceof Error ? err.message : 'Could not load users.'
    }
  }

  const setRole = async (userId: string, role: ProfileRole) => {
    savingId.value = userId
    try {
      const { error: rpcError } = await supabase.rpc('admin_set_profile_role', {
        p_user_id: userId,
        p_role: role,
      })
      if (rpcError) throw new Error(rpcError.message)
      users.value = users.value.map((row) => (row.id === userId ? { ...row, role } : row))
    } finally {
      savingId.value = null
    }
  }

  const setBanned = async (userId: string, banned: boolean) => {
    savingId.value = userId
    try {
      const { data, error: fnError } = await supabase.functions.invoke('admin-users', {
        body: { action: banned ? 'suspend' : 'reactivate', userId },
      })
      const payload = (data ?? null) as { error?: string } | null
      const message = edgeFunctionErrorMessage(fnError, payload)
      if (fnError || payload?.error) {
        throw new Error(message || 'Could not update this account. Redeploy the admin-users function.')
      }
      users.value = users.value.map((row) => (row.id === userId ? { ...row, banned } : row))
    } finally {
      savingId.value = null
    }
  }

  return { users, total, status, error, savingId, load, setRole, setBanned }
}
