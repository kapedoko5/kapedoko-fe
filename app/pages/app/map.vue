<template>
  <IonPage>
    <IonContent :scroll-y="false" class="map-content">
      <div
        class="map-screen"
        :class="{
          'is-ready': mapReady,
          'is-sheet-open': sheetOpen || detailOpen,
        }"
      >
        <div class="map-placeholder" aria-hidden="true" />

        <KapeMap
          v-if="mapCenter"
          :key="mapEpoch"
          ref="mapRef"
          :center="mapCenter"
          :accuracy="accuracy"
          :cafes="visibleCafes"
          :selected-id="selectedId"
          :sheet-open="sheetOpen || detailOpen"
          :header-pad="headerPad"
          :bottom-pad="bottomPad"
          @tiles-ready="onTilesReady"
          @tiles-error="onTilesError"
          @select="onSelectCafe"
          @viewchange="onViewChange"
        />

        <div class="map-chrome">
          <header class="map-hero">
            <div class="map-hero__bar">
              <button type="button" class="map-back" aria-label="Go back" @click="goBack">
                <ChevronLeft :size="22" :stroke-width="2.25" />
              </button>

              <div class="map-brand">
                <img
                  src="/assets/kapedoko-logo_dark.png"
                  alt=""
                  width="23"
                  height="30"
                  class="map-brand__mark"
                />
                <img
                  src="/assets/kapedoko-horizontal-text_dark.png"
                  alt="kapé DOKO"
                  width="122"
                  height="28"
                  class="map-brand__wordmark"
                />
              </div>

              <h1 class="map-title">MAPS</h1>
            </div>

            <form class="map-search" @submit.prevent="submitSearch">
              <label class="map-search__field">
                <span class="sr-only">Search a coffee shop</span>
                <input
                  ref="searchInput"
                  v-model="query"
                  type="search"
                  name="q"
                  role="combobox"
                  placeholder="Search a coffee shop"
                  autocomplete="off"
                  enterkeyhint="search"
                  aria-autocomplete="list"
                  :aria-expanded="showSuggestions"
                  aria-controls="map-search-list"
                  :aria-activedescendant="activeSuggestionId"
                  @focus="onSearchFocus"
                  @blur="onSearchBlur"
                  @keydown="onSearchKeydown"
                />
                <span class="map-search__controls">
                  <button
                    v-if="query.length > 0"
                    type="button"
                    class="map-search__clear"
                    aria-label="Clear search"
                    @mousedown.prevent="clearSearch"
                    @click="clearSearch"
                  >
                    <X :size="22" :stroke-width="2" aria-hidden="true" />
                  </button>
                  <button type="submit" class="map-search__submit" aria-label="Search">
                    <Search :size="24" :stroke-width="2" />
                  </button>
                </span>
              </label>

              <ul
                v-if="showSuggestions"
                id="map-search-list"
                class="map-search__results"
                role="listbox"
                aria-label="Coffee shop suggestions"
              >
                <li v-if="suggestions.length === 0" class="map-search__empty" role="option" aria-disabled="true">
                  No matching coffee shops
                </li>
                <li
                  v-for="(cafe, index) in suggestions"
                  :id="`map-search-option-${cafe.id}`"
                  :key="cafe.id"
                  role="option"
                  :aria-selected="index === activeIndex"
                >
                  <button
                    type="button"
                    class="map-search__suggestion"
                    :class="{ 'is-active': index === activeIndex }"
                    @mousedown.prevent="pickSuggestion(cafe)"
                  >
                    <span class="map-search__suggestion-copy">
                      <span class="map-search__suggestion-name">{{ cafe.name }}</span>
                      <span class="map-search__suggestion-meta">
                        {{ cafe.address }}
                        <template v-if="suggestionDistances[cafe.id]">
                          · {{ suggestionDistances[cafe.id] }}
                        </template>
                      </span>
                    </span>
                    <span
                      v-if="hasConfirmedWifi(cafe) || hasConfirmedPlug(cafe)"
                      class="map-search__suggestion-amenities"
                    >
                      <span
                        v-if="hasConfirmedWifi(cafe)"
                        class="map-search__suggestion-amenity"
                        aria-label="WiFi"
                      >
                        <Wifi :size="14" :stroke-width="2" aria-hidden="true" />
                        <span class="sr-only">WiFi</span>
                      </span>
                      <span
                        v-if="hasConfirmedPlug(cafe)"
                        class="map-search__suggestion-amenity"
                        aria-label="Outlets"
                      >
                        <Plug :size="14" :stroke-width="2" aria-hidden="true" />
                        <span class="sr-only">Outlets</span>
                      </span>
                    </span>
                  </button>
                </li>
              </ul>
            </form>
          </header>

          <div class="map-status">
            <Transition name="map-note">
              <div
                v-if="usingFallback && locationStatus !== 'requesting'"
                key="off"
                class="map-note"
                role="status"
              >
                <span class="map-note__mark" aria-hidden="true">
                  <LocateOff :size="16" :stroke-width="2.25" />
                </span>
                <p class="map-note__copy">Location is off. Enable it to see cafes near you.</p>
                <button type="button" class="map-note__action" @click="requestLocation">
                  Enable location
                </button>
              </div>
              <div
                v-else-if="locationStatus === 'requesting' && !mapSettled"
                key="live"
                class="map-note map-note--live"
                role="status"
                aria-busy="true"
              >
                <span class="map-note__you" aria-hidden="true">
                  <span class="map-note__you-pulse" />
                  <span class="map-note__you-pulse map-note__you-pulse--late" />
                  <span class="map-note__you-core" />
                </span>
                <p class="map-note__copy">Finding your location…</p>
              </div>
            </Transition>

            <Transition name="map-note">
              <div v-if="tilesFailed" key="tiles" class="map-note map-note--alert" role="alert">
                <span class="map-note__mark" aria-hidden="true">
                  <MapIcon :size="16" :stroke-width="2.25" />
                </span>
                <p class="map-note__copy">Map tiles couldn’t load. Check your connection, then try again.</p>
                <button type="button" class="map-note__action" @click="retryTiles">
                  Retry map
                </button>
              </div>
            </Transition>
          </div>

          <button
            v-if="mapReady"
            type="button"
            class="map-locate"
            aria-label="Recenter map"
            @click="recenter"
          >
            <LocateFixed :size="20" :stroke-width="2" />
          </button>

          <button
            v-if="mapReady && !sheetOpen && !detailOpen"
            type="button"
            class="map-cta"
            @click="openSheet"
          >
            <Coffee :size="24" :stroke-width="2" aria-hidden="true" />
            Show cafes near me
          </button>
        </div>
      </div>
    </IonContent>

    <NearbyCafesSheet
      v-model:open="sheetOpen"
      :cafes="sheetCafes"
      :selected-id="selectedId"
      :distances="distances"
      @present="onSheetPresent"
      @select="onSelectCafe"
    />

    <CafeDetailSheet
      v-model:open="detailOpen"
      :cafe="selectedCafe || lastDetailCafe"
      @present="onDetailPresent"
      @dismissed="onDetailDismissed"
      @review="onReviewCafe"
      @checkin="onCheckInCafe"
    />
  </IonPage>
