import {
  RECORDS_PAGE_SIZE,
  isShopTrafficKind,
  isShopTrafficSurface,
  recordsKindsForFilter,
  trafficRangeStartDay,
  trafficRangeStartIso,
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
  }
}

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

  const loadNames = async (owned?: ShopTrafficName[]) => {
    if (owned) {
      names.value = owned
      return
    }
    const { data, error: queryError } = await supabase
      .from('shops')
      .select('id, name')
      .eq('status', 'approved')
      .order('name')
    if (queryError) throw queryError
    names.value = ((data ?? []) as { id: string, name: string }[]).map((shop) => ({
      id: shop.id,
      name: shop.name,
    }))
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

  const loadDaily = async (days: TrafficRangeDays, owned?: ShopTrafficName[], shopId?: string) => {
    status.value = 'loading'
    error.value = ''
    try {
      if (shopId) {
        if (owned) names.value = owned.filter((shop) => shop.id === shopId)
        else await loadName(shopId)
        if (names.value.length === 0) {
          daily.value = []
          status.value = 'error'
          error.value = 'That cafe was not found.'
          return
        }
      } else {
        await loadNames(owned)
      }
      const fromDay = trafficRangeStartDay(days)
      let query = supabase
        .from('shop_traffic_daily')
        .select('shop_id, kind, surface, day, hits')
        .gte('day', fromDay)
      if (shopId) query = query.eq('shop_id', shopId)
      else if (owned?.length) query = query.in('shop_id', owned.map((shop) => shop.id))
      const { data, error: queryError } = await query
      if (queryError) throw queryError
      daily.value = parseDaily(data)
      status.value = 'ready'
    } catch (err) {
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
      if (queryError) throw queryError
      const page = parseEvents(data)
      events.value = input.append ? [...events.value, ...page] : page
      eventsDone.value = page.length < RECORDS_PAGE_SIZE
      eventsStatus.value = 'ready'
    } catch (err) {
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
