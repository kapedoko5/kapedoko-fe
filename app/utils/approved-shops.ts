import type { Cafe } from '../types/cafe'
import type { GeoBounds } from './geography'
import type {
  MarkerTier,
  ShopBusynessNowRow,
  ShopMarkerTierRow,
  ShopReviewPublicRow,
  ShopReviewRow,
  ShopReviewStatsRow,
  ShopRow,
} from '../types/shop'
import { mapPublicReview, matchaInsightFromStats, statsFromPublicReviews } from './cafe-review'
import type { ShopAmenityResolutionRow } from './amenity-status'
import {
  mapShopToCafe,
  withCafeBusyness,
  withCafeReviews,
} from './shop-mapper'
import { paymentFromRow, type CafePayment, type ShopPaymentRow } from './cafe-payment'
import {
  amenityFilterSpec,
  amenityRowMatchesFilter,
  CAFE_FEED_PAGE_SIZE,
  isPopularReviewStats,
  POPULAR_RECOMMEND_PCT,
  POPULAR_REVIEW_MIN,
} from './cafe-feed'
import type { CafeFilterId } from './cafe-filters'

export const APPROVED_SHOP_COLUMNS =
  'id,name,description,address,latitude,longitude,categories,hours,cover_photo_url,logo_object_key,contact_number,status,submitted_by,reviewed_by,reviewed_at,rejection_reason,created_at,updated_at'

const SHOP_ID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export function isShopId(value: string): boolean {
  const trimmed = value.trim()
  return trimmed.length === 36 && SHOP_ID_RE.test(trimmed)
}

export function shopIdFromRoute(path: string, param?: unknown): string {
  const fromParam = typeof param === 'string'
    ? param
    : Array.isArray(param)
      ? String(param[0] || '')
      : ''
  if (isShopId(fromParam)) return fromParam.trim()
  const match = `${fromParam} ${path}`.match(SHOP_ID_RE)
  return match?.[0] ?? ''
}

export function resolveLiveShopId(
  fullPath: string,
  path: string,
  param?: unknown,
  extras: { ionPath?: string; href?: string } = {},
): string {
  return (
    shopIdFromRoute(fullPath, param)
    || shopIdFromRoute(path, param)
    || shopIdFromRoute(extras.ionPath || '', param)
    || shopIdFromRoute(extras.href || '', param)
  )
}

function firstRow<T>(data: T | T[] | null | undefined): T | null {
  if (Array.isArray(data)) return data[0] ?? null
  return data ?? null
}

function sanitizeSearch(query: string): string {
  return query.replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim()
}

export const SHOP_ID_CHUNK = 80
export const SHOP_ID_GET_CHUNK = 8
export const SHOP_ID_MIN_CHUNK = 1
export const POSTGREST_PAGE_SIZE = 1000
export const SIDECAR_RPC = 'shop_card_sidecars'
export const PICKER_SHOP_COLUMNS = 'id,name,address,status'

export type PickerShopRow = Pick<ShopRow, 'id' | 'name' | 'address' | 'status'>

const AMENITY_RESOLUTION_COLUMNS =
  'shop_id,amenity_key,availability,confidence,source_at,decided_count,yes_count,no_count,is_stale,needs_recheck,wifi_speed,wifi_time_limit,outlet_reliability'
const PAYMENT_COLUMNS = 'shop_id,accepts_qr,accepts_card,accepts_cash,source_at'

type PageResult<T> = { data: T[] | null; error: unknown }

export function chunkIds<T>(items: readonly T[], size = SHOP_ID_CHUNK): T[][] {
  const chunkSize = Math.max(1, size)
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize) as T[])
  }
  return chunks
}

export async function fetchPages<T>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = POSTGREST_PAGE_SIZE,
): Promise<T[]> {
  const size = Math.max(1, pageSize)
  const rows: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await loadPage(from, from + size - 1)
    if (error) throw error
    const page = data ?? []
    rows.push(...page)
    if (page.length < size) break
    from += size
  }
  return rows
}