</template>

<script lang="ts" setup>
import { ChevronLeft, Coffee, LocateFixed, LocateOff, Map as MapIcon, Plug, Search, Wifi, X } from 'lucide-vue-next'
import { Capacitor } from '@capacitor/core'
import { onIonViewWillEnter, useIonRouter } from '@ionic/vue'
import KapeMap from '~/components/map/KapeMap.client.vue'
import NearbyCafesSheet from '~/components/map/NearbyCafesSheet.vue'
import CafeDetailSheet from '~/components/map/CafeDetailSheet.vue'
import type { Cafe } from '~/types/cafe'
import { cafeMatchesQuery } from '~/utils/cafe-search'
import { trustedPositive } from '~/utils/amenity-status'
import { distanceMeters, formatDistance } from '~/utils/geo'
import { ANALYTICS_EVENTS, confidenceBucketFromStatus, detailViewKey } from '~/utils/analytics'

useAppTabBar('hide')

const ionRouter = useIonRouter()
const { track, once, consent } = useAnalytics()
const { status: locationStatus, location, usingFallback, center, requestLocation } =
  useDeviceLocation()
const {
  viewportCafes,
  nearbyCafes,
  suggestions,
  cafeById,
  remember,
  hydrateCafe,
  loadNearby,
  loadViewport,
  searchCafes,
} = useMapCafes()

