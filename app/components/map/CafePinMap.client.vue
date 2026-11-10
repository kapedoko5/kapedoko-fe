<template>
  <section
    v-if="hasPoint"
    class="cafe-pin-map"
    :class="{ 'is-passthrough': passthroughScroll }"
    :aria-labelledby="titleId"
  >
    <h3 :id="titleId">{{ placeLine }}</h3>

    <div class="cafe-pin-map__frame">
      <div ref="root" class="cafe-pin-map__canvas" />

      <div v-if="tilesFailed" class="cafe-pin-map__fail" role="alert">
        <p>Map didn’t load.</p>
        <a :href="mapsHref" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
      </div>

      <div class="cafe-pin-map__tools">
        <div class="cafe-pin-map__zoom" role="group" aria-label="Zoom">
          <button type="button" aria-label="Zoom in" :disabled="!mapReady" @click="zoomBy(1)">
            <Plus :size="18" :stroke-width="2.25" aria-hidden="true" />
          </button>
          <button type="button" aria-label="Zoom out" :disabled="!mapReady" @click="zoomBy(-1)">
            <Minus :size="18" :stroke-width="2.25" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          class="cafe-pin-map__locate"
          :aria-label="locating ? 'Finding your location' : 'Show my location'"
          :disabled="!mapReady || locating"
          @click="showMe"
        >
          <LocateFixed :size="18" :stroke-width="2.25" aria-hidden="true" />
        </button>
      </div>

      <button
        v-if="drifted"
        type="button"
        class="cafe-pin-map__back"
        @click="backToShop"
      >
        {{ kind === 'event' ? 'Back to the event' : 'Back to the shop' }}
      </button>
    </div>

    <p v-if="locationNote" class="cafe-pin-map__note" role="status">{{ locationNote }}</p>
  </section>
</template>

<script lang="ts" setup>
import L from 'leaflet'
import type { Map as LeafletMap, Marker } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LocateFixed, Minus, Plus } from 'lucide-vue-next'
import { KAPEDOKO_BEAN_PIN_SRC } from '~/utils/logo'
import { cafeHasMapPoint, cafePlaceLine } from '~/utils/maps'
import { escapeHtml, pinLabel } from '~/utils/marker-tier'

const props = withDefaults(defineProps<{
  lat: number
  lng: number
  name: string
  address: string
  mapsHref: string
  kind?: 'cafe' | 'event'
  passthroughScroll?: boolean
}>(), {
  kind: 'cafe',
  passthroughScroll: false,
})

const config = useRuntimeConfig()
const { status: locationStatus, location, requestLocation } = useDeviceLocation()
const root = ref<HTMLElement | null>(null)
const mapReady = ref(false)
const tilesFailed = ref(false)
const drifted = ref(false)
const locating = ref(false)
const locationNote = ref('')
const titleId = useId()

let map: LeafletMap | null = null
let shopMarker: Marker | null = null
let youMarker: Marker | null = null
let resizeObserver: ResizeObserver | null = null
let failTimer: ReturnType<typeof window.setTimeout> | null = null

const hasPoint = computed(() => cafeHasMapPoint(props.lat, props.lng))
const placeLine = computed(() => cafePlaceLine(props.address, props.name))

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const shopLatLng = (): [number, number] => [Number(props.lat), Number(props.lng)]

const EVENT_PIN_SVG = `<svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
  <circle cx="20" cy="20" r="16.2" fill="#1F6F6B" stroke="#ffffff" stroke-width="3.2" paint-order="stroke fill" />
  <rect x="12.2" y="13.4" width="15.6" height="14.2" rx="2.2" stroke="#ffffff" stroke-width="2.1" />
  <path d="M12.2 18.2h15.6" stroke="#ffffff" stroke-width="2.1" />
  <path d="M16.2 11.2v4.2M23.8 11.2v4.2" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round" />
</svg>`

