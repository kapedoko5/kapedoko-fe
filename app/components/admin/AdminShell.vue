<template>
  <IonContent class="admin-shell-content">
    <div ref="shellEl" class="admin-shell" :class="{ 'is-nav-open': navOpen, 'admin-shell--cafe': layout === 'cafe' }">
      <div
        v-if="navOpen"
        class="admin-shell__scrim"
        aria-hidden="true"
        @click="navOpen = false"
      />

      <aside class="admin-shell__nav" :aria-hidden="!desktop && !navOpen">
        <div class="admin-shell__brand">
          <img src="/assets/kapedoko-horizontal-text_dark.png" alt="kapé DOKO" width="132" height="28" />
          <p>Admin</p>
          <button
            v-if="!desktop"
            type="button"
            class="admin-shell__close"
            aria-label="Close admin navigation"
            @click="navOpen = false"
          >
            Close
          </button>
        </div>
        <nav aria-label="Admin">
          <NuxtLink
            v-for="item in items"
            :key="item.id"
            :to="item.href"
            class="admin-shell__link"
            :class="{ 'is-active': active === item.id }"
            :aria-current="active === item.id ? 'page' : undefined"
            @click.prevent="go(item.href)"
          >
            <span class="admin-shell__link-mark" aria-hidden="true" />
            {{ item.label }}
            <span v-if="item.id === 'requests' && pendingCount > 0" class="admin-shell__badge">{{ pendingCount }}</span>
            <span v-if="item.id === 'claims' && claimCount > 0" class="admin-shell__badge">{{ claimCount }}</span>
          </NuxtLink>
        </nav>
        <NuxtLink to="/app" class="admin-shell__back" @click.prevent="backToApp">Back to app</NuxtLink>
      </aside>

      <div class="admin-shell__main" :inert="navOpen && !desktop ? true : undefined">
        <header class="admin-shell__top">
          <button
            type="button"
            class="admin-shell__menu"
            :aria-expanded="navOpen"
            :aria-label="navOpen ? 'Close admin navigation' : 'Open admin navigation'"
            @click="navOpen = !navOpen"
          >
            Menu
          </button>
          <div class="admin-shell__heading">
            <h1>{{ title }}</h1>
            <p v-if="lede">{{ lede }}</p>
          </div>
          <div v-if="$slots.actions" class="admin-shell__actions">
            <slot name="actions" />
          </div>
        </header>
        <div
          class="admin-shell__body"
          :aria-busy="!status || status === 'idle' || status === 'loading' ? 'true' : undefined"
        >
          <p v-if="!status || status === 'idle' || status === 'loading'" class="admin-shell__state" role="status">
            <AdminBusyLabel busy>Loading…</AdminBusyLabel>
          </p>
          <p v-else-if="status === 'forbidden'" class="admin-shell__state">This portal is for KapeDoko staff.</p>
          <p v-else-if="status === 'error'" class="admin-shell__state admin-shell__state--error">{{ error }}</p>
          <template v-else>
            <p v-if="error" class="admin-shell__state admin-shell__state--error" role="alert">{{ error }}</p>
            <slot />
          </template>
        </div>
      </div>
    </div>
    <AdminToastStack v-if="isFeedbackHost" />
    <AdminBusyOverlay v-if="isFeedbackHost" />
    <AdminConfirmHost v-if="isFeedbackHost" />
  </IonContent>
</template>

<script lang="ts" setup>
import { IonContent, useIonRouter } from '@ionic/vue'
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminBusyOverlay from '~/components/admin/AdminBusyOverlay.vue'
import AdminConfirmHost from '~/components/admin/AdminConfirmHost.vue'
import AdminToastStack from '~/components/admin/AdminToastStack.vue'
import { adminNavIdFromPath, staffNav } from '~/utils/admin-nav'
import { isForeignSurface, isSameAppPath, resolveAppPath } from '~/utils/app-tabs'

