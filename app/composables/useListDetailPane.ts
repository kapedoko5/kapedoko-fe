import { onIonViewWillLeave } from '@ionic/vue'
import type { Cafe } from '~/types/cafe'
import type { ActiveEventRow, KapeEvent } from '~/types/event'
import {
  ANALYTICS_EVENTS,
  confidenceBucketFromStatus,
  detailViewKey,
  rememberDetailSource,
  takeDetailSource,
  type DetailSource,
} from '~/utils/analytics'
import { fetchApprovedCafeById, hydrateCafeDetail, isShopId } from '~/utils/approved-shops'
import { isEventId, mapActiveEvent } from '~/utils/events'
import { usesDetailPane } from '~/utils/viewport-layout'

const EVENT_DETAIL_COLUMNS = 'id, name, organizer_name, organizer_contact_name, organizer_contact_number, description, address, latitude, longitude, event_starts_at, event_ends_at, display_starts_at, display_ends_at, poster_object_key, gallery_object_keys'

export function useListDetailPane(defaultSource: DetailSource) {
  const { size, compact } = useViewportLayout()
  const supabase = useSupabaseClient()
  const config = useRuntimeConfig()
  const { track, once } = useAnalytics()

  const cafe = ref<Cafe | null>(null)
  const event = ref<KapeEvent | null>(null)
  const dismissing = ref(false)
  let cafeSeq = 0
  let eventSeq = 0

  const paneDocked = computed(() => usesDetailPane(size.value) && Boolean(cafe.value || event.value))
  const paneOpen = computed(() => paneDocked.value && !dismissing.value)
  const publicBase = () => String(config.public.r2PublicBaseUrl || '')

  const clear = () => {
    dismissing.value = false
    cafe.value = null
    event.value = null
  }

  const close = (immediate = false) => {
    if (immediate || !paneDocked.value) {
      clear()
      return
    }
    dismissing.value = true
  }

  const afterLeave = () => {
    clear()
  }

  const trackCafe = (next: Cafe, source: DetailSource) => {
    if (!once(detailViewKey(next.id))) return
    track(ANALYTICS_EVENTS.CAFE_DETAIL_VIEWED, {
      cafe_id: next.id,
      wifi_confidence: confidenceBucketFromStatus(next.work.wifiStatus),
      outlet_confidence: confidenceBucketFromStatus(next.work.outletsStatus),
      source: takeDetailSource(source),
    })
  }

  const openCafe = async (id: string, fallback?: Cafe | null, source = defaultSource) => {
    rememberDetailSource(source)
    if (!usesDetailPane(size.value)) {
      close(true)
      await navigateTo(`/app/cafes/${id}`)
      return
    }
    dismissing.value = false
    event.value = null
    if (fallback && fallback.id === id) cafe.value = fallback
    if (!isShopId(id)) return
    const seq = ++cafeSeq
    try {
      const base = await fetchApprovedCafeById(supabase, publicBase(), id)
      const next = base
        ? await hydrateCafeDetail(supabase, base).catch(() => base)
        : fallback ?? null
      if (seq !== cafeSeq) return
      cafe.value = next
      if (next) trackCafe(next, source)
    } catch {
      if (seq !== cafeSeq) return
      if (!cafe.value && fallback?.id === id) cafe.value = fallback
    }
  }

  const openEvent = async (id: string, fallback?: KapeEvent | null) => {
    if (!usesDetailPane(size.value)) {
      close(true)
      await navigateTo(`/app/events/${id}`)
      return
    }
    dismissing.value = false
    cafe.value = null
    if (fallback && fallback.id === id) event.value = fallback
    if (!isEventId(id)) return
    const seq = ++eventSeq
    try {
      const { data, error } = await supabase
        .from('active_events')
        .select(EVENT_DETAIL_COLUMNS)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      const next = data ? mapActiveEvent(data as ActiveEventRow, publicBase()) : fallback ?? null
      if (seq !== eventSeq) return
      event.value = next
    } catch {
      if (seq !== eventSeq) return
      if (!event.value && fallback?.id === id) event.value = fallback
    }
  }

  const onReview = async () => {
    const id = cafe.value?.id
    if (!id) return
    await navigateTo(`/app/cafes/${id}/review`)
  }

  const onCheckIn = async () => {
    const id = cafe.value?.id
    if (!id) return
    await navigateTo(`/app/cafes/${id}/check-in`)
  }

  watch(compact, (isCompact, wasCompact) => {
    if (!isCompact || wasCompact !== false) return
    const cafeId = cafe.value?.id
    const eventId = event.value?.id
    close(true)
    if (cafeId) void navigateTo(`/app/cafes/${cafeId}`)
    else if (eventId) void navigateTo(`/app/events/${eventId}`)
  })

  onIonViewWillLeave(() => {
    close(true)
  })

  return {
    cafe,
    event,
    paneOpen,
    paneDocked,
    openCafe,
    openEvent,
    close,
    afterLeave,
    onReview,
    onCheckIn,
  }
}
