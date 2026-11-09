<template>
  <div class="kape-map" :class="{ 'is-sheet-open': sheetOpen }">
    <div ref="root" class="kape-map__canvas" />
  </div>
</template>

<script lang="ts" setup>
import L from 'leaflet'
import type { Circle, Map as LeafletMap, Marker, TileLayer } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Cafe, LatLng } from '~/types/cafe'
import type { KapeEvent } from '~/types/event'
import type { MarkerTier } from '~/types/shop'
import type { GeoBounds } from '~/utils/geography'
import { destinationPoint, distanceMeters, MAP_VIEW_RADIUS_M, SEARCH_RADIUS_M } from '~/utils/geo'
import { KAPEDOKO_BEAN_PIN_SRC, KAPEDOKO_MARK_SRC, isKapedokoMark } from '~/utils/logo'
import { escapeHtml, pinLabel, standardPinIsDot } from '~/utils/marker-tier'

const COINCIDENT_THRESHOLD_M = 30
const COINCIDENT_OFFSET_M = 45

const CUP_SVG = `<svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
  <circle cx="20" cy="20" r="16.2" fill="#372d25" stroke="#ffffff" stroke-width="3.2" paint-order="stroke fill" />
  <path d="M15.6 10.8v3.8M21.4 10.3v4.2" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />
  <path d="M11.4 16.4h14.4v7.4a3.7 3.7 0 0 1-3.7 3.7h-7a3.7 3.7 0 0 1-3.7-3.7z" fill="#ffffff" />
  <path d="M25.8 18.1c3.6.15 4.4 2.55 4.4 4s-1 3.9-4.45 4.05" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" />
</svg>`

const EVENT_PIN_SVG = `<svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
  <circle cx="20" cy="20" r="16.2" fill="#1F6F6B" stroke="#ffffff" stroke-width="3.2" paint-order="stroke fill" />
  <rect x="12.2" y="13.4" width="15.6" height="14.2" rx="2.2" stroke="#ffffff" stroke-width="2.1" />
  <path d="M12.2 18.2h15.6" stroke="#ffffff" stroke-width="2.1" />
  <path d="M16.2 11.2v4.2M23.8 11.2v4.2" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round" />
</svg>`

const props = withDefaults(defineProps<{
  center: LatLng
  accuracy: number
  cafes: Cafe[]
  events?: KapeEvent[]
  selectedId: string | null
  selectedEventId?: string | null
  sheetOpen: boolean
  headerPad: number
  bottomPad: number
}>(), {
  events: () => [],
  selectedEventId: null,
})

const emit = defineEmits<{
  tilesReady: []
  tilesError: []
  select: [id: string]
  selectEvent: [id: string]
  viewchange: [view: { bounds: GeoBounds; center: LatLng; zoom: number }]
}>()

const config = useRuntimeConfig()
const root = ref<HTMLElement | null>(null)

let map: LeafletMap | null = null
let tileLayer: TileLayer | null = null
let userMarker: Marker | null = null
let accuracyCircle: Circle | null = null
let radiusCircle: Circle | null = null
const cafeMarkers = new Map<string, Marker>()
const cafeMarkerKey = new Map<string, string>()
const eventMarkers = new Map<string, Marker>()
const eventMarkerKey = new Map<string, string>()
let tilesSettled = false
let sizeTimer: ReturnType<typeof window.setInterval> | null = null

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const cafeTier = (cafe: Cafe): MarkerTier => cafe.markerTier ?? 'standard'

const cafeLogoSrc = (cafe: Cafe) => (isKapedokoMark(cafe.image) ? null : cafe.image)

const labeledHtml = (mark: string, name: string) =>
  `<span class="kd-cafe-pin__stack" aria-hidden="true">${mark}<span class="kd-cafe-pin__label">${escapeHtml(pinLabel(name))}</span></span>`

const selectedHtml = () =>
  `<span class="kd-cafe-pin__mark kd-cafe-pin__mark--logo" aria-hidden="true">
    <img src="${KAPEDOKO_BEAN_PIN_SRC}" alt="" width="32" height="36" />
  </span>`

const cupHtml = () => `<span class="kd-cafe-pin__mark" aria-hidden="true">${CUP_SVG}</span>`