const props = withDefaults(
  defineProps<{
    title: string
    lede?: string
    status?: 'idle' | 'loading' | 'ready' | 'forbidden' | 'error'
    error?: string
    pendingCount?: number
    claimCount?: number
    navRole?: 'admin' | 'auditor'
    layout?: 'cafe'
  }>(),
  {
    pendingCount: 0,
    claimCount: 0,
    navRole: 'admin',
  },
)

const route = useRoute()
const ionRouter = useIonRouter()
const navOpen = ref(false)
const desktop = ref(true)
const shellEl = ref<HTMLElement | null>(null)
const feedbackOwnerId = useId()
const feedbackHostId = useState<string | null>('kd-admin-feedback-host', () => null)
let feedbackReleased = false
const claimFeedbackHost = () => {
  if (feedbackReleased || feedbackHostId.value) return
  feedbackHostId.value = feedbackOwnerId
}
const isFeedbackHost = computed(() => feedbackHostId.value === feedbackOwnerId)
const ownedPath = route.path
const pendingPath = useState<string | null>('kd-admin-nav-path', () => null)
const items = computed(() => staffNav(props.navRole))
const active = computed(() => adminNavIdFromPath(pendingPath.value || route.path))
const revealAppTabBar = useRevealAppTabBar()
useAdminPageTabLock(shellEl)

const hideOwnedPage = () => {
  const page = shellEl.value?.closest('.ion-page')
  if (!page) return
  page.classList.add('ion-page-hidden')
  page.setAttribute('aria-hidden', 'true')
}

const browserPath = () => (
  import.meta.client ? `${window.location.pathname}${window.location.hash}` : ''
)

const settleAdminPages = () => {
  const pages = [...document.querySelectorAll('ion-router-outlet .ion-page')]
  if (pages.length < 2) return
  pages.forEach((page, index) => {
    const top = index === pages.length - 1
    page.classList.toggle('ion-page-hidden', !top)
    if (top) {
      page.classList.remove('ion-page-invisible')
      page.removeAttribute('aria-hidden')
    }
    else {
      page.setAttribute('aria-hidden', 'true')
    }
  })
}

const onResize = () => {
  desktop.value = window.innerWidth >= 1024
  if (desktop.value) navOpen.value = false
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && navOpen.value) navOpen.value = false
}

const go = async (href: string) => {
  pendingPath.value = href
  navOpen.value = false
  const here = resolveAppPath(route.path, browserPath())
  if (isSameAppPath(here, href)) return
  try {
    await navigateTo(href)
  }
  finally {
    if (import.meta.client) requestAnimationFrame(settleAdminPages)
  }
}

onMounted(() => {
  claimFeedbackHost()
  onResize()
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeydown)
})

watch(feedbackHostId, claimFeedbackHost)

onBeforeUnmount(() => {
  feedbackReleased = true
  if (feedbackHostId.value === feedbackOwnerId) feedbackHostId.value = null
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKeydown)
})

const backToApp = async () => {
  navOpen.value = false
  hideOwnedPage()
  revealAppTabBar('/app')
  await navigateTo('/app')
  ionRouter.navigate('/app', 'root', 'replace')
}

watch(() => route.path, (path) => {
  if (pendingPath.value && adminNavIdFromPath(path) === adminNavIdFromPath(pendingPath.value)) {
    pendingPath.value = null
  }
  if (!import.meta.client || !shellEl.value) return
  if (isForeignSurface(path) && adminNavIdFromPath(ownedPath) === adminNavIdFromPath(path)) return
  const page = shellEl.value.closest('.ion-page')
  if (!page) return
  if (!isForeignSurface(path)) {
    hideOwnedPage()
    revealAppTabBar(path)
    return
  }
  const pages = document.querySelectorAll('ion-router-outlet .ion-page')
  if (pages.length < 2) return
  hideOwnedPage()
})
</script>

