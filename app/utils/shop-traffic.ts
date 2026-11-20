export const SHOP_TRAFFIC_KINDS = [
  'card_impression',
  'card_click',
  'detail_view',
  'navigate',
  'call',
  'photo_view',
] as const

export type ShopTrafficKind = (typeof SHOP_TRAFFIC_KINDS)[number]

export const SHOP_TRAFFIC_SURFACES = [
  'home',
  'search',
  'map',
  'favorites',
  'promotion',
  'direct',
] as const

export type ShopTrafficSurface = (typeof SHOP_TRAFFIC_SURFACES)[number]

export const TRAFFIC_TABS = ['statistics', 'records', 'traffic', 'promotion'] as const
export type TrafficTabId = (typeof TRAFFIC_TABS)[number]

export const TRAFFIC_LEDGER_SURFACES = SHOP_TRAFFIC_SURFACES.filter(
  (surface): surface is Exclude<ShopTrafficSurface, 'promotion'> => surface !== 'promotion',
)

export const TRAFFIC_RANGES = [7, 30] as const
export type TrafficRangeDays = (typeof TRAFFIC_RANGES)[number]

export const CARD_IMPRESSION_RATIO = 0.5
export const CARD_IMPRESSION_MS = 750
export const TRAFFIC_COOLDOWN_MS = 2000
export const RECORDS_PAGE_SIZE = 50
export const TRAFFIC_PAGE_SIZE = 12

export type ShopTrafficDailyRow = {
  shop_id: string
  kind: ShopTrafficKind
  surface: ShopTrafficSurface
  day: string
  hits: number
}

export type ShopTrafficEventRow = {
  id: string
  shop_id: string
  kind: ShopTrafficKind
  surface: ShopTrafficSurface
  created_at: string
}

export type ShopTrafficName = {
  id: string
  name: string
}

export type ShopTrafficTally = {
  impressions: number
  clicks: number
  ctr: number | null
  detailViews: number
  navigate: number
  call: number
  photos: number
  engagement: number
  engagementRate: number | null
  reach: number
}

export type ShopTrafficCafeRow = ShopTrafficTally & {
  shopId: string
  name: string
}

export type ShopTrafficSurfaceRow = ShopTrafficTally & {
  surface: ShopTrafficSurface
  name: string
}

export type ShopTrafficBar = {
  day: string
  clicks: number
  detailViews: number
}

export type RecordsKindFilter = 'all' | 'reach' | 'impressions' | 'clicks' | 'detail' | 'engagement'

export type ShopTrafficRecordsQuery = {
  days: TrafficRangeDays
  filter: RecordsKindFilter
  shopId: string | null
  surface?: ShopTrafficSurface | null
}

export type TrafficActivityFilter = 'all' | 'active' | 'quiet'
export type TrafficSortKey =
  | 'name'
  | 'reach'
  | 'impressions'
  | 'clicks'
  | 'ctr'
  | 'detailViews'
  | 'navigate'
  | 'call'
  | 'photos'
  | 'engagement'
  | 'engagementRate'
export type TrafficSortDir = 'asc' | 'desc'

const KIND_SET = new Set<string>(SHOP_TRAFFIC_KINDS)
const SURFACE_SET = new Set<string>(SHOP_TRAFFIC_SURFACES)

const KIND_LABEL: Record<ShopTrafficKind, string> = {
  card_impression: 'Card impression',
  card_click: 'Card click',
  detail_view: 'Cafe page',
  navigate: 'Directions',
  call: 'Call',
  photo_view: 'Photo',
}

const SURFACE_LABEL: Record<ShopTrafficSurface, string> = {
  home: 'Home',
  search: 'Search',
  map: 'Map',
  favorites: 'Favorites',
  promotion: 'Promotion',
  direct: 'Direct',
}

const DETAIL_SOURCE_TO_SURFACE: Record<string, ShopTrafficSurface> = {
  feed: 'home',
  home: 'home',
  search: 'search',
  map: 'map',
  favorites: 'favorites',
  promotion: 'promotion',
  direct: 'direct',
}

const RECORDS_KIND_MAP: Record<Exclude<RecordsKindFilter, 'all'>, ShopTrafficKind[]> = {
  reach: ['card_click', 'detail_view'],
  impressions: ['card_impression'],
  clicks: ['card_click'],
  detail: ['detail_view'],
  engagement: ['navigate', 'call', 'photo_view'],
}

