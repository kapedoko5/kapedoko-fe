<template>
  <nav
    v-show="!tabsLocked"
    class="app-tabbar"
    :class="{ 'is-float': isFloat, 'is-motion': motionReady }"
    aria-label="Primary"
    :aria-hidden="tabsLocked ? 'true' : undefined"
  >
    <span
      ref="markEl"
      class="app-tabbar__mark"
      aria-hidden="true"
      :style="{ '--tab-slot': String(activeSlot) }"
    />
    <template v-for="(tab, index) in tabs" :key="tab.id">
    <button
      v-if="index === 2"
      type="button"
      class="app-tabbar__item app-tabbar__vibe"
      :class="{ 'has-vibe': vibeTagIds.length > 0 }"
      aria-label="What's your vibe?"
      aria-haspopup="dialog"
      @click="openVibeModal"
      @pointerdown="press(sealEl)"
      @pointerup="release(sealEl)"
      @pointerleave="release(sealEl)"
      @pointercancel="release(sealEl)"
    >
      <span ref="sealEl" class="app-tabbar__vibe-seal" aria-hidden="true">
        <Sparkles :size="20" :stroke-width="2.25" />
      </span>
      <span class="app-tabbar__label">
        Vibe<span
          v-if="vibeTagIds.length"
          ref="countEl"
          class="app-tabbar__count"
        >{{ vibeTagIds.length }}</span>
      </span>
    </button>
    <button
      type="button"
      class="app-tabbar__item"
      :class="{ 'is-active': active === tab.id }"
      :aria-current="active === tab.id ? 'page' : undefined"
      :aria-label="tab.aria"
      @click="go(tab.path)"
      @pointerdown="press(glyphs[tab.id])"
      @pointerup="release(glyphs[tab.id])"
      @pointerleave="release(glyphs[tab.id])"
      @pointercancel="release(glyphs[tab.id])"
    >
      <span :ref="(el) => setGlyph(tab.id, el)" class="app-tabbar__glyph" aria-hidden="true">
        <component
          :is="tab.icon"
          class="app-tabbar__icon"
          :size="20"
          :stroke-width="2.25"
        />
      </span>
      <span class="app-tabbar__label">{{ tab.label }}</span>
    </button>
    </template>
    <VibeModal />
  </nav>
</template>

<script lang="ts" setup>
import { useIonRouter } from '@ionic/vue'
import { animate } from 'motion'
import type { ComponentPublicInstance } from 'vue'
import { Heart, House, Map as MapIcon, Sparkles, User } from 'lucide-vue-next'
import VibeModal from '~/components/vibe/VibeModal.vue'
import { APP_TAB_PATHS, activeAppTab, isSameAppPath, resolveAppPath, type AppTabId } from '~/utils/app-tabs'

const props = defineProps<{
  active?: AppTabId
}>()

const route = useRoute()
const ionRouter = useIonRouter()
const { locked: tabsLocked } = useAppTabsLock()
const { compact } = useViewportLayout()
const { tagIds: vibeTagIds, openModal: openVibeModal, hydrate: hydrateVibes } = useVibeFilter()
hydrateVibes()
const pendingPath = ref<string | null>(null)
const isFloat = computed(() => !compact.value && !tabsLocked.value)

const livePath = computed(() => {
  void route.fullPath
  if (pendingPath.value) return pendingPath.value
  return resolveAppPath(route.path, import.meta.client ? window.location.pathname : '')
})

const tabs: {
  id: AppTabId
  label: string
  aria: string
  path: string
  icon: typeof House
}[] = [
  { id: 'home', label: 'Home', aria: 'Home', path: APP_TAB_PATHS.home, icon: House },
  { id: 'saved', label: 'Saved', aria: 'Saved cafes', path: APP_TAB_PATHS.saved, icon: Heart },
  { id: 'map', label: 'Map', aria: 'Map', path: APP_TAB_PATHS.map, icon: MapIcon },
  { id: 'profile', label: 'Profile', aria: 'Profile', path: APP_TAB_PATHS.profile, icon: User },
]

const active = computed<AppTabId>(() => props.active ?? activeAppTab(livePath.value))

const activeIndex = computed(() => {
  const index = tabs.findIndex((tab) => tab.id === active.value)
  return index >= 0 ? index : 0
})

/** The vibe button owns the middle slot, so tabs after index 1 shift right. */
const activeSlot = computed(() => (activeIndex.value >= 2 ? activeIndex.value + 1 : activeIndex.value))

const hideStackedPages = () => {
  if (!import.meta.client) return
  const visible = [...document.querySelectorAll('ion-router-outlet .ion-page')].filter((page) => (
    !page.classList.contains('ion-page-hidden')
    && !page.classList.contains('ion-page-invisible')
  ))
  visible.slice(0, -1).forEach((page) => {
    page.classList.add('ion-page-hidden')
    page.setAttribute('aria-hidden', 'true')
  })
}

const go = (path: string) => {
  const here = resolveAppPath(route.path, import.meta.client ? window.location.pathname : '')
  if (isSameAppPath(here, path)) return
  hideStackedPages()
  pendingPath.value = path
  if (import.meta.client) {
    ionRouter.navigate(path, 'root', 'replace')
    return
  }
  return navigateTo(path, { replace: true })
}

/* ---------- Motion ---------- */
const markEl = ref<HTMLElement | null>(null)
const sealEl = ref<HTMLElement | null>(null)
const countEl = ref<HTMLElement | null>(null)
const glyphs: Partial<Record<AppTabId, HTMLElement>> = {}
const motionReady = ref(false)

