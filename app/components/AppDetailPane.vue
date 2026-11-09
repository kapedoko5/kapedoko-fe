<template>
  <Teleport to="body">
    <Transition name="detail-pane" @after-leave="emit('afterLeave')">
      <aside
        v-if="open"
        class="detail-pane"
        :class="{ 'is-resizing': resizing }"
        role="dialog"
        aria-modal="false"
        :aria-label="label"
        :style="canResize ? { width: `${widthPx}px` } : undefined"
      >
        <button
          v-if="canResize"
          type="button"
          class="detail-pane__resize"
          role="slider"
          aria-label="Resize details"
          aria-orientation="horizontal"
          :aria-valuemin="minWidth"
          :aria-valuemax="maxWidth"
          :aria-valuenow="widthPx"
          @pointerdown="onResizeStart"
          @keydown="onResizeKey"
        />
        <header class="detail-pane__bar">
          <button
            type="button"
            class="detail-pane__close"
            aria-label="Close details"
            @click="emit('close')"
          >
            <X :size="20" :stroke-width="2.25" aria-hidden="true" />
          </button>
        </header>
        <div class="detail-pane__body">
          <slot />
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
import { X } from 'lucide-vue-next'
import {
  clampDetailPaneWidth,
  DETAIL_PANE_MIN_PX,
  SIDE_PANE_WIDTH_PX,
} from '~/utils/viewport-layout'

const props = defineProps<{
  open: boolean
  label: string
}>()

const emit = defineEmits<{
  close: []
  afterLeave: []
}>()

const { span } = useViewportLayout()
const widthPx = useState('kd-detail-pane-width', () => SIDE_PANE_WIDTH_PX)
useSidePaneGutter(() => props.open, widthPx)
const resizing = ref(false)
const minWidth = DETAIL_PANE_MIN_PX
const maxWidth = ref(SIDE_PANE_WIDTH_PX)
const canResize = computed(() => span.value !== 'horizontal')

let dragStartX = 0
let dragStartWidth = 0

const viewportWidth = () => (
  import.meta.client
    ? window.visualViewport?.width || window.innerWidth || 0
    : SIDE_PANE_WIDTH_PX * 2
)

const applyWidth = (px: number) => {
  const next = clampDetailPaneWidth(px, viewportWidth())
  maxWidth.value = Math.max(DETAIL_PANE_MIN_PX, Math.floor(viewportWidth() / 2))
  widthPx.value = next
  if (!import.meta.client) return
  document.documentElement.style.setProperty('--kd-detail-pane-width', `${next}px`)
}

const stopResize = () => {
  if (!resizing.value) return
  resizing.value = false
  if (!import.meta.client) return
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', stopResize)
  window.removeEventListener('pointercancel', stopResize)
  document.body.style.removeProperty('cursor')
  document.body.style.removeProperty('user-select')
}

const onResizeMove = (event: PointerEvent) => {
  if (!resizing.value) return
  applyWidth(dragStartWidth + (dragStartX - event.clientX))
}

const onResizeStart = (event: PointerEvent) => {
  if (event.button !== 0 || !canResize.value) return
  event.preventDefault()
  resizing.value = true
  dragStartX = event.clientX
  dragStartWidth = widthPx.value
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', stopResize)
  window.addEventListener('pointercancel', stopResize)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const onResizeKey = (event: KeyboardEvent) => {
  if (!canResize.value) return
  const step = event.shiftKey ? 48 : 16
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    applyWidth(widthPx.value + step)
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    applyWidth(widthPx.value - step)
    return
  }
  if (event.key === 'Home') {
    event.preventDefault()
    applyWidth(minWidth)
    return
  }
  if (event.key === 'End') {
    event.preventDefault()
    applyWidth(maxWidth.value)
  }
}

const onKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') emit('close')
}

const onHardwareBack = (event: Event) => {
  const register = (event as CustomEvent<{ register: (priority: number, handler: () => void) => void }>).detail?.register
  if (!register) return
  register(40, () => {
    emit('close')
  })
}

const onViewportChange = () => {
  applyWidth(widthPx.value)
}

