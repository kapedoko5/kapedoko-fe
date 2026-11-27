<template>
  <IonPage>
    <IonContent class="home-content">
      <div class="home" :class="{ 'has-detail': paneDocked }">
        <div class="home-plate">
        <header class="home-chrome">
          <div class="home-chrome__greeting">
            <p class="home-chrome__hello">{{ greeting }}</p>
            <p v-if="firstName" class="home-chrome__name">{{ firstName }}</p>
          </div>
          <img
            src="/assets/kapedoko-horizontal-text_dark.png"
            alt="kapé DOKO"
            width="168"
            height="36"
            class="home-chrome__wordmark"
          />
        </header>

          <form class="home-search" @submit.prevent="submitSearch">
            <label class="home-search__field">
              <Search :size="18" :stroke-width="2.25" aria-hidden="true" />
              <span class="sr-only">Search a coffee shop</span>
              <input
                v-model="query"
                type="search"
                name="q"
                placeholder="Search a coffee shop"
                autocomplete="off"
                enterkeyhint="search"
              />
            </label>
          </form>

        <section
          v-if="homeBanners.length > 0"
          class="home-partners"
          aria-label="Featured banners"
        >
          <div
            ref="bannerTrack"
            class="home-partners__track"
            role="list"
            aria-roledescription="carousel"
            @pointerenter="holdBannerSwipe"
            @pointerleave="releaseBannerSwipe"
            @pointerdown="bumpBannerSwipe"
            @scroll.passive="onBannerScroll"
            @scrollend.passive="onBannerScrollEnd"
          >
            <button
              v-for="ad in homeBanners"
              :key="ad.id"
              type="button"
              class="home-partners__card"
              :class="[
                'home-partners__card--sponsored',
                { 'home-partners__card--bleed': ad.bleed },
              ]"
              role="listitem"
              :aria-label="ad.ariaLabel"
              :ref="(el) => bindPromoEl(ad.id, el)"
              @click="openPromotion(ad)"
            >
              <span class="home-partners__media">
                <img
                  class="home-partners__image"
                  :src="ad.image"
                  alt=""
                  :width="ad.bleed ? 1920 : 320"
                  :height="ad.bleed ? 640 : 150"
                />
              </span>
            </button>
          </div>
        </section>

        <div class="home-filters" role="tablist" aria-label="Cafe filters">
          <button
            v-for="filter in filters"
            :key="filter.id"
            type="button"
            role="tab"
            class="home-filters__chip"
            :class="{ 'is-active': activeFilter === filter.id }"
            :aria-selected="activeFilter === filter.id"
            @click="setFilter(filter.id)"
          >
            <component :is="filterIcons[filter.icon]" :size="14" :stroke-width="2.25" aria-hidden="true" />
            {{ filter.label }}
          </button>
        </div>

        <section
          v-if="featuredCafes.length > 0"
          class="home-partners"
          aria-labelledby="home-featured-cafes-title"
        >
          <h2 id="home-featured-cafes-title" class="home-partners__title">Our featured cafes</h2>
          <div class="home-partners__track" role="list">
            <button
              v-for="ad in featuredCafes"
              :key="ad.id"
              type="button"
              class="home-partners__card home-partners__card--cafe"
              :class="ad.kind === 'promoted' ? 'home-partners__card--sponsored' : 'home-partners__card--partner'"
              role="listitem"
              :aria-label="ad.ariaLabel"
              :ref="(el) => bindPromoEl(ad.id, el)"
              @click="openPromotion(ad)"
            >
              <span class="home-partners__media">
                <img
                  class="home-partners__image"
                  :src="ad.image"
                  alt=""
                  width="120"
                  height="120"
                />
                <span v-if="ad.badge" class="home-partners__badge">{{ ad.badge }}</span>
              </span>
              <span class="home-partners__copy" aria-hidden="true">
                <span class="home-partners__name">{{ ad.name }}</span>
                <span v-if="ad.place" class="home-partners__place">{{ ad.place }}</span>
                <span v-if="ad.wifi || ad.outlets || ad.vibeTags.length" class="home-partners__facts">
                  <span v-if="ad.wifi" class="home-partners__amenity">
                    <Wifi :size="12" :stroke-width="2.25" />
                    WiFi
                  </span>
                  <span v-if="ad.outlets" class="home-partners__amenity">
                    <Plug :size="12" :stroke-width="2.25" />
                    Outlets
                  </span>
                  <span
                    v-for="tag in ad.vibeTags"
                    :key="tag.id"
                    class="home-partners__vibe"
                    :style="vibeTagColorStyle(tag.color)"
                  >
                    <component :is="vibeTagLucideComponent(tag.lucideIcon)" :size="11" :stroke-width="2.25" />
                    {{ tag.label }}
                  </span>
                </span>
              </span>
            </button>
          </div>
        </section>

        <section
          v-if="nearbyEvents.length > 0"
          class="home-events"
          aria-label="Kape Events near you"
        >
          <h2 class="home-events__title">Kape Events near you</h2>
          <div class="home-events__track" role="list">
            <button
              v-for="(item, index) in nearbyEvents"
              :key="item.id"
              type="button"
              class="home-events__card"
              :class="{ 'is-selected': item.id === detailEvent?.id }"
              role="listitem"
              :aria-label="eventCardLabel(item, index)"
              @click="openEvent(item.id)"
            >
              <span class="home-events__poster">
                <img
                  class="home-events__image"
                  :src="item.poster"
                  :alt="`${item.name} poster`"
                  width="320"
                  height="120"
                />
              </span>
              <span class="home-events__copy">
                <span class="home-events__name">{{ item.name }}</span>
                <span class="home-events__when">{{ item.whenLabel }}</span>
                <span v-if="eventDistance(item)" class="home-events__distance">{{ eventDistance(item) }}</span>
              </span>
            </button>
          </div>
        </section>

        <p v-if="status === 'ready'" class="home-state">
          <component :is="filterIcons[activeFilterMeta.icon]" :size="14" :stroke-width="2.25" aria-hidden="true" />
          <span>{{ activeFilterMeta.label }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ shopCountLabel }}</span>
          <template v-if="locationNote">
            <span aria-hidden="true">·</span>
            <span>{{ locationNote }}</span>
          </template>
        </p>
        <div v-if="vibeIds.length" class="home-vibes" role="group" aria-label="Today's vibe">
          <span class="home-vibes__lead">Today's vibe</span>
          <button
            type="button"
            class="home-vibes__chip"
            v-for="tag in pickedVibes"
            :key="tag.id"
            :style="vibeTagColorStyle(tag.color)"
            @click="openVibeModal"
          >
            <component :is="vibeTagLucideComponent(tag.lucide_icon)" :size="13" :stroke-width="2.25" aria-hidden="true" />
            {{ tag.label }}
          </button>
          <button type="button" class="home-vibes__clear" @click="clearVibes">Clear</button>
        </div>
        <div v-if="showNearbyTicket" class="home-aside">
          <p v-if="amenityHint" class="home-state home-state--note">{{ amenityHint }}</p>
          <button
            type="button"
            class="home-ticket"
            :class="{ 'is-on': nearbyOn, 'is-busy': nearbyBusy }"
            :aria-pressed="nearbyOn"
            :aria-busy="nearbyBusy"
            @click="toggleNearby"
          >
            <span class="home-ticket__seal" aria-hidden="true">
              <Navigation :size="16" :stroke-width="2.25" />
            </span>
            <span class="home-ticket__copy">
              <span class="home-ticket__title">{{ nearbyTitle }}</span>
              <span class="home-ticket__detail">{{ nearbyDetail }}</span>
            </span>
          </button>
        </div>

        <Transition name="cafe-list" mode="out-in">
          <section :key="listKey" class="home-list" aria-label="Cafes">
            <div v-if="status === 'idle' || status === 'loading'" class="home-skeletons" aria-busy="true">
              <p class="sr-only">Loading coffee shops…</p>
              <span class="home-skeleton" />
              <span class="home-skeleton" />
              <span class="home-skeleton" />
            </div>
            <p v-else-if="status === 'error'" class="home-empty">
              <CircleAlert :size="18" :stroke-width="2.25" aria-hidden="true" />
              <span>{{ error || 'Could not load coffee shops.' }}</span>
              <button type="button" class="home-retry" @click="refresh">
                <RefreshCw :size="16" :stroke-width="2.25" aria-hidden="true" />
                Try again
              </button>
            </p>
            <p v-else-if="pagedCafes.length === 0 && !hasMoreCafes" class="home-empty">
              <Coffee :size="18" :stroke-width="2.25" aria-hidden="true" />
              <span>{{ emptyCopy }}</span>
            </p>

            <CafeCard
              v-for="(cafe, index) in pagedCafes"
              :key="cafe.id"
              :cafe="cafe"
              :selected="cafe.id === detailCafe?.id"
              :distance-label="distanceLabel(cafe)"
              :style="{ '--enter': String(index % 12) }"
              surface="home"
              @select="openCafe"
            />
            <p v-if="moreError" class="home-more">
              <span>{{ moreError }}</span>
              <button type="button" @click="retryMore">Try again</button>
            </p>
            <p v-else-if="hasMoreCafes" ref="moreCafes" class="home-more">
              {{ loadingMore ? 'Loading more shops…' : 'Scroll for more' }}
            </p>
            <button
              v-if="status === 'ready'"
              type="button"
              class="home-spot"
              @click="addCafe"
            >
              <span class="home-spot__mark" aria-hidden="true">
                <Plus :size="18" :stroke-width="2.25" />
              </span>
              <span class="home-spot__copy">
                <span class="home-spot__title">Know a shop we missed?</span>
                <span class="home-spot__action">Add a cafe</span>
              </span>
            </button>
          </section>
        </Transition>
        </div>
      </div>
      <AppDetailPane
        :open="paneOpen"
        :label="detailCafe?.name || detailEvent?.name || 'Details'"
        @close="closeDetail"
        @after-leave="afterLeave"
      >
        <CafeDetailContent
          v-if="detailCafe"
          :key="detailCafe.id"
          :cafe="detailCafe"
          variant="sheet"
          @review="onReview"
          @checkin="onCheckIn"
        />
        <EventDetailContent
          v-else-if="detailEvent"
          :key="detailEvent.id"
          :event="detailEvent"
          variant="sheet"
        />
      </AppDetailPane>
    </IonContent>
  </IonPage>