export function isShopTrafficKind(value: string): value is ShopTrafficKind {
  return KIND_SET.has(value)
}

export function isShopTrafficSurface(value: string): value is ShopTrafficSurface {
  return SURFACE_SET.has(value)
}

export function isTrafficTabId(value: string): value is TrafficTabId {
  return (TRAFFIC_TABS as readonly string[]).includes(value)
}

export function shopTrafficConsentAllowsCapture(consent: unknown): boolean {
  return consent === 'granted'
}

export function shopTrafficKindLabel(kind: ShopTrafficKind): string {
  return KIND_LABEL[kind]
}

export function shopTrafficSurfaceLabel(surface: ShopTrafficSurface): string {
  return SURFACE_LABEL[surface]
}

export function surfaceFromDetailSource(value: unknown, fallback: ShopTrafficSurface = 'direct'): ShopTrafficSurface {
  if (typeof value !== 'string') return fallback
  return DETAIL_SOURCE_TO_SURFACE[value] ?? fallback
}

let pendingSurface: ShopTrafficSurface | null = null
let currentSurface: ShopTrafficSurface = 'direct'

export function rememberTrafficSurface(surface: ShopTrafficSurface) {
  pendingSurface = surface
  currentSurface = surface
}

export function takeTrafficSurface(queryValue?: unknown): ShopTrafficSurface {
  const pending = pendingSurface
  pendingSurface = null
  if (pending) {
    currentSurface = pending
    return pending
  }
  currentSurface = surfaceFromDetailSource(queryValue, 'direct')
  return currentSurface
}

export function currentTrafficSurface(): ShopTrafficSurface {
  return currentSurface
}

export function recordsKindsForFilter(filter: RecordsKindFilter): ShopTrafficKind[] | null {
  if (filter === 'all') return null
  return RECORDS_KIND_MAP[filter]
}

export function recordsFilterCounts(
  rows: ShopTrafficDailyRow[],
  shopId?: string | null,
): Record<RecordsKindFilter, number> {
  const counts: Record<RecordsKindFilter, number> = {
    all: 0,
    reach: 0,
    impressions: 0,
    clicks: 0,
    detail: 0,
    engagement: 0,
  }
  for (const row of rows) {
    if (shopId && row.shop_id !== shopId) continue
    counts.all += row.hits
    if (row.kind === 'card_click' || row.kind === 'detail_view') counts.reach += row.hits
    if (row.kind === 'card_impression') counts.impressions += row.hits
    else if (row.kind === 'card_click') counts.clicks += row.hits
    else if (row.kind === 'detail_view') counts.detail += row.hits
    else counts.engagement += row.hits
  }
  return counts
}

