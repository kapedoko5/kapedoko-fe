<template>
  <IonPage>
    <IonContent class="search-content">
      <div class="search" :class="{ 'has-detail': paneDocked }">
        <header class="search-chrome">
          <div class="search-chrome__bar">
            <button
              type="button"
              class="search-chrome__back"
              aria-label="Back to Home"
              @click="goBack"
            >
              <ChevronLeft :size="24" :stroke-width="2" />
            </button>
            <h1>Search shops</h1>
          </div>

          <form class="search-form" @submit.prevent="submitSearch">
            <label class="search-form__field">
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
        </header>

        <p class="sr-only" aria-live="polite">
          {{ resultAnnouncement }}
        </p>

        <p v-if="amenityHint" class="search-hint">{{ amenityHint }}</p>
        <div class="search-filters" role="tablist" aria-label="Cafe filters">
          <button
            v-for="filter in filters"
            :key="filter.id"
            type="button"
            role="tab"
            class="search-filters__chip"
            :class="{ 'is-active': activeFilter === filter.id }"
            :aria-selected="activeFilter === filter.id"
            @click="setFilter(filter.id)"
          >
            <component :is="filterIcons[filter.icon]" :size="14" :stroke-width="2.25" aria-hidden="true" />
            {{ filter.label }}
          </button>
        </div>

        <Transition name="search-list" mode="out-in">
          <section :key="listKey" class="search-results" aria-label="Search results">
            <div v-if="status === 'idle' || status === 'loading'" class="search-skeletons" aria-busy="true">
              <p class="sr-only">Loading coffee shops…</p>
              <span class="search-skeleton" />
              <span class="search-skeleton" />
              <span class="search-skeleton" />
            </div>
            <p v-else-if="status === 'error'" class="search-empty">
              <CircleAlert :size="18" :stroke-width="2.25" aria-hidden="true" />
              <span>{{ error || 'Could not load coffee shops.' }}</span>
              <button type="button" class="search-retry" @click="refresh">
                <RefreshCw :size="16" :stroke-width="2.25" aria-hidden="true" />
                Try again
              </button>
            </p>
            <p v-else-if="pagedCafes.length === 0 && !hasMoreCafes" class="search-empty">
              <Coffee :size="18" :stroke-width="2.25" aria-hidden="true" />
              <span>{{ emptyCopy }}</span>
            </p>
            <template v-else>
              <CafeCard
                v-for="(cafe, index) in pagedCafes"
                :key="cafe.id"
                :cafe="cafe"
                :selected="cafe.id === detailCafe?.id"
                :distance-label="distanceLabel(cafe)"
                :style="{ '--enter': String(index % 12) }"
                surface="search"
                @select="openCafe"
              />
              <p v-if="moreError" class="search-more">
                <span>{{ moreError }}</span>
                <button type="button" @click="retryMore">Try again</button>
              </p>
              <p v-else-if="hasMoreCafes" ref="moreCafes" class="search-more">
                {{ loadingMore ? 'Loading more shops…' : 'Scroll for more' }}
              </p>
            </template>
          </section>
        </Transition>
      </div>
      <AppDetailPane
        :open="paneOpen"
        :label="detailCafe?.name || 'Cafe details'"
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
      </AppDetailPane>
    </IonContent>
  </IonPage>
</template>

<script lang="ts" setup>
import { onIonViewWillEnter } from '@ionic/vue'
import { BatteryCharging, ChevronLeft, CircleAlert, Coffee, Flame, Hourglass, Navigation, Plug, RefreshCw, Search, Wifi, Zap } from 'lucide-vue-next'
import AppDetailPane from '~/components/AppDetailPane.vue'
import CafeCard from '~/components/cafe/CafeCard.vue'
import CafeDetailContent from '~/components/cafe/CafeDetailContent.vue'
import type { Cafe } from '~/types/cafe'
import { CAFE_FILTERS, type CafeFilterIcon, type CafeFilterId } from '~/utils/cafe-filters'
import { amenityFilterHint } from '~/utils/amenity-status'
import {
  ANALYTICS_EVENTS,
  classifySearchQuery,
  confidenceBucketFromCafe,
  modalConfidenceBucket,
} from '~/utils/analytics'
import { distanceMeters, formatDistance } from '~/utils/geo'