const query = ref('')
const submittedQuery = ref('')
const searchFocused = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)
const activeIndex = ref(-1)
const sheetOpen = ref(false)
const detailOpen = ref(false)
const listWasOpen = ref(false)
const selectedId = ref<string | null>(null)
const viewBounds = ref<GeoBounds | null>(null)
const mapReady = ref(false)
const tilesFailed = ref(false)
const mapEpoch = ref(0)
const mapRef = ref<{
  recenter: () => void
  focusCafe: (cafe: { lat: number; lng: number }, extraBottom?: number) => void
  invalidate: () => void
} | null>(null)

const mapSettled = computed(() => mapReady.value || tilesFailed.value)
const mapCenter = computed(() => (location.value ? center.value : null))
const accuracy = computed(() => location.value?.accuracy ?? 0)

const sheetCafes = computed(() => {
  const term = submittedQuery.value.trim()
  if (!term) return nearbyCafes.value
  return nearbyCafes.value.filter((cafe) => cafeMatchesQuery(cafe, term))
})
const visibleCafes = computed(() => {
  const selected = cafeById(selectedId.value)
  const bounds = viewBounds.value
  const inView = bounds
    ? viewportCafes.value.filter((cafe) => pointInBounds(cafe, bounds))
    : viewportCafes.value
  if (selected && !inView.some((cafe) => cafe.id === selected.id)) {
    return [...inView, selected]
  }
  return inView
})
const showSuggestions = computed(
  () => searchFocused.value && query.value.trim().length > 0,
)
const activeSuggestionId = computed(() => {
  const cafe = suggestions.value[activeIndex.value]
  return cafe ? `map-search-option-${cafe.id}` : undefined
})
const suggestionDistances = computed(() => {
  const origin = mapCenter.value
  if (!origin) return {}
  return Object.fromEntries(
    suggestions.value.map((cafe) => [cafe.id, formatDistance(distanceMeters(origin, cafe))]),
  )
})

function hasConfirmedWifi(cafe: Cafe) {
  return trustedPositive(cafe.work.wifiStatus)
}

function hasConfirmedPlug(cafe: Cafe) {
  return trustedPositive(cafe.work.outletsStatus)
}

const selectedCafe = computed(() => cafeById(selectedId.value))
const lastDetailCafe = ref<Cafe | null>(null)
const pendingCafePath = ref<string | null>(null)
watch(selectedCafe, (cafe) => {
  if (cafe) lastDetailCafe.value = cafe
})
const distances = computed(() => {
  const origin = mapCenter.value
  if (!origin) return {}
  return Object.fromEntries(
    sheetCafes.value.map((cafe) => [cafe.id, formatDistance(distanceMeters(origin, cafe))]),
  )
})

const headerPad = 188
const bottomPad = computed(() => {
  if (sheetOpen.value || detailOpen.value) {
    return Math.round(window.innerHeight * 0.52)
  }
  return 36
})

const goBack = async () => {
  if (showSuggestions.value) {
    searchFocused.value = false
    return
  }
  if (detailOpen.value) {
    detailOpen.value = false
    return
  }
  if (sheetOpen.value) {
    sheetOpen.value = false
    return
  }
  if (ionRouter.canGoBack()) {
    ionRouter.back()
    return
  }
  await navigateTo('/app')
}

const onSearchFocus = () => {
  searchFocused.value = true
}

const clearSearch = () => {
  query.value = ''
  submittedQuery.value = ''
  activeIndex.value = -1
  searchFocused.value = true
  searchInput.value?.focus()
}

const onSearchBlur = () => {
  window.setTimeout(() => {
    searchFocused.value = false
    activeIndex.value = -1
  }, 120)
}

const onSearchKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    searchFocused.value = false
    activeIndex.value = -1
    return
  }

  if (!showSuggestions.value || suggestions.value.length === 0) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % suggestions.value.length
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value =
      activeIndex.value <= 0 ? suggestions.value.length - 1 : activeIndex.value - 1
    return
  }

  if (event.key === 'Enter' && activeIndex.value >= 0) {
    const cafe = suggestions.value[activeIndex.value]
    if (!cafe) return
    event.preventDefault()
    pickSuggestion(cafe)
  }
}

