<template>
  <IonPage>
    <IonContent :scroll-y="true" class="cafe-page-content">
      <div class="cafe-page">
        <header class="cafe-page__bar">
          <button type="button" class="cafe-page__back" aria-label="Go back" @click="goBack">
            <ChevronLeft :size="22" :stroke-width="2.25" />
          </button>
          <h1 class="sr-only">{{ heading }}</h1>
        </header>

        <div v-if="status === 'loading'" class="cafe-page__state">
          <p>Loading this cafe…</p>
          <div class="cafe-page__pulse" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div v-else-if="status === 'missing' || status === 'error'" class="cafe-page__state">
          <h2>
            {{ status === 'error' ? 'Could not load this cafe' : 'This cafe is not on the map yet' }}
          </h2>
          <p>
            {{
              status === 'error'
                ? 'Check your connection and try again.'
                : 'It may still be pending review, or the link is out of date.'
            }}
          </p>
          <button type="button" class="cafe-page__home" @click="goHome">Back to Home</button>
        </div>

        <CafeDetailContent
          v-else-if="cafe"
          :cafe="cafe"
          variant="page"
          @review="onReview"
          @checkin="onCheckIn"
        />
        <p v-if="cafe && cafe.source === 'openstreetmap'" class="cafe-page__attr">
          Place data © OpenStreetMap contributors
        </p>
        <section v-if="cafe && status === 'ready' && ownerHref" class="cafe-page__owner" :aria-labelledby="ownerHeadingId">
          <div class="cafe-page__mast">
            <div class="cafe-page__stamp" aria-hidden="true">
              <Store :size="18" :stroke-width="2.25" />
            </div>
            <h2 :id="ownerHeadingId">{{ ownerTitle }}</h2>
          </div>
          <p class="cafe-page__owner-hint">{{ ownerHint }}</p>
          <a
            class="cafe-page__claim"
            :class="{ 'is-quiet': ownerQuiet }"
            :href="ownerHref"
            @click.prevent="goOwner"
          >
            {{ ownerLabel }}
          </a>
        </section>
      </div>
    </IonContent>
  </IonPage>
</template>

<script lang="ts" setup>
import { Capacitor } from '@capacitor/core'
import { onIonViewWillEnter, useIonRouter } from '@ionic/vue'
import { ChevronLeft, Store } from 'lucide-vue-next'
import CafeDetailContent from '~/components/cafe/CafeDetailContent.vue'
import type { Cafe } from '~/types/cafe'
import {
  fetchApprovedCafeById,
  hydrateCafeDetail,
  isShopId,
  shopIdFromRoute,
} from '~/utils/approved-shops'
import {
  ANALYTICS_EVENTS,
  confidenceBucketFromStatus,
  detailViewKey,
  takeDetailSource,
} from '~/utils/analytics'

useAppTabBar('hide')

const route = useRoute()
const ionRouter = useIonRouter()
const supabase = useSupabaseClient()
const config = useRuntimeConfig()
const { user } = useAuth()
const { track, once, consent } = useAnalytics()
const ownership = useShopOwnership()

const { upsertCafe } = useApprovedShops()
const cafe = ref<Cafe | null>(null)
const status = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')

const shopId = computed(() => resolveShopId())
const heading = computed(() => cafe.value?.name || 'Cafe details')
const ownerClaim = computed(() => (shopId.value ? ownership.claimForShop(shopId.value) : null))
const ownerHeadingId = 'cafe-owner-invite'
const ownerTitle = computed(() => {
  if (ownerClaim.value?.status === 'verified') return 'You manage this cafe'
  if (ownerClaim.value?.status === 'pending') return 'We’re reviewing your claim'
  return 'Are you the owner of this cafe?'
})
const ownerHint = computed(() => {
  if (ownerClaim.value?.status === 'verified') return 'Hours, contact, and the logo are yours to keep current.'
  if (ownerClaim.value?.status === 'pending') return 'This listing stays on the map while we check.'
  if (ownerClaim.value?.status === 'rejected') return 'You can send a clearer claim and we’ll look again.'
  return 'Hours and the logo stay truer when the shop keeps them.'
})
const ownerHref = computed(() => {
  if (!shopId.value) return ''
  if (!user.value) return `/login?redirect=${encodeURIComponent(`/app/cafes/${shopId.value}/claim`)}`
  if (ownerClaim.value?.status === 'verified') return `/app/cafes/${shopId.value}/edit`
  return `/app/cafes/${shopId.value}/claim`
})
const ownerLabel = computed(() => {
  if (!user.value) return 'Sign in to claim this cafe'
  if (ownerClaim.value?.status === 'verified') return 'Edit listing'
  if (ownerClaim.value?.status === 'pending') return 'View claim'
  if (ownerClaim.value?.status === 'rejected') return 'Send a new claim'
  return 'Claim this cafe'
})
const ownerQuiet = computed(() => ownerClaim.value?.status === 'pending')

