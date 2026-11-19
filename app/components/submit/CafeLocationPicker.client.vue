<template>
  <section class="picker" :class="{ 'is-overlay': overlay }" aria-labelledby="picker-title">
    <div v-if="!overlay" class="picker__copy">
      <h2 id="picker-title">Pin the cafe</h2>
      <p>Drag the pin or search so the marker sits on the shop, not the next street.</p>
    </div>

    <div class="picker__search" @keydown.enter.stop>
      <div class="picker__search-field">
        <label class="sr-only" for="cafe-address-search">
          {{ unrestricted ? 'Search an address' : 'Search an address in the Philippines' }}
        </label>
        <input
          id="cafe-address-search"
          v-model="query"
          type="search"
          name="address-search"
          :placeholder="unrestricted ? 'Search an address' : 'Search an address in the Philippines'"
          autocomplete="off"
          enterkeyhint="search"
          role="combobox"
          aria-autocomplete="list"
          :aria-expanded="results.length > 0"
          aria-controls="cafe-address-results"
          @input="scheduleSearch"
          @keydown.enter.stop.prevent="runSearch()"
          @search.stop.prevent="runSearch()"
        />
        <button type="button" class="picker__icon-btn" aria-label="Search address" @click.stop="runSearch()">
          <Search :size="20" :stroke-width="2" />
        </button>
      </div>

      <p v-if="searching" class="picker__banner" role="status">Searching addresses…</p>
      <p v-else-if="searchError" class="picker__banner picker__banner--error" role="alert">
        {{ searchError }}
      </p>
      <ul v-if="results.length" id="cafe-address-results" class="picker__results">
        <li v-for="result in results" :key="`${result.label}-${result.point.lat}-${result.point.lng}`">
          <button type="button" @mousedown.prevent @click="chooseResult(result)">
            {{ result.label }}
          </button>
        </li>
      </ul>
    </div>

    <div class="picker__map">
      <div ref="root" class="picker__canvas" />
      <button
        type="button"
        class="picker__locate"
        aria-label="Use my location"
        @click="useMyLocation"
      >
        <LocateFixed :size="20" :stroke-width="2" />
      </button>
    </div>

    <p v-if="!unrestricted && !inBounds" class="picker__banner picker__banner--error" role="alert">
      That pin is outside the Philippines.
    </p>

    <div class="picker__peek">
      <div v-if="overlay" class="picker__copy">
        <h2 id="picker-title">Pin the cafe</h2>
        <p>Drag the pin or search so the marker sits on the shop, not the next street.</p>
      </div>

      <p v-if="locationNote" class="picker__banner" role="status">{{ locationNote }}</p>

      <label class="picker__field">
        <span>Address</span>
        <textarea
          :value="address"
          rows="2"
          name="address"
          autocomplete="street-address"
          placeholder="Street, barangay, city"
          :aria-invalid="Boolean(addressIssue)"
          @input="emit('update:address', ($event.target as HTMLTextAreaElement).value)"
        />
      </label>
      <p v-if="addressIssue" class="picker__error" role="alert">{{ addressIssue }}</p>
    </div>
  </section>
</template>

<script lang="ts" setup>
import L from 'leaflet'
import type { Map as LeafletMap, Marker } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LocateFixed, Search } from 'lucide-vue-next'
import type { LatLng } from '~/types/cafe'
import { reverseGeocode, searchCoverageAddress, searchWorldAddress } from '~/utils/geocode'
import {
  METRO_MANILA_CENTER,
  coverageBounds,
  coverageRings,
  isInCoverage,
} from '~/utils/geography'

const props = defineProps<{
  lat: number | null
  lng: number | null
  address: string
  addressIssue?: string | null
  overlay?: boolean
  unrestricted?: boolean
}>()

const emit = defineEmits<{
  'update:lat': [value: number]
  'update:lng': [value: number]
  'update:address': [value: string]
}>()

const { status: locationStatus, location, requestLocation } = useDeviceLocation()
const config = useRuntimeConfig()
const root = ref<HTMLElement | null>(null)
const query = ref('')
const searchError = ref('')
const searching = ref(false)
const locationNote = ref('')
const results = ref<{ label: string; point: LatLng }[]>([])
let previousLookup = ''
let map: LeafletMap | null = null
let marker: Marker | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchAbort: AbortController | null = null
let searchSerial = 0

const fallback = METRO_MANILA_CENTER
const point = computed<LatLng>(() => ({
  lat: props.lat ?? fallback.lat,
  lng: props.lng ?? fallback.lng,
}))

const inBounds = computed(() => isInCoverage(point.value))

const pinHtml = `<span class="kd-cafe-pin__mark kd-cafe-pin__mark--logo" aria-hidden="true">
  <img src="/assets/kapedoko-logo_dark.png" alt="" width="32" height="42" />
</span>`

const makeIcon = () =>
  L.divIcon({
    className: 'kd-cafe-pin is-selected',
    html: pinHtml,
    iconSize: [40, 52],
    iconAnchor: [20, 50],
  })