const pickSuggestion = (cafe: Cafe) => {
  remember([cafe])
  query.value = cafe.name
  submittedQuery.value = ''
  searchFocused.value = false
  activeIndex.value = -1
  onSelectCafe(cafe.id)
}

const submitSearch = () => {
  searchFocused.value = false
  activeIndex.value = -1
  submittedQuery.value = query.value.trim()
  window.setTimeout(() => {
    const matches = sheetCafes.value
    if (matches.length === 1 && matches[0]) {
      onSelectCafe(matches[0].id)
      return
    }
    sheetOpen.value = true
    if (selectedId.value && !matches.some((cafe) => cafe.id === selectedId.value)) {
      selectedId.value = null
    }
  }, 0)
}

const openSheet = () => {
  sheetOpen.value = true
}

const onSelectCafe = (id: string) => {
  selectedId.value = id
  if (sheetOpen.value) listWasOpen.value = true
  sheetOpen.value = false
  detailOpen.value = true
  const existing = cafeById(id)
  if (existing) {
    const extra = Math.round(window.innerHeight * 0.52)
    mapRef.value?.focusCafe(existing, extra)
  }
  void hydrateCafe(id).then((cafe) => {
    if (!cafe || selectedId.value !== id) return
    const extra = Math.round(window.innerHeight * 0.52)
    mapRef.value?.focusCafe(cafe, extra)
  })
}

const queueCafePage = (path: string) => {
  listWasOpen.value = false
  sheetOpen.value = false
  if (!detailOpen.value) {
    void navigateTo(path)
    return
  }
  pendingCafePath.value = path
  detailOpen.value = false
  window.setTimeout(() => {
    if (pendingCafePath.value === path) onDetailDismissed()
  }, 450)
}

const onReviewCafe = () => {
  const id = selectedId.value || lastDetailCafe.value?.id
  if (!id) return
  queueCafePage(`/app/cafes/${id}/review`)
}

const onCheckInCafe = () => {
  const id = selectedId.value || lastDetailCafe.value?.id
  if (!id) return
  queueCafePage(`/app/cafes/${id}/check-in`)
}

const onDetailDismissed = () => {
  const path = pendingCafePath.value
  if (!path) return
  pendingCafePath.value = null
  selectedId.value = null
  void navigateTo(path)
}

const onViewChange = (view: { bounds: GeoBounds; center: { lat: number; lng: number } }) => {
  viewBounds.value = view.bounds
  loadViewport(view.bounds, view.center)
}

const onTilesReady = () => {
  tilesFailed.value = false
  mapReady.value = true
  requestAnimationFrame(() => mapRef.value?.invalidate())
}

const onTilesError = () => {
  if (mapReady.value) return
  tilesFailed.value = true
}

const retryTiles = () => {
  mapReady.value = false
  tilesFailed.value = false
  mapEpoch.value += 1
}

const recenter = () => {
  mapRef.value?.recenter()
}

const refreshMap = () => {
  mapRef.value?.invalidate()
  window.setTimeout(() => mapRef.value?.invalidate(), 80)
  window.setTimeout(() => mapRef.value?.invalidate(), 320)
}

const onSheetPresent = () => {
  refreshMap()
}

const onDetailPresent = () => {
  refreshMap()
  const cafe = selectedCafe.value || lastDetailCafe.value
  if (!cafe) return
  if (!once(detailViewKey(cafe.id))) return
  track(ANALYTICS_EVENTS.CAFE_DETAIL_VIEWED, {
    cafe_id: cafe.id,
    wifi_confidence: confidenceBucketFromStatus(cafe.work.wifiStatus),
    outlet_confidence: confidenceBucketFromStatus(cafe.work.outletsStatus),
    source: 'map',
  })
}

watch(query, (value) => {
  activeIndex.value = -1
  searchCafes(value, mapCenter.value)
})

watch(
  mapCenter,
  (origin) => {
    if (origin) void loadNearby(origin)
  },
  { immediate: true },
)

watch(usingFallback, (fallback, previous) => {
  if (previous && !fallback) mapRef.value?.recenter()
})

