import { createRequestGuard } from '~/utils/request-guard'
import { SHOP_ID_GET_CHUNK, chunkIds, fetchPages } from '~/utils/approved-shops'
import {
  RECORDS_PAGE_SIZE,
  isShopTrafficKind,
  isMissingRpcError,
  isShopTrafficSurface,
  recordsKindsForFilter,
  rollupRowsToDaily,
  trafficRangeStartDay,
  trafficRangeStartIso,
  trafficRangeWindow,
  TRAFFIC_VIEW_RANGES,
  type RecordsKindFilter,
  type ShopTrafficDailyRow,
  type ShopTrafficEventRow,
  type ShopTrafficName,
  type ShopTrafficSurface,
  type TrafficRangeDays,
} from '~/utils/shop-traffic'

type TrafficDatabase = {
  public: {
    Tables: {
      shops: {
        Row: { id: string, name: string, status: string }
      }
      shop_traffic_events: {
        Row: ShopTrafficEventRow
      }
    }
    Views: {
      shop_traffic_daily: {
        Row: ShopTrafficDailyRow
      }
    }
    Functions: {
      shop_traffic_rollup: {
        Args: { p_from: string, p_to: string, p_shop_ids: string[] | null, p_grain: string }
        Returns: Array<{ shop_id: string, kind: string, surface: string, bucket: string, hits: number }>
      }
    }
  }
}

/**
 * Set once the shop_traffic_rollup RPC is known to be missing (migration not
 * applied yet). Shared so the range tabs can hide 90 days and later loads skip
 * the failing call.
 */
export const trafficRollupMissing = ref(false)

const parseDaily = (rows: unknown): ShopTrafficDailyRow[] => {
  if (!Array.isArray(rows)) return []
  const next: ShopTrafficDailyRow[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const shopId = typeof item.shop_id === 'string' ? item.shop_id : ''
    const kind = typeof item.kind === 'string' ? item.kind : ''
    const surface = typeof item.surface === 'string' ? item.surface : ''
    const day = typeof item.day === 'string' ? item.day : ''
    const hits = typeof item.hits === 'number' ? item.hits : Number(item.hits)
    if (!shopId || !isShopTrafficKind(kind) || !isShopTrafficSurface(surface) || !day) continue
    next.push({ shop_id: shopId, kind, surface, day, hits: Number.isFinite(hits) ? hits : 0 })
  }
  return next
}

const parseEvents = (rows: unknown): ShopTrafficEventRow[] => {
  if (!Array.isArray(rows)) return []
  const next: ShopTrafficEventRow[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const item = row as Record<string, unknown>
    const id = typeof item.id === 'string' ? item.id : ''
    const shopId = typeof item.shop_id === 'string' ? item.shop_id : ''
    const kind = typeof item.kind === 'string' ? item.kind : ''
    const surface = typeof item.surface === 'string' ? item.surface : ''
    const created = typeof item.created_at === 'string' ? item.created_at : ''
    if (!id || !shopId || !isShopTrafficKind(kind) || !isShopTrafficSurface(surface) || !created) continue
    next.push({ id, shop_id: shopId, kind, surface, created_at: created })
  }
  return next
}