const setPoint = async (next: LatLng, lookup = true) => {
  emit('update:lat', next.lat)
  emit('update:lng', next.lng)
  marker?.setLatLng([next.lat, next.lng])
  map?.panTo([next.lat, next.lng])
  if (!lookup) return
  const label = await reverseGeocode(next)
  if (label && !props.address.trim()) emit('update:address', label)
  if (label && props.address.trim() && props.address === previousLookup) {
    emit('update:address', label)
  }
  previousLookup = label ?? previousLookup
}

const scheduleSearch = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    void runSearch({ quiet: true })
  }, 350)
}

const runSearch = async (options?: { quiet?: boolean }) => {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }

  const term = query.value.trim()
  searchError.value = ''
  if (term.length < 3) {
    searchAbort?.abort()
    searching.value = false
    results.value = []
    if (term.length > 0 && !options?.quiet) searchError.value = 'Type at least 3 characters.'
    return
  }

  searchAbort?.abort()
  const abort = new AbortController()
  searchAbort = abort
  const serial = ++searchSerial
  searching.value = true
  results.value = []

  try {
    const found = props.unrestricted
      ? await searchWorldAddress(term, abort.signal)
      : await searchCoverageAddress(term, abort.signal)
    if (serial !== searchSerial || abort.signal.aborted) return
    if (!found.length) {
      searchError.value = props.unrestricted
        ? 'No addresses matched that search. Move the pin instead.'
        : 'No Philippine addresses matched that search. Move the pin instead.'
      return
    }
    results.value = found
  } catch {
    if (serial !== searchSerial || abort.signal.aborted) return
    searchError.value = 'Address search is unavailable. Move the pin instead.'
  } finally {
    if (serial === searchSerial) searching.value = false
  }
}

const chooseResult = async (result: { label: string; point: LatLng }) => {
  results.value = []
  query.value = result.label
  emit('update:address', result.label)
  previousLookup = result.label
  await setPoint(result.point, false)
}

const useMyLocation = async () => {
  locationNote.value = ''
  await requestLocation()
  if (!location.value || locationStatus.value !== 'granted') {
    locationNote.value = 'Location is off. Drag the pin onto the cafe instead.'
    return
  }
  if (!props.unrestricted && !isInCoverage(location.value)) {
    locationNote.value = 'Your location is outside the Philippines. Pin the cafe on the map instead.'
    return
  }
  await setPoint(location.value)
}

const regionBounds = () => {
  const bounds = coverageBounds()
  return L.latLngBounds(
    [bounds.south, bounds.west],
    [bounds.north, bounds.east],
  )
}

const regionLatLngs = () =>
  coverageRings().map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number]))

const init = () => {
  if (!root.value) return

  map = L.map(root.value, {
    zoomControl: false,
    attributionControl: true,
    ...(props.unrestricted
      ? {}
      : {
          maxBounds: regionBounds().pad(0.12),
          maxBoundsViscosity: 0.85,
        }),
  })
  map.attributionControl?.setPrefix('')
  map.setView([point.value.lat, point.value.lng], props.unrestricted ? 12 : 13)

  L.tileLayer(config.public.mapTiles.url, {
    attribution: config.public.mapTiles.attribution,
    maxZoom: 19,
  }).addTo(map)

  if (!props.unrestricted) {
    L.polygon(regionLatLngs(), {
      color: '#1c1917',
      weight: 1,
      fill: false,
      interactive: false,
    }).addTo(map)
  }

  marker = L.marker([point.value.lat, point.value.lng], {
    icon: makeIcon(),
    draggable: true,
    autoPan: true,
    keyboard: true,
    title: 'Cafe location',
  }).addTo(map)

  marker.on('dragend', () => {
    const next = marker?.getLatLng()
    if (!next) return
    void setPoint({ lat: next.lat, lng: next.lng })
  })

  map.on('click', (event) => {
    void setPoint({ lat: event.latlng.lat, lng: event.latlng.lng })
  })

  if (props.lat == null || props.lng == null) {
    void setPoint(fallback)
  }

  requestAnimationFrame(() => map?.invalidateSize({ animate: false }))
  window.setTimeout(() => map?.invalidateSize({ animate: false }), 80)
  window.setTimeout(() => map?.invalidateSize({ animate: false }), 320)
}

onMounted(() => {
  try {
    init()
  } catch {
    searchError.value = 'The map couldn’t load. Check your connection, then try again.'
  }
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
  searchAbort?.abort()
  map?.remove()
  map = null
  marker = null
})
</script>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  flex: 1;
}

.picker.is-overlay {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 0;
  height: 100%;
  min-height: 0;
}