<style scoped>
.admin-shell-content {
  --background: #f2f2f2;
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.admin-shell {
  display: grid;
  min-height: 100%;
  background: #f2f2f2;
  color: var(--kd-ink);
  scrollbar-color: color-mix(in srgb, var(--kd-ink) 28%, transparent) #f2f2f2;
}

.admin-shell__scrim {
  display: none;
}

.admin-shell__nav {
  display: none;
  flex-direction: column;
  gap: 18px;
  padding: 24px 18px;
  background: #faf8f5;
  border-right: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

.admin-shell__brand {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 12px;
  align-items: center;
}

.admin-shell__brand img {
  display: block;
  width: 132px;
  height: auto;
  grid-column: 1;
}

.admin-shell__brand p {
  margin: 0;
  grid-column: 1;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.3;
}

.admin-shell__close {
  grid-column: 2;
  grid-row: 1 / span 2;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: transparent;
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.7875rem;
  font-weight: 700;
  cursor: pointer;
}

.admin-shell__nav nav {
  display: grid;
  gap: 4px;
}

.admin-shell__link,
.admin-shell__back,
.admin-shell__menu,
.admin-btn,
.admin-chip {
  font-family: inherit;
}

.admin-shell__link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 12px 0 16px;
  border-radius: 16px;
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 400;
  text-decoration: none;
  transition:
    background-color 160ms cubic-bezier(0.16, 1, 0.3, 1),
    color 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.admin-shell__link-mark {
  position: absolute;
  top: 50%;
  left: 6px;
  display: block;
  width: 4px;
  height: 16px;
  border-radius: 16px;
  background: var(--kd-accent);
  opacity: 0;
  transform: translateY(-50%) scaleY(0.4);
  transition:
    opacity 160ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.admin-shell__link.is-active {
  background: color-mix(in srgb, var(--kd-primary) 14%, #faf8f5);
  color: var(--kd-primary);
  font-weight: 700;
}

.admin-shell__link.is-active .admin-shell__link-mark {
  opacity: 1;
  transform: translateY(-50%) scaleY(1);
}

.admin-shell__back {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin-top: auto;
  color: var(--kd-primary);
  font-size: 0.7875rem;
  font-weight: 700;
  text-decoration: none;
}

.admin-shell__badge {
  margin-left: auto;
  min-width: 20px;
  padding: 0 6px;
  border-radius: 8px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.admin-shell__main {
  min-width: 0;
}

.admin-shell__top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px 16px;
  padding: max(16px, env(safe-area-inset-top)) 16px 12px;
  border-bottom: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  background: #faf8f5;
}

.admin-shell__heading {
  flex: 1;
  min-width: 0;
}

.admin-shell__heading h1 {
  margin: 0;
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.admin-shell__heading p,
.admin-shell__state {
  margin: 8px 0 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.3;
}

.admin-shell__state--error {
  color: var(--kd-destructive);
  font-weight: 700;
}

.admin-shell__menu {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  font-weight: 700;
  cursor: pointer;
}

.admin-shell__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.admin-shell__body {
  padding: 16px;
}

.admin-shell :deep(.admin-grid) {
  display: grid;
  gap: 12px;
}

.admin-shell :deep(.admin-stats) {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.admin-shell :deep(.admin-card),
.admin-shell :deep(.admin-panel) {
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.admin-shell :deep(.admin-card h2),
.admin-shell :deep(.admin-panel h2) {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.admin-shell :deep(.admin-card p),
.admin-shell :deep(.admin-meta) {
  margin: 6px 0 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.3;
}

.admin-shell :deep(.report-quote) {
  margin: 10px 0 0;
  padding: 0;
  border: 0;
  color: var(--kd-ink);
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.admin-shell :deep(.admin-toolbar) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.admin-shell :deep(.admin-search) {
  flex: 1;
  min-width: 180px;
  min-height: 46px;
  width: 100%;
  padding: 0 4px;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 0;
  background: transparent;
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.95rem;
}

.admin-shell :deep(.admin-field input),
.admin-shell :deep(.admin-field select),
.admin-shell :deep(.admin-field textarea) {
  min-height: 44px;
  width: 100%;
  padding: 8px 12px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 8px;
  background: #faf8f5;
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.95rem;
}

.admin-shell :deep(.admin-search::placeholder),
.admin-shell :deep(.admin-field input::placeholder) {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
}

.admin-shell :deep(.admin-chip) {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 16px;
  background: transparent;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  font-weight: 400;
  cursor: pointer;
}

.admin-shell :deep(.admin-chip.is-active) {
  background: var(--kd-accent);
  font-weight: 700;
}

.admin-shell :deep(.admin-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border: 0;
  border-radius: 16px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-size: 0.7875rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.admin-shell :deep(.admin-btn--ghost) {
  border: 1px solid var(--kd-primary);
  background: transparent;
  color: var(--kd-primary);
}

.admin-shell :deep(.admin-btn--quiet) {
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  font-weight: 400;
}

.admin-shell :deep(.admin-btn--danger) {
  background: var(--kd-destructive);
  color: var(--kd-white);
}

.admin-shell :deep(.admin-btn:disabled) {
  opacity: 0.55;
  cursor: not-allowed;
}

.admin-shell :deep(.admin-table-wrap) {
  overflow-x: auto;
}

.admin-shell :deep(.admin-table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.7875rem;
  font-variant-numeric: tabular-nums;
}

.admin-shell :deep(.admin-table th),
.admin-shell :deep(.admin-table td) {
  padding: 12px 12px 12px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
  text-align: left;
  vertical-align: top;
}

.admin-shell :deep(.admin-table th) {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-weight: 700;
}

.admin-shell :deep(.admin-table td:first-child) {
  font-weight: 700;
  font-size: 0.95rem;
}

.admin-shell :deep(.admin-status) {
  display: inline;
  padding: 0;
  border: 0;
  background: none;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
}

.admin-shell :deep(.admin-status--approved),
.admin-shell :deep(.admin-status--current),
.admin-shell :deep(.admin-status--admin),
.admin-shell :deep(.admin-status--cafe-owner),
.admin-shell :deep(.admin-status--verified) {
  color: var(--kd-primary);
}

.admin-shell :deep(.admin-status--pending),
.admin-shell :deep(.admin-status--scheduled) {
  color: var(--kd-ink);
}

.admin-shell :deep(.admin-status--rejected),
.admin-shell :deep(.admin-status--ended),
.admin-shell :deep(.admin-status--banned) {
  color: var(--kd-destructive);
}

.admin-shell :deep(.admin-facts) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0 0 16px;
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.admin-shell :deep(.admin-facts span) {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-weight: 400;
}

.admin-shell :deep(.admin-rail) {
  margin: 0 0 20px;
}

.admin-shell :deep(.admin-rail__head) {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 12px;
  margin-bottom: 8px;
}

.admin-shell :deep(.admin-rail__head h2) {
  margin: 0;
  font-size: 0.95rem;
}

.admin-shell :deep(.admin-rail__head p),
.admin-shell :deep(.admin-rail__empty) {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
}

.admin-shell :deep(.admin-rail__scroller) {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-color: color-mix(in srgb, var(--kd-ink) 28%, transparent) #f2f2f2;
}

.admin-shell :deep(.admin-ticket) {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 160px;
  max-width: 220px;
  min-height: 64px;
  padding: 12px;
  border-radius: 16px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  text-decoration: none;
  animation: admin-stamp 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.admin-shell :deep(.admin-ticket__name) {
  overflow: hidden;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-shell :deep(.admin-ticket__addr) {
  overflow: hidden;
  font-size: 0.75rem;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-shell :deep(.admin-ledger) {
  padding: 8px 16px 4px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.admin-shell :deep(.admin-cards) {
  display: none;
}

.admin-shell :deep(.admin-form) {
  display: grid;
  gap: 16px;
}

.admin-shell :deep(.admin-field) {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
}

.admin-shell :deep(.admin-error) {
  margin: 0;
  color: var(--kd-destructive);
  font-size: 13px;
  font-weight: 700;
}

.admin-shell :deep(.admin-row-actions) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.admin-shell :deep(.admin-label) {
  display: block;
  font-size: 0.7875rem;
  font-weight: 700;
}

.admin-shell :deep(.admin-pay) {
  display: grid;
  gap: 10px;
  margin: 12px 0 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

.admin-shell :deep(.admin-pay legend) {
  padding: 0;
  margin: 0 0 6px;
}

.admin-shell :deep(.admin-pay__row) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.admin-shell :deep(.admin-pay__name) {
  min-width: 44px;
  font-size: 0.7875rem;
  font-weight: 700;
}

.admin-shell :deep(.admin-link) {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-primary);
  font: inherit;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

@keyframes admin-stamp {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (hover: hover) and (pointer: fine) {
  .admin-shell__link:hover:not(.is-active) {
    background: color-mix(in srgb, var(--kd-ink) 6%, #faf8f5);
  }

  .admin-shell__back:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .admin-shell :deep(.admin-btn--quiet:hover),
  .admin-shell :deep(.admin-link:hover) {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .admin-shell :deep(.admin-ticket:hover) {
    filter: brightness(0.97);
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-shell :deep(.admin-ticket) {
    animation: none;
  }

  .admin-shell__link,
  .admin-shell__link-mark {
    transition: none;
  }

  .admin-shell__link-mark {
    transform: translateY(-50%);
  }
}

@media (max-width: 767px) {
  .admin-shell :deep(.admin-ledger) {
    padding: 0;
    border: 0;
    background: transparent;
  }

  .admin-shell :deep(.admin-table-wrap) {
    display: none;
  }

  .admin-shell :deep(.admin-cards) {
    display: grid;
    gap: 12px;
  }
}

@media (min-width: 768px) {
  .admin-shell :deep(.admin-stats) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .admin-shell :deep(.admin-form) {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }

  .admin-shell :deep(.admin-form > .admin-span) {
    grid-column: 1 / -1;
  }
}

@media (min-width: 1024px) {
  .admin-shell {
    grid-template-columns: 224px minmax(0, 1fr);
  }

  .admin-shell__nav {
    display: flex;
    position: sticky;
    top: 0;
    height: 100vh;
  }

  .admin-shell__menu {
    display: none;
  }

  .admin-shell__body {
    padding: 24px 28px 40px;
    max-width: 1280px;
  }

  .admin-shell :deep(.admin-stats) {
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }
}

@media (max-width: 1023px) {
  .admin-shell.is-nav-open .admin-shell__scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 20;
    background: color-mix(in srgb, var(--kd-ink) 40%, transparent);
  }

  .admin-shell.is-nav-open .admin-shell__nav {
    display: flex;
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 21;
    width: min(280px, 86vw);
    height: auto;
    max-height: 100dvh;
    overflow: auto;
    padding-top: max(24px, env(safe-area-inset-top));
    padding-bottom: max(24px, env(safe-area-inset-bottom));
    padding-left: max(18px, env(safe-area-inset-left));
  }
}

.admin-shell :deep(.admin-btn:focus-visible),
.admin-shell :deep(.admin-chip:focus-visible),
.admin-shell :deep(.admin-search:focus-visible),
.admin-shell :deep(.admin-field input:focus-visible),
.admin-shell :deep(.admin-field select:focus-visible),
.admin-shell :deep(.admin-field textarea:focus-visible),
.admin-shell :deep(.admin-picker__trigger:focus-visible),
.admin-shell :deep(.admin-ticket:focus-visible),
.admin-shell__link:focus-visible,
.admin-shell__menu:focus-visible,
.admin-shell__close:focus-visible,
.admin-shell__back:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.admin-shell--cafe .admin-shell__top {
  padding: max(20px, env(safe-area-inset-top)) 20px 20px;
  gap: 16px 20px;
}

.admin-shell--cafe .admin-shell__body {
  padding: 20px 20px 36px;
}

@media (min-width: 1024px) {
  .admin-shell--cafe .admin-shell__top {
    padding: max(24px, env(safe-area-inset-top)) 32px 20px;
  }

  .admin-shell--cafe .admin-shell__body {
    padding: 28px 32px 48px;
  }
}
</style>