export async function fetchByShopIds<T>(
  ids: string[],
  loadPage: (chunk: string[], from: number, to: number) => PromiseLike<PageResult<T>>,
  size = SHOP_ID_GET_CHUNK,
): Promise<T[]> {
  const rows: T[] = []
  for (const chunk of chunkIds(ids, size)) {
    rows.push(...await fetchShopIdChunk(chunk, loadPage))
  }
  return rows
}

/** GET ?shop_id=in.(…) 400s past a handful of uuids. Split until one id, which cards already load. */
async function fetchShopIdChunk<T>(
  chunk: string[],
  loadPage: (chunk: string[], from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  try {
    return await fetchPages((from, to) => loadPage(chunk, from, to))
  } catch (err) {
    if (chunk.length <= SHOP_ID_MIN_CHUNK) throw err
    const rows: T[] = []
    for (const half of chunkIds(chunk, Math.ceil(chunk.length / 2))) {
      rows.push(...await fetchShopIdChunk(half, loadPage))
    }
    return rows
  }
}

export function groupAmenityRows(
  rows: ShopAmenityResolutionRow[],
): Map<string, ShopAmenityResolutionRow[]> {
  const grouped = new Map<string, ShopAmenityResolutionRow[]>()
  for (const row of rows) {
    const list = grouped.get(row.shop_id) ?? []
    list.push(row)
    grouped.set(row.shop_id, list)
  }
  return grouped
}

type ShopClient = {
  from: (relation: string) => any
  rpc?: (fn: string, args: Record<string, unknown>) => PromiseLike<PageResult<unknown>>
}

interface ShopCardSidecarsPayload {
  amenities?: ShopAmenityResolutionRow[] | null
  payments?: ShopPaymentRow[] | null
  stats?: ShopReviewStatsRow[] | null
  tiers?: ShopMarkerTierRow[] | null
}

export function parseSidecarPayload(data: unknown): ShopCardSidecarsPayload | null {
  if (data == null) return null
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as ShopCardSidecarsPayload
  } catch {
    return null
  }
}

export interface CafeSidecars {
  statsById: Map<string, ShopReviewStatsRow>
  tierById: Map<string, MarkerTier>
  amenityById: Map<string, ShopAmenityResolutionRow[]>
  paymentById: Map<string, CafePayment>
  amenitiesLoaded: boolean
  paymentsLoaded: boolean
}

export function sidecarsFromPayload(payload?: ShopCardSidecarsPayload | null): CafeSidecars {
  const paymentById = new Map<string, CafePayment>()
  for (const row of payload?.payments ?? []) {
    const payment = paymentFromRow(row)
    if (payment) paymentById.set(row.shop_id, payment)
  }
  return {
    statsById: new Map((payload?.stats ?? []).map((row) => [row.shop_id, row])),
    tierById: new Map(
      (payload?.tiers ?? []).map((row) => [row.shop_id, row.marker_tier as MarkerTier]),
    ),
    amenityById: groupAmenityRows(payload?.amenities ?? []),
    paymentById,
    amenitiesLoaded: Array.isArray(payload?.amenities),
    paymentsLoaded: Array.isArray(payload?.payments),
  }
}

export function mergeSidecars(target: CafeSidecars, extra: CafeSidecars): CafeSidecars {
  for (const [id, row] of extra.statsById) target.statsById.set(id, row)
  for (const [id, row] of extra.tierById) target.tierById.set(id, row)
  for (const [id, rows] of extra.amenityById) {
    target.amenityById.set(id, [...(target.amenityById.get(id) ?? []), ...rows])
  }
  for (const [id, row] of extra.paymentById) target.paymentById.set(id, row)
  target.amenitiesLoaded = target.amenitiesLoaded || extra.amenitiesLoaded
  target.paymentsLoaded = target.paymentsLoaded || extra.paymentsLoaded
  return target
}

async function rowsOrNull<T>(rows: Promise<T[]>): Promise<T[] | null> {
  try {
    return await rows
  } catch {
    return null
  }
}