const eventMarkHtml = () => `<span class="kd-event-pin__mark" aria-hidden="true">${EVENT_PIN_SVG}</span>`

const eventPinHtml = (event: KapeEvent, selected: boolean) => {
  const mark = eventMarkHtml()
  if (!selected) return mark
  return labeledHtml(mark, event.name)
}

const makeEventIcon = (event: KapeEvent, selected: boolean, entering = false) => {
  const classes = ['leaflet-div-icon', 'kd-event-pin']
  if (selected) classes.push('is-selected', 'kd-event-pin--labeled')
  if (entering) classes.push('is-entering')
  return L.divIcon({
    className: classes.join(' '),
    html: eventPinHtml(event, selected),
    iconSize: selected ? [96, 66] : [36, 36],
    iconAnchor: selected ? [48, 22] : [18, 18],
  })
}

const dotHtml = () => `<span class="kd-cafe-pin__dot" aria-hidden="true"></span>`

const promotedHtml = (cafe: Cafe) => {
  const logo = cafeLogoSrc(cafe)
  const mark = logo
    ? `<span class="kd-cafe-pin__mark kd-cafe-pin__mark--promo" aria-hidden="true">
        <img src="${escapeHtml(logo)}" alt="" width="44" height="44" onerror="this.onerror=null;this.src='${KAPEDOKO_MARK_SRC}'" />
      </span>`
    : cupHtml()
  return labeledHtml(mark, cafe.name)
}

const iconKey = (cafe: Cafe, selected: boolean, zoom: number) => {
  const tier = cafeTier(cafe)
  const band = !selected && tier === 'standard' && standardPinIsDot(zoom) ? 'dot' : 'cup'
  return `${tier}|${selected ? 'sel' : 'idle'}|${band}|${cafeLogoSrc(cafe) ?? ''}|${cafe.name}`
}

const pinZIndex = (cafe: Cafe, selected: boolean) => {
  if (selected) return 800
  const tier = cafeTier(cafe)
  if (tier === 'promoted') return 650
  if (tier === 'partner') return 520
  return standardPinIsDot(map?.getZoom() ?? 16) ? 280 : 400
}

const makeCafeIcon = (cafe: Cafe, selected: boolean, entering = false) => {
  const zoom = map?.getZoom() ?? 16
  const tier = cafeTier(cafe)
  const classes = ['leaflet-div-icon', 'kd-cafe-pin']
  if (selected) classes.push('is-selected')
  if (entering) classes.push('is-entering')
  if (!selected && tier === 'standard' && standardPinIsDot(zoom)) classes.push('kd-cafe-pin--dot')
  if (!selected && tier === 'partner') classes.push('kd-cafe-pin--partner', 'kd-cafe-pin--labeled')
  if (!selected && tier === 'promoted') classes.push('kd-cafe-pin--promoted', 'kd-cafe-pin--labeled')

  let html = cupHtml()
  let width = 36
  let height = 36
  let anchor: [number, number] = [18, 18]

  if (selected) {
    html = selectedHtml()
    width = 40
    height = 44
    anchor = [20, 42]
  } else if (tier === 'promoted') {
    html = promotedHtml(cafe)
    width = 96
    height = 74
    anchor = [48, 26]
  } else if (tier === 'partner') {
    html = labeledHtml(cupHtml(), cafe.name)
    width = 96
    height = 66
    anchor = [48, 22]
  } else if (standardPinIsDot(zoom)) {
    html = dotHtml()
    width = 18
    height = 18
    anchor = [9, 9]
  }

  return L.divIcon({
    className: classes.join(' '),
    html,
    iconSize: [width, height],
    iconAnchor: anchor,
  })
}