watch(() => props.open, (open) => {
  if (!import.meta.client) return
  if (open) {
    applyWidth(widthPx.value)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onViewportChange)
    window.visualViewport?.addEventListener('resize', onViewportChange)
    document.addEventListener('ionBackButton', onHardwareBack)
    return
  }
  stopResize()
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onViewportChange)
  window.visualViewport?.removeEventListener('resize', onViewportChange)
  document.removeEventListener('ionBackButton', onHardwareBack)
}, { immediate: true })

onBeforeUnmount(() => {
  if (!import.meta.client) return
  stopResize()
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onViewportChange)
  window.visualViewport?.removeEventListener('resize', onViewportChange)
  document.removeEventListener('ionBackButton', onHardwareBack)
})
</script>

<style scoped>
.detail-pane {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1050;
  display: flex;
  flex-direction: column;
  width: var(--kd-detail-pane-width, var(--kd-side-pane-width));
  min-width: 280px;
  max-width: 50vw;
  background: #f2f2f2;
  color: var(--kd-ink);
  border-left: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
  transform-origin: 100% 0;
}

.detail-pane-enter-active {
  will-change: clip-path, transform;
  animation: detail-pane-in 480ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.detail-pane-enter-active .detail-pane__body {
  animation: detail-pane-print 520ms cubic-bezier(0.16, 1, 0.3, 1) 60ms both;
}

.detail-pane-leave-active {
  pointer-events: none;
  will-change: clip-path, transform;
  animation: detail-pane-out 280ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.detail-pane__resize {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 2;
  width: 16px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: col-resize;
  touch-action: none;
}

.detail-pane__resize::before,
.detail-pane__resize::after {
  content: '';
  position: absolute;
  left: 6px;
  width: 1px;
  height: 16px;
  background: color-mix(in srgb, var(--kd-ink) 34%, transparent);
  pointer-events: none;
}

.detail-pane__resize::before {
  top: calc(50% - 18px);
}

.detail-pane__resize::after {
  top: calc(50% + 2px);
}

.detail-pane__resize:hover::before,
.detail-pane__resize:hover::after,
.detail-pane__resize:focus-visible::before,
.detail-pane__resize:focus-visible::after,
.detail-pane.is-resizing .detail-pane__resize::before,
.detail-pane.is-resizing .detail-pane__resize::after {
  background: var(--kd-primary);
}

.detail-pane__resize:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: -2px;
}

.detail-pane__bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex: 0 0 auto;
  min-height: 52px;
  padding: max(8px, env(safe-area-inset-top)) 8px 0;
}

.detail-pane__close {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  cursor: pointer;
}

.detail-pane__close:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
  border-radius: 8px;
}

.detail-pane__close:active {
  transform: scale(0.96);
}

@keyframes detail-pane-in {
  from {
    transform: translateX(16px) rotate(-0.35deg);
    clip-path: inset(0 0 0 100%);
  }
  to {
    transform: none;
    clip-path: inset(0 0 0 0);
  }
}

@keyframes detail-pane-print {
  from {
    clip-path: inset(0 0 100% 0);
  }
  to {
    clip-path: inset(0 0 0 0);
  }
}

@keyframes detail-pane-out {
  from {
    transform: none;
    clip-path: inset(0 0 0 0);
  }
  to {
    transform: translateX(12px);
    clip-path: inset(0 0 0 100%);
  }
}

@keyframes detail-pane-in-quiet {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes detail-pane-out-quiet {
  from { opacity: 1; }
  to { opacity: 0; }
}

.detail-pane__body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  background: #ffffff;
}

.detail-pane__body > * {
  flex: 1 1 auto;
  min-height: 0;
}

@media (prefers-reduced-motion: reduce) {
  .detail-pane-enter-active {
    will-change: auto;
    animation: detail-pane-in-quiet 160ms ease both;
  }

  .detail-pane-enter-active .detail-pane__body {
    animation: none;
  }

  .detail-pane-leave-active {
    will-change: auto;
    animation: detail-pane-out-quiet 120ms ease both;
  }

  .detail-pane__close:active {
    transform: none;
  }
}
</style>
