import { createRequestGuard } from '~/utils/request-guard'
import { fetchPages, chunkIds, SHOP_ID_GET_CHUNK } from '~/utils/approved-shops'
import { isMissingRpcError, trafficRangeStartIso, trafficRangeWindow } from '~/utils/shop-traffic'
import {
  hourlyGrid,
  parseCheckinHourly,
  parseTrafficHourly,
  trafficHourlyGrid,
  type HourlyGrid,
} from '~/utils/peak-hours'
import {
  parseReviewRows,
  summarizeReviews,
  type PublicReviewRow,
  type ReviewSummary,
} from '~/utils/visitor-voice'
import { parseVibeRows, type ActiveVibeRow } from '~/utils/traffic-vibes'

/**
 * Set once shop_traffic_hourly is known to be missing (migration not applied),
 * so later loads skip the failing call and the heatmap just shows check-ins.
 */
export const trafficHourlyMissing = ref(false)

/**
 * Secondary analytics data: check-in peak hours, traffic by hour, review
 * sentiment and vibe tags. Every loader is quiet on failure, the matching card
 * simply stays hidden, and a newer call drops older in-flight results.
 */
export function useShopAudience() {
  const supabase = useSupabaseClient()
  const checkinGrid = ref<HourlyGrid | null>(null)
  const trafficGrid = ref<HourlyGrid | null>(null)
  const reviews = ref<PublicReviewRow[]>([])
  const reviewsReady = ref(false)
  const vibes = ref<ActiveVibeRow[]>([])
  const vibesStatus = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const checkinGuard = createRequestGuard()
  const trafficGuard = createRequestGuard()
  const reviewGuard = createRequestGuard()
  const vibeGuard = createRequestGuard()

  /** 14 days of hourly check-in counts from the public view. */
  const loadCheckinHourly = async (shopIds: string[]) => {
    const isCurrent = checkinGuard.next()
    if (shopIds.length === 0) {
      checkinGrid.value = null
      return
    }
    try {
      const rows: unknown[] = []
      for (const chunk of chunkIds(shopIds, SHOP_ID_GET_CHUNK)) {
        const page = await fetchPages<unknown>((from, to) =>
          supabase
            .from('shop_busyness_hourly')
            .select('shop_id, hour_start, report_count')
            .in('shop_id', chunk)
            .order('hour_start')
            .range(from, to),
        )
        rows.push(...page)
      }
      if (!isCurrent()) return
      checkinGrid.value = hourlyGrid(parseCheckinHourly(rows))
    } catch {
      if (!isCurrent()) return
      checkinGrid.value = null
    }
  }

  /** Cafe page visits by Manila hour of week, when the RPC exists. */
  const loadTrafficHourly = async (days: number, shopIds: string[] | null) => {
    const isCurrent = trafficGuard.next()
    if (trafficHourlyMissing.value) {
      trafficGrid.value = null
      return
    }
    try {
      const window = trafficRangeWindow(days)
      const { data, error } = await supabase.rpc('shop_traffic_hourly', {
        p_from: window.from,
        p_to: window.to,
        p_shop_ids: shopIds,
      })
      if (!isCurrent()) return
      if (error) {
        if (isMissingRpcError(error)) trafficHourlyMissing.value = true
        trafficGrid.value = null
        return
      }
      trafficGrid.value = trafficHourlyGrid(parseTrafficHourly(data), ['detail_view'])
    } catch {
      if (!isCurrent()) return
      trafficGrid.value = null
    }
  }

  /** Published reviews for the cafes in scope, newest first. */
  const loadReviews = async (shopIds: string[], days: number) => {
    const isCurrent = reviewGuard.next()
    reviewsReady.value = false
    if (shopIds.length === 0) {
      reviews.value = []
      return
    }
    try {
      const rows: unknown[] = []
      for (const chunk of chunkIds(shopIds, SHOP_ID_GET_CHUNK)) {
        const page = await fetchPages<unknown>((from, to) =>
          supabase
            .from('shop_reviews_public')
            .select('id, shop_id, created_at, author_name, recommend, visit_again, comment')
            .in('shop_id', chunk)
            .gte('created_at', trafficRangeStartIso(days))
            .order('created_at', { ascending: false })
            .range(from, to),
        )
        rows.push(...page)
      }
      if (!isCurrent()) return
      reviews.value = parseReviewRows(rows)
      reviewsReady.value = true
    } catch {
      if (!isCurrent()) return
      reviews.value = []
    }
  }

  const loadVibes = async () => {
    const isCurrent = vibeGuard.next()
    vibesStatus.value = 'loading'
    try {
      const rows = await fetchPages<unknown>((from, to) =>
        supabase
          .from('active_shop_vibe_tags')
          .select('shop_id, tag_id, slug, label')
          .order('tag_id')
          .order('shop_id')
          .range(from, to),
      )
      if (!isCurrent()) return
      vibes.value = parseVibeRows(rows)
      vibesStatus.value = 'ready'
    } catch {
      if (!isCurrent()) return
      vibes.value = []
      vibesStatus.value = 'error'
    }
  }

  const reviewSummary = (days: number): ReviewSummary => summarizeReviews(reviews.value, days)

  return {
    checkinGrid,
    trafficGrid,
    reviews,
    reviewsReady,
    vibes,
    vibesStatus,
    loadCheckinHourly,
    loadTrafficHourly,
    loadReviews,
    loadVibes,
    reviewSummary,
  }
}
