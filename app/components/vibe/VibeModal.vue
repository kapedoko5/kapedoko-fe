<template>
  <Teleport to="body">
    <Transition :css="false" @enter="onEnter" @leave="onLeave">
      <div v-if="open" class="vibe-modal" @keydown.esc.stop="closeModal">
        <div class="vibe-modal__scrim" aria-hidden="true" @click="closeModal" />
        <section
          ref="sheet"
          class="vibe-modal__sheet"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          :aria-describedby="ledeId"
          tabindex="-1"
        >
          <header class="vibe-modal__head">
            <div class="vibe-modal__heading">
              <p class="vibe-modal__eyebrow">
                <Sparkles :size="14" :stroke-width="2.25" aria-hidden="true" />
                Today's filter
              </p>
              <h2 :id="titleId" class="vibe-modal__title">What's your vibe?</h2>
              <p :id="ledeId" class="vibe-modal__lede">Pick a mood or two. Home shows cafes that match any of them until you change it.</p>
            </div>
            <button type="button" class="vibe-modal__close" aria-label="Close" @click="closeModal">
              <X :size="18" :stroke-width="2.25" aria-hidden="true" />
            </button>
          </header>

          <p v-if="status === 'loading' || status === 'idle'" class="vibe-modal__meta">Loading vibes…</p>
          <p v-else-if="status === 'error'" class="vibe-modal__meta vibe-modal__meta--error" role="alert">
            Could not load vibes.
            <button type="button" class="vibe-modal__link" @click="retry">Try again</button>
          </p>
          <p v-else-if="!catalog.length" class="vibe-modal__meta">No vibes yet. Check back soon.</p>
          <div
            v-else
            class="vibe-modal__grid"
            role="group"
            aria-label="Vibes"
          >
            <button
              v-for="(tag, index) in catalog"
              :key="tag.id"
              type="button"
              class="vibe-modal__stamp"
              :class="{ 'is-on': draft.includes(tag.id), 'is-popping': popped === tag.id }"
              :style="stampStyle(tag.color, index)"
              :aria-pressed="draft.includes(tag.id)"
              @click="toggle(tag.id)"
              @animationend="onStampAnimationEnd($event, tag.id)"
            >
              <span class="vibe-modal__bubble" aria-hidden="true">
                <component :is="vibeTagLucideComponent(tag.lucide_icon)" :size="20" :stroke-width="2.25" />
              </span>
              <span class="vibe-modal__label">{{ tag.label }}</span>
              <span class="vibe-modal__check" aria-hidden="true">
                <Check :size="13" :stroke-width="3" />
              </span>
            </button>
          </div>

          <p v-if="status === 'ready' && catalog.length" class="vibe-modal__count" aria-live="polite">
            <template v-if="draft.length">
              <strong>{{ draft.length }}</strong> {{ draft.length === 1 ? 'vibe' : 'vibes' }} picked
            </template>
            <template v-else>Nothing picked yet. You'll see every cafe.</template>
          </p>

          <footer class="vibe-modal__foot">
            <button type="button" class="vibe-modal__clear" :disabled="!draft.length" @click="clear">
              <RotateCcw :size="16" :stroke-width="2.25" aria-hidden="true" />
              Clear
            </button>
            <button type="button" class="vibe-modal__apply" @click="save">
              <span class="vibe-modal__apply-text">{{ applyLabel }}</span>
              <ArrowRight :size="18" :stroke-width="2.25" aria-hidden="true" />
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
import { animate } from 'motion'
import { ArrowRight, Check, RotateCcw, Sparkles, X } from 'lucide-vue-next'
import { normalizeVibeTagColor, vibeTagLucideComponent } from '~/utils/admin-vibe-tags'
import { vibeStickerColors } from '~/utils/vibe-contrast'

const { open, tagIds, catalog, status, apply, closeModal, loadCatalog } = useVibeFilter()
const uid = useId()
const titleId = `vibe-modal-${uid}`
const ledeId = `vibe-modal-lede-${uid}`
const sheet = ref<HTMLElement | null>(null)
const draft = ref<string[]>([])
const popped = ref<string | null>(null)
let opener: HTMLElement | null = null

// Sticker tilts cycle so neighbours never lean the same way in the 2- or 3-column grid.
const TILTS = ['-1.6deg', '1.2deg', '-0.6deg', '1.8deg', '-1.1deg', '0.8deg']

const reduced = () => import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const stampStyle = (color: string | null | undefined, index: number) => {
  const vibe = normalizeVibeTagColor(color)
  const { fill, on } = vibeStickerColors(vibe)
  return {
    '--vibe-color': vibe,
    '--vibe-fill': fill,
    '--vibe-on': on,
    '--tilt': TILTS[index % TILTS.length],
    '--i': String(Math.min(index, 14)),
  }
}

