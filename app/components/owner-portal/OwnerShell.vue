<template>
  <IonContent class="owner-shell-content">
    <div ref="shellEl" class="owner-shell" :class="{ 'is-nav-open': navOpen }">
      <div
        v-if="navOpen"
        class="owner-shell__scrim"
        aria-hidden="true"
        @click="navOpen = false"
      />

      <aside class="owner-shell__nav" :aria-hidden="!desktop && !navOpen">
        <div class="owner-shell__brand">
          <img src="/assets/kapedoko-horizontal-text_dark.png" alt="kapé DOKO" width="132" height="28" />
          <p>Owner desk</p>
          <button
            v-if="!desktop"
            type="button"
            class="owner-shell__close"
            aria-label="Close owner navigation"
            @click="navOpen = false"
          >
            Close
          </button>
        </div>
        <nav aria-label="Owner desk">
          <NuxtLink
            v-for="item in items"
            :key="item.id"
            :to="item.href"
            class="owner-shell__link"
            :class="{ 'is-active': active === item.id }"
            :aria-current="active === item.id ? 'page' : undefined"
            @click.prevent="go(item.href)"
          >
            <span class="owner-shell__link-mark" aria-hidden="true" />
            {{ item.label }}
            <span v-if="item.id === 'claims' && claimCount > 0" class="owner-shell__badge">{{ claimCount }}</span>
          </NuxtLink>
        </nav>
        <button type="button" class="owner-shell__signout" :disabled="signingOut" @click="onSignOut">
          {{ signingOut ? 'Signing out…' : 'Sign out' }}
        </button>
        <NuxtLink to="/app" class="owner-shell__back" @click.prevent="backToApp">Back to app</NuxtLink>
      </aside>

      <div class="owner-shell__main" :inert="navOpen && !desktop ? true : undefined">
        <header class="owner-shell__top">
          <button
            type="button"
            class="owner-shell__menu"
            :aria-expanded="navOpen"
            :aria-label="navOpen ? 'Close owner navigation' : 'Open owner navigation'"
            @click="navOpen = !navOpen"
          >
            Menu
          </button>
          <div class="owner-shell__heading" :class="{ 'has-back': Boolean(backNav) }">
            <OwnerBackButton
              v-if="backNav"
              :to="backNav.to"
              :label="backNav.label"
              @navigate="go"
            />
            <h1>{{ title }}</h1>
            <p v-if="lede">{{ lede }}</p>
          </div>
          <div v-if="$slots.actions" class="owner-shell__actions">
            <slot name="actions" />
          </div>
        </header>
        <div
          class="owner-shell__body"
          :aria-busy="!status || status === 'idle' || status === 'loading' ? 'true' : undefined"
        >
          <p v-if="!status || status === 'idle' || status === 'loading'" class="owner-shell__state" role="status">
            <OwnerBusyLabel busy>Loading…</OwnerBusyLabel>
          </p>
          <p v-else-if="status === 'forbidden'" class="owner-shell__state">{{ ownerForbiddenCopy() }}</p>
          <p v-else-if="status === 'error'" class="owner-shell__state owner-shell__state--error">{{ error }}</p>
          <template v-else>
            <p v-if="error" class="owner-shell__state owner-shell__state--error" role="alert">{{ error }}</p>
            <slot />
          </template>
        </div>
      </div>
    </div>
    <OwnerToastStack v-if="isFeedbackHost" />
    <OwnerBusyOverlay v-if="isFeedbackHost" />
    <OwnerConfirmHost v-if="isFeedbackHost" />
  </IonContent>
</template>

<script lang="ts" setup>
import { IonContent, useIonRouter } from '@ionic/vue'
import OwnerBackButton from '~/components/owner-portal/OwnerBackButton.vue'
import OwnerBusyLabel from '~/components/owner-portal/OwnerBusyLabel.vue'
import OwnerBusyOverlay from '~/components/owner-portal/OwnerBusyOverlay.vue'
import OwnerConfirmHost from '~/components/owner-portal/OwnerConfirmHost.vue'
import OwnerToastStack from '~/components/owner-portal/OwnerToastStack.vue'
import { isSameAppPath, resolveAppPath } from '~/utils/app-tabs'
import { OWNER_NAV, ownerBackNav, ownerNavIdFromPath } from '~/utils/owner-nav'
import { ownerForbiddenCopy } from '~/utils/owner-portal'