export function useShopTrafficDesk() {
  const supabase = useSupabaseClient<TrafficDatabase>()
  const daily = ref<ShopTrafficDailyRow[]>([])
  const events = ref<ShopTrafficEventRow[]>([])
  const names = ref<ShopTrafficName[]>([])
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const eventsStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')
  const eventsError = ref('')
  const eventsDone = ref(false)
  const dailyGuard = createRequestGuard()
  const eventsGuard = createRequestGuard()

  const loadNames = async (owned?: ShopTrafficName[]) => {
    if (owned) {
      names.value = owned
      return
    }
    const rows = await fetchPages<{ id: string, name: string }>((from, to) =>
      supabase
        .from('shops')
        .select('id, name')
        .eq('status', 'approved')
        .order('name')
        .order('id')
        .range(from, to),
    )
    names.value = rows.map((shop) => ({
      id: shop.id,
      name: shop.name,
    }))
  }

  const mergeNames = async (shopIds: string[]) => {
    const have = new Set(names.value.map((shop) => shop.id))
    const missing = [...new Set(shopIds)].filter((id) => id && !have.has(id))
    if (missing.length === 0) return
    const extra: ShopTrafficName[] = []
    for (const chunk of chunkIds(missing, SHOP_ID_GET_CHUNK)) {
      const { data, error: queryError } = await supabase
        .from('shops')
        .select('id, name')
        .in('id', chunk)
      if (queryError) throw queryError
      for (const shop of (data ?? []) as { id: string, name: string }[]) {
        extra.push({ id: shop.id, name: shop.name })
      }
    }
    if (extra.length) names.value = [...names.value, ...extra]
  }

  const loadName = async (shopId: string) => {
    const { data, error: queryError } = await supabase
      .from('shops')
      .select('id, name')
      .eq('id', shopId)
      .maybeSingle()
    if (queryError) throw queryError
    const shop = data as { id: string, name: string } | null
    names.value = shop ? [{ id: shop.id, name: shop.name }] : []
  }

  const loadRollup = async (days: number, shopIds: string[] | null): Promise<ShopTrafficDailyRow[]> => {
    const window = trafficRangeWindow(days * 2)
    const rows = await fetchPages((from, to) =>
      supabase
        .rpc('shop_traffic_rollup', {
          p_from: window.from,
          p_to: window.to,
          p_shop_ids: shopIds,
          p_grain: 'day',
        })
        .order('shop_id')
        .order('kind')
        .order('surface')
        .order('bucket')
        .range(from, to),
    )
    return rollupRowsToDaily(rows)
  }

  /**
   * Loads days * 2 so the board can compare against the previous period of equal
   * length. A newer call makes older in-flight calls drop their results.
   */
  const loadDaily = async (days: TrafficRangeDays, owned?: ShopTrafficName[], shopId?: string) => {
    const isCurrent = dailyGuard.next()
    status.value = 'loading'
    error.value = ''
    try {
      if (shopId) {
        if (owned) names.value = owned.filter((shop) => shop.id === shopId)
        else await loadName(shopId)
        if (!isCurrent()) return
        if (names.value.length === 0) {
          daily.value = []
          status.value = 'error'
          error.value = 'That cafe was not found.'
          return
        }
      } else {
        await loadNames(owned)
        if (!isCurrent()) return
      }
      const scopeIds = shopId ? [shopId] : owned?.length ? owned.map((shop) => shop.id) : null
      let parsed: ShopTrafficDailyRow[] | null = null
      if (!trafficRollupMissing.value) {
        try {
          parsed = await loadRollup(days, scopeIds)
        } catch (rpcError) {
          if (!isMissingRpcError(rpcError)) throw rpcError
          trafficRollupMissing.value = true
        }
      }
      if (!isCurrent()) return
      if (!parsed) {
        // Fallback: the view pages every row, so cap at the ranges it can serve.
        const viewDays = Math.min(days, Math.max(...TRAFFIC_VIEW_RANGES))
        const fromDay = trafficRangeStartDay(viewDays * 2)
        const rows = await fetchPages((from, to) => {
          let query = supabase
            .from('shop_traffic_daily')
            .select('shop_id, kind, surface, day, hits')
            .gte('day', fromDay)
            .order('shop_id')
            .order('kind')
            .order('surface')
            .order('day')
            .range(from, to)
          if (shopId) query = query.eq('shop_id', shopId)
          else if (owned?.length) query = query.in('shop_id', owned.map((shop) => shop.id))
          return query
        })
        parsed = parseDaily(rows)
      }
      if (!isCurrent()) return
      daily.value = parsed
      await mergeNames(daily.value.map((row) => row.shop_id))
      if (!isCurrent()) return
      status.value = 'ready'
    } catch (err) {
      if (!isCurrent()) return
      status.value = 'error'
      error.value = err instanceof Error ? err.message : 'Could not load analytics.'
    }
  }

  const loadEvents = async (input: {
    days: TrafficRangeDays
    filter: RecordsKindFilter
    shopId?: string | null
    shopIds?: string[]
    surface?: ShopTrafficSurface | null
    append?: boolean
  }) => {
    const isCurrent = eventsGuard.next()
    eventsStatus.value = 'loading'
    eventsError.value = ''
    if (!input.append) {
      events.value = []
      eventsDone.value = false
    }
    try {
      const kinds = recordsKindsForFilter(input.filter)
      const from = events.value.length
      let query = supabase
        .from('shop_traffic_events')
        .select('id, shop_id, kind, surface, created_at')
        .gte('created_at', trafficRangeStartIso(input.days))
        .order('created_at', { ascending: false })
        .range(from, from + RECORDS_PAGE_SIZE - 1)
      if (kinds) query = query.in('kind', kinds)
      if (input.surface) query = query.eq('surface', input.surface)
      if (input.shopId) query = query.eq('shop_id', input.shopId)
      else if (input.shopIds?.length) query = query.in('shop_id', input.shopIds)
      const { data, error: queryError } = await query
      if (!isCurrent()) return
      if (queryError) throw queryError
      const page = parseEvents(data)
      events.value = input.append ? [...events.value, ...page] : page
      eventsDone.value = page.length < RECORDS_PAGE_SIZE
      await mergeNames(page.map((row) => row.shop_id))
      if (!isCurrent()) return
      eventsStatus.value = 'ready'
    } catch (err) {
      if (!isCurrent()) return
      eventsStatus.value = 'error'
      eventsError.value = err instanceof Error ? err.message : 'Could not load records.'
    }
  }

  return {
    daily,
    events,
    names,
    status,
    eventsStatus,
    error,
    eventsError,
    eventsDone,
    loadDaily,
    loadEvents,
  }
}

export function parseSurfaceFilter(value: string): ShopTrafficSurface | 'all' {
  if (value === 'all') return 'all'
  return isShopTrafficSurface(value) ? value : 'all'
}