const applyLabel = computed(() => {
  if (!draft.value.length) return 'Show all cafes'
  if (draft.value.length === 1) {
    const tag = catalog.value.find((item) => item.id === draft.value[0])
    return tag ? `Show ${tag.label} cafes` : 'Show 1 vibe'
  }
  return `Show cafes for ${draft.value.length} vibes`
})

const toggle = (id: string) => {
  const on = !draft.value.includes(id)
  draft.value = on ? [...draft.value, id] : draft.value.filter((item) => item !== id)
  popped.value = on ? id : null
}

const clear = () => {
  draft.value = []
  popped.value = null
}

const onStampAnimationEnd = (event: AnimationEvent, id: string) => {
  if (event.animationName.includes('vibe-pop') && popped.value === id) popped.value = null
}

const save = () => {
  apply(draft.value)
  closeModal()
}

const retry = () => {
  catalog.value = []
  status.value = 'idle'
  void loadCatalog()
}

watch(open, async (isOpen) => {
  if (!import.meta.client) return
  if (isOpen) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    draft.value = [...tagIds.value]
    popped.value = null
    document.documentElement.style.overflow = 'hidden'
    await nextTick()
    sheet.value?.focus()
  } else {
    document.documentElement.style.overflow = ''
    opener?.focus?.()
  }
})

onBeforeUnmount(() => {
  if (import.meta.client) document.documentElement.style.overflow = ''
})

// Sheet + scrim use motion; stickers stagger in with a CSS keyframe (see .vibe-modal__stamp)
// so their tilt/hover transforms are never overwritten by inline animation styles.
const onEnter = (el: Element, done: () => void) => {
  const scrim = el.querySelector('.vibe-modal__scrim')
  const panel = el.querySelector('.vibe-modal__sheet')
  if (reduced() || !scrim || !panel) return done()
  animate(scrim, { opacity: [0, 1] }, { duration: 0.2 })
  animate(panel, { opacity: [0, 1], transform: ['translateY(24px)', 'translateY(0px)'] }, { duration: 0.32, ease: [0.16, 1, 0.3, 1] })
    .finished.then(done)
}

const onLeave = (el: Element, done: () => void) => {
  const scrim = el.querySelector('.vibe-modal__scrim')
  const panel = el.querySelector('.vibe-modal__sheet')
  if (reduced() || !scrim || !panel) return done()
  animate(scrim, { opacity: [1, 0] }, { duration: 0.16 })
  animate(panel, { opacity: [1, 0], transform: ['translateY(0px)', 'translateY(16px)'] }, { duration: 0.18, ease: [0.4, 0, 1, 1] })
    .finished.then(done)
}
</script>

<style scoped>
.vibe-modal {
  position: fixed;
  inset: 0;
  z-index: 9500;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  font-family: 'Kumbh Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.vibe-modal__scrim {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--kd-ink) 45%, transparent);
}

.vibe-modal__sheet {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: min(560px, 100%);
  max-height: min(88dvh, 680px);
  overflow-y: auto;
  padding: 20px 20px calc(20px + env(safe-area-inset-bottom));
  background: var(--kd-stock);
  color: var(--kd-ink);
  border: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
  border-radius: 24px 24px 0 0;
  outline: none;
}

@media (min-width: 640px) {
  .vibe-modal {
    align-items: center;
  }

  .vibe-modal__sheet {
    border-radius: 24px;
    padding: 24px;
  }
}

/* Header */
.vibe-modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.vibe-modal__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 6px;
  color: var(--kd-primary);
  font-size: 0.75rem;
  font-weight: 700;
}

.vibe-modal__eyebrow :deep(svg) {
  color: var(--kd-accent);
}

.vibe-modal__title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.05;
}

.vibe-modal__lede {
  max-width: 34ch;
  margin: 8px 0 0;
  font-size: 0.8125rem;
  line-height: 1.35;
}

.vibe-modal__close {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: -6px -8px 0 0;
  border: 0;
  border-radius: 16px;
  background: transparent;
  color: var(--kd-ink);
  cursor: pointer;
}

/* Sticker grid */
.vibe-modal__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 6px 2px 2px;
}

@media (min-width: 480px) {
  .vibe-modal__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.vibe-modal__stamp {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 64px;
  padding: 10px 12px;
  border: 1.5px solid color-mix(in srgb, var(--vibe-color) 70%, var(--kd-ink));
  border-bottom-width: 3.5px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--vibe-color) 12%, var(--kd-stock));
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.15;
  text-align: left;
  rotate: var(--tilt, -1deg);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  animation: vibe-stick 420ms cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  animation-delay: calc(80ms + var(--i, 0) * 32ms);
  transition:
    rotate 220ms cubic-bezier(0.34, 1.56, 0.64, 1),
    scale 220ms cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 180ms ease-out,
    border-color 180ms ease-out,
    color 180ms ease-out,
    box-shadow 120ms ease-out;
}

.vibe-modal__bubble {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--vibe-fill);
  color: var(--vibe-on);
  transition: background-color 180ms ease-out, color 180ms ease-out;
}