const props = withDefaults(
  defineProps<{
    title: string
    lede?: string
    status?: 'idle' | 'loading' | 'ready' | 'forbidden' | 'error'
    error?: string
    claimCount?: number
    backTo?: string
    backLabel?: string
  }>(),
  {
    claimCount: 0,
  },
)

const route = useRoute()
const ionRouter = useIonRouter()
const navOpen = ref(false)
const desktop = ref(true)
const shellEl = ref<HTMLElement | null>(null)
const signingOut = ref(false)
const feedbackOwnerId = useId()
const feedbackHostId = useState<string | null>('kd-owner-feedback-host', () => null)
let feedbackReleased = false
const claimFeedbackHost = () => {
  if (feedbackReleased || feedbackHostId.value) return
  feedbackHostId.value = feedbackOwnerId
}
const isFeedbackHost = computed(() => feedbackHostId.value === feedbackOwnerId)
const ownedPath = route.path
const pendingPath = useState<string | null>('kd-owner-nav-path', () => null)
const items = OWNER_NAV
const active = computed(() => ownerNavIdFromPath(pendingPath.value || route.path))
const revealAppTabBar = useRevealAppTabBar()
useHideAppTabs(shellEl, 'owner')
useAppTabBar('hide')

const { signOut } = useOwnerPortal()

const hideOwnedPage = () => {
  const page = shellEl.value?.closest('.ion-page')
  if (!page) return
  page.classList.add('ion-page-hidden')
  page.setAttribute('aria-hidden', 'true')
}

const browserPath = () => (
  import.meta.client ? `${window.location.pathname}${window.location.hash}` : ''
)

const backNav = computed(() => {
  const label = props.backLabel?.trim()
  if (props.backTo) return { to: props.backTo, label: label || 'Back' }
  const auto = ownerBackNav(resolveAppPath(route.path, browserPath()))
  if (!auto) return null
  return label ? { ...auto, label } : auto
})