useAppTabBar('hide')
const {
  cafe: detailCafe,
  paneOpen,
  paneDocked,
  openCafe: openCafePane,
  close: closeDetail,
  afterLeave,
  onReview,
  onCheckIn,
} = useListDetailPane('search')

const { status: locationStatus, location, usingFallback, requestLocation } = useDeviceLocation()
const { radiusMeters } = useNearbyRadius()
const { track } = useAnalytics()

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

const route = useRoute()
const requestURL = useRequestURL()
const query = ref('')
const submittedQuery = ref('')
const activeFilter = ref<CafeFilterId>('near')
const amenityHint = computed(() => amenityFilterHint(activeFilter.value))

const readQueryParam = (value: unknown) => {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return ''
}

const queryFromLocation = () => {
  if (import.meta.client) {
    const fromWindow = new URLSearchParams(window.location.search).get('q')
    if (fromWindow) return fromWindow
  }

  try {
    const fromRequest = new URL(requestURL.href).searchParams.get('q')
    if (fromRequest) return fromRequest
  } catch {
    /* ignore invalid URL */
  }

  return readQueryParam(route.query.q)
}

const syncFromRoute = () => {
  const next = queryFromLocation()
  query.value = next
  submittedQuery.value = next
}

syncFromRoute()

watch(() => route.fullPath, syncFromRoute)
onMounted(syncFromRoute)

const listKey = computed(() => `${submittedQuery.value.trim().toLowerCase()}|${activeFilter.value}`)

const origin = computed(() => (
  locationStatus.value === 'granted' && location.value && !usingFallback.value
    ? location.value
    : null
))

const locationReady = computed(() => (
  locationStatus.value === 'granted'
  || locationStatus.value === 'denied'
  || locationStatus.value === 'unavailable'
))

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
  nearby: computed(() => false),
  locationReady,
})

onIonViewWillEnter(() => {
  syncFromRoute()
  if (status.value === 'error') void refresh()
})

const distanceLabel = (cafe: Cafe) => {
  if (!origin.value) return undefined
  return formatDistance(distanceMeters(origin.value, cafe))
}

const openCafe = async (id: string) => {
  const fallback = pagedCafes.value.find((item) => item.id === id) || null
  await openCafePane(id, fallback)
}

const trackPending = ref<CafeFilterId | null>(null)

const setFilter = (id: CafeFilterId) => {
  if (id === activeFilter.value) return
  activeFilter.value = id
  trackPending.value = id
}

watch(status, (value) => {
  const id = trackPending.value
  if (value !== 'ready' || !id) return
  trackPending.value = null
  track(ANALYTICS_EVENTS.FILTER_APPLIED, {
    filter_name: id,
    result_count: cafeTotal.value ?? pagedCafes.value.length,
    confidence_bucket: modalConfidenceBucket(pagedCafes.value.map((cafe) => confidenceBucketFromCafe(cafe))),
  })
})

watch(
  [submittedQuery, status],
  ([queryText, loadStatus], previous) => {
    const next = String(queryText ?? '').trim()
    if (!next || loadStatus !== 'ready') return
    if (previous && previous[0] === queryText && previous[1] === loadStatus) return
    const classified = classifySearchQuery(next)
    const count = cafeTotal.value ?? pagedCafes.value.length
    track(ANALYTICS_EVENTS.SEARCH_PERFORMED, {
      query_type: classified.query_type,
      result_count: count,
      zero_results: count === 0,
      ...(classified.area_name ? { area_name: classified.area_name } : {}),
    })
  },
  { immediate: true },
)

const resultAnnouncement = computed(() => {
  const shown = pagedCafes.value.length
  const count = cafeTotal.value
  if (shown === 0 && !hasMoreCafes.value) return 'No coffee shops match that search.'
  if (count != null && shown >= count) {
    return count === 1 ? '1 coffee shop found.' : `${count} coffee shops found.`
  }
  if (count != null) return `Showing ${shown} of ${count} coffee shops.`
  if (hasMoreCafes.value) return `Showing ${shown} coffee shops. Scroll for more.`
  return shown === 1 ? '1 coffee shop found.' : `${shown} coffee shops found.`
})