</template>

<script lang="ts" setup>
import { Capacitor } from '@capacitor/core'
import { onIonViewDidLeave, onIonViewWillEnter } from '@ionic/vue'
import { BatteryCharging, CircleAlert, Coffee, Flame, Hourglass, Navigation, Plug, Plus, RefreshCw, Search, Wifi, Zap } from 'lucide-vue-next'
import AppDetailPane from '~/components/AppDetailPane.vue'
import CafeCard from '~/components/cafe/CafeCard.vue'
import CafeDetailContent from '~/components/cafe/CafeDetailContent.vue'
import EventDetailContent from '~/components/event/EventDetailContent.vue'
import type { Cafe } from '~/types/cafe'
import type { AdDestinationKind } from '~/types/admin'
import { adBannerIsBleed, featuredAdCopy, featuredCafeSignals, parseInternalAdPath } from '~/utils/admin-ads'
import { vibeTagColorStyle, vibeTagLucideComponent } from '~/utils/admin-vibe-tags'
import { watchImpression } from '~/utils/analytics-impression'
import { CARD_IMPRESSION_MS, CARD_IMPRESSION_RATIO } from '~/utils/shop-traffic'
import { CAFE_FILTERS, type CafeFilterIcon, type CafeFilterId } from '~/utils/cafe-filters'
import { feedCountLabel } from '~/utils/cafe-feed'
import { fetchPlacementCafes } from '~/utils/approved-shops'
import { EVENT_NEARBY_RADIUS_M, eventsWithinMeters } from '~/utils/events'
import type { KapeEvent } from '~/types/event'
import { amenityFilterHint } from '~/utils/amenity-status'
import { displayNameFromAuthUser } from '~/utils/auth'
import { distanceMeters, formatDistance } from '~/utils/geo'

