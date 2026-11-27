import { createRequestGuard } from '~/utils/request-guard'
import {
  parseAdStats,
  summarizeAdStats,
  type AdPlacementSummary,
  type AdStatRow,
} from '~/utils/ad-attribution'
import { isMissingRpcError, trafficRangeWindow } from '~/utils/shop-traffic'

type AdStatsDatabase = {
  public: {
    Tables: {
      ad_campaign_events: {
        Row: { placement: string, kind: string, shop_id: string | null, created_at: string }
      }
    }
    Functions: {
      ad_campaign_stats: {
        Args: { p_from: string, p_to: string }
        Returns: Array<{
          campaign_id: string | null
          shop_id: string | null
          placement: string
          label: string | null
          impressions: number
          clicks: number
        }>
      }
    }
  }
}

/**
 * Campaign attribution (banner vs featured). Every load degrades quietly:
 * when the RPC or table is not deployed, `available` stays false and the UI
 * hides the section instead of showing an error.
 */
export function useAdCampaignStats() {
  const supabase = useSupabaseClient<AdStatsDatabase>()
  const rows = ref<AdStatRow[]>([])
  const summary = ref<AdPlacementSummary | null>(null)
  const available = ref(false)
  const guard = createRequestGuard()

  const loadAdmin = async (days: number, shopId?: string) => {
    const isCurrent = guard.next()
    const window = trafficRangeWindow(days)
    try {
      const { data, error } = await supabase.rpc('ad_campaign_stats', {
        p_from: window.from,
        p_to: window.to,
      })
      if (!isCurrent()) return
      if (error) throw error
      const parsed = parseAdStats(data)
      rows.value = shopId ? parsed.filter((row) => row.shopId === shopId) : parsed
      summary.value = summarizeAdStats(rows.value)
      available.value = true
    } catch (err) {
      if (!isCurrent()) return
      rows.value = []
      summary.value = null
      available.value = false
      if (!isMissingRpcError(err)) console.warn('Ad stats unavailable')
    }
  }

  /** Owners read only the featured rows of cafes they manage (RLS). */
  const loadOwnerFeatured = async (shopIds: string[], days: number) => {
    const isCurrent = guard.next()
    if (shopIds.length === 0) {
      summary.value = null
      available.value = false
      return
    }
    const window = trafficRangeWindow(days)
    const from = `${window.from}T00:00:00+08:00`
    const count = async (kind: 'impression' | 'click') => {
      const { count: total, error } = await supabase
        .from('ad_campaign_events')
        .select('kind', { count: 'exact', head: true })
        .eq('placement', 'featured')
        .eq('kind', kind)
        .in('shop_id', shopIds)
        .gte('created_at', from)
      if (error) throw error
      return total ?? 0
    }
    try {
      const [impressions, clicks] = await Promise.all([count('impression'), count('click')])
      if (!isCurrent()) return
      const featured = { impressions, clicks, ctr: impressions > 0 ? clicks / impressions : null }
      summary.value = { banner: { impressions: 0, clicks: 0, ctr: null }, featured }
      available.value = true
    } catch {
      if (!isCurrent()) return
      summary.value = null
      available.value = false
    }
  }

  return { rows, summary, available, loadAdmin, loadOwnerFeatured }
}