export function manilaDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function shiftManilaDay(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const next = new Date(Date.UTC(year, (month ?? 1) - 1, (date ?? 1) + delta))
  const y = next.getUTCFullYear()
  const m = String(next.getUTCMonth() + 1).padStart(2, '0')
  const d = String(next.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Inclusive start of a 7- or 30-day Manila window that ends today. */
export function trafficRangeStartDay(days: TrafficRangeDays, now = new Date()): string {
  return shiftManilaDay(manilaDateString(now), 1 - days)
}

/** UTC instant of midnight Manila on the range start day. */
export function trafficRangeStartIso(days: TrafficRangeDays, now = new Date()): string {
  const start = trafficRangeStartDay(days, now)
  return `${start}T00:00:00+08:00`
}

export function eachManilaDay(fromDay: string, toDay: string): string[] {
  const days: string[] = []
  let cursor = fromDay
  for (let i = 0; i < 366; i += 1) {
    days.push(cursor)
    if (cursor === toDay) break
    cursor = shiftManilaDay(cursor, 1)
  }
  return days
}

export function trafficRatio(part: number, whole: number): number | null {
  if (whole <= 0) return null
  return part / whole
}

export function formatTrafficRatio(value: number | null): string {
  if (value == null) return '—'
  return `${Math.round(value * 1000) / 10}%`
}

export function formatTrafficCount(value: number): string {
  return new Intl.NumberFormat('en-PH').format(value)
}

function emptyTally(): ShopTrafficTally {
  return {
    impressions: 0,
    clicks: 0,
    ctr: null,
    detailViews: 0,
    navigate: 0,
    call: 0,
    photos: 0,
    engagement: 0,
    engagementRate: null,
    reach: 0,
  }
}

function addKind(tally: ShopTrafficTally, kind: ShopTrafficKind, hits: number) {
  if (kind === 'card_impression') tally.impressions += hits
  else if (kind === 'card_click') tally.clicks += hits
  else if (kind === 'detail_view') tally.detailViews += hits
  else if (kind === 'navigate') tally.navigate += hits
  else if (kind === 'call') tally.call += hits
  else tally.photos += hits
}

function finishTally(tally: ShopTrafficTally): ShopTrafficTally {
  tally.engagement = tally.navigate + tally.call + tally.photos
  tally.reach = tally.clicks + tally.detailViews
  tally.ctr = trafficRatio(tally.clicks, tally.impressions)
  tally.engagementRate = trafficRatio(tally.engagement, tally.detailViews)
  return tally
}

export function filterDailyRows(
  rows: ShopTrafficDailyRow[],
  input: {
    fromDay: string
    surfaces?: ShopTrafficSurface[] | null
    shopIds?: string[] | null
  },
): ShopTrafficDailyRow[] {
  const shops = input.shopIds ? new Set(input.shopIds) : null
  const surfaces = input.surfaces ? new Set(input.surfaces) : null
  return rows.filter((row) => {
    if (row.day < input.fromDay) return false
    if (shops && !shops.has(row.shop_id)) return false
    if (surfaces && !surfaces.has(row.surface)) return false
    return true
  })
}

export function tallyFromDaily(rows: ShopTrafficDailyRow[]): ShopTrafficTally {
  const tally = emptyTally()
  for (const row of rows) addKind(tally, row.kind, row.hits)
  return finishTally(tally)
}

export function dailyBars(
  rows: ShopTrafficDailyRow[],
  fromDay: string,
  toDay: string,
): ShopTrafficBar[] {
  const byDay = new Map<string, ShopTrafficBar>()
  for (const day of eachManilaDay(fromDay, toDay)) {
    byDay.set(day, { day, clicks: 0, detailViews: 0 })
  }
  for (const row of rows) {
    const bar = byDay.get(row.day)
    if (!bar) continue
    if (row.kind === 'card_click') bar.clicks += row.hits
    if (row.kind === 'detail_view') bar.detailViews += row.hits
  }
  return [...byDay.values()]
}

export function perCafeTraffic(
  rows: ShopTrafficDailyRow[],
  names: ShopTrafficName[],
): ShopTrafficCafeRow[] {
  const byShop = new Map<string, ShopTrafficTally>()
  for (const row of rows) {
    const tally = byShop.get(row.shop_id) ?? emptyTally()
    addKind(tally, row.kind, row.hits)
    byShop.set(row.shop_id, tally)
  }
  const nameById = new Map(names.map((shop) => [shop.id, shop.name]))
  const list: ShopTrafficCafeRow[] = []
  for (const shop of names) {
    const tally = finishTally(byShop.get(shop.id) ?? emptyTally())
    list.push({
      shopId: shop.id,
      name: shop.name,
      ...tally,
    })
  }
  for (const [shopId, tally] of byShop) {
    if (nameById.has(shopId)) continue
    list.push({
      shopId,
      name: 'Unknown cafe',
      ...finishTally(tally),
    })
  }
  return list.sort((a, b) => b.clicks - a.clicks || a.name.localeCompare(b.name))
}

export function cafeTrafficHasActivity(row: ShopTrafficCafeRow): boolean {
  return row.impressions + row.clicks + row.detailViews + row.engagement > 0
}

export function filterCafeTraffic(
  rows: ShopTrafficCafeRow[],
  input: { query?: string, activity?: TrafficActivityFilter } = {},
): ShopTrafficCafeRow[] {
  const needle = input.query?.trim().toLowerCase() ?? ''
  const activity = input.activity ?? 'all'
  return rows.filter((row) => {
    if (needle && !row.name.toLowerCase().includes(needle)) return false
    if (activity === 'active' && !cafeTrafficHasActivity(row)) return false
    if (activity === 'quiet' && cafeTrafficHasActivity(row)) return false
    return true
  })
}

export function trafficLedgerEmptyCopy(input: {
  query?: string
  activity?: TrafficActivityFilter
}): string {
  if (input.query?.trim()) return 'No cafes match that search.'
  if (input.activity === 'active') return 'No café listing traffic in this window yet.'
  if (input.activity === 'quiet') return 'Every cafe in this window has traffic.'
  return 'No cafes in this window.'
}

export function nextTrafficSort(
  currentKey: TrafficSortKey,
  currentDir: TrafficSortDir,
  nextKey: TrafficSortKey,
): { key: TrafficSortKey, dir: TrafficSortDir } {
  if (currentKey === nextKey) {
    return { key: nextKey, dir: currentDir === 'desc' ? 'asc' : 'desc' }
  }
  return { key: nextKey, dir: nextKey === 'name' ? 'asc' : 'desc' }
}

export function sortCafeTraffic(
  rows: ShopTrafficCafeRow[],
  key: TrafficSortKey,
  dir: TrafficSortDir,
): ShopTrafficCafeRow[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (key === 'name') {
      return sign * a.name.localeCompare(b.name) || a.shopId.localeCompare(b.shopId)
    }
    const left = a[key]
    const right = b[key]
    if (left == null && right == null) return a.name.localeCompare(b.name)
    if (left == null) return 1
    if (right == null) return -1
    const diff = left - right
    if (diff !== 0) return sign * diff
    return a.name.localeCompare(b.name)
  })
}