function resolveShopId(): string {
  const param = route.params.id
  const href = import.meta.client
    ? `${window.location.pathname}${window.location.hash}${window.location.search}`
    : ''
  return (
    shopIdFromRoute(route.fullPath, param)
    || shopIdFromRoute(route.path, param)
    || shopIdFromRoute(String(ionRouter.routeInfo?.pathname || ''), param)
    || shopIdFromRoute(href, param)
  )
}

const publicBase = () => String(config.public.r2PublicBaseUrl || '')

const loadCafe = async (id: string): Promise<Cafe | null> => {
  const next = await fetchApprovedCafeById(supabase, publicBase(), id)
  if (!next) return null
  let hydrated = next
  try {
    hydrated = await hydrateCafeDetail(supabase, next)
  } catch {
    hydrated = next
  }
  upsertCafe(hydrated)
  return hydrated
}

const goHome = async () => {
  await navigateTo('/app')
}

const goBack = async () => {
  if (ionRouter.canGoBack()) {
    ionRouter.back()
    return
  }
  await goHome()
}

const onReview = async () => {
  const id = shopId.value || cafe.value?.id
  if (!id) return
  await navigateTo(`/app/cafes/${id}/review`)
}

const onCheckIn = async () => {
  const id = shopId.value || cafe.value?.id
  if (!id) return
  await navigateTo(`/app/cafes/${id}/check-in`)
}

const goOwner = async () => {
  if (!ownerHref.value) return
  if (!user.value) {
    track(ANALYTICS_EVENTS.AUTH_PROMPT_SHOWN, { trigger: 'claim' })
  }
  await navigateTo(ownerHref.value)
}

const trackCafeDetail = (next: Cafe) => {
  if (!once(detailViewKey(next.id))) return
  track(ANALYTICS_EVENTS.CAFE_DETAIL_VIEWED, {
    cafe_id: next.id,
    wifi_confidence: confidenceBucketFromStatus(next.work.wifiStatus),
    outlet_confidence: confidenceBucketFromStatus(next.work.outletsStatus),
    source: takeDetailSource(route.query.from),
  })
}

const onHardwareBack = (event: Event) => {
  const register = (event as CustomEvent<{ register: (priority: number, handler: () => void) => void }>).detail?.register
  if (!register) return
  register(20, () => {
    void goBack()
  })
}

let loadSeq = 0
let emptyIdTimer: ReturnType<typeof window.setTimeout> | null = null

const bootstrap = async (id: string, force = false) => {
  if (emptyIdTimer) {
    window.clearTimeout(emptyIdTimer)
    emptyIdTimer = null
  }

  if (!isShopId(id)) {
    if (id) {
      status.value = 'missing'
      return
    }
    status.value = cafe.value ? 'ready' : 'loading'
    emptyIdTimer = window.setTimeout(() => {
      const retry = resolveShopId()
      if (isShopId(retry)) {
        void bootstrap(retry, force)
        return
      }
      if (!cafe.value && status.value === 'loading') status.value = 'missing'
    }, 600)
    return
  }
  if (cafe.value?.id === id && status.value === 'ready' && !force) return

  const seq = ++loadSeq
  if (!cafe.value) status.value = 'loading'
  try {
    const nextCafe = await loadCafe(id)
    if (seq !== loadSeq) return
    if (!nextCafe) {
      cafe.value = null
      status.value = 'missing'
      return
    }
    cafe.value = nextCafe
    status.value = 'ready'
    if (user.value) void ownership.loadClaimForShop(id)
    trackCafeDetail(nextCafe)
  } catch {
    if (seq !== loadSeq) return
    status.value = cafe.value?.id === id ? 'ready' : 'error'
  }
}

