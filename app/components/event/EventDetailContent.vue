<template>
  <div class="event-detail" :class="`event-detail--${variant}`">
    <header class="event-detail__header">
      <h2>{{ event.name }}</h2>
      <button
        v-if="showClose"
        type="button"
        class="event-detail__close"
        aria-label="Close event details"
        @click="emit('close')"
      >
        <X :size="18" :stroke-width="2.25" aria-hidden="true" />
      </button>
    </header>

    <div class="event-detail__scroll">
      <button
        type="button"
        class="event-detail__poster"
        :aria-label="`View ${event.name} poster`"
        @click="openPhoto(event.poster, `${event.name} poster`, $event)"
      >
        <img :src="event.poster" :alt="`${event.name} poster`" width="720" height="480" />
      </button>

      <ul class="event-detail__facts" aria-label="Event details">
        <li>
          <Calendar :size="15" :stroke-width="2.25" aria-hidden="true" />
          <span>
            <strong>When</strong>
            {{ event.whenLabel }}
          </span>
        </li>
        <li>
          <MapPin :size="15" :stroke-width="2.25" aria-hidden="true" />
          <span>
            <strong>Where</strong>
            {{ event.address }}
          </span>
        </li>
      </ul>

      <div class="event-detail__actions">
        <a
          class="event-detail__navigate"
          :href="mapsHref"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Navigate to this event in Google Maps"
        >
          <Navigation :size="16" :stroke-width="2.25" aria-hidden="true" />
          Navigate to this event
        </a>
      </div>

      <p v-if="event.description" class="event-detail__about">{{ event.description }}</p>

      <div class="event-detail__map">
        <ClientOnly>
          <CafePinMap
            kind="event"
            :lat="event.lat"
            :lng="event.lng"
            :name="event.name"
            :address="event.address"
            :maps-href="mapsHref"
          />
        </ClientOnly>
      </div>

      <div v-if="event.gallery.length" class="event-detail__gallery" aria-label="More photos">
        <button
          v-for="(photo, index) in event.gallery"
          :key="`${photo}-${index}`"
          type="button"
          class="event-detail__shot"
          :aria-label="`View ${event.name} photo ${index + 1}`"
          @click="openPhoto(photo, `${event.name} photo ${index + 1}`, $event)"
        >
          <img
            :src="photo"
            :alt="`${event.name} photo ${index + 1}`"
            width="240"
            height="180"
          />
        </button>
      </div>
    </div>

    <dialog
      :id="viewerId"
      ref="viewer"
      class="event-detail__viewer"
      :aria-labelledby="viewerTitleId"
      @close="onViewerClose"
      @click="onViewerBackdrop"
    >
      <h3 :id="viewerTitleId" class="sr-only">{{ viewerAlt }}</h3>
      <img v-if="viewerSrc" :src="viewerSrc" :alt="viewerAlt" />
      <button
        type="button"
        class="event-detail__viewer-close"
        aria-label="Close photo"
        @click="closePhoto"
      >
        <X :size="20" :stroke-width="2.25" aria-hidden="true" />
      </button>
    </dialog>
  </div>
</template>

<script lang="ts" setup>
import { Calendar, MapPin, Navigation, X } from 'lucide-vue-next'
import CafePinMap from '~/components/map/CafePinMap.client.vue'
import type { KapeEvent } from '~/types/event'
import { googleMapsDirectionsUrl } from '~/utils/maps'

const props = withDefaults(defineProps<{
  event: KapeEvent
  variant?: 'page' | 'sheet'
  showClose?: boolean
}>(), {
  variant: 'page',
  showClose: false,
})

const emit = defineEmits<{
  close: []
}>()

const mapsHref = computed(() => googleMapsDirectionsUrl(props.event.lat, props.event.lng))
const viewer = ref<HTMLDialogElement | null>(null)
const viewerSrc = ref('')
const viewerAlt = ref('')
const viewerId = useId()
const viewerTitleId = `${viewerId}-title`
let lastTrigger: HTMLElement | null = null