watch(sheetOpen, (open) => {
  if (!open && !detailOpen.value) selectedId.value = null
  refreshMap()
})

watch(detailOpen, (open) => {
  if (open) {
    refreshMap()
    return
  }
  if (pendingCafePath.value) {
    refreshMap()
    return
  }
  selectedId.value = null
  const restoreList = listWasOpen.value
  listWasOpen.value = false
  if (restoreList) {
    window.setTimeout(() => {
      sheetOpen.value = true
    }, 320)
  }
  refreshMap()
})

watch(visibleCafes, (list) => {
  if (detailOpen.value) return
  if (selectedId.value && !list.some((cafe) => cafe.id === selectedId.value)) {
    selectedId.value = null
  }
})

const route = useRoute()
watch(
  () => route.query.cafe,
  (value) => {
    const id = Array.isArray(value) ? value[0] : value
    if (typeof id !== 'string' || !id) return
    onSelectCafe(id)
  },
  { immediate: true },
)

const fireMapOpened = () => {
  if (!once('map_opened')) return
  track(ANALYTICS_EVENTS.MAP_OPENED, {})
}

onIonViewWillEnter(() => {
  fireMapOpened()
})

watch(consent, (value) => {
  if (value === 'granted') fireMapOpened()
})

onMounted(() => {
  if (Capacitor.getPlatform() === 'android') {
    document.documentElement.classList.add('is-android')
  }
  void requestLocation()
})
</script>

