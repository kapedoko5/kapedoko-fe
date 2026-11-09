<template>
  <IonModal
    :is-open="open"
    :initial-breakpoint="compact ? PEEK : undefined"
    :breakpoints="compact ? BREAKPOINTS : undefined"
    :handle="compact"
    :handle-behavior="compact ? 'cycle' : undefined"
    :backdrop-breakpoint="compact ? EXPANDED : undefined"
    :show-backdrop="false"
    class="event-detail-modal"
    @didPresent="onPresent"
    @didDismiss="onDismiss"
  >
    <div class="event-sheet">
      <EventDetailContent
        v-if="event"
        :event="event"
        variant="sheet"
        :show-close="!compact"
        @close="onClose"
      />
    </div>
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

.event-sheet {
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

</style>