useAppTabBar('show')
const {
  cafe: detailCafe,
  event: detailEvent,
  paneOpen,
  paneDocked,
  openCafe: openCafePane,
  openEvent: openEventPane,
  close: closeDetail,
  afterLeave,
  onReview,
  onCheckIn,
} = useListDetailPane('home')

const filterIcons: Record<CafeFilterIcon, typeof Navigation> = {
  navigation: Navigation,
  flame: Flame,
  wifi: Wifi,
  plug: Plug,
  hourglass: Hourglass,
  zap: Zap,
  'battery-charging': BatteryCharging,
}

const filters = CAFE_FILTERS

const { ads: liveAds } = useActiveAds()
const { events: activeEvents } = useActiveEvents()
const { status: locationStatus, location, usingFallback, requestLocation } = useDeviceLocation()
const { radiusKm: nearbyRadiusKm, radiusMeters, hydrate: hydrateNearbyRadius } = useNearbyRadius()
const { user, loadProfile } = useAuth()
const { consent } = useAnalytics()
const { record } = useShopTrafficCapture()
const supabase = useSupabaseClient()
const runtimeConfig = useRuntimeConfig()
const placementList = ref<Cafe[]>([])

const NEARBY_EMPTY: Record<Exclude<CafeFilterId, 'near'>, string> = {
  popular: 'popular shops',
  wifi: 'WiFi shops',
  plugs: 'shops with plugs',
  'long-stay': 'long-stay WiFi shops',
  'fast-wifi': 'fast WiFi shops',
  'reliable-outlets': 'shops with reliable outlets',
}

const query = ref('')
const submittedQuery = ref('')
const activeFilter = ref<CafeFilterId>('near')
const nearbyUnderFilter = ref(false)
const nearbyBusy = ref(false)
const greeting = ref('Good morning')
const firstName = ref('')

const placementCafes = computed(() => {
  const promoted = placementList.value.filter((cafe) => cafe.markerTier === 'promoted')
  const partners = placementList.value.filter((cafe) => cafe.markerTier === 'partner')
  return [...promoted, ...partners]
})

const homeBanners = computed(() => liveAds.value.map((ad) => {
  const bleed = adBannerIsBleed(ad.label)
  const copy = ad.destinationKind === 'cafe'
    ? featuredAdCopy(ad.name, ad.label)
    : { name: ad.label.trim() || ad.name, place: '' }
  return {
    id: ad.id,
    shopId: ad.shopId,
    name: copy.name,
    place: copy.place,
    image: ad.image,
    badge: '',
    kind: 'ad' as const,
    bleed,
    destinationKind: ad.destinationKind,
    destinationUrl: ad.destinationUrl,
    ariaLabel: copy.place
      ? `Ad: ${copy.name}, ${copy.place}`
      : `Ad: ${copy.name}`,
  }
}))

const featuredCafes = computed(() => placementCafes.value.map((cafe) => {
  const badge = cafe.markerTier === 'promoted' ? 'Sponsored' : 'Partner'
  const signals = featuredCafeSignals(cafe)
  const extras = [
    signals.wifi ? 'WiFi' : '',
    signals.outlets ? 'Outlets' : '',
    ...signals.vibeTags.map((tag) => tag.label),
  ].filter(Boolean)
  return {
    id: cafe.id,
    shopId: cafe.id,
    name: cafe.name,
    place: cafe.address,
    image: '/assets/partner-ad-placeholder.svg',
    badge,
    kind: cafe.markerTier === 'promoted' ? 'promoted' as const : 'partner' as const,
    bleed: false,
    destinationKind: 'cafe' as const,
    destinationUrl: null as string | null,
    wifi: signals.wifi,
    outlets: signals.outlets,
    vibeTags: signals.vibeTags,
    ariaLabel: extras.length ? `${badge}: ${cafe.name}. ${extras.join(', ')}` : `${badge}: ${cafe.name}`,
  }
}))

