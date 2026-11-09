import type { Cafe } from '~/types/cafe'
import { fetchApprovedCafes } from '~/utils/approved-shops'

export function useApprovedShops() {
  const supabase = useSupabaseClient()
  const config = useRuntimeConfig()
  const cafes = useState<Cafe[]>('approved-cafes', () => [])
  const source = useState<'live' | 'error'>('approved-cafes-source', () => 'live')
  const status = useState<'idle' | 'loading' | 'ready' | 'error'>('approved-cafes-status', () => 'idle')
  const error = useState('approved-cafes-error', () => '')
  let loadSeq = 0

  const publicBase = () => String(config.public.r2PublicBaseUrl || '')

  const refresh = async () => {
    const seq = ++loadSeq
    if (status.value !== 'ready') status.value = 'loading'
    error.value = ''

    try {
      const next = await fetchApprovedCafes(supabase, publicBase())
      if (seq !== loadSeq) return
      cafes.value = next
      source.value = 'live'
      status.value = 'ready'
    } catch (err) {
      if (seq !== loadSeq) return
      error.value = err instanceof Error ? err.message : 'Could not load cafes.'
      if (status.value === 'ready') return
      cafes.value = []
      source.value = 'error'
      status.value = 'error'
    }
  }

  /**
   * Shared cache for cafe pages and the map. The home and search lists page
   * their own feeds; opening the app must not download the whole catalog.
   */
  const upsertCafe = (next: Cafe) => {
    const index = cafes.value.findIndex((cafe) => cafe.id === next.id)
    if (index === -1) {
      cafes.value = [...cafes.value, next]
      return
    }
    const prev = cafes.value[index]!
    cafes.value = cafes.value.map((cafe, cafeIndex) => (
      cafeIndex === index
        ? {
            ...prev,
            ...next,
            work: next.work,
            amenities: next.amenities,
            payment: next.payment ?? prev.payment,
            wifiInsight: next.wifiInsight ?? prev.wifiInsight,
            plugInsight: next.plugInsight ?? prev.plugInsight,
            matchaInsight: next.matchaInsight ?? prev.matchaInsight,
            reviews: next.reviews.length ? next.reviews : prev.reviews,
            busyness: next.busyness ?? prev.busyness,
            checkIns30d: next.checkIns30d || prev.checkIns30d,
          }
        : cafe
    ))
  }

  return { cafes, source, status, error, refresh, upsertCafe }
}