<style scoped>
.map-content {
  --background: #f2f2f2;
  --overflow: hidden;
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.map-screen {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #f2f2f2;
  font-family: 'Kumbh Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: var(--kd-ink);
}

.map-placeholder {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 18% 24%, color-mix(in srgb, #ffffff 55%, transparent), transparent 36%),
    linear-gradient(180deg, #ffffff 0%, #f2f2f2 42%);
}

.map-chrome {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.map-hero,
.map-status,
.map-note,
.map-locate,
.map-cta,
.map-back,
.map-search,
.map-search__results,
.map-search__suggestion,
.map-note__action {
  pointer-events: auto;
}

.map-hero {
  position: relative;
  padding: max(2.75rem, calc(env(safe-area-inset-top) + 16px)) 20px 18px;
  background: linear-gradient(180deg, #f2f2f2 0%, color-mix(in srgb, #f2f2f2 0%, transparent) 100%);
}

.map-hero__bar {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 30px;
}

.map-back {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-left: -12px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 140ms cubic-bezier(0.16, 1, 0.3, 1);
}

.map-back:focus-visible,
.map-search__clear:focus-visible,
.map-search__submit:focus-visible,
.map-search__suggestion:focus-visible,
.map-locate:focus-visible,
.map-cta:focus-visible,
.map-note__action:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
  border-radius: 16px;
}

.map-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.map-brand__mark,
.map-brand__wordmark {
  display: block;
  object-fit: contain;
}

.map-brand__mark {
  width: 23px;
  height: 30px;
}

.map-brand__wordmark {
  width: 122px;
  height: 28px;
  object-position: left center;
}

.map-title {
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.map-search {
  position: relative;
  z-index: 3;
  margin-top: 16px;
}

.map-search__field {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 8px 0 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #ffffff;
}

.map-search__field input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
  font-family: inherit;
  caret-color: var(--kd-primary);
}

.map-search__field input::placeholder {
  color: color-mix(in srgb, var(--kd-ink) 50%, transparent);
  opacity: 1;
}

.map-search__field input:focus {
  outline: none;
}

.map-search__field:focus-within {
  box-shadow: inset 0 -1px 0 var(--kd-primary);
  border-color: color-mix(in srgb, var(--kd-ink) 34%, transparent);
}

.map-search__field input::-webkit-search-decoration,
.map-search__field input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

.map-search__controls {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.map-search__clear,
.map-search__submit {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.map-search__results {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 4;
  margin: 0;
  padding: 6px;
  max-height: min(42vh, 320px);
  overflow-y: auto;
  list-style: none;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #ffffff;
}

.map-search__empty {
  padding: 14px 12px;
  color: var(--kd-ink);
  font-size: 0.7875rem;
}

.map-search__suggestion {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  padding: 10px 12px;
  border: 0;
  border-radius: 16px;
  background: transparent;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.map-search__suggestion.is-active,
.map-search__suggestion:hover {
  background: #f2f2f2;
}

.map-search__suggestion-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.map-search__suggestion-name {
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.3;
}

.map-search__suggestion-meta {
  color: var(--kd-ink);
  font-size: 0.75rem;
  line-height: 1.35;
}

.map-search__suggestion-amenities {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
}

.map-search__suggestion-amenity {
  display: inline-flex;
  color: var(--kd-accent, #d9793b);
}

.map-search__suggestion-amenity :deep(svg) {
  display: block;
}

.map-status {
  position: relative;
  display: grid;
  gap: 8px;
}

.map-note {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 12px;
  margin: 0 20px;
  padding: 8px 8px 8px 12px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
  border-radius: 16px;
  background: #ffffff;
  color: var(--kd-ink);
}

.map-note--live {
  padding-right: 14px;
}

.map-note__you {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
}

.map-note__you-core {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--kd-accent);
  border: 2px solid #ffffff;
  z-index: 1;
}

.map-note__you-pulse {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 1.5px solid var(--kd-primary);
  background: color-mix(in srgb, var(--kd-accent) 18%, transparent);
  animation: map-note-ping 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

.map-note__you-pulse--late {
  animation-delay: 0.55s;
}

.map-note__mark {
  display: grid;
  place-items: center;
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #f2f2f2;
  color: var(--kd-ink);
}

.map-note--alert .map-note__mark {
  background: color-mix(in srgb, #8c3a2f 16%, #ffffff);
  color: #8c3a2f;
}

.map-note__copy {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.35;
}

.map-note__action {
  flex-shrink: 0;
  margin-left: auto;
  height: 44px;
  min-height: 44px;
  min-width: 44px;
  padding: 0 14px;
  border: 1px solid var(--kd-accent);
  border-radius: 16px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: box-shadow 140ms cubic-bezier(0.16, 1, 0.3, 1);
}

.map-note__action:hover {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

:root.is-android .map-note__action {
  height: 48px;
  min-height: 48px;
}

.map-note-enter-active,
.map-note-leave-active {
  transition: opacity 220ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.map-note-leave-active {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 1;
}

.map-note-enter-from,
.map-note-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.map-locate {
  position: absolute;
  right: 20px;
  bottom: calc(env(safe-area-inset-bottom) + 76px);
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #ffffff;
  color: var(--kd-ink);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  animation: map-rise 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.map-screen.is-sheet-open .map-locate {
  bottom: calc(52vh + 16px);
}

.map-cta {
  position: absolute;
  left: 20px;
  right: 20px;
  bottom: calc(env(safe-area-inset-bottom) + 16px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 44px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--kd-accent);
  border-radius: 16px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  animation: map-rise 560ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

:root.is-android .map-cta {
  height: 48px;
  min-height: 48px;
}

.map-back:active,
.map-search__clear:active,
.map-search__submit:active,
.map-search__suggestion:active,
.map-locate:active,
.map-cta:active,
.map-note__action:active {
  transform: scale(0.96);
}

@keyframes map-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes map-note-ping {
  0% {
    transform: scale(1);
    opacity: 0.7;
  }
  75% {
    transform: scale(2.45);
    opacity: 0;
  }
  100% {
    transform: scale(2.45);
    opacity: 0;
  }
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

@media (min-width: 540px) {
  .map-screen {
    max-width: 480px;
    margin-inline: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .map-cta,
  .map-locate,
  .map-note__you-pulse,
  .map-note-enter-active,
  .map-note-leave-active {
    animation: none;
    transition-duration: 1ms;
  }

  .map-note__you-pulse--late {
    display: none;
  }

  .map-note__you-pulse {
    transform: scale(2.1);
    opacity: 0.22;
  }

  .map-back:active,
  .map-search__clear:active,
  .map-search__submit:active,
  .map-search__suggestion:active,
  .map-locate:active,
  .map-cta:active,
  .map-note__action:active {
    transform: none;
  }
}

::selection {
  background: color-mix(in srgb, var(--kd-accent) 35%, transparent);
  color: var(--kd-ink);
}
</style>