const pinHtml = () => {
  const mark = props.kind === 'event'
    ? `<span class="kd-cafe-pin__mark kd-event-pin__mark" aria-hidden="true">${EVENT_PIN_SVG}</span>`
    : `<span class="kd-cafe-pin__mark kd-cafe-pin__mark--logo">
        <img src="${KAPEDOKO_BEAN_PIN_SRC}" alt="" width="32" height="36" />
      </span>`
  return `<span class="kd-cafe-pin__stack" aria-hidden="true">
    ${mark}
    <span class="kd-cafe-pin__label">${escapeHtml(pinLabel(props.name, 18))}</span>
  </span>`
}

const makeShopIcon = (entering: boolean) =>
  L.divIcon({
    className: `leaflet-div-icon kd-cafe-pin is-selected kd-cafe-pin--labeled${props.kind === 'event' ? ' kd-event-pin' : ''}${entering ? ' is-entering' : ''}`,
    html: pinHtml(),
    iconSize: [108, 72],
    iconAnchor: [54, 44],
  })

const makeYouIcon = () =>
  L.divIcon({
    className: 'leaflet-div-icon kd-user-dot',
    html: '<span class="kd-user-dot__pulse"></span><span class="kd-user-dot__core"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })

const updateDrift = () => {
  if (!map) {
    drifted.value = false
    return
  }
  drifted.value = map.distance(map.getCenter(), shopLatLng()) > 140
}

const zoomBy = (delta: number) => {
  if (!map) return
  map.setZoom(map.getZoom() + delta, { animate: !prefersReducedMotion() })
}

const backToShop = () => {
  if (!map) return
  map.panTo(shopLatLng(), { animate: !prefersReducedMotion() })
}

const showMe = async () => {
  if (!map) return
  locationNote.value = ''
  locating.value = true
  try {
    await requestLocation()
    if (!location.value || locationStatus.value !== 'granted') {
      locationNote.value = props.kind === 'event'
        ? 'Location is off. The pin is still the event.'
        : 'Location is off. The pin is still the shop.'
      return
    }
    const here: [number, number] = [location.value.lat, location.value.lng]
    if (!youMarker) {
      youMarker = L.marker(here, {
        icon: makeYouIcon(),
        interactive: false,
        keyboard: false,
        zIndexOffset: 700,
      }).addTo(map)
    } else {
      youMarker.setLatLng(here)
    }
    map.panTo(here, { animate: !prefersReducedMotion() })
  } finally {
    locating.value = false
  }
}

const destroy = () => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (failTimer) {
    window.clearTimeout(failTimer)
    failTimer = null
  }
  map?.remove()
  map = null
  shopMarker = null
  youMarker = null
  mapReady.value = false
}

const init = () => {
  if (!root.value || !hasPoint.value) return
  destroy()
  tilesFailed.value = false
  locationNote.value = ''
  drifted.value = false

  map = L.map(root.value, {
    zoomControl: false,
    attributionControl: true,
    dragging: !props.passthroughScroll,
    touchZoom: !props.passthroughScroll,
    scrollWheelZoom: false,
    fadeAnimation: !prefersReducedMotion(),
    zoomAnimation: !prefersReducedMotion(),
    markerZoomAnimation: !prefersReducedMotion(),
  })
  map.attributionControl?.setPrefix('')
  map.setView(shopLatLng(), 16)

  const tiles = L.tileLayer(config.public.mapTiles.url, {
    attribution: config.public.mapTiles.attribution,
    maxZoom: 19,
  })

  const markReady = () => {
    if (mapReady.value) return
    mapReady.value = true
    if (failTimer) {
      window.clearTimeout(failTimer)
      failTimer = null
    }
    requestAnimationFrame(() => map?.invalidateSize({ animate: false }))
  }

  tiles.on('load', markReady)
  tiles.on('tileload', markReady)
  failTimer = window.setTimeout(() => {
    if (!mapReady.value) tilesFailed.value = true
  }, 8000)
  tiles.addTo(map)

  shopMarker = L.marker(shopLatLng(), {
    icon: makeShopIcon(true),
    title: props.name,
    keyboard: true,
    zIndexOffset: 800,
  }).addTo(map)
  window.setTimeout(() => {
    shopMarker?.getElement()?.classList.remove('is-entering')
  }, 480)

  map.on('moveend', updateDrift)
  map.on('zoomend', updateDrift)

  resizeObserver = new ResizeObserver(() => map?.invalidateSize({ animate: false }))
  resizeObserver.observe(root.value)
  requestAnimationFrame(() => map?.invalidateSize({ animate: false }))
}

onMounted(() => {
  if (hasPoint.value) init()
})

onBeforeUnmount(destroy)

watch(
  () => [props.name, props.kind] as const,
  () => {
    shopMarker?.setIcon(makeShopIcon(false))
  },
)

watch(
  () => [props.lat, props.lng] as const,
  () => {
    if (!hasPoint.value) {
      destroy()
      return
    }
    if (!map) {
      init()
      return
    }
    shopMarker?.setLatLng(shopLatLng())
    map.setView(shopLatLng(), map.getZoom(), { animate: false })
    updateDrift()
  },
)
</script>

<style scoped>
.cafe-pin-map {
  margin-top: 22px;
  color: var(--kd-ink);
  font-family: 'Kumbh Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.cafe-pin-map h3 {
  margin: 0 0 10px;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.cafe-pin-map__frame {
  position: relative;
  overflow: hidden;
  height: 240px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.cafe-pin-map__canvas {
  width: 100%;
  height: 100%;
  touch-action: none;
}

.cafe-pin-map.is-passthrough .cafe-pin-map__canvas {
  touch-action: pan-y;
}

.cafe-pin-map :deep(.leaflet-container) {
  width: 100%;
  height: 100%;
  font-family: inherit;
  background: #faf8f5;
}

.cafe-pin-map :deep(img.leaflet-tile) {
  max-width: none !important;
  max-height: none !important;
}

.cafe-pin-map :deep(.leaflet-tile-pane) {
  filter: sepia(0.32) saturate(0.62) hue-rotate(-12deg) brightness(1.03);
}

.cafe-pin-map :deep(.leaflet-control-attribution) {
  max-width: min(58vw, 220px);
  margin: 0 8px 8px 0;
  padding: 3px 7px;
  border-radius: 4px;
  background: color-mix(in srgb, #faf8f5 90%, transparent);
  color: var(--kd-ink);
  font-size: 10px;
  line-height: 1.3;
}

.cafe-pin-map :deep(.leaflet-control-attribution a) {
  color: var(--kd-ink);
}

.cafe-pin-map :deep(.leaflet-marker-pane) {
  filter: none;
}

.cafe-pin-map :deep(.leaflet-div-icon.kd-cafe-pin),
.cafe-pin-map :deep(.leaflet-div-icon.kd-user-dot) {
  background: transparent;
  border: 0;
}

.cafe-pin-map :deep(.kd-cafe-pin) {
  display: grid;
  place-items: start center;
  color: var(--kd-ink);
}

.cafe-pin-map :deep(.kd-cafe-pin__stack) {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.cafe-pin-map :deep(.kd-cafe-pin__mark) {
  display: block;
  width: 40px;
  height: 44px;
  filter: drop-shadow(0 4px 8px color-mix(in srgb, #000 16%, transparent));
  transform-origin: center bottom;
}

.cafe-pin-map :deep(.kd-cafe-pin.is-entering .kd-cafe-pin__mark),
.cafe-pin-map :deep(.kd-cafe-pin.is-entering .kd-cafe-pin__label) {
  animation: cafe-pin-drop 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.cafe-pin-map :deep(.kd-cafe-pin.is-entering .kd-cafe-pin__label) {
  animation-delay: 80ms;
}

.cafe-pin-map :deep(.kd-event-pin__mark svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.cafe-pin-map :deep(.kd-cafe-pin__mark--logo img) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  object-fit: contain;
}

.cafe-pin-map :deep(.kd-cafe-pin__label) {
  max-width: 96px;
  margin-top: 4px;
  padding: 3px 8px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 8px;
  background: #faf8f5;
  color: var(--kd-ink);
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  text-overflow: ellipsis;
  box-shadow: 0 3px 8px color-mix(in srgb, #000 12%, transparent);
}

.cafe-pin-map :deep(.kd-user-dot) {
  display: grid;
  place-items: center;
}

.cafe-pin-map :deep(.kd-user-dot__core) {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--kd-accent);
  border: 2px solid #ffffff;
  box-shadow: 0 2px 6px color-mix(in srgb, #000 16%, transparent);
}

.cafe-pin-map :deep(.kd-user-dot__pulse) {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--kd-accent);
  animation: cafe-you-pulse 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

.cafe-pin-map__tools {
  position: absolute;
  z-index: 400;
  top: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cafe-pin-map__zoom,
.cafe-pin-map__locate {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  box-shadow: 0 4px 10px color-mix(in srgb, #000 8%, transparent);
}

.cafe-pin-map__zoom {
  display: flex;
  flex-direction: column;
}

.cafe-pin-map__zoom button,
.cafe-pin-map__locate {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.cafe-pin-map__zoom button + button {
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
}

.cafe-pin-map__zoom button:disabled,
.cafe-pin-map__locate:disabled {
  opacity: 0.45;
  cursor: default;
}

.cafe-pin-map__fail {
  position: absolute;
  inset: 0;
  z-index: 500;
  display: grid;
  place-content: center;
  gap: 8px;
  padding: 20px;
  background: color-mix(in srgb, #faf8f5 92%, transparent);
  text-align: center;
}

.cafe-pin-map__fail p {
  margin: 0;
  font-size: 0.7875rem;
  font-weight: 700;
}

.cafe-pin-map__fail a {
  color: var(--kd-primary);
  font-size: 0.7875rem;
  font-weight: 700;
}

.cafe-pin-map__back {
  position: absolute;
  z-index: 400;
  left: 50%;
  bottom: 28px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--kd-accent);
  border-radius: 16px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
  font-family: inherit;
  white-space: nowrap;
  transform: translateX(-50%);
  cursor: pointer;
  box-shadow: 0 4px 12px color-mix(in srgb, #000 12%, transparent);
  -webkit-tap-highlight-color: transparent;
}

.cafe-pin-map__note {
  margin: 8px 0 0;
  font-size: 0.75rem;
  line-height: 1.3;
}

.cafe-pin-map__zoom button:focus-visible,
.cafe-pin-map__locate:focus-visible,
.cafe-pin-map__back:focus-visible,
.cafe-pin-map__fail a:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.cafe-pin-map__zoom button:active,
.cafe-pin-map__locate:active,
.cafe-pin-map__back:active {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

@media (hover: hover) {
  .cafe-pin-map__zoom button:hover,
  .cafe-pin-map__locate:hover {
    background: color-mix(in srgb, var(--kd-ink) 4%, #faf8f5);
  }

  .cafe-pin-map__back:hover {
    box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
  }
}

:root.is-android .cafe-pin-map__zoom button,
:root.is-android .cafe-pin-map__locate,
:root.is-android .cafe-pin-map__back {
  min-height: 48px;
  height: 48px;
}

:root.is-android .cafe-pin-map__locate,
:root.is-android .cafe-pin-map__zoom button {
  width: 48px;
}

@keyframes cafe-pin-drop {
  from {
    opacity: 0;
    filter: blur(2px);
    transform: translateY(-18px) scale(1.12);
  }
  to {
    opacity: 1;
    filter: none;
    transform: translateY(0) scale(1);
  }
}

@keyframes cafe-you-pulse {
  0% {
    transform: scale(1);
    opacity: 0.45;
  }
  70% {
    transform: scale(2.6);
    opacity: 0;
  }
  100% {
    transform: scale(2.6);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cafe-pin-map :deep(.kd-cafe-pin.is-entering .kd-cafe-pin__mark),
  .cafe-pin-map :deep(.kd-cafe-pin.is-entering .kd-cafe-pin__label),
  .cafe-pin-map :deep(.kd-user-dot__pulse) {
    animation: none;
  }

  .cafe-pin-map__zoom button:active,
  .cafe-pin-map__locate:active,
  .cafe-pin-map__back:active {
    box-shadow: none;
  }
}
</style>
