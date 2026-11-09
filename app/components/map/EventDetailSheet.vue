<template>
  <IonModal
    :is-open="open"
    :initial-breakpoint="compact ? PEEK : undefined"
    :breakpoints="compact ? BREAKPOINTS : undefined"
    :handle="compact"
    :handle-behavior="compact ? 'cycle' : undefined"
    :backdrop-breakpoint="compact ? EXPANDED : undefined"
    :expand-to-scroll="false"
    :show-backdrop="false"
    class="event-detail-modal"
    @didPresent="onPresent"
    @didDismiss="onDismiss"
  >
    <IonHeader class="event-sheet-header ion-no-border" :class="{ 'is-compact': compact }">
      <div class="event-sheet-header__row">
        <h2>{{ event?.name }}</h2>
        <button
          type="button"
          class="event-sheet-header__close"
          aria-label="Close event details"
          @pointerdown.stop
          @click.stop="onClose"
        >
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <path d="M5 5l14 14M19 5 5 19" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </IonHeader>
    <IonContent :scroll-y="true" class="event-sheet-body">
      <EventDetailContent
        v-if="event"
        :event="event"
        variant="sheet"
        :show-header="false"
      />
    </IonContent>
  </IonModal>
</template>

<script lang="ts" setup>
import type { KapeEvent } from '~/types/event'
import EventDetailContent from '~/components/event/EventDetailContent.vue'

const SHEET_HEIGHT = 0.88
const PEEK_VIEWPORT = 0.62
const PEEK = PEEK_VIEWPORT / SHEET_HEIGHT
const EXPANDED = 1
const BREAKPOINTS = [0, PEEK, EXPANDED]
const { compact } = useViewportLayout()

defineProps<{
  open: boolean
  event: KapeEvent | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  present: []
  dismissed: []
}>()

const onPresent = () => emit('present')
const onClose = () => {
  emit('update:open', false)
}
const onDismiss = () => {
  emit('update:open', false)
  emit('dismissed')
}
</script>

<style>
ion-modal.event-detail-modal {
  contain: none;
  pointer-events: none;
  --height: 88%;
  --width: 100%;
  --border-radius: 16px;
  --background: #ffffff;
  --box-shadow: 0 -4px 20px color-mix(in srgb, #1c1917 12%, transparent);
  --backdrop-opacity: 0;
}

ion-modal.event-detail-modal::part(backdrop) {
  display: none;
  pointer-events: none;
}

ion-modal.event-detail-modal::part(content) {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

ion-modal.event-detail-modal .ion-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

ion-modal.event-detail-modal::part(handle) {
  width: 50px;
  height: 5px;
  margin-top: 12px;
  border-radius: 999px;
  background: color-mix(in srgb, #1c1917 25%, transparent);
}

ion-modal.event-detail-modal .event-sheet-header {
  position: relative;
  z-index: 6;
  flex: 0 0 auto;
  background: #ffffff;
  box-shadow: none;
  pointer-events: auto;
}

ion-modal.event-detail-modal .event-sheet-header__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 20px;
}

ion-modal.event-detail-modal .event-sheet-header.is-compact .event-sheet-header__row {
  padding-top: 28px;
}

ion-modal.event-detail-modal .event-sheet-header h2 {
  margin: 0;
  min-width: 0;
  flex: 1;
  color: var(--kd-ink);
  font-family: 'Kumbh Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}

ion-modal.event-detail-modal .event-sheet-header__close {
  position: relative;
  z-index: 7;
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 16px;
  background: #ffffff;
  color: var(--kd-ink);
  cursor: pointer;
  touch-action: manipulation;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
}

ion-modal.event-detail-modal .event-sheet-header__close svg {
  display: block;
}

ion-modal.event-detail-modal .event-sheet-header__close:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

ion-modal.event-detail-modal ion-content.event-sheet-body {
  flex: 1 1 auto;
  min-height: 0;
  --background: #ffffff;
  --padding-top: 0;
  --padding-bottom: 0;
  --padding-start: 0;
  --padding-end: 0;
}
</style>