async function loadCafeSidecarsByIn(supabase: ShopClient, ids: string[]): Promise<CafeSidecars> {
  const unique = [...new Set(ids)]
  if (!unique.length) return sidecarsFromPayload()

  const [amenities, stats, tiers, payments] = await Promise.all([
    rowsOrNull(fetchByShopIds<ShopAmenityResolutionRow>(unique, (chunk, from, to) =>
      supabase
        .from('shop_amenity_resolutions_public')
        .select(AMENITY_RESOLUTION_COLUMNS)
        .in('shop_id', chunk)
        .range(from, to),
    )),
    rowsOrNull(fetchByShopIds<ShopReviewStatsRow>(unique, (chunk, from, to) =>
      supabase.from('shop_review_stats').select('*').in('shop_id', chunk).range(from, to),
    )),
    rowsOrNull(fetchByShopIds<ShopMarkerTierRow>(unique, (chunk, from, to) =>
      supabase.from('shop_marker_tiers').select('shop_id,marker_tier').in('shop_id', chunk).range(from, to),
    )),
    rowsOrNull(fetchByShopIds<ShopPaymentRow>(unique, (chunk, from, to) =>
      supabase.from('shop_payment_public').select(PAYMENT_COLUMNS).in('shop_id', chunk).range(from, to),
    )),
  ])

  return sidecarsFromPayload({ amenities, stats, tiers, payments })
}

async function loadCafeSidecarsByRpc(supabase: ShopClient, ids: string[]): Promise<CafeSidecars | null> {
  if (typeof supabase.rpc !== 'function') return null
  let bundled = sidecarsFromPayload()
  for (const chunk of chunkIds(ids)) {
    const payload = await rpcSidecarPayload(supabase, chunk)
    if (!payload) return null
    bundled = mergeSidecars(bundled, sidecarsFromPayload(payload))
  }
  return bundled
}

async function rpcSidecarPayload(
  supabase: ShopClient,
  chunk: string[],
): Promise<ShopCardSidecarsPayload | null> {
  try {
    const { data, error } = await supabase.rpc!(SIDECAR_RPC, { p_shop_ids: chunk })
    if (error) return null
    return parseSidecarPayload(data)
  } catch {
    return null
  }
}

/**
 * RPC first (POST ids). GET in() of 8 if the RPC is missing. Never one giant in().
 * A sidecar that cannot load stays unloaded so cards fall back to review stats.
 */
export async function loadCafeSidecars(supabase: ShopClient, ids: string[]): Promise<CafeSidecars> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return sidecarsFromPayload()
  return await loadCafeSidecarsByRpc(supabase, unique) ?? await loadCafeSidecarsByIn(supabase, unique)
}

export async function fetchAmenityRowsForShopIds(
  supabase: ShopClient,
  ids: string[],
): Promise<ShopAmenityResolutionRow[]> {
  const sidecars = await loadCafeSidecars(supabase, ids)
  return [...sidecars.amenityById.values()].flat()
}

function cafeFromApprovedShop(
  shop: ShopRow,
  publicBase: string,
  sidecars: CafeSidecars,
): Cafe {
  return mapShopToCafe(
    shop,
    sidecars.statsById.get(shop.id),
    publicBase,
    sidecars.tierById.get(shop.id) ?? 'standard',
    sidecars.amenitiesLoaded ? sidecars.amenityById.get(shop.id) ?? [] : undefined,
    sidecars.paymentById.get(shop.id) ?? null,
  )
}

function approvedShopQuery(
  supabase: { from: (relation: string) => any },
  options: {
    bounds?: GeoBounds
    query?: string
    ids?: string[]
  } = {},
) {
  let request = supabase
    .from('shops')
    .select(APPROVED_SHOP_COLUMNS)
    .eq('status', 'approved')

  if (options.ids) request = request.in('id', options.ids)
  if (options.bounds) {
    request = request
      .gte('latitude', options.bounds.south)
      .lte('latitude', options.bounds.north)
      .gte('longitude', options.bounds.west)
      .lte('longitude', options.bounds.east)
  }

  const term = options.query ? sanitizeSearch(options.query) : ''
  if (term) {
    request = request.or(`name.ilike.%${term}%,address.ilike.%${term}%`)
  }

  return request.order('name')
}

