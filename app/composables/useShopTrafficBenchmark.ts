import { createRequestGuard } from '~/utils/request-guard'
import { trafficRangeWindow } from '~/utils/shop-traffic'
import { parseBenchmark, type BenchmarkRow } from '~/utils/traffic-benchmark'

/**
 * Peer benchmark for one cafe. Quiet by design: if the RPC is missing, the
 * caller is not allowed, or no group has 5 cafes, `rows` stays empty and the
 * card is simply not shown.
 */
export function useShopTrafficBenchmark() {
  const supabase = useSupabaseClient()
  const rows = ref<BenchmarkRow[]>([])
  const guard = createRequestGuard()

  const load = async (shopId: string, days: number) => {
    const isCurrent = guard.next()
    const window = trafficRangeWindow(days)
    try {
      const { data, error } = await supabase.rpc('shop_traffic_benchmark', {
        p_shop_id: shopId,
        p_from: window.from,
        p_to: window.to,
      })
      if (!isCurrent()) return
      rows.value = error ? [] : parseBenchmark(data)
    } catch {
      if (!isCurrent()) return
      rows.value = []
    }
  }

  const clear = () => {
    guard.next()
    rows.value = []
  }

  return { rows, load, clear }
}
