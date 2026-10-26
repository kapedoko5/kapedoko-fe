import type { Cafe, LatLng } from '~/types/cafe'
import type { GeoBounds } from '~/utils/geography'
import { fetchApprovedCafeById, fetchApprovedCafes, hydrateCafeDetail } from '~/utils/approved-shops'
import {
  boundsContain,
  boundsFromRadius,
  clampQueryBounds,
  padBounds,
} from '~/utils/geography'
import {
  SEARCH_RADIUS_M,
  VIEWPORT_FETCH_LIMIT,
  VIEWPORT_QUERY_MAX_RADIUS_M,
  distanceMeters,
} from '~/utils/geo'
import { suggestCafes } from '~/utils/cafe-search'

const VIEWPORT_PAD = 0.35
const VIEWPORT_DEBOUNCE_MS = 280
const SEARCH_DEBOUNCE_MS = 180

export function useMapCafes() {
  const supabase = useSupabaseClient()
  const config = useRuntimeConfig()
  const { upsertCafe } = useApprovedShops()
  const cache = ref(new Map<string, Cafe>())
  const viewBounds = ref<GeoBounds | null>(null)
  const nearbyCafes = ref<Cafe[]>([])
  const suggestions = ref<Cafe[]>([])
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const error = ref('')

  let fetchedBounds: GeoBounds | null = null
  let viewportTimer: ReturnType<typeof window.setTimeout> | null = null
  let searchTimer: ReturnType<typeof window.setTimeout> | null = null
  let viewportSeq = 0
  let nearbySeq = 0
  let searchSeq = 0

  const publicBase = () => String(config.public.r2PublicBaseUrl || '')

  const remember = (cafes: Cafe[], mode: 'merge' | 'replace' = 'merge') => {
    if (!cafes.length) return
    const next = new Map(cache.value)
    let changed = false
    for (const cafe of cafes) {
      const prev = next.get(cafe.id)
      const merged = prev && mode === 'merge'
        ? {
            ...cafe,
            reviews: cafe.reviews.length ? cafe.reviews : prev.reviews,
            wifiInsight: cafe.wifiInsight ?? prev.wifiInsight,
            plugInsight: cafe.plugInsight ?? prev.plugInsight,
            matchaInsight: cafe.matchaInsight ?? prev.matchaInsight,
            busyness: cafe.busyness ?? prev.busyness,
            checkIns30d: cafe.checkIns30d || prev.checkIns30d,
          }
        : cafe
      if (
        prev
        && prev.lat === merged.lat
        && prev.lng === merged.lng
        && prev.name === merged.name
        && prev.status === merged.status
        && prev.markerTier === merged.markerTier
        && prev.image === merged.image
        && prev.reviews === merged.reviews
        && prev.busyness === merged.busyness
        && prev.checkIns30d === merged.checkIns30d
        && prev.wifiInsight === merged.wifiInsight
      ) {
        continue
      }
      next.set(cafe.id, merged)
      changed = true
    }
    if (changed) cache.value = next
  }

  const cafeById = (id: string | null) => (id ? cache.value.get(id) ?? null : null)

  const hydrateCafe = async (id: string) => {
    const current = cafeById(id)
    try {
      const base = current ?? await fetchApprovedCafeById(supabase, publicBase(), id)
      if (!base) return current
      const detailed = await hydrateCafeDetail(supabase, base)
      remember([detailed], 'replace')
      upsertCafe(detailed)
      return detailed
    } catch {
      return current
    }
  }

  const viewportCafes = computed(() => [...cache.value.values()])

  const loadNearby = async (origin: LatLng) => {
    const seq = ++nearbySeq
    status.value = 'loading'
    error.value = ''
    try {
      const cafes = await fetchApprovedCafes(supabase, publicBase(), {
        bounds: boundsFromRadius(origin, SEARCH_RADIUS_M),
        limit: VIEWPORT_FETCH_LIMIT,
      })
      if (seq !== nearbySeq) return
      const nearby = cafes.filter((cafe) => distanceMeters(origin, cafe) <= SEARCH_RADIUS_M)
      remember(nearby)
      nearbyCafes.value = nearby
      status.value = 'ready'
    } catch (err) {
      if (seq !== nearbySeq) return
      nearbyCafes.value = []
      status.value = 'error'
      error.value = err instanceof Error ? err.message : 'Could not load cafes.'
    }
  }

  const fetchViewport = async (bounds: GeoBounds, center: LatLng) => {
    const queryBounds = padBounds(
      clampQueryBounds(center, bounds, VIEWPORT_QUERY_MAX_RADIUS_M),
      VIEWPORT_PAD,
    )
    if (fetchedBounds && boundsContain(fetchedBounds, queryBounds)) {
      viewBounds.value = bounds
      return
    }

    const seq = ++viewportSeq
    try {
      const cafes = await fetchApprovedCafes(supabase, publicBase(), {
        bounds: queryBounds,
        limit: VIEWPORT_FETCH_LIMIT,
      })
      if (seq !== viewportSeq) return
      remember(cafes)
      fetchedBounds = queryBounds
      viewBounds.value = bounds
    } catch (err) {
      if (seq !== viewportSeq) return
      error.value = err instanceof Error ? err.message : 'Could not load cafes.'
    }
  }

  const loadViewport = (bounds: GeoBounds, center: LatLng) => {
    viewBounds.value = bounds
    if (viewportTimer) window.clearTimeout(viewportTimer)
    viewportTimer = window.setTimeout(() => {
      viewportTimer = null
      void fetchViewport(bounds, center)
    }, VIEWPORT_DEBOUNCE_MS)
  }

  const searchCafes = (query: string, origin?: LatLng | null) => {
    if (searchTimer) window.clearTimeout(searchTimer)
    const term = query.trim()
    if (!term) {
      suggestions.value = []
      return
    }
    searchTimer = window.setTimeout(() => {
      searchTimer = null
      const seq = ++searchSeq
      void fetchApprovedCafes(supabase, publicBase(), {
        query: term,
        limit: 8,
      })
        .then((cafes) => {
          if (seq !== searchSeq) return
          remember(cafes)
          suggestions.value = suggestCafes(cafes, term, origin)
        })
        .catch(() => {
          if (seq !== searchSeq) return
          suggestions.value = []
        })
    }, SEARCH_DEBOUNCE_MS)
  }

  onBeforeUnmount(() => {
    if (viewportTimer) window.clearTimeout(viewportTimer)
    if (searchTimer) window.clearTimeout(searchTimer)
  })

  return {
    viewportCafes,
    nearbyCafes,
    suggestions,
    status,
    error,
    cafeById,
    remember,
    hydrateCafe,
    loadNearby,
    loadViewport,
    searchCafes,
  }
}