const settleOwnerPages = () => {
  const pages = [...document.querySelectorAll('ion-router-outlet .ion-page')]
  if (pages.length < 2) return
  pages.forEach((page, index) => {
    const top = index === pages.length - 1
    page.classList.toggle('ion-page-hidden', !top)
    if (top) {
      page.classList.remove('ion-page-invisible')
      page.removeAttribute('aria-hidden')
    } else {
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
  } finally {
    if (import.meta.client) requestAnimationFrame(settleOwnerPages)
  }
}

const backToApp = async () => {
  navOpen.value = false
  hideOwnedPage()
  revealAppTabBar('/app')
  await navigateTo('/app')
  ionRouter.navigate('/app', 'root', 'replace')
}

const onSignOut = async () => {
  if (signingOut.value) return
  signingOut.value = true
  try {
    await signOut()
    await navigateTo('/owner/login')
  } finally {
    signingOut.value = false
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

watch(() => route.path, (path) => {
  if (pendingPath.value && ownerNavIdFromPath(path) === ownerNavIdFromPath(pendingPath.value)) {
    pendingPath.value = null
  }
  if (!import.meta.client || !shellEl.value) return
  if (path.startsWith('/owner') && ownerNavIdFromPath(ownedPath) === ownerNavIdFromPath(path)) return
  const page = shellEl.value.closest('.ion-page')
  if (!page) return
  if (!path.startsWith('/owner')) {
    hideOwnedPage()
    revealAppTabBar(path)
  }
})
</script>

<style scoped>
.owner-shell-content {
  --background: #f2f2f2;
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.owner-shell {
  display: grid;
  min-height: 100%;
  background: #f2f2f2;
  color: var(--kd-ink);
  scrollbar-color: color-mix(in srgb, var(--kd-ink) 28%, transparent) #f2f2f2;
}

.owner-shell__scrim {
  display: none;
}

.owner-shell__nav {
  display: none;
  flex-direction: column;
  gap: 18px;
  padding: 28px 20px;
  background: #faf8f5;
  border-right: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

.owner-shell__brand {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 12px;
  align-items: center;
}

.owner-shell__brand img {
  display: block;
  width: 132px;
  height: auto;
  grid-column: 1;
}

.owner-shell__brand p {
  margin: 0;
  grid-column: 1;
  color: var(--kd-primary);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
}

.owner-shell__close,
.owner-shell__menu,
.owner-shell__signout {
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

.owner-shell__close {
  grid-column: 2;
  grid-row: 1 / span 2;
}

.owner-shell__nav nav {
  display: grid;
  gap: 4px;
}

.owner-shell__link {
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

.owner-shell__link-mark {
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

.owner-shell__link.is-active {
  background: color-mix(in srgb, var(--kd-primary) 14%, #faf8f5);
  color: var(--kd-primary);
  font-weight: 700;
}

.owner-shell__link.is-active .owner-shell__link-mark {
  opacity: 1;
  transform: translateY(-50%) scaleY(1);
}

.owner-shell__signout {
  margin-top: auto;
  text-align: left;
}

.owner-shell__back {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--kd-primary);
  font-size: 0.7875rem;
  font-weight: 700;
  text-decoration: none;
}

.owner-shell__badge {
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

.owner-shell__main {
  min-width: 0;
}

.owner-shell__top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px 20px;
  padding: max(20px, env(safe-area-inset-top)) 20px 20px;
  border-bottom: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  background: #faf8f5;
}

.owner-shell__heading {
  flex: 1;
  min-width: 0;
}

.owner-shell__heading.has-back {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.owner-shell__heading.has-back :deep(.owner-back) {
  margin: -8px 0 -4px -10px;
}

.owner-shell__heading h1 {
  margin: 0;
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.owner-shell__heading p,
.owner-shell__state {
  margin: 8px 0 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.3;
}

.owner-shell__state--error {
  color: var(--kd-destructive);
  font-weight: 700;
}

.owner-shell__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.owner-shell__body {
  padding: 20px 20px 36px;
}

.owner-shell :deep(.owner-btn) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--kd-accent);
  border-radius: 16px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.7875rem;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.owner-shell :deep(.owner-btn--ghost) {
  border-color: color-mix(in srgb, var(--kd-ink) 22%, transparent);
  background: transparent;
}

.owner-shell :deep(.owner-btn:disabled) {
  opacity: 0.55;
  cursor: not-allowed;
}

.owner-shell :deep(.owner-chip) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: transparent;
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.7875rem;
  cursor: pointer;
}

.owner-shell :deep(.owner-chip.is-active) {
  border-color: var(--kd-accent);
  background: var(--kd-accent);
  font-weight: 700;
}

.owner-shell :deep(.owner-search) {
  width: 100%;
  height: 46px;
  padding: 0 12px;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 0;
  background: transparent;
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.95rem;
  caret-color: var(--kd-primary);
}

.owner-shell :deep(.owner-btn:focus-visible),
.owner-shell :deep(.owner-chip:focus-visible),
.owner-shell :deep(.owner-search:focus-visible),
.owner-shell__link:focus-visible,
.owner-shell__menu:focus-visible,
.owner-shell__close:focus-visible,
.owner-shell__back:focus-visible,
.owner-shell__signout:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

@media (hover: hover) and (pointer: fine) {
  .owner-shell__link:hover:not(.is-active) {
    background: color-mix(in srgb, var(--kd-ink) 6%, #faf8f5);
  }

  .owner-shell__back:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .owner-shell__link,
  .owner-shell__link-mark {
    transition: none;
  }

  .owner-shell__link-mark {
    transform: translateY(-50%);
  }
}

@media (min-width: 1024px) {
  .owner-shell {
    grid-template-columns: 224px minmax(0, 1fr);
  }

  .owner-shell__nav {
    display: flex;
    position: sticky;
    top: 0;
    height: 100vh;
  }

  .owner-shell__menu {
    display: none;
  }

  .owner-shell__top {
    padding: max(24px, env(safe-area-inset-top)) 32px 20px;
  }

  .owner-shell__body {
    padding: 28px 32px 48px;
    max-width: 820px;
  }
}

@media (max-width: 1023px) {
  .owner-shell.is-nav-open .owner-shell__scrim {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 20;
    background: color-mix(in srgb, var(--kd-ink) 40%, transparent);
  }

  .owner-shell.is-nav-open .owner-shell__nav {
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
    padding-top: max(28px, env(safe-area-inset-top));
    padding-bottom: max(24px, env(safe-area-inset-bottom));
    padding-left: max(20px, env(safe-area-inset-left));
  }
}

:root.is-android .owner-shell__menu,
:root.is-android .owner-shell__close,
:root.is-android .owner-shell__signout,
:root.is-android .owner-shell :deep(.owner-btn),
:root.is-android .owner-shell :deep(.owner-chip) {
  min-height: 48px;
}
</style>