export async function fetchAdminShopRows(supabase: ShopClient): Promise<ShopRow[]> {
  return await fetchPages<ShopRow>((from, to) =>
    supabase
      .from('shops')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  )
}

/** Name and address only, paged past the PostgREST 1000-row cap. */
export async function fetchApprovedPickerRows(supabase: ShopClient): Promise<PickerShopRow[]> {
  const rows = await fetchPages<PickerShopRow>((from, to) =>
    supabase
      .from('shops')
      .select(PICKER_SHOP_COLUMNS)
      .eq('status', 'approved')
      .order('name')
      .order('id')
      .range(from, to),
  )
  return rows.filter((shop) => shop.status === 'approved')
}

export async function fetchApprovedShopRows(
  supabase: ShopClient,
  options: {
    bounds?: GeoBounds
    query?: string
    limit?: number
  } = {},
): Promise<ShopRow[]> {
  const shops = options.limit
    ? await (async () => {
        const { data, error } = await approvedShopQuery(supabase, options).limit(options.limit)
        if (error) throw error
        return (data ?? []) as ShopRow[]
      })()
    : await fetchPages<ShopRow>((from, to) =>
        approvedShopQuery(supabase, options).range(from, to),
      )
  return shops.filter((shop) => shop.status === 'approved')
}

export function cafesFromApprovedShops(
  shops: ShopRow[],
  publicBase: string,
  sidecars: CafeSidecars = sidecarsFromPayload(),
): Cafe[] {
  return shops.map((shop) => cafeFromApprovedShop(shop, publicBase, sidecars))
}

export async function fetchApprovedCafes(
  supabase: ShopClient,
  publicBase: string,
  options: {
    bounds?: GeoBounds
    query?: string
    limit?: number
  } = {},
): Promise<Cafe[]> {
  const approved = await fetchApprovedShopRows(supabase, options)
  if (!approved.length) return []
  const sidecars = await loadCafeSidecars(supabase, approved.map((shop) => shop.id))
  return cafesFromApprovedShops(approved, publicBase, sidecars)
}

export interface ShopPoint {
  id: string
  name: string
  lat: number
  lng: number
}

/** One screen of approved shops. Does not walk the rest of the catalog. */
export async function fetchApprovedCafePage(
  supabase: ShopClient,
  publicBase: string,
  options: {
    offset?: number
    limit?: number
    bounds?: GeoBounds
    query?: string
  } = {},
): Promise<{ cafes: Cafe[]; hasMore: boolean }> {
  const limit = Math.max(1, options.limit ?? CAFE_FEED_PAGE_SIZE)
  const offset = Math.max(0, options.offset ?? 0)
  const { data, error } = await approvedShopQuery(supabase, {
    bounds: options.bounds,
    query: options.query,
  })
    .order('id')
    .range(offset, offset + limit - 1)

  if (error) throw error
  const rows = (data ?? []) as ShopRow[]
  const shops = rows.filter((shop) => shop.status === 'approved')
  if (!shops.length) return { cafes: [], hasMore: false }
  const sidecars = await loadCafeSidecars(supabase, shops.map((shop) => shop.id))
  return {
    cafes: cafesFromApprovedShops(shops, publicBase, sidecars),
    hasMore: rows.length === limit,
  }
}

