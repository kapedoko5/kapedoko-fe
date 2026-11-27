import type { Cafe, LatLng } from '~/types/cafe'
import { cafeMatchesFilter, filterCafes, type CafeFilterId } from '~/utils/cafe-filters'
import {
  CAFE_FEED_PAGE_SIZE,
  cafeFeedMode,
  LOCATION_WAIT_MS,
  rankShopsByDistance,
  slicePage,
  type CafeFeedMode,
} from '~/utils/cafe-feed'
import {
  countApprovedShops,
  fetchApprovedCafePage,
  fetchApprovedCafesByIds,
  fetchApprovedShopPoints,
  fetchFilterShopIds,
  fetchVibeShopIds,
} from '~/utils/approved-shops'
import { cafeHasAnyVibe } from '~/utils/vibe-day'
import { boundsFromRadius } from '~/utils/geography'

interface FeedRequest {
  filter: CafeFilterId
  query: string
  origin: LatLng | null
  radiusMeters: number
  nearby: boolean
  vibeTagIds: string[]
  mode: CafeFeedMode
}

/**
 * Home and search lists. Nearby loads the radius and ranks it, then hydrates
 * one page. Without a location, each scroll asks for the next page.
 */
export function useCafeFeed(input: {
  filter: Ref<CafeFilterId>
  query: Ref<string>
  origin: Ref<LatLng | null>
  radiusMeters: Ref<number>
  nearby: Ref<boolean>
  locationReady: Ref<boolean>
  vibeTagIds?: Ref<string[]>
}) {
  const supabase = useSupabaseClient()
  const config = useRuntimeConfig()
  const { cafes: cachedCafes } = useApprovedShops()

  const cafes = ref<Cafe[]>([])
  const total = ref<number | null>(null)
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('loading')
  const error = ref('')
  const hasMore = ref(false)
  const loadingMore = ref(false)
  const moreError = ref('')
  const settled = ref(false)

  let loadSeq = 0
  let cursor = 0
  let rankedIds: string[] | null = null
  let searchRows: Cafe[] = []
  let settleTimer: ReturnType<typeof setTimeout> | null = null

  const publicBase = () => String(config.public.r2PublicBaseUrl || '')

  const requestOf = (): FeedRequest => {
    const filter = input.filter.value
    const query = input.query.value.trim()
    const origin = input.origin.value
    const nearby = input.nearby.value
    const vibeTagIds = [...(input.vibeTagIds?.value ?? [])].sort()
    return {
      filter,
      query,
      origin,
      radiusMeters: input.radiusMeters.value,
      nearby,
      vibeTagIds,
      mode: cafeFeedMode({ filter, query, origin, nearby, vibe: vibeTagIds.length > 0 }),
    }
  }

  const originKey = (origin: LatLng | null) => (
    origin ? `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}` : 'none'
  )

  const feedKey = computed(() => {
    if (!settled.value && !input.locationReady.value) return ''
    const request = requestOf()
    const radiusKey = request.mode === 'nearby' ? String(request.radiusMeters) : ''
    return [
      request.mode,
      request.filter,
      request.query.toLowerCase(),
      originKey(request.origin),
      radiusKey,
      request.vibeTagIds.join(','),
    ].join('|')
  })

  const applyPatch = (list: Cafe[]) => {
    if (!list.length || !cafes.value.length) return
    const byId = new Map(list.map((cafe) => [cafe.id, cafe]))
    cafes.value = cafes.value.map((cafe) => byId.get(cafe.id) ?? cafe)
  }

  watch(cachedCafes, applyPatch)

  const visibleSearch = (rows: Cafe[], request: FeedRequest) => filterCafes(rows, {
    query: request.query,
    filter: request.filter,
    origin: request.origin,
  }).filter((cafe) => cafeHasAnyVibe(cafe.vibeTags.map((tag) => tag.id), request.vibeTagIds))

  const hydrateIds = async (ids: string[], request: FeedRequest) => {
    const fetched = await fetchApprovedCafesByIds(supabase, publicBase(), ids)
    return fetched.filter((cafe) => cafeMatchesFilter(cafe, request.filter))
  }

  const loadFirst = async (request: FeedRequest, seq: number) => {
    if (request.mode === 'nearby' && request.origin) {
      const points = await fetchApprovedShopPoints(
        supabase,
        boundsFromRadius(request.origin, request.radiusMeters),
      )
      if (seq !== loadSeq) return
      let ranked = rankShopsByDistance(points, request.origin, request.radiusMeters)
      if (request.filter !== 'near') {
        const allowed = new Set(await fetchFilterShopIds(supabase, request.filter))
        if (seq !== loadSeq) return
        ranked = ranked.filter((shop) => allowed.has(shop.id))
      }
      if (request.vibeTagIds.length) {
        const vibed = new Set(await fetchVibeShopIds(supabase, request.vibeTagIds))
        if (seq !== loadSeq) return
        ranked = ranked.filter((shop) => vibed.has(shop.id))
      }
      rankedIds = ranked.map((shop) => shop.id)
      const slice = slicePage(rankedIds, 0)
      const page = await hydrateIds(slice.page, request)
      if (seq !== loadSeq) return
      cursor = slice.nextOffset
      cafes.value = page
      total.value = rankedIds.length
      hasMore.value = slice.hasMore
      return
    }

    if (request.mode === 'filter') {
      if (request.filter === 'near') {
        rankedIds = await fetchVibeShopIds(supabase, request.vibeTagIds)
      } else {
        rankedIds = await fetchFilterShopIds(supabase, request.filter)
        if (request.vibeTagIds.length) {
          const vibed = new Set(await fetchVibeShopIds(supabase, request.vibeTagIds))
          rankedIds = rankedIds.filter((id) => vibed.has(id))
        }
      }
      if (seq !== loadSeq) return
      const slice = slicePage(rankedIds, 0)
      const page = await hydrateIds(slice.page, request)
      if (seq !== loadSeq) return
      cursor = slice.nextOffset
      cafes.value = page
      total.value = rankedIds.length
      hasMore.value = slice.hasMore
      return
    }

    rankedIds = null
    searchRows = []
    const counted = request.mode === 'browse' || request.filter === 'near'
      ? countApprovedShops(supabase, { query: request.query }).catch(() => null)
      : Promise.resolve(null)

    let offset = 0
    let more = true
    let guard = 0
    while (guard < 6 && more && (request.mode === 'browse' || cafes.value.length < CAFE_FEED_PAGE_SIZE)) {
      const page = await fetchApprovedCafePage(supabase, publicBase(), {
        offset,
        limit: CAFE_FEED_PAGE_SIZE,
        query: request.query,
      })
      if (seq !== loadSeq) return
      offset += page.cafes.length
      more = page.hasMore && page.cafes.length > 0
      if (request.mode === 'search') {
        searchRows = [...searchRows, ...page.cafes]
        cafes.value = visibleSearch(searchRows, request)
      } else {
        cafes.value = [...cafes.value, ...page.cafes]
      }
      guard += 1
      if (!page.cafes.length) break
      if (request.mode === 'browse') break
    }

    if (seq !== loadSeq) return
    cursor = offset
    total.value = await counted
    if (seq !== loadSeq) return
    hasMore.value = more
  }

  const loadNext = async (request: FeedRequest, seq: number) => {
    if (rankedIds) {
      const slice = slicePage(rankedIds, cursor)
      const page = await hydrateIds(slice.page, request)
      if (seq !== loadSeq) return
      cursor = slice.nextOffset
      cafes.value = [...cafes.value, ...page]
      hasMore.value = slice.hasMore
      return
    }

    const page = await fetchApprovedCafePage(supabase, publicBase(), {
      offset: cursor,
      limit: CAFE_FEED_PAGE_SIZE,
      query: request.query,
    })
    if (seq !== loadSeq) return
    cursor += page.cafes.length
    if (request.mode === 'search') {
      searchRows = [...searchRows, ...page.cafes]
      cafes.value = visibleSearch(searchRows, request)
    } else {
      cafes.value = [...cafes.value, ...page.cafes]
    }
    hasMore.value = page.hasMore && page.cafes.length > 0
  }

  const reload = async () => {
    const seq = ++loadSeq
    loadingMore.value = false
    const request = requestOf()
    cursor = 0
    rankedIds = null
    searchRows = []
    hasMore.value = false
    moreError.value = ''
    error.value = ''
    total.value = null
    cafes.value = []
    status.value = 'loading'

    try {
      await loadFirst(request, seq)
      if (seq !== loadSeq) return
      status.value = 'ready'
    } catch (err) {
      if (seq !== loadSeq) return
      cafes.value = []
      hasMore.value = false
      status.value = 'error'
      error.value = err instanceof Error ? err.message : 'Could not load coffee shops.'
    }
  }

  const loadMore = async () => {
    if (loadingMore.value || status.value !== 'ready' || !hasMore.value || moreError.value) return
    const seq = loadSeq
    const request = requestOf()
    loadingMore.value = true
    try {
      await loadNext(request, seq)
    } catch (err) {
      if (seq !== loadSeq) return
      moreError.value = err instanceof Error ? err.message : 'Could not load more shops.'
    } finally {
      if (seq === loadSeq) loadingMore.value = false
    }
  }

  const retryMore = () => {
    moreError.value = ''
    void loadMore()
  }

  watch(input.locationReady, (ready) => {
    if (!import.meta.client) return
    if (ready) {
      settled.value = true
      if (settleTimer) {
        clearTimeout(settleTimer)
        settleTimer = null
      }
      return
    }
    if (settled.value || settleTimer) return
    settleTimer = setTimeout(() => {
      settleTimer = null
      settled.value = true
    }, LOCATION_WAIT_MS)
  }, { immediate: true })

  watch(feedKey, (key) => {
    if (!import.meta.client || !key) return
    void reload()
  }, { immediate: true })

  const sentinel = ref<HTMLElement | null>(null)
  let observer: IntersectionObserver | null = null
  let filling = false

  const sentinelInView = () => {
    const el = sentinel.value
    if (!el) return false
    const rect = el.getBoundingClientRect()
    return rect.height > 0 && rect.top <= window.innerHeight + 140
  }

  const fill = async () => {
    if (filling || !hasMore.value || moreError.value) return
    filling = true
    let guard = 0
    while (guard < 4 && hasMore.value && !moreError.value && sentinelInView()) {
      await loadMore()
      guard += 1
      await nextTick()
    }
    filling = false
  }

  const attach = () => {
    observer?.disconnect()
    observer = null
    const el = sentinel.value
    if (!el || !import.meta.client) return
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void fill()
    }, { rootMargin: '160px' })
    observer.observe(el)
    void fill()
  }

  watch(sentinel, attach)

  onBeforeUnmount(() => {
    if (settleTimer) clearTimeout(settleTimer)
    observer?.disconnect()
  })

  return {
    cafes,
    total,
    status,
    error,
    hasMore,
    loadingMore,
    moreError,
    sentinel,
    refresh: reload,
    loadMore,
    retryMore,
  }
}
