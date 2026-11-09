<template>
  <nav
    v-show="!tabsLocked"
    class="app-tabbar"
    :class="{ 'is-float': isFloat }"
    aria-label="Primary"
    :aria-hidden="tabsLocked ? 'true' : undefined"
  >
    <span
      class="app-tabbar__mark"
      aria-hidden="true"
      :style="{ '--tab-index': String(activeIndex) }"
    />
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      class="app-tabbar__item"
      :class="{ 'is-active': active === tab.id }"
      :aria-current="active === tab.id ? 'page' : undefined"
      :aria-label="tab.aria"
      @click="go(tab.path)"
    >
      <component
        :is="tab.icon"
        class="app-tabbar__icon"
        :size="18"
        :stroke-width="2.25"
        aria-hidden="true"
      />
      <span class="app-tabbar__label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<script lang="ts" setup>
import { useIonRouter } from '@ionic/vue'
import { Heart, House, Map as MapIcon, User } from 'lucide-vue-next'
import { APP_TAB_PATHS, activeAppTab, isSameAppPath, resolveAppPath, type AppTabId } from '~/utils/app-tabs'

const props = defineProps<{
  active?: AppTabId
}>()

const route = useRoute()
const ionRouter = useIonRouter()
const { locked: tabsLocked } = useAppTabsLock()
const { compact } = useViewportLayout()
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
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9000;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  align-items: stretch;
  width: 100%;
  height: calc(72px + env(safe-area-inset-bottom));
  padding: 0 8px env(safe-area-inset-bottom);
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
  left: 8px;
  z-index: 1;
  width: calc((100% - 16px) / 4);
  height: 2px;
  background-color: var(--kd-accent);
  border-radius: 1px;
  transform: translateX(calc(var(--tab-index, 0) * 100%));
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

.app-tabbar__item {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 48px;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  cursor: pointer;
  touch-action: manipulation;
  pointer-events: auto;
  transition:
    color 160ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 120ms cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 120ms cubic-bezier(0.16, 1, 0.3, 1);
}

.app-tabbar__icon {
  display: block;
  flex-shrink: 0;
}

.app-tabbar__label {
  font-size: 0.6875rem;
  font-weight: 400;
  line-height: 1;
}

.app-tabbar__item.is-active {
  color: var(--kd-primary);
}

.app-tabbar__item.is-active .app-tabbar__label {
  font-weight: 700;
}

.app-tabbar__item:active {
  transform: translateY(1px) scaleY(0.94);
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-accent) 22%, transparent);
}

.app-tabbar__item:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: -4px;
}

.app-tabbar.is-float {
  left: 20px;
  right: auto;
  bottom: calc(16px + env(safe-area-inset-bottom));
  width: min(450px, calc(100% - 40px));
  height: 72px;
  margin-inline: 0;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
  border-radius: 24px;
  background-color: #f2f2f2;
  box-shadow: 0 12px 32px color-mix(in srgb, #1c1917 18%, transparent);
}

.app-tabbar.is-float .app-tabbar__mark {
  top: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .app-tabbar__mark {
    transition: none;
  }

  .app-tabbar__item {
    transition: none;
  }

  .app-tabbar__item:active {
    transform: none;
    box-shadow: none;
  }
}
</style>