const emptyCopy = computed(() => {
  const hasQuery = submittedQuery.value.trim().length > 0
  if (hasQuery) {
    return 'No coffee shops match that search. Try another name or clear a filter.'
  }
  const known = cafeTotal.value ?? pagedCafes.value.length
  return known === 0
    ? 'No coffee shops yet.'
    : 'No coffee shops match that filter. Try another filter.'
})

const submitSearch = async () => {
  const next = query.value.trim()
  submittedQuery.value = query.value

  const path = next ? `/app/search?q=${encodeURIComponent(next)}` : '/app/search'

  await navigateTo(path, { replace: true })
}

const goBack = async () => {
  await navigateTo('/app')
}

onMounted(() => {
  void requestLocation()
})
</script>

<style scoped>
.search-content {
  --background: #f2f2f2;
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.search-content :deep(.inner-scroll) {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.search {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 100%;
  background: #f2f2f2;
  color: var(--kd-ink);
  caret-color: var(--kd-primary);
  padding-bottom: calc(2rem + env(safe-area-inset-bottom));
  container-type: inline-size;
  container-name: search;
}

.search-chrome {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f2f2f2;
  padding: max(16px, env(safe-area-inset-top)) 20px 0;
}

.search-chrome__bar {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  margin: 0 0 8px;
}

.search-chrome__back {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-left: -10px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 140ms cubic-bezier(0.16, 1, 0.3, 1);
}

.search-chrome__back:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
  border-radius: 8px;
}

.search-chrome h1 {
  margin: 0;
  color: var(--kd-ink);
  font-size: clamp(0.95rem, 3.8vw, 1.05rem);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.search-form {
  margin: 0 0 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--kd-ink) 28%, transparent);
}

.search-form__field {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  color: var(--kd-ink);
}

.search-form__field input {
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

.search-form__field input::placeholder {
  color: var(--kd-ink-50);
  opacity: 1;
}

.search-form__field input:focus {
  outline: none;
}

.search-form__field:focus-within {
  box-shadow: inset 0 -1px 0 var(--kd-primary);
}

.search-form__field input::-webkit-search-decoration,
.search-form__field input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

.search-filters {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 8px 20px 12px;
  background: #f2f2f2;
}

.search-filters::-webkit-scrollbar {
  display: none;
}

.search-filters__chip {
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

.search-filters__chip.is-active {
  background: var(--kd-accent);
  color: var(--kd-ink);
  border-color: var(--kd-accent);
  font-weight: 700;
}

.search-filters__chip:active {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 35%, transparent);
}

.search-filters__chip.is-active:active {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

.search-filters__chip:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: -4px;
}

.search-results {
  display: grid;
  grid-template-columns: 1fr;
  flex: 1 1 auto;
  gap: 12px;
  padding: 0 20px 12px;
  background: #f2f2f2;
}

.search-skeletons {
  display: flex;
  flex-direction: column;
}

.search-skeleton {
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

.search-skeleton:nth-child(3) {
  animation-delay: 120ms;
}

.search-skeleton:nth-child(4) {
  animation-delay: 240ms;
}

.search-empty {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 4px 0 12px;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.3;
  text-align: left;
}

.search-retry {
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

.search-retry:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 3px;
}

.search-more {
  margin: 0;
  padding: 12px 12px 14px;
  color: var(--kd-ink);
  font-size: 0.8rem;
  font-weight: 700;
  text-align: center;
}

.search-more button {
  margin-left: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-primary);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.search-chrome__back:active {
  transform: scale(0.94);
}

.search-list-enter-active,
.search-list-leave-active {
  transition: opacity 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.search-list-enter-from,
.search-list-leave-to {
  opacity: 0;
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

@keyframes bag-shimmer {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .search-chrome__back,
  .search-filters__chip,
  .search-list-enter-active,
  .search-list-leave-active {
    transition-duration: 1ms;
  }

  .search-skeleton,
  .search-filters__chip:active {
    animation: none;
    box-shadow: none;
  }

  .search-chrome__back:active {
    transform: none;
  }
}

::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}
</style>