/** Id and position only, inside a map box. Callers rank these before loading cards. */
export async function fetchApprovedShopPoints(
  supabase: ShopClient,
  bounds: GeoBounds,
): Promise<ShopPoint[]> {
  const rows = await fetchPages<{
    id: string
    name: string
    latitude: number | string
    longitude: number | string
  }>((from, to) =>
    supabase
      .from('shops')
      .select('id,name,latitude,longitude')
      .eq('status', 'approved')
      .gte('latitude', bounds.south)
      .lte('latitude', bounds.north)
      .gte('longitude', bounds.west)
      .lte('longitude', bounds.east)
      .order('id')
      .range(from, to),
  )
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    lat: Number(row.latitude),
    lng: Number(row.longitude),
  }))
}

export async function countApprovedShops(
  supabase: ShopClient,
  options: { query?: string } = {},
): Promise<number> {
  let request = supabase
    .from('shops')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')

  const term = options.query ? sanitizeSearch(options.query) : ''
  if (term) request = request.or(`name.ilike.%${term}%,address.ilike.%${term}%`)

  const { count, error } = await request
  if (error) throw error
  return count ?? 0
}

export async function fetchFilterShopIds(
  supabase: ShopClient,
  filter: CafeFilterId,
): Promise<string[]> {
  if (filter === 'popular') {
    const rows = await fetchPages<Pick<ShopReviewStatsRow, 'shop_id' | 'total_reviews' | 'recommend_pct'>>((from, to) =>
      supabase
        .from('shop_review_stats')
        .select('shop_id,total_reviews,recommend_pct')
        .gte('total_reviews', POPULAR_REVIEW_MIN)
        .gte('recommend_pct', POPULAR_RECOMMEND_PCT)
        .order('recommend_pct', { ascending: false })
        .order('shop_id')
        .range(from, to),
    )
    return [...new Set(rows.filter((row) => isPopularReviewStats(row)).map((row) => row.shop_id))]
  }

  const spec = amenityFilterSpec(filter)
  if (!spec) return []

  const rows = await fetchPages<ShopAmenityResolutionRow>((from, to) => {
    let request = supabase
      .from('shop_amenity_resolutions_public')
      .select(AMENITY_RESOLUTION_COLUMNS)
      .eq('amenity_key', spec.key)
      .eq('availability', 'available')
      .in('confidence', ['team_verified', 'community_confirmed'])
      .order('shop_id')
      .range(from, to)
    if (spec.wifiSpeed) request = request.eq('wifi_speed', spec.wifiSpeed)
    if (spec.outletReliability) request = request.eq('outlet_reliability', spec.outletReliability)
    return request
  })

  return [...new Set(
    rows
      .filter((row) => amenityRowMatchesFilter(row, filter))
      .map((row) => row.shop_id),
  )]
}

export async function fetchPlacementCafes(
  supabase: ShopClient,
  publicBase: string,
): Promise<Cafe[]> {
  const { data, error } = await supabase
    .from('shop_marker_tiers')
    .select('shop_id,marker_tier')
    .in('marker_tier', ['promoted', 'partner'])

  if (error) throw error
  const ids = [...new Set(
    ((data ?? []) as { shop_id?: string }[])
      .map((row) => row.shop_id)
      .filter((id): id is string => Boolean(id)),
  )]
  if (!ids.length) return []
  return fetchApprovedCafesByIds(supabase, publicBase, ids)
}

export async function fetchApprovedCafesByIds(
  supabase: ShopClient,
  publicBase: string,
  shopIds: string[],
): Promise<Cafe[]> {
  const ids = [...new Set(shopIds.filter((id) => isShopId(id)))]
  if (!ids.length) return []

  const found = await fetchByShopIds<ShopRow>(ids, (chunk, from, to) =>
    approvedShopQuery(supabase, { ids: chunk }).range(from, to),
  )
  const approved = found.filter((shop) => shop.status === 'approved')
  if (!approved.length) return []

  const sidecars = await loadCafeSidecars(supabase, approved.map((shop) => shop.id))
  const byId = new Map(
    approved.map((shop) => [shop.id, cafeFromApprovedShop(shop, publicBase, sidecars)]),
  )

  return ids.flatMap((id) => {
    const cafe = byId.get(id)
    return cafe ? [cafe] : []
  })
}