export function sortSurfaceTraffic(
  rows: ShopTrafficSurfaceRow[],
  key: TrafficSortKey,
  dir: TrafficSortDir,
): ShopTrafficSurfaceRow[] {
  return sortCafeTraffic(
    rows.map((row) => ({ shopId: row.surface, ...row })),
    key,
    dir,
  ).map((row) => ({
    surface: row.shopId as ShopTrafficSurface,
    name: row.name,
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: row.ctr,
    detailViews: row.detailViews,
    navigate: row.navigate,
    call: row.call,
    photos: row.photos,
    engagement: row.engagement,
    engagementRate: row.engagementRate,
    reach: row.reach,
  }))
}

export function createTrafficCooldown(ms = TRAFFIC_COOLDOWN_MS) {
  const last = new Map<string, number>()
  return (shopId: string, kind: ShopTrafficKind, surface: ShopTrafficSurface, now = Date.now()) => {
    const key = `${shopId}:${kind}:${surface}`
    const previous = last.get(key)
    if (previous != null && now - previous < ms) return false
    last.set(key, now)
    return true
  }
}

export function ownerAnalyticsEmptyCopy(claimCount: number): string {
  if (claimCount > 0) return 'Analytics appear after a cafe you manage is live.'
  return 'Claim a cafe to see how people find it.'
}

export function ownerAnalyticsLockedCopy(): string {
  return 'Analytics is off until a partnership turns it on for a cafe you manage.'
}

export function promotionEmptyCopy(query?: string): string {
  if (query?.trim()) return 'No cafes match that search.'
  return 'No promotion traffic in this window yet.'
}

export function cafeAnalyticsPath(tone: 'admin' | 'owner', shopId: string): string {
  const root = tone === 'admin' ? '/admin/analytics' : '/owner/analytics'
  return shopId.trim() ? `${root}/${shopId}` : root
}

export function perSurfaceTraffic(rows: ShopTrafficDailyRow[]): ShopTrafficSurfaceRow[] {
  const bySurface = new Map<ShopTrafficSurface, ShopTrafficTally>()
  for (const surface of SHOP_TRAFFIC_SURFACES) bySurface.set(surface, emptyTally())
  for (const row of rows) {
    const tally = bySurface.get(row.surface) ?? emptyTally()
    addKind(tally, row.kind, row.hits)
    bySurface.set(row.surface, tally)
  }
  return SHOP_TRAFFIC_SURFACES.map((surface) => ({
    surface,
    name: shopTrafficSurfaceLabel(surface),
    ...finishTally(bySurface.get(surface) ?? emptyTally()),
  }))
}

export function formatTrafficWhen(value: string): string {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatTrafficDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  if (!year || !month || !date) return day
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, date, 12)))
}