const firstNameFrom = (value: unknown): string => {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.split(/\s+/)[0] ?? ''
}

const greetingForHour = (hour: number): string => {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const origin = computed(() => (
  locationStatus.value === 'granted' && location.value && !usingFallback.value
    ? location.value
    : null
))

const nearbyEvents = computed(() => eventsWithinMeters(activeEvents.value, origin.value, EVENT_NEARBY_RADIUS_M))

const eventDistance = (event: KapeEvent) => (
  origin.value ? formatDistance(distanceMeters(origin.value, event)) : ''
)

const eventCardLabel = (event: KapeEvent, index: number) => {
  const distance = eventDistance(event)
  const parts = [event.name, event.whenLabel, distance].filter(Boolean)
  return `${parts.join(', ')}, ${index + 1} of ${nearbyEvents.value.length}`
}

const locationReady = computed(() => (
  locationStatus.value === 'granted'
  || locationStatus.value === 'denied'
  || locationStatus.value === 'unavailable'
))

const { tagIds: vibeIds, picked: pickedVibes, hydrate: hydrateVibes, loadCatalog: loadVibeCatalog, clear: clearVibes, openModal: openVibeModal } = useVibeFilter()
hydrateVibes()
void loadVibeCatalog()

const {
  cafes: pagedCafes,
  total: cafeTotal,
  status,
  error,
  hasMore: hasMoreCafes,
  loadingMore,
  moreError,
  sentinel: moreCafes,
  refresh,
  retryMore,
} = useCafeFeed({
  filter: activeFilter,
  query: submittedQuery,
  origin,
  radiusMeters,
  nearby: computed(() => nearbyUnderFilter.value && activeFilter.value !== 'near'),
  locationReady,
  vibeTagIds: vibeIds,
})

const activeFilterMeta = computed(() => filters.find((filter) => filter.id === activeFilter.value) ?? filters[0]!)
const amenityHint = computed(() => amenityFilterHint(activeFilter.value))
const showNearbyTicket = computed(() => status.value === 'ready' && activeFilter.value !== 'near')
const nearbyOn = computed(() => nearbyUnderFilter.value && activeFilter.value !== 'near')

const nearbyTitle = computed(() => {
  const label = activeFilterMeta.value.label
  return nearbyOn.value ? `${label} near you` : `See ${label} near you`
})

const nearbyDetail = computed(() => {
  if (nearbyBusy.value) return 'Finding you…'
  if (locationStatus.value === 'denied') return 'Turn on location'
  if (locationStatus.value === 'unavailable') return 'Location is unavailable'
  if (!origin.value) return 'Uses your location'
  return nearbyOn.value ? 'Closest first' : `Within ${nearbyRadiusKm.value} km`
})

const locationNote = computed(() => {
  const scoped = activeFilter.value === 'near' || nearbyOn.value
  if (!scoped) return ''
  if (locationStatus.value === 'denied') return 'Location is off, so this list is not sorted by distance.'
  if (locationStatus.value === 'unavailable') return 'Location is unavailable, so this list is not sorted by distance.'
  if (origin.value) return `within ${nearbyRadiusKm.value} km`
  return ''
})

const listKey = computed(() => (
  `${activeFilter.value}|${vibeIds.value.join(',')}|${submittedQuery.value}|${nearbyRadiusKm.value}|${origin.value ? 'geo' : 'nogeo'}|${nearbyOn.value ? 'nearby' : 'all'}`
))

const shopCountLabel = computed(() => (
  feedCountLabel(pagedCafes.value.length, cafeTotal.value, hasMoreCafes.value)
))

const emptyCopy = computed(() => {
  const known = cafeTotal.value ?? pagedCafes.value.length
  if (known === 0 && activeFilter.value === 'near' && !origin.value) return 'No coffee shops yet.'
  if (nearbyOn.value && origin.value && activeFilter.value !== 'near') {
    const noun = NEARBY_EMPTY[activeFilter.value]
    return `No ${noun} within ${nearbyRadiusKm.value} km.`
  }
  if (activeFilter.value === 'near' && origin.value) {
    return `No coffee shops within ${nearbyRadiusKm.value} km.`
  }
  if (vibeIds.value.length) return 'No coffee shops match today\'s vibe. Change it or clear it.'
  return 'No coffee shops match that filter.'
})

const distanceLabel = (cafe: Cafe) => {
  if (!origin.value) return undefined
  return formatDistance(distanceMeters(origin.value, cafe))
}

const submitSearch = async () => {
  const next = query.value.trim()
  const path = next ? `/app/search?q=${encodeURIComponent(next)}` : '/app/search'

  await navigateTo(path)
}

const setFilter = (id: CafeFilterId) => {
  if (id === activeFilter.value) return
  activeFilter.value = id
}

const toggleNearby = async () => {
  if (!showNearbyTicket.value || nearbyBusy.value) return
  if (nearbyUnderFilter.value) {
    nearbyUnderFilter.value = false
    return
  }
  if (!origin.value) {
    nearbyBusy.value = true
    try {
      await requestLocation()
    } finally {
      nearbyBusy.value = false
    }
  }
  if (!origin.value) return
  nearbyUnderFilter.value = true
}

const openCafe = async (id: string) => {
  const fallback = pagedCafes.value.find((item) => item.id === id)
    || placementList.value.find((item) => item.id === id)
    || null
  await openCafePane(id, fallback)
}

const openEvent = async (id: string) => {
  const fallback = nearbyEvents.value.find((item) => item.id === id) || null
  await openEventPane(id, fallback)
}

const openPromotion = async (ad: {
  id: string
  shopId: string | null
  kind: 'ad' | 'promoted' | 'partner'
  destinationKind?: AdDestinationKind
  destinationUrl?: string | null
}) => {
  if (ad.shopId) record(ad.shopId, 'card_click', 'promotion')
  if (ad.kind !== 'ad') {
    if (!ad.shopId) return
    const fallback = placementList.value.find((item) => item.id === ad.shopId)
      || pagedCafes.value.find((item) => item.id === ad.shopId)
      || null
    await openCafePane(ad.shopId, fallback, 'promotion')
    return
  }

  const kind = ad.destinationKind ?? 'cafe'
  if (kind === 'cafe' && ad.shopId) {
    const fallback = placementList.value.find((item) => item.id === ad.shopId)
      || pagedCafes.value.find((item) => item.id === ad.shopId)
      || null
    await openCafePane(ad.shopId, fallback, 'promotion')
    return
  }
  if (kind === 'external' && ad.destinationUrl) {
    window.open(ad.destinationUrl, '_blank', 'noopener,noreferrer')
    return
  }
  if (kind === 'internal' && ad.destinationUrl) {
    const parsed = parseInternalAdPath(ad.destinationUrl)
    if (parsed?.type === 'cafe') {
      await openCafePane(parsed.id, null, 'promotion')
      return
    }
    if (parsed?.type === 'event') {
      await openEventPane(parsed.id)
      return
    }
    if (parsed) await navigateTo(ad.destinationUrl)
  }
}

const BANNER_SWIPE_MS = 6000
const bannerTrack = ref<HTMLElement | null>(null)
let bannerTimer: ReturnType<typeof window.setInterval> | null = null
let bannerHold = false
let bannerAnimating = false

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const stopBannerSwipe = () => {
  if (bannerTimer) {
    window.clearInterval(bannerTimer)
    bannerTimer = null
  }
}

const bannerCards = () => {
  const track = bannerTrack.value
  if (!track) return []
  return [...track.querySelectorAll<HTMLElement>(':scope > .home-partners__card')]
}

const advanceBanner = () => {
  const track = bannerTrack.value
  if (!track || bannerHold || prefersReducedMotion()) return
  const cards = bannerCards()
  if (cards.length < 2) return
  const start = cards[0]?.offsetLeft ?? 0
  const next = cards.find((card) => card.offsetLeft - start > track.scrollLeft + 8)
  const atEnd = !next || track.scrollLeft + track.clientWidth >= track.scrollWidth - 8
  bannerAnimating = true
  if (atEnd || !next) {
    track.scrollTo({ left: 0, behavior: 'auto' })
    track.scrollLeft = 0
    window.setTimeout(() => {
      bannerAnimating = false
    }, 50)
    return
  }
  track.scrollTo({
    left: Math.max(0, next.offsetLeft - start),
    behavior: 'smooth',
  })
  window.setTimeout(() => {
    bannerAnimating = false
  }, 700)
}

const startBannerSwipe = () => {
  stopBannerSwipe()
  if (homeBanners.value.length < 2 || prefersReducedMotion() || bannerHold) return
  bannerTimer = window.setInterval(advanceBanner, BANNER_SWIPE_MS)
}

const holdBannerSwipe = () => {
  bannerHold = true
  stopBannerSwipe()
}

const releaseBannerSwipe = () => {
  bannerHold = false
  startBannerSwipe()
}

const bumpBannerSwipe = () => {
  if (bannerHold) return
  startBannerSwipe()
}

const onBannerScroll = () => {
  if (bannerAnimating) return
  bumpBannerSwipe()
}

const onBannerScrollEnd = () => {
  bannerAnimating = false
}

const promoEls = new Map<string, Element>()
const promoStops = new Map<string, () => void>()

const startPromoWatch = (id: string, node: Element) => {
  promoStops.get(id)?.()
  promoStops.delete(id)
  if (consent.value !== 'granted') return
  const ad = homeBanners.value.find((item) => item.id === id)
    ?? featuredCafes.value.find((item) => item.id === id)
  if (!ad) return
  promoStops.set(id, watchImpression(node, {
    ratio: CARD_IMPRESSION_RATIO,
    dwellMs: CARD_IMPRESSION_MS,
    onView: () => {
      if (ad.shopId) record(ad.shopId, 'card_impression', 'promotion')
    },
  }))
}

const bindPromoEl = (id: string, el: unknown) => {
  const node = el instanceof Element ? el : (el as { $el?: Element } | null)?.$el
  if (!(node instanceof Element)) {
    promoStops.get(id)?.()
    promoStops.delete(id)
    promoEls.delete(id)
    return
  }
  promoEls.set(id, node)
  startPromoWatch(id, node)
}

watch(consent, (value) => {
  if (value !== 'granted') {
    for (const stop of promoStops.values()) stop()
    promoStops.clear()
    return
  }
  for (const [id, node] of promoEls) startPromoWatch(id, node)
})

const onBannerVisibility = () => {
  if (document.hidden) stopBannerSwipe()
  else startBannerSwipe()
}

onBeforeUnmount(() => {
  stopBannerSwipe()
  window.removeEventListener('visibilitychange', onBannerVisibility)
  for (const stop of promoStops.values()) stop()
  promoStops.clear()
  promoEls.clear()
})

const addCafe = async () => {
  await navigateTo('/app/submit-cafe')
}

onIonViewWillEnter(() => {
  hydrateNearbyRadius()
  if (status.value === 'error') void refresh()
  startBannerSwipe()
})

onIonViewDidLeave(() => {
  stopBannerSwipe()
})

watch(homeBanners, async () => {
  await nextTick()
  startBannerSwipe()
})

watch(user, (next) => {
  if (next) return
  firstName.value = ''
})

onMounted(() => {
  window.addEventListener('visibilitychange', onBannerVisibility)
  if (Capacitor.getPlatform() === 'android') {
    document.documentElement.classList.add('is-android')
  }
  greeting.value = greetingForHour(new Date().getHours())
  firstName.value = firstNameFrom(displayNameFromAuthUser(user.value) || user.value?.user_metadata?.display_name)
  void requestLocation()
  const publicBase = String(runtimeConfig.public.r2PublicBaseUrl || '')
  void fetchPlacementCafes(supabase, publicBase)
    .then((cafes) => {
      placementList.value = cafes
    })
    .catch(() => {
      placementList.value = []
    })
  void (async () => {
    if (!user.value) return
    try {
      const profile = await loadProfile()
      const fromProfile = firstNameFrom(profile?.display_name)
      if (fromProfile) firstName.value = fromProfile
    } catch {
      // Keep metadata name when the profile call fails.
    }
  })()
})
</script>

<style scoped>
.home-content {
  --background: #f2f2f2;
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.home {
  min-height: 100%;
  background-color: #f2f2f2;
  padding: 0 0 var(--kd-tabbar-inset);
}

.home-plate {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: transparent;
  color: var(--kd-ink);
  caret-color: var(--kd-primary);
}

.home-chrome {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 72px;
  padding: max(16px, env(safe-area-inset-top)) 20px 12px;
  background: #f2f2f2;
}

.home-chrome__greeting {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
  flex: 1 1 auto;
  color: #1c1917;
}

.home-chrome__hello,
.home-chrome__name {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

.home-chrome__hello {
  font-size: clamp(0.875rem, 3.5vw, 0.975rem);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.home-chrome__name {
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.3;
}

.home-chrome__wordmark {
  display: block;
  flex: 0 0 auto;
  width: min(120px, 34vw);
  height: 26px;
  object-fit: contain;
  object-position: right center;
}

.home-search {
  margin: 0 20px 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--kd-ink) 28%, transparent);
}

.home-partners {
  margin: 0 0 4px;
}

.home-partners__title {
  margin: 0;
  padding: 4px 20px 8px;
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.home-partners__track {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: 20px;
  scrollbar-width: none;
  padding: 4px 20px 8px;
  -webkit-overflow-scrolling: touch;
}

.home-partners__track::-webkit-scrollbar {
  display: none;
}

.home-partners__card {
  --ad-banner-height: 150px;
  --ad-media-col: minmax(168px, 1.8fr);
  display: grid;
  grid-template-columns: var(--ad-media-col) minmax(120px, 1fr);
  align-items: stretch;
  flex: 0 0 calc(100% - 56px);
  scroll-snap-align: start;
  min-width: 0;
  height: var(--ad-banner-height);
  min-height: var(--ad-banner-height);
  max-height: var(--ad-banner-height);
  padding: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 28%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

@media (min-width: 600px) {
  .home-partners__card {
    --ad-banner-height: 200px;
    --ad-media-col: minmax(240px, 2fr);
  }
}

@media (min-width: 840px) {
  .home-partners__card {
    --ad-banner-height: 240px;
    --ad-media-col: minmax(360px, 2.4fr);
  }
}

.home-partners__card--bleed {
  --ad-banner-height: auto;
  grid-template-columns: minmax(0, 1fr);
  width: min(100%, 1920px);
  height: auto;
  min-height: 0;
  max-width: 1920px;
  max-height: 640px;
  aspect-ratio: 1920 / 640;
  border: 0;
  background: #faf8f5;
}

.home-partners__card:only-child {
  flex-basis: 100%;
}

.home-partners__card--bleed:only-child {
  flex-basis: min(100%, 1920px);
  margin-inline: auto;
}

.home-partners__card--cafe {
  --ad-banner-height: 120px;
  --ad-media-col: 120px;
  grid-template-columns: 120px minmax(0, 1fr);
  flex: 0 0 360px;
  width: 360px;
  height: 120px;
  min-height: 120px;
  max-height: 120px;
}

.home-partners__card--cafe:only-child {
  flex-basis: 360px;
}

.home-partners__card--cafe .home-partners__media {
  width: 120px;
  height: 120px;
  aspect-ratio: 1 / 1;
}

.home-partners__card--cafe .home-partners__image {
  object-fit: cover;
  object-position: center;
}

.home-partners__card--cafe .home-partners__copy {
  justify-content: center;
  gap: 4px;
  padding: 10px 12px;
}

.home-partners__card--cafe .home-partners__name {
  font-size: 0.86rem;
  -webkit-line-clamp: 1;
  line-clamp: 1;
}

.home-partners__card--cafe .home-partners__place {
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-size: 0.68rem;
  line-height: 1.25;
}

.home-partners__facts {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.home-partners__facts::-webkit-scrollbar {
  display: none;
}

.home-partners__amenity,
.home-partners__vibe {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.home-partners__amenity {
  background: color-mix(in srgb, var(--kd-ink) 8%, #faf8f5);
  color: var(--kd-ink);
}

.home-partners__amenity :deep(svg) {
  flex-shrink: 0;
  color: var(--kd-primary);
}

.home-partners__vibe {
  border: 1px solid var(--vibe-color, var(--kd-accent));
  background: color-mix(in srgb, var(--vibe-color, var(--kd-accent)) 22%, #faf8f5);
  color: var(--kd-ink);
}

.home-partners__vibe :deep(svg) {
  flex-shrink: 0;
  color: var(--vibe-color, var(--kd-accent));
}

.home-partners__card--cafe .home-partners__badge {
  left: 6px;
  bottom: 6px;
  padding: 1px 5px;
  font-size: 0.65rem;
}

.home-partners__card:active {
  background: color-mix(in srgb, var(--kd-ink) 6%, #faf8f5);
}

.home-partners__card:active .home-partners__image {
  filter: brightness(0.92);
}

.home-partners__card:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

@media (hover: hover) {
  .home-partners__card:hover {
    background: color-mix(in srgb, var(--kd-ink) 4%, #faf8f5);
  }
}

.home-partners__card.home-partners__card--bleed:hover,
.home-partners__card.home-partners__card--bleed:active {
  background: #faf8f5;
}

.home-partners__media {
  position: relative;
  display: block;
  min-height: 0;
  height: 100%;
  background: var(--kd-primary);
}

.home-partners__card--sponsored .home-partners__media {
  background: var(--kd-accent);
}

.home-partners__card--bleed .home-partners__media,
.home-partners__card--sponsored.home-partners__card--bleed .home-partners__media {
  background: #faf8f5;
}

.home-partners__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.home-partners__card--bleed .home-partners__image {
  object-fit: contain;
  object-position: center;
}

.home-partners__badge {
  position: absolute;
  left: 8px;
  bottom: 8px;
  padding: 2px 6px;
  border-radius: 8px;
  background: #faf8f5;
  color: var(--kd-primary);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
}

.home-partners__card--sponsored .home-partners__badge {
  color: var(--kd-ink);
}

.home-partners__copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  padding: 12px 14px 12px 12px;
}

.home-partners__name {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.home-partners__place {
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
}

.home-partners__place {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.3;
}

.home-search__field {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
}

.home-search__field input {
  width: 100%;
  height: 46px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  text-align: left;
  caret-color: var(--kd-primary);
}

.home-search__field input::placeholder {
  color: var(--kd-ink-50);
  opacity: 1;
}

.home-search__field input:focus {
  outline: none;
}

.home-search__field:focus-within {
  box-shadow: inset 0 -1px 0 var(--kd-primary);
}

.home-search__field input::-webkit-search-decoration,
.home-search__field input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

.home-filters {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 8px 20px 12px;
}

.home-filters::-webkit-scrollbar {
  display: none;
}

.home-events {
  margin: 0 0 8px;
}

.home-events__title {
  margin: 0;
  padding: 4px 20px 8px;
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.home-events__track {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: 20px;
  scrollbar-width: none;
  padding: 0 20px 8px;
  -webkit-overflow-scrolling: touch;
}

.home-events__track::-webkit-scrollbar {
  display: none;
}

.home-events__card {
  display: flex;
  flex-direction: column;
  flex: 0 0 calc(100% - 56px);
  scroll-snap-align: start;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 28%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.home-events__card.is-selected {
  border-color: var(--kd-primary);
}

.home-events__card:only-child {
  flex-basis: 100%;
}

.home-events__card:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.home-events__card:active {
  background: color-mix(in srgb, var(--kd-ink) 6%, #faf8f5);
}

@media (hover: hover) {
  .home-events__card:hover {
    background: color-mix(in srgb, var(--kd-ink) 4%, #faf8f5);
  }
}

.home-events__poster {
  display: block;
  min-height: 120px;
  background: var(--kd-primary);
}

.home-events__image {
  display: block;
  width: 100%;
  height: 120px;
  object-fit: cover;
}

.home-events__copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 12px 14px 12px 12px;
}

.home-events__name {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.home-events__when,
.home-events__distance {
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
  font-size: 0.75rem;
  line-height: 1.3;
}

.home-events__when {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.home-filters__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  min-width: 0;
  height: 44px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: transparent;
  color: var(--kd-ink);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 400;
  letter-spacing: 0;
  white-space: nowrap;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.home-filters__chip.is-active {
  background: var(--kd-accent);
  color: var(--kd-ink);
  border-color: var(--kd-accent);
  font-weight: 700;
}

.home-filters__chip:active {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 35%, transparent);
}

.home-filters__chip.is-active:active {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

.home-filters__chip:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: -4px;
}

.home-state,
.home-empty {
  margin: 0;
  padding: 4px 20px 12px;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.3;
  text-align: left;
}

.home-empty {
  padding-inline: 0;
}

.home-state {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  letter-spacing: 0;
}

.home-aside {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 20px 12px;
}

.home-state--note {
  padding: 0;
}

.home-ticket {
  --ticket-notch: radial-gradient(circle at left, transparent 5px, #000 5.5px);
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  margin: 0;
  padding: 8px 16px 8px 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-mask-image: var(--ticket-notch);
  mask-image: var(--ticket-notch);
  -webkit-mask-size: 100% 14px;
  mask-size: 100% 14px;
  -webkit-mask-repeat: repeat-y;
  mask-repeat: repeat-y;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 180ms cubic-bezier(0.16, 1, 0.3, 1), border-color 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.home-ticket__seal {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--kd-accent);
  color: var(--kd-ink);
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1), background-color 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.home-ticket__copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.home-ticket__title,
.home-ticket__detail {
  min-width: 0;
}

.home-ticket__title {
  font-size: 0.85rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.home-ticket__detail {
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.3;
}

.home-ticket.is-on {
  background: var(--kd-accent);
  border-color: var(--kd-accent);
}

.home-ticket.is-on .home-ticket__seal {
  background: #faf8f5;
  transform: rotate(-12deg);
}

.home-ticket.is-on .home-ticket__detail {
  color: var(--kd-ink);
}

.home-ticket:active {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

.home-ticket.is-busy {
  cursor: progress;
}

.home-empty {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.home-skeletons {
  display: flex;
  flex-direction: column;
}

.home-skeleton {
  display: block;
  height: 128px;
  margin: 0;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 12%, transparent);
  border-radius: 16px;
  background: linear-gradient(
    90deg,
    var(--kd-white) 0%,
    color-mix(in srgb, var(--kd-ink) 8%, var(--kd-white)) 50%,
    var(--kd-white) 100%
  );
  background-size: 200% 100%;
  animation: bag-shimmer 1.1s ease-in-out infinite;
}

.home-skeleton:nth-child(3) {
  animation-delay: 120ms;
}

.home-skeleton:nth-child(4) {
  animation-delay: 240ms;
}

.home-retry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  margin-left: auto;
  padding: 0 12px;
  border: 1px solid var(--kd-primary);
  background: transparent;
  color: var(--kd-primary);
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

.home-retry:focus-visible,
.home-spot:focus-visible,
.home-ticket:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 3px;
}

.home-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  padding: 0 20px 12px;
}

.home-more {
  margin: 0;
  padding: 12px 12px 14px;
  color: var(--kd-ink);
  font-size: 0.8rem;
  font-weight: 700;
  text-align: center;
}

.home-more button {
  margin-left: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-primary);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.home-spot {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 72px;
  margin: 0;
  padding: 16px;
  border: 1px solid rgba(28, 25, 23, 0.34);
  border-radius: 16px;
  background: #faf8f5;
  color: #1c1917;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.home-spot__mark {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: 8px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.home-spot__copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.home-spot__title {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.home-spot__action {
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.3;
}

.home-spot:active {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

.home-spot:active .home-spot__mark {
  transform: rotate(-8deg);
}

.cafe-list-enter-active,
.cafe-list-leave-active {
  transition: opacity 220ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.cafe-list-enter-from,
.cafe-list-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@keyframes bag-shimmer {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}

.home-plate ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

@media (prefers-reduced-motion: reduce) {
  .home-filters__chip,
  .home-spot,
  .home-spot__mark,
  .home-retry,
  .home-ticket,
  .home-ticket__seal,
  .cafe-list-enter-active,
  .cafe-list-leave-active {
    transition: none;
  }

  .home-ticket.is-on .home-ticket__seal,
  .home-spot:active .home-spot__mark {
    transform: none;
  }

  .home-skeleton,
  .home-filters__chip:active,
  .home-spot:active,
  .home-ticket:active {
    animation: none;
    box-shadow: none;
  }
}

.home-vibes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 0 20px 12px;
}

.home-vibes__lead {
  margin-right: 4px;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--kd-ink);
  white-space: nowrap;
}

.home-vibes__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--vibe-color, var(--kd-accent));
  border-radius: 8px;
  background: color-mix(in srgb, var(--vibe-color, var(--kd-accent)) 16%, #faf8f5);
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}

.home-vibes__chip :deep(svg) {
  flex-shrink: 0;
  color: var(--vibe-color, var(--kd-accent));
}

.home-vibes__clear {
  margin-left: auto;
  min-height: 36px;
  padding: 0 4px;
  border: 0;
  background: transparent;
  color: var(--kd-primary);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.home-vibes__chip:focus-visible,
.home-vibes__clear:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}
</style>