.vibe-modal__label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.vibe-modal__check {
  position: absolute;
  top: -8px;
  right: -6px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 2px solid var(--kd-stock);
  border-radius: 8px;
  background: var(--kd-ink);
  color: var(--kd-stock);
  opacity: 0;
  scale: 0.4;
  rotate: -20deg;
  transition:
    opacity 140ms ease-out,
    scale 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
    rotate 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@media (hover: hover) and (pointer: fine) {
  .vibe-modal__stamp:hover {
    rotate: 0deg;
    scale: 1.04;
    border-color: color-mix(in srgb, var(--vibe-color) 55%, var(--kd-ink));
  }
}

.vibe-modal__stamp:active {
  rotate: 0deg;
  scale: 0.96;
  box-shadow: inset 0 2px 0 color-mix(in srgb, var(--kd-ink) 18%, transparent);
}

/* Selected: the sticker fills with its vibe color (contrast-safe pair from vibeStickerColors). */
.vibe-modal__stamp.is-on {
  rotate: 0deg;
  border-color: color-mix(in srgb, var(--vibe-fill) 65%, var(--kd-ink));
  background: var(--vibe-fill);
  color: var(--vibe-on);
}

.vibe-modal__stamp.is-on .vibe-modal__bubble {
  background: color-mix(in srgb, var(--vibe-on) 16%, transparent);
  color: var(--vibe-on);
}

.vibe-modal__stamp.is-on .vibe-modal__check {
  opacity: 1;
  scale: 1;
  rotate: 0deg;
}

/* Keep vibe-stick in the list so toggling the class never replays the entrance. */
.vibe-modal__stamp.is-popping {
  animation:
    vibe-stick 420ms cubic-bezier(0.34, 1.56, 0.64, 1) backwards,
    vibe-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
  animation-delay: calc(80ms + var(--i, 0) * 32ms), 0ms;
}

@keyframes vibe-stick {
  from {
    opacity: 0;
    translate: 0 10px;
    scale: 0.88;
  }
}

@keyframes vibe-pop {
  0% { scale: 0.94; }
  45% { scale: 1.08; }
  75% { scale: 0.98; }
  100% { scale: 1; }
}

/* Meta + count */
.vibe-modal__meta {
  margin: 0;
  font-size: 0.875rem;
}

.vibe-modal__meta--error {
  color: var(--kd-destructive);
  font-weight: 700;
}

.vibe-modal__link {
  border: 0;
  background: transparent;
  color: var(--kd-primary);
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.vibe-modal__count {
  margin: -4px 0 0;
  font-size: 0.75rem;
  line-height: 1.3;
}

.vibe-modal__count strong {
  display: inline-grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  margin-right: 2px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-size: 0.75rem;
}

/* Footer */
.vibe-modal__foot {
  display: flex;
  align-items: stretch;
  gap: 10px;
  padding-top: 4px;
}

.vibe-modal__clear,
.vibe-modal__apply {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
  border-radius: 16px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: box-shadow 120ms ease-out, scale 120ms ease-out, opacity 160ms ease-out;
}

.vibe-modal__clear {
  flex-shrink: 0;
  padding: 0 16px;
  border: 1.5px solid var(--kd-primary);
  background: transparent;
  color: var(--kd-primary);
  font-size: 0.875rem;
}

.vibe-modal__clear:disabled {
  opacity: 0.4;
  cursor: default;
}

.vibe-modal__apply {
  flex: 1;
  min-width: 0;
  padding: 0 20px;
  border: 0;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-size: 0.9375rem;
}

.vibe-modal__apply-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vibe-modal__apply :deep(svg) {
  flex-shrink: 0;
}

@media (hover: hover) and (pointer: fine) {
  .vibe-modal__apply:hover {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--kd-ink) 40%, transparent);
  }

  .vibe-modal__clear:not(:disabled):hover {
    background: color-mix(in srgb, var(--kd-primary) 8%, transparent);
  }
}

.vibe-modal__apply:active,
.vibe-modal__clear:not(:disabled):active {
  scale: 0.98;
  box-shadow: inset 0 2px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

.vibe-modal__stamp:focus-visible,
.vibe-modal__close:focus-visible,
.vibe-modal__clear:focus-visible,
.vibe-modal__apply:focus-visible,
.vibe-modal__link:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  .vibe-modal__stamp,
  .vibe-modal__stamp:hover,
  .vibe-modal__stamp:active,
  .vibe-modal__stamp.is-on,
  .vibe-modal__stamp.is-popping {
    rotate: 0deg;
    scale: 1;
    animation: none;
    transition: background-color 120ms linear, border-color 120ms linear, color 120ms linear;
  }

  .vibe-modal__check {
    scale: 1;
    rotate: 0deg;
    transition: opacity 120ms linear;
  }

  .vibe-modal__apply:active,
  .vibe-modal__clear:not(:disabled):active {
    scale: 1;
  }
}
</style>