export async function fetchApprovedCafeById(
  supabase: { from: (relation: string) => any },
  publicBase: string,
  shopId: string,
): Promise<Cafe | null> {
  if (!isShopId(shopId)) return null

  const { data: shop, error } = await supabase
    .from('shops')
    .select(APPROVED_SHOP_COLUMNS)
    .eq('id', shopId)
    .eq('status', 'approved')
    .maybeSingle()

  if (error) throw error
  if (!shop) return null

  const sidecars = await loadCafeSidecars(supabase, [shopId])
  return cafeFromApprovedShop(shop as ShopRow, publicBase, sidecars)
}

export async function fetchPublicCafeReviews(
  supabase: { from: (relation: string) => any },
  shopId: string,
  limit = 20,
): Promise<Cafe['reviews']> {
  const rows = await fetchPublicCafeReviewRows(supabase, shopId, limit)
  return rows.map(mapPublicReview)
}

export async function fetchPublicCafeReviewRows(
  supabase: { from: (relation: string) => any },
  shopId: string,
  limit = 20,
): Promise<ShopReviewPublicRow[]> {
  if (!isShopId(shopId)) return []

  const fromView = await supabase
    .from('shop_reviews_public')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!fromView.error) {
    const viewRows = (fromView.data ?? []) as ShopReviewPublicRow[]
    if (viewRows.length) return viewRows
  }

  const fromTable = await supabase
    .from('reviews')
    .select('id, shop_id, created_at, updated_at, wifi_available, wifi_speed, wifi_time_limit, power_available, power_access, serves_matcha, noise, stay_fit, recommend, visit_again, comment')
    .eq('shop_id', shopId)
    .is('flagged_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (fromTable.error) return []
  return ((fromTable.data ?? []) as ShopReviewRow[]).map((row) => ({
    id: row.id,
    shop_id: row.shop_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author_name: 'KapéBean',
    wifi_available: row.wifi_available,
    wifi_speed: row.wifi_speed,
    wifi_time_limit: row.wifi_time_limit,
    power_available: row.power_available,
    power_access: row.power_access,
    serves_matcha: row.serves_matcha,
    noise: row.noise,
    stay_fit: row.stay_fit,
    recommend: row.recommend,
    visit_again: row.visit_again,
    comment: row.comment,
  }))
}

export async function fetchShopBusynessNow(
  supabase: { from: (relation: string) => any },
  shopId: string,
): Promise<ShopBusynessNowRow | null> {
  if (!isShopId(shopId)) return null

  const { data, error } = await supabase
    .from('shop_busyness_now')
    .select('*')
    .eq('shop_id', shopId)
    .limit(1)

  if (error) return null
  return firstRow(data as ShopBusynessNowRow[] | ShopBusynessNowRow | null)
}

export async function hydrateCafeDetail(
  supabase: { from: (relation: string) => any },
  cafe: Cafe,
): Promise<Cafe> {
  const [rowsResult, busynessResult] = await Promise.allSettled([
    fetchPublicCafeReviewRows(supabase, cafe.id),
    fetchShopBusynessNow(supabase, cafe.id),
  ])
  const rows = rowsResult.status === 'fulfilled' ? rowsResult.value : []
  const derived = statsFromPublicReviews(rows)
  const reviewed: Cafe = {
    ...withCafeReviews(cafe, rows.map(mapPublicReview)),
    wifiInsight: cafe.wifiInsight,
    plugInsight: cafe.plugInsight,
    matchaInsight: cafe.matchaInsight ?? matchaInsightFromStats(derived),
  }
  const busyness = busynessResult.status === 'fulfilled' ? busynessResult.value : null
  return withCafeBusyness(reviewed, busyness)
}

export async function fetchOwnShopReview(
  supabase: { from: (relation: string) => any },
  shopId: string,
  userId: string,
): Promise<ShopReviewRow | null> {
  if (!isShopId(shopId) || !isShopId(userId)) return null

  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('shop_id', shopId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as ShopReviewRow | null
}