const openPhoto = (src: string, alt: string, event: MouseEvent) => {
  lastTrigger = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
  viewerSrc.value = src
  viewerAlt.value = alt
  void nextTick(() => viewer.value?.showModal())
}

const closePhoto = () => {
  viewer.value?.close()
}

const onViewerBackdrop = (event: MouseEvent) => {
  if (event.target === viewer.value) closePhoto()
}

const onViewerClose = () => {
  viewerSrc.value = ''
  lastTrigger?.focus()
  lastTrigger = null
}

onBeforeUnmount(() => {
  if (viewer.value?.open) viewer.value.close()
})
</script>

<style scoped>
.event-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  padding: 0 20px calc(24px + env(safe-area-inset-bottom));
  color: var(--kd-ink);
  font-family: 'Kumbh Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.event-detail--sheet {
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  padding-top: 32px;
  padding-bottom: 0;
}

.event-detail__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.event-detail__close {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.event-detail__close:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.event-detail__header h2 {
  margin: 0;
  min-width: 0;
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}

.event-detail__scroll {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.event-detail--sheet .event-detail__scroll {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding-bottom: calc(32px + env(safe-area-inset-bottom));
  overscroll-behavior: contain;
  touch-action: pan-y;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--kd-ink) 25%, transparent) transparent;
}

.event-detail__about {
  margin: 0;
  font-size: 0.7875rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.event-detail__facts {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 16px;
  list-style: none;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.event-detail__facts li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.event-detail__facts svg {
  flex: 0 0 auto;
  margin-top: 2px;
  color: var(--kd-accent);
}

.event-detail__facts span {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  font-size: 0.7875rem;
  line-height: 1.3;
}

.event-detail__facts strong {
  font-size: 0.75rem;
  font-weight: 700;
}

.event-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.event-detail__navigate {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--kd-accent);
  border-radius: 16px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  text-decoration: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.event-detail__navigate:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.event-detail__poster,
.event-detail__shot {
  display: block;
  width: 100%;
  padding: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  cursor: zoom-in;
  -webkit-tap-highlight-color: transparent;
}

.event-detail__poster:focus-visible,
.event-detail__shot:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.event-detail__poster {
  flex-shrink: 0;
  aspect-ratio: 16 / 9;
}

.event-detail--page .event-detail__poster {
  aspect-ratio: 3 / 2;
}

.event-detail__poster img,
.event-detail__shot img {
  display: block;
  width: 100%;
  object-fit: cover;
  pointer-events: none;
}

.event-detail__poster img {
  height: 100%;
}

.event-detail__gallery {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding-bottom: 4px;
  scrollbar-width: none;
}

.event-detail__gallery::-webkit-scrollbar {
  display: none;
}

.event-detail__shot {
  flex: 0 0 72%;
  scroll-snap-align: start;
}

.event-detail__shot img {
  height: auto;
  max-height: 180px;
}

.event-detail__viewer {
  position: relative;
  width: min(42rem, calc(100vw - 32px));
  max-height: min(42rem, calc(100vh - 32px));
  padding: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  box-shadow: 0 8px 28px color-mix(in srgb, #1c1917 18%, transparent);
}

.event-detail__viewer::backdrop {
  background: color-mix(in srgb, var(--kd-ink) 40%, transparent);
}

.event-detail__viewer img {
  display: block;
  width: 100%;
  max-height: min(38rem, calc(100vh - 72px));
  object-fit: contain;
  background: #faf8f5;
}

.event-detail__viewer-close {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.event-detail__viewer-close:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
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

:root.is-android .event-detail__navigate {
  min-height: 48px;
}

@media (prefers-reduced-motion: reduce) {
  .event-detail__viewer,
  .event-detail__viewer::backdrop {
    animation: none;
  }
}
</style>