watch(
  () => [route.fullPath, route.path, route.params.id],
  () => {
    void bootstrap(resolveShopId())
  },
  { immediate: true },
)

watch(consent, (value) => {
  if (value === 'granted' && cafe.value && status.value === 'ready') {
    trackCafeDetail(cafe.value)
  }
})

onIonViewWillEnter(() => {
  void bootstrap(resolveShopId(), true)
})

onMounted(() => {
  if (Capacitor.getPlatform() === 'android') {
    document.documentElement.classList.add('is-android')
  }
  document.addEventListener('ionBackButton', onHardwareBack)
})

onBeforeUnmount(() => {
  if (emptyIdTimer) window.clearTimeout(emptyIdTimer)
  document.removeEventListener('ionBackButton', onHardwareBack)
})
</script>

<style scoped>
.cafe-page-content {
  --background: #f2f2f2;
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.cafe-page {
  width: 100%;
  max-width: 100%;
  min-height: 100%;
  overflow-x: clip;
  background: #f2f2f2;
}

.cafe-page__bar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: max(0.75rem, env(safe-area-inset-top)) 12px 0 8px;
  background: #faf8f5;
}

.cafe-page__back {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 140ms cubic-bezier(0.16, 1, 0.3, 1);
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

.cafe-page__state {
  padding: 20px;
}

.cafe-page__state p,
.cafe-page__state h2 {
  margin: 0;
  color: var(--kd-ink);
}

.cafe-page__state h2 {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.cafe-page__state p {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.35;
}

.cafe-page__pulse {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.cafe-page__pulse span {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: var(--kd-secondary);
  transform-origin: left center;
  animation: cafe-page-pulse 900ms cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

.cafe-page__pulse span:nth-child(1) { width: 72%; }
.cafe-page__pulse span:nth-child(2) { width: 54%; animation-delay: 90ms; }
.cafe-page__pulse span:nth-child(3) { width: 38%; animation-delay: 160ms; }

.cafe-page__home {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 45px;
  margin-top: 20px;
  padding: 0 20px;
  border: 0;
  border-radius: 16px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-size: 16px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  text-decoration: none;
}

.cafe-page__owner {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  margin: 0 20px calc(20px + env(safe-area-inset-bottom));
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.cafe-page__mast {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cafe-page__stamp {
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--kd-accent) 18%, #faf8f5);
  color: var(--kd-ink);
}

.cafe-page__mast h2,
.cafe-page__owner-hint {
  margin: 0;
  color: var(--kd-ink);
  overflow-wrap: anywhere;
}

.cafe-page__mast h2 {
  min-width: 0;
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.03em;
}

.cafe-page__owner-hint {
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
  font-size: 0.75rem;
  line-height: 1.3;
}

.cafe-page__claim {
  display: flex;
  align-items: center;
  justify-content: center;
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
  transition: box-shadow 160ms ease;
}

.cafe-page__claim.is-quiet {
  border-color: color-mix(in srgb, var(--kd-ink) 22%, transparent);
  background: #faf8f5;
}

.cafe-page__claim:active {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

@media (hover: hover) {
  .cafe-page__claim:hover {
    box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
  }
}

.cafe-page__attr {
  margin: 0;
  padding: 8px 20px 10px;
  color: color-mix(in srgb, var(--kd-ink) 62%, transparent);
  font-size: 11px;
  line-height: 1.35;
}

.cafe-page__back:focus-visible,
.cafe-page__home:focus-visible,
.cafe-page__claim:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 3px;
  border-radius: 16px;
}

.cafe-page__back:active,
.cafe-page__home:active {
  transform: scale(0.96);
}

@keyframes cafe-page-pulse {
  0%,
  100% {
    opacity: 0.55;
  }
  50% {
    opacity: 1;
  }
}

@media (min-width: 540px) {
  .cafe-page {
    max-width: 480px;
    margin-inline: auto;
  }
}

:root.is-android .cafe-page__home,
:root.is-android .cafe-page__claim {
  min-height: 48px;
}

@media (prefers-reduced-motion: reduce) {
  .cafe-page__pulse span,
  .cafe-page__back,
  .cafe-page__home,
  .cafe-page__claim {
    animation: none;
    transition-duration: 1ms;
  }

  .cafe-page__back:active,
  .cafe-page__home:active {
    transform: none;
  }
}
</style>