.picker__copy h2 {
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.picker__copy p,
.picker__error {
  margin: 8px 0 0;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  line-height: 1.3;
}

.picker__error {
  color: var(--kd-destructive);
  font-weight: 700;
}

.picker__search {
  position: relative;
  z-index: 2;
}

.picker.is-overlay .picker__search {
  position: absolute;
  z-index: 40;
  top: calc(max(2.75rem, env(safe-area-inset-top) + 16px) + 62px);
  left: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  grid-row: 1;
  pointer-events: auto;
}

.picker__search-field {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 8px 0 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #ffffff;
}

.picker__search-field input,
.picker__field textarea {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 400;
  font-family: inherit;
  caret-color: var(--kd-primary);
}

.picker__search-field input {
  font-size: 0.95rem;
  font-weight: 700;
}

.picker__field textarea {
  font-size: 0.7875rem;
  line-height: 1.3;
}

.picker__search-field input::-webkit-search-decoration,
.picker__search-field input::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

.picker__search-field input::placeholder,
.picker__field textarea::placeholder {
  color: color-mix(in srgb, var(--kd-ink) 45%, transparent);
  font-weight: 400;
}

.picker__field textarea {
  display: block;
  min-height: 64px;
  max-height: 88px;
  padding: 12px 16px;
  overflow: auto;
  resize: none;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.picker__search-field input:focus,
.picker__field textarea:focus {
  outline: none;
}

.picker__search-field:focus-within {
  border-color: color-mix(in srgb, var(--kd-ink) 34%, transparent);
  box-shadow: inset 0 -1px 0 var(--kd-primary);
}

.picker__field textarea:focus {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.picker__icon-btn,
.picker__locate {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: var(--kd-ink);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.picker__locate {
  position: absolute;
  z-index: 500;
  right: 20px;
  bottom: 16px;
  width: 48px;
  height: 48px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  background: #ffffff;
}

.picker__banner {
  position: relative;
  z-index: 2;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
  border-radius: 16px;
  background: #ffffff;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  line-height: 1.3;
}

.picker.is-overlay .picker__banner {
  position: absolute;
  top: calc(max(2.75rem, env(safe-area-inset-top) + 16px) + 122px);
  left: 20px;
  right: 20px;
  grid-row: 1;
}

.picker.is-overlay .picker__peek .picker__banner {
  position: static;
  top: auto;
  left: auto;
  right: auto;
  margin: 8px 0 0;
}

.picker__banner--error {
  color: var(--kd-destructive);
  font-weight: 700;
}

.picker__results {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 0;
  margin: 8px 0 0;
  padding: 6px;
  list-style: none;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #ffffff;
}

.picker.is-overlay .picker__search .picker__banner,
.picker.is-overlay .picker__search .picker__results {
  position: static;
  top: auto;
  left: auto;
  right: auto;
  margin: 0;
}

.picker.is-overlay .picker__results {
  max-height: 36vh;
  overflow: auto;
}

.picker__results button {
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
}

.picker__results button:hover,
.picker__results button:active {
  background: #f2f2f2;
}

.picker__map {
  position: relative;
  flex: 1;
  min-height: 240px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #f2f2f2;
}

.picker.is-overlay .picker__map {
  position: relative;
  z-index: 0;
  grid-row: 1;
  flex: none;
  min-height: 0;
  height: 100%;
  border: 0;
  border-radius: 0;
}

.picker__canvas {
  width: 100%;
  height: 100%;
  min-height: 240px;
}

.picker.is-overlay .picker__canvas {
  min-height: 0;
}

.picker__peek {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.picker.is-overlay .picker__peek {
  grid-row: 2;
  margin-top: auto;
  padding: 16px 20px 8px;
  border-radius: 16px 16px 0 0;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
  background: #f2f2f2;
  animation: submit-peek 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes submit-peek {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.picker__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
}

.picker :deep(.leaflet-container) {
  width: 100%;
  height: 100%;
  font-family: inherit;
  background: #f2f2f2;
}

.picker :deep(.leaflet-tile-pane) {
  filter: sepia(0.32) saturate(0.62) hue-rotate(-12deg) brightness(1.03);
}

.picker :deep(.leaflet-control-attribution) {
  max-width: min(72vw, 280px);
  margin: 0 12px 10px 0;
  padding: 4px 8px;
  border-radius: 8px;
  background: color-mix(in srgb, #ffffff 88%, transparent);
  color: var(--kd-ink);
  font-size: 0.75rem;
}

.picker.is-overlay :deep(.leaflet-control-attribution) {
  margin-bottom: 12px;
}

.picker :deep(.kd-cafe-pin) {
  display: grid;
  place-items: end center;
  filter: drop-shadow(0 4px 8px var(--kd-shadow));
}

.picker :deep(.kd-cafe-pin__mark--logo img) {
  display: block;
  width: 40px;
  height: 52px;
  object-fit: contain;
}

.picker__icon-btn:focus-visible,
.picker__locate:focus-visible,
.picker__results button:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.picker__icon-btn:active,
.picker__locate:active,
.picker__results button:active {
  transform: scale(0.94);
}

@media (prefers-reduced-motion: reduce) {
  .picker.is-overlay .picker__peek {
    animation: none;
  }

  .picker__icon-btn:active,
  .picker__locate:active,
  .picker__results button:active {
    transform: none;
  }
}

::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
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
</style>
