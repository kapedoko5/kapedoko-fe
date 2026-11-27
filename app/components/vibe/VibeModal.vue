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
          tabindex="-1"
        >
          <header class="vibe-modal__head">
            <div>
              <h2 :id="titleId" class="vibe-modal__title">What's your vibe?</h2>
              <p class="vibe-modal__lede">Pick today's mood. Home shows cafes that carry it until you clear or change it.</p>
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
              :class="{ 'is-on': draft.includes(tag.id) }"
              :style="{ '--tilt': index % 2 ? '1.4deg' : '-1.2deg', ...vibeTagColorStyle(tag.color) }"
              :aria-pressed="draft.includes(tag.id)"
              @click="toggle(tag.id)"
            >
              <component :is="vibeTagLucideComponent(tag.lucide_icon)" :size="16" :stroke-width="2.25" aria-hidden="true" />
              {{ tag.label }}
            </button>
          </div>

          <footer class="vibe-modal__foot">
            <button type="button" class="vibe-modal__clear" :disabled="!draft.length" @click="draft = []">Clear</button>
            <button type="button" class="vibe-modal__apply" @click="save">
              {{ draft.length ? `Show ${draft.length} ${draft.length === 1 ? 'vibe' : 'vibes'}` : 'Show all cafes' }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
import { animate } from 'motion'
import { X } from 'lucide-vue-next'
import { vibeTagColorStyle, vibeTagLucideComponent } from '~/utils/admin-vibe-tags'

const { open, tagIds, catalog, status, apply, closeModal, loadCatalog } = useVibeFilter()
const titleId = `vibe-modal-${useId()}`
const sheet = ref<HTMLElement | null>(null)
const draft = ref<string[]>([])
let opener: HTMLElement | null = null

const reduced = () => import.meta.client && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const toggle = (id: string) => {
  draft.value = draft.value.includes(id) ? draft.value.filter((item) => item !== id) : [...draft.value, id]
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

const onEnter = (el: Element, done: () => void) => {
  const scrim = el.querySelector('.vibe-modal__scrim')
  const panel = el.querySelector('.vibe-modal__sheet')
  if (reduced() || !scrim || !panel) return done()
  animate(scrim, { opacity: [0, 1] }, { duration: 0.2 })
  const stamps = el.querySelectorAll('.vibe-modal__stamp')
  animate(panel, { opacity: [0, 1], transform: ['translateY(24px)', 'translateY(0px)'] }, { duration: 0.32, ease: [0.16, 1, 0.3, 1] })
    .finished.then(done)
  if (stamps.length) {
    animate(stamps, { opacity: [0, 1], scale: [0.92, 1] }, { duration: 0.24, delay: (i: number) => 0.08 + Math.min(i, 12) * 0.025, ease: [0.16, 1, 0.3, 1] })
  }
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
  width: min(520px, 100%);
  max-height: min(86dvh, 640px);
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
    padding-bottom: 20px;
  }
}

.vibe-modal__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.vibe-modal__title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.vibe-modal__lede {
  margin: 6px 0 0;
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
  background: transparent;
  color: var(--kd-ink);
  cursor: pointer;
}

.vibe-modal__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
  padding: 4px 2px;
}

.vibe-modal__stamp {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 8px 14px;
  border: 1px solid var(--vibe-color, var(--kd-accent));
  border-radius: 8px;
  background: color-mix(in srgb, var(--vibe-color, var(--kd-accent)) 10%, #faf8f5);
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  transform: rotate(var(--tilt, -1.2deg));
  cursor: pointer;
  transition: background-color 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.vibe-modal__stamp :deep(svg) {
  color: var(--vibe-color, var(--kd-accent));
}

.vibe-modal__stamp.is-on {
  background: color-mix(in srgb, var(--vibe-color, var(--kd-accent)) 30%, #faf8f5);
  box-shadow: inset 0 2px 0 color-mix(in srgb, var(--kd-ink) 18%, transparent);
}

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
  cursor: pointer;
}

.vibe-modal__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.vibe-modal__clear {
  min-height: 48px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: var(--kd-primary);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.vibe-modal__clear:disabled {
  opacity: 0.4;
  cursor: default;
}

.vibe-modal__apply {
  min-height: 48px;
  padding: 0 20px;
  border: 0;
  border-radius: 8px;
  background: var(--kd-primary);
  color: #fff;
  font: inherit;
  font-size: 0.9375rem;
  font-weight: 700;
  cursor: pointer;
}

.vibe-modal__stamp:focus-visible,
.vibe-modal__close:focus-visible,
.vibe-modal__clear:focus-visible,
.vibe-modal__apply:focus-visible,
.vibe-modal__link:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .vibe-modal__stamp {
    transform: none;
    transition: none;
  }
}
</style>