const setGlyph = (id: AppTabId, el: Element | ComponentPublicInstance | null) => {
  if (el instanceof HTMLElement) glyphs[id] = el
  else delete glyphs[id]
}

const reducedMotion = () => (
  !import.meta.client || window.matchMedia('(prefers-reduced-motion: reduce)').matches
)

const SNAP = { type: 'spring', stiffness: 520, damping: 34, mass: 0.9 } as const
const POP = { type: 'spring', stiffness: 600, damping: 16 } as const

const press = (el?: HTMLElement | null) => {
  if (!el || reducedMotion()) return
  animate(el, { scale: 0.86 }, { duration: 0.08, ease: 'easeOut' })
}

const release = (el?: HTMLElement | null) => {
  if (!el || reducedMotion()) return
  animate(el, { scale: 1 }, POP)
}

onMounted(() => {
  // Motion owns the slide from here on; the CSS transition stays as the no-JS fallback.
  motionReady.value = !reducedMotion()
})

watch(activeSlot, (to, from) => {
  if (!motionReady.value || reducedMotion() || to === from) return
  const mark = markEl.value
  if (mark) {
    animate(
      mark,
      { transform: [`translateX(${from * 100}%)`, `translateX(${to * 100}%)`] },
      SNAP,
    )
  }
  const glyph = glyphs[active.value]
  if (glyph) animate(glyph, { scale: [0.78, 1], y: [2, 0] }, POP)
})

watch(() => vibeTagIds.value.length, async (to, from) => {
  if (!motionReady.value || reducedMotion() || to === from) return
  await nextTick()
  if (sealEl.value) {
    animate(sealEl.value, { scale: [1, 1.14, 1], rotate: [0, to > from ? -6 : 6, 0] }, { duration: 0.42, ease: 'easeOut' })
  }
  if (countEl.value) animate(countEl.value, { scale: [0.6, 1], opacity: [0, 1] }, POP)
})

watch(
  () => [route.fullPath, import.meta.client ? window.location.pathname : ''] as const,
  () => {
    const here = resolveAppPath(route.path, import.meta.client ? window.location.pathname : '')
    if (pendingPath.value && isSameAppPath(here, pendingPath.value)) {
      pendingPath.value = null
    }
  },
)
</script>

<style scoped>
.app-tabbar {
  --tab-pad-x: 8px;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9000;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: stretch;
  width: 100%;
  height: calc(72px + env(safe-area-inset-bottom));
  padding: 0 var(--tab-pad-x) env(safe-area-inset-bottom);
  background-color: #f2f2f2;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
  pointer-events: auto;
  isolation: isolate;
}

.app-tabbar[aria-hidden="true"] {
  display: none !important;
  pointer-events: none !important;
}

.app-tabbar__mark {
  position: absolute;
  top: 6px;
  left: var(--tab-pad-x);
  z-index: 1;
  display: flex;
  justify-content: center;
  width: calc((100% - (var(--tab-pad-x) * 2)) / 5);
  height: 3px;
  transform: translateX(calc(var(--tab-slot, 0) * 100%));
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

.app-tabbar__mark::before {
  content: '';
  width: 28px;
  height: 100%;
  background-color: var(--kd-accent);
  border-radius: 2px;
}

.app-tabbar.is-motion .app-tabbar__mark {
  transition: none;
}

.app-tabbar__item {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: color-mix(in srgb, var(--kd-ink) 72%, transparent);
  font-family: inherit;
  cursor: pointer;
  touch-action: manipulation;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
  transition: color 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.app-tabbar__glyph {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  will-change: transform;
}

.app-tabbar__icon {
  display: block;
  flex-shrink: 0;
}

.app-tabbar__label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.app-tabbar__item.is-active {
  color: var(--kd-primary);
}

.app-tabbar__item.is-active .app-tabbar__label {
  font-weight: 700;
}

.app-tabbar__vibe {
  color: var(--kd-ink);
}

.app-tabbar__vibe-seal {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: 42px;
  height: 42px;
  /* Net layout height 24px, same as a tab glyph, so all labels share one baseline. */
  margin: -18px 0 0;
  border: 1px solid var(--kd-ink);
  border-radius: 12px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  will-change: transform;
}

.app-tabbar__vibe-seal :deep(svg) {
  display: block;
}

.app-tabbar__vibe.has-vibe .app-tabbar__label {
  font-weight: 700;
}

.app-tabbar__count {
  display: inline-grid;
  place-items: center;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 3px;
  background: var(--kd-ink);
  color: #f2f2f2;
  font-size: 0.625rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.app-tabbar__item:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: -4px;
  border-radius: 12px;
}

.app-tabbar.is-float {
  --tab-pad-x: 24px;
  left: 20px;
  right: auto;
  bottom: calc(16px + env(safe-area-inset-bottom));
  width: min(450px, calc(100% - 40px));
  height: 72px;
  margin-inline: 0;
  padding: 0 var(--tab-pad-x);
  border: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
  border-radius: 24px;
  background-color: #f2f2f2;
  box-shadow: 0 12px 32px color-mix(in srgb, #1c1917 18%, transparent);
}

.app-tabbar.is-float .app-tabbar__mark {
  top: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .app-tabbar__mark,
  .app-tabbar__item {
    transition: none;
  }
}
</style>