const makeUserIcon = () => {
  return L.divIcon({
    className: 'leaflet-div-icon kd-user-dot',
    html: '<span class="kd-user-dot__pulse"></span><span class="kd-user-dot__core"></span>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

const fitToRadius = (animate = true) => {
  if (!map) return
  const lat = props.center.lat
  const lng = props.center.lng
  const latDelta = MAP_VIEW_RADIUS_M / 111_320
  const lngDelta = MAP_VIEW_RADIUS_M / (111_320 * Math.cos((lat * Math.PI) / 180))
  const bounds = L.latLngBounds(
    [lat - latDelta, lng - lngDelta],
    [lat + latDelta, lng + lngDelta],
  )

  map.fitBounds(bounds, {
    paddingTopLeft: [20, props.headerPad],
    paddingBottomRight: [20, props.bottomPad],
    maxZoom: 17,
    animate: animate && !prefersReducedMotion(),
  })
}

const syncUser = () => {
  if (!map) return
  const latlng: [number, number] = [props.center.lat, props.center.lng]

  if (!userMarker) {
    userMarker = L.marker(latlng, {
      icon: makeUserIcon(),
      zIndexOffset: 900,
      interactive: false,
      keyboard: false,
    }).addTo(map)
  } else {
    userMarker.setLatLng(latlng)
  }

  if (props.accuracy > 0) {
    const haloRadius = Math.min(Math.max(props.accuracy, 18), 220)
    if (!accuracyCircle) {
      accuracyCircle = L.circle(latlng, {
        radius: haloRadius,
        color: '#372d25',
        weight: 1,
        fillColor: '#372d25',
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(map)
    } else {
      accuracyCircle.setLatLng(latlng)
      accuracyCircle.setRadius(haloRadius)
    }
  } else if (accuracyCircle) {
    map.removeLayer(accuracyCircle)
    accuracyCircle = null
  }

  if (!radiusCircle) {
    radiusCircle = L.circle(latlng, {
      radius: SEARCH_RADIUS_M,
      stroke: false,
      fill: false,
      interactive: false,
    }).addTo(map)
  } else {
    radiusCircle.setLatLng(latlng)
  }
}

const markerLatLng = (cafe: Cafe, index: number, total: number): [number, number] | null => {
  const lat = Number(cafe.lat)
  const lng = Number(cafe.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const point = { lat, lng }
  if (distanceMeters(props.center, point) >= COINCIDENT_THRESHOLD_M) {
    return [lat, lng]
  }

  const bearing = total > 1 ? (360 / total) * index : 45
  const offset = destinationPoint(props.center, COINCIDENT_OFFSET_M, bearing)
  return [offset.lat, offset.lng]
}

const syncCafes = () => {
  if (!map) return
  const seen = new Set<string>()
  const zoom = map.getZoom()
  const view = map.getBounds().pad(0.04)
  const cafes = props.cafes.filter((cafe) => {
    if (!Number.isFinite(Number(cafe.lat)) || !Number.isFinite(Number(cafe.lng))) return false
    return cafe.id === props.selectedId || view.contains([cafe.lat, cafe.lng])
  })

  cafes.forEach((cafe, index) => {
    seen.add(cafe.id)
    const latlng = markerLatLng(cafe, index, cafes.length)
    if (!latlng) return
    const selected = cafe.id === props.selectedId
    const nextKey = iconKey(cafe, selected, zoom)
    const existing = cafeMarkers.get(cafe.id)

    if (!existing) {
      const marker = L.marker(latlng, {
        icon: makeCafeIcon(cafe, selected, true),
        title: cafe.name,
        keyboard: true,
        zIndexOffset: pinZIndex(cafe, selected),
      })
      marker.on('click', () => emit('select', cafe.id))
      marker.addTo(map)
      cafeMarkers.set(cafe.id, marker)
      cafeMarkerKey.set(cafe.id, nextKey)
      window.setTimeout(() => {
        marker.getElement()?.classList.remove('is-entering')
      }, 450)
    } else {
      const current = existing.getLatLng()
      if (current.lat !== latlng[0] || current.lng !== latlng[1]) {
        existing.setLatLng(latlng)
      }
      if (cafeMarkerKey.get(cafe.id) !== nextKey) {
        existing.setIcon(makeCafeIcon(cafe, selected, false))
        existing.setZIndexOffset(pinZIndex(cafe, selected))
        cafeMarkerKey.set(cafe.id, nextKey)
      }
    }
  })

  for (const [id, marker] of cafeMarkers) {
    if (seen.has(id)) continue
    map.removeLayer(marker)
    cafeMarkers.delete(id)
    cafeMarkerKey.delete(id)
  }
}

const syncEvents = () => {
  if (!map) return
  const seen = new Set<string>()
  const view = map.getBounds().pad(0.04)
  const events = props.events.filter((event) => {
    if (!Number.isFinite(Number(event.lat)) || !Number.isFinite(Number(event.lng))) return false
    return event.id === props.selectedEventId || view.contains([event.lat, event.lng])
  })

  events.forEach((event) => {
    seen.add(event.id)
    const latlng: [number, number] = [event.lat, event.lng]
    const selected = event.id === props.selectedEventId
    const nextKey = `${selected ? 'sel' : 'idle'}|${event.name}`
    const existing = eventMarkers.get(event.id)

    if (!existing) {
      const marker = L.marker(latlng, {
        icon: makeEventIcon(event, selected, true),
        title: event.name,
        keyboard: true,
        zIndexOffset: selected ? 820 : 600,
      })
      marker.on('click', () => emit('selectEvent', event.id))
      marker.addTo(map)
      eventMarkers.set(event.id, marker)
      eventMarkerKey.set(event.id, nextKey)
      window.setTimeout(() => {
        marker.getElement()?.classList.remove('is-entering')
      }, 450)
    } else {
      const current = existing.getLatLng()
      if (current.lat !== latlng[0] || current.lng !== latlng[1]) {
        existing.setLatLng(latlng)
      }
      if (eventMarkerKey.get(event.id) !== nextKey) {
        existing.setIcon(makeEventIcon(event, selected, false))
        existing.setZIndexOffset(selected ? 820 : 600)
        eventMarkerKey.set(event.id, nextKey)
      }
    }
  })

  for (const [id, marker] of eventMarkers) {
    if (seen.has(id)) continue
    map.removeLayer(marker)
    eventMarkers.delete(id)
    eventMarkerKey.delete(id)
  }
}

const focusPoint = (point: { lat: number; lng: number }, extraBottom = 0) => {
  if (!map) return
  const target = map.project([point.lat, point.lng], map.getZoom())
  target.y += extraBottom / 2
  const latlng = map.unproject(target, map.getZoom())
  map.panTo(latlng, { animate: !prefersReducedMotion() })
}

const focusCafe = (cafe: Cafe, extraBottom = 0) => {
  focusPoint(cafe, extraBottom)
}

const emitView = () => {
  if (!map) return
  const bounds = map.getBounds()
  const mapCenter = map.getCenter()
  emit('viewchange', {
    bounds: {
      south: bounds.getSouth(),
      north: bounds.getNorth(),
      west: bounds.getWest(),
      east: bounds.getEast(),
    },
    center: { lat: mapCenter.lat, lng: mapCenter.lng },
    zoom: map.getZoom(),
  })
}

const invalidate = () => {
  map?.invalidateSize({ animate: false })
}

const destroy = () => {
  if (sizeTimer) {
    window.clearInterval(sizeTimer)
    sizeTimer = null
  }
  if (!map) return
  map.remove()
  map = null
  tileLayer = null
  userMarker = null
  accuracyCircle = null
  radiusCircle = null
  cafeMarkers.clear()
  cafeMarkerKey.clear()
  eventMarkers.clear()
  eventMarkerKey.clear()
}

const init = () => {
  if (!root.value) return

  destroy()
  tilesSettled = false

  map = L.map(root.value, {
    zoomControl: false,
    attributionControl: true,
    fadeAnimation: !prefersReducedMotion(),
    zoomAnimation: !prefersReducedMotion(),
    markerZoomAnimation: !prefersReducedMotion(),
  })

  map.attributionControl?.setPrefix('')
  map.setView([props.center.lat, props.center.lng], 16)

  tileLayer = L.tileLayer(config.public.mapTiles.url, {
    attribution: config.public.mapTiles.attribution,
    maxZoom: 19,
  })

  const markReady = () => {
    if (tilesSettled) return
    tilesSettled = true
    emit('tilesReady')
    requestAnimationFrame(() => invalidate())
  }

  tileLayer.on('load', markReady)
  tileLayer.on('tileload', markReady)

  tileLayer.on('tileerror', () => {
    window.setTimeout(() => {
      if (!tilesSettled) {
        tilesSettled = true
        emit('tilesError')
      }
    }, 8000)
  })

  tileLayer.addTo(map)
  syncUser()
  syncCafes()
  syncEvents()
  map.on('moveend', () => {
    syncEvents()
    emitView()
  })
  map.on('zoomend', () => {
    syncCafes()
    syncEvents()
    emitView()
  })
  fitToRadius(false)
  requestAnimationFrame(() => {
    invalidate()
    emitView()
  })
  sizeTimer = window.setInterval(() => invalidate(), 250)
  window.setTimeout(() => {
    if (sizeTimer) {
      window.clearInterval(sizeTimer)
      sizeTimer = null
    }
  }, 1200)

  window.setTimeout(() => {
    if (!tilesSettled) {
      tilesSettled = true
      emit('tilesError')
    }
  }, 14000)
}

onMounted(() => {
  try {
    init()
  } catch {
    emit('tilesError')
  }
  window.addEventListener('resize', invalidate)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', invalidate)
  destroy()
})

watch(
  () => [props.center.lat, props.center.lng, props.accuracy],
  () => {
    syncUser()
    syncCafes()
    syncEvents()
  },
)

watch(
  () =>
    props.cafes
      .map((cafe) => `${cafe.id}:${cafe.markerTier}:${cafe.image}:${cafe.name}`)
      .join('|'),
  () => syncCafes(),
)

watch(
  () => props.selectedId,
  () => syncCafes(),
)

watch(
  () =>
    props.events
      .map((event) => `${event.id}:${event.name}`)
      .join('|'),
  () => syncEvents(),
)

watch(
  () => props.selectedEventId,
  () => syncEvents(),
)

watch(
  () => [props.headerPad, props.bottomPad],
  () => invalidate(),
)

defineExpose({
  recenter: () => fitToRadius(),
  focusCafe,
  focusEvent: focusPoint,
  invalidate,
})
</script>

<style scoped>
.kape-map {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--kd-secondary);
}

.kape-map__canvas {
  width: 100%;
  height: 100%;
}

.kape-map :deep(.leaflet-container) {
  width: 100%;
  height: 100%;
  font-family: inherit;
  background: var(--kd-secondary);
}

.kape-map :deep(img.leaflet-tile) {
  max-width: none !important;
  max-height: none !important;
}

.kape-map :deep(.leaflet-tile-pane) {
  filter: sepia(0.32) saturate(0.62) hue-rotate(-12deg) brightness(1.03);
}

.kape-map :deep(.leaflet-control-attribution) {
  max-width: min(72vw, 280px);
  margin: 0 12px 10px 0;
  padding: 4px 8px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--kd-white) 88%, transparent);
  color: var(--kd-ink);
  font-size: 10px;
  line-height: 1.3;
}

.kape-map :deep(.leaflet-control-attribution a) {
  color: var(--kd-ink);
}

.kape-map :deep(.leaflet-bottom) {
  bottom: calc(env(safe-area-inset-bottom) + 132px);
  z-index: 1;
  pointer-events: auto;
}

.kape-map.is-sheet-open :deep(.leaflet-bottom) {
  bottom: calc(52vh + 12px);
}

.kape-map :deep(.leaflet-marker-pane) {
  z-index: 600;
  /* Keep markers off the tile-pane sepia/saturate filter so bean artwork stays true. */
  filter: none;
}

.kape-map :deep(.leaflet-div-icon.kd-cafe-pin),
.kape-map :deep(.leaflet-div-icon.kd-event-pin),
.kape-map :deep(.leaflet-div-icon.kd-user-dot) {
  background: transparent;
  border: 0;
}

.kape-map :deep(.kd-cafe-pin),
.kape-map :deep(.kd-event-pin) {
  display: grid;
  place-items: center;
  color: var(--kd-ink);
}

.kape-map :deep(.kd-cafe-pin.is-selected) {
  place-items: end center;
}

.kape-map :deep(.kd-cafe-pin--labeled) {
  place-items: start center;
}

.kape-map :deep(.kd-cafe-pin:focus-visible) {
  outline: 2px solid var(--kd-white);
  outline-offset: 2px;
  border-radius: 999px;
}

.kape-map :deep(.kd-cafe-pin.is-selected:focus-visible),
.kape-map :deep(.kd-cafe-pin--labeled:focus-visible) {
  border-radius: 8px;
}

.kape-map :deep(.kd-cafe-pin__stack) {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.kape-map :deep(.kd-cafe-pin__mark) {
  display: block;
  width: 36px;
  height: 36px;
  filter: drop-shadow(0 3px 5px var(--kd-shadow));
  transform-origin: center center;
}

.kape-map :deep(.kd-cafe-pin.is-entering .kd-cafe-pin__mark),
.kape-map :deep(.kd-cafe-pin.is-entering .kd-cafe-pin__dot) {
  animation: kd-pin-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.kape-map :deep(.kd-cafe-pin.is-selected .kd-cafe-pin__mark) {
  width: 40px;
  height: 44px;
  transform: scale(1.08);
  transform-origin: center bottom;
  filter: drop-shadow(0 4px 8px var(--kd-shadow));
}

.kape-map :deep(.kd-cafe-pin--partner .kd-cafe-pin__mark) {
  width: 44px;
  height: 44px;
}

.kape-map :deep(.kd-cafe-pin--promoted .kd-cafe-pin__mark) {
  width: 52px;
  height: 52px;
  filter: drop-shadow(0 6px 12px var(--kd-shadow));
}

.kape-map :deep(.kd-cafe-pin svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.kape-map :deep(.kd-cafe-pin__mark--logo img),
.kape-map :deep(.kd-cafe-pin__mark--promo img) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  object-fit: contain;
}

.kape-map :deep(.kd-cafe-pin__mark--promo) {
  overflow: hidden;
  border-radius: 999px;
  background: var(--kd-white);
  box-shadow: 0 0 0 3px var(--kd-white), 0 0 0 5px var(--kd-primary);
}

.kape-map :deep(.kd-cafe-pin__mark--promo img) {
  object-fit: cover;
}

.kape-map :deep(.kd-cafe-pin__label) {
  max-width: 88px;
  margin-top: 3px;
  padding: 2px 6px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--kd-white);
  color: var(--kd-ink);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  text-overflow: ellipsis;
  box-shadow: 0 2px 6px var(--kd-shadow);
}

.kape-map :deep(.kd-cafe-pin--promoted .kd-cafe-pin__label) {
  box-shadow: 0 3px 8px var(--kd-shadow);
}

.kape-map :deep(.kd-event-pin) {
  color: var(--kd-primary);
}

.kape-map :deep(.kd-event-pin__mark) {
  display: block;
  width: 36px;
  height: 36px;
  filter: drop-shadow(0 3px 5px var(--kd-shadow));
  transform-origin: center center;
}

.kape-map :deep(.kd-event-pin.is-selected .kd-event-pin__mark) {
  width: 40px;
  height: 40px;
  filter: drop-shadow(0 4px 8px var(--kd-shadow));
}

.kape-map :deep(.kd-event-pin svg) {
  display: block;
  width: 100%;
  height: 100%;
}

.kape-map :deep(.kd-event-pin.is-entering .kd-event-pin__mark) {
  animation: kd-pin-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.kape-map :deep(.kd-event-pin--labeled) {
  place-items: start center;
}

.kape-map :deep(.kd-event-pin:focus-visible) {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
  border-radius: 999px;
}

.kape-map :deep(.kd-cafe-pin__dot) {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--kd-accent);
  border: 2px solid var(--kd-white);
  box-shadow: 0 2px 6px var(--kd-shadow);
}

.kape-map :deep(.kd-user-dot) {
  display: grid;
  place-items: center;
}

.kape-map :deep(.kd-user-dot__core) {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--kd-accent);
  border: 2px solid var(--kd-white);
  box-shadow: 0 2px 6px var(--kd-shadow);
}

.kape-map :deep(.kd-user-dot__pulse) {
  position: absolute;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--kd-accent);
  animation: kd-user-pulse 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

@keyframes kd-pin-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.86);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes kd-user-pulse {
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
  .kape-map :deep(.kd-cafe-pin.is-entering .kd-cafe-pin__mark),
  .kape-map :deep(.kd-cafe-pin.is-entering .kd-cafe-pin__dot),
  .kape-map :deep(.kd-event-pin.is-entering .kd-event-pin__mark),
  .kape-map :deep(.kd-user-dot__pulse) {
    animation: none;
  }
}
</style>
