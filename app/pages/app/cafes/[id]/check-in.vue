<template>
  <IonPage>
    <IonContent :scroll-y="true" class="checkin-content">
      <div class="checkin" :class="{ 'is-done': submitted }">
        <header class="checkin__hero">
          <div class="checkin__hero-bar">
            <button type="button" class="checkin__back" :aria-label="backLabel" @click="goBack">
              <ChevronLeft :size="22" :stroke-width="2.25" />
            </button>
            <p class="checkin__title">You are checking in</p>
          </div>

          <div v-if="cafe" class="checkin__place">
            <h1>{{ cafe.name }}</h1>
            <p>{{ cafe.address }}</p>
          </div>
        </header>

        <div v-if="status === 'loading'" class="checkin__body">
          <p class="checkin__status">Loading this cafe…</p>
          <div class="checkin__pulse" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div v-else-if="status === 'missing' || status === 'error'" class="checkin__body">
          <section class="checkin__sheet" aria-labelledby="missing-title">
            <h2 id="missing-title">
              {{ status === 'error' ? 'Could not load this cafe' : 'This cafe is not on the map yet' }}
            </h2>
            <p>
              {{
                status === 'error'
                  ? 'Check your connection and try again. If you just opened this from the map, go back and tap Check in again.'
                  : 'It may still be pending review, or the link is out of date.'
              }}
            </p>
          </section>
          <div class="checkin__dock">
            <button type="button" class="checkin__cta" @click="goHome">Back to Home</button>
          </div>
        </div>

        <div v-else-if="submitted && cafe" class="checkin__body">
          <section class="checkin__sheet checkin__sheet--done" aria-labelledby="done-title">
            <h2 id="done-title">{{ doneTitle }}</h2>
            <p>{{ doneCopy }}</p>
          </section>
          <div class="checkin__dock checkin__dock--stack">
            <button type="button" class="checkin__cta" @click="goToReview">Add WiFi and outlets</button>
            <button type="button" class="checkin__cta checkin__cta--quiet" @click="goToCafe">Back to this cafe</button>
          </div>
        </div>

        <form v-else-if="cafe" class="checkin__form" @submit.prevent="onPrimary">
          <div class="checkin__note">
            <Info :size="16" :stroke-width="2.25" aria-hidden="true" />
            <p>
              Tell other KapéBeans how packed
              <strong>{{ cafe.name }}</strong>
              is right now. You can add WiFi and outlets after.
            </p>
          </div>

          <div class="checkin__question">
            <p class="checkin__topic">
              <Users :size="16" :stroke-width="2.25" aria-hidden="true" />
              Right now
            </p>
            <h2>How packed is it right now?</h2>
            <div class="checkin__answers">
              <ReviewChoiceGroup
                v-model="level"
                :options="BUSYNESS_OPTIONS"
                ariaLabel="How packed is it right now?"
                :disabled="busy"
              />
            </div>
          </div>

          <p v-if="issue" class="checkin__error" role="alert">{{ issue }}</p>

          <div class="checkin__dock">
            <button type="submit" class="checkin__cta" :disabled="busy" :aria-busy="busy">
              {{ primaryLabel }}
            </button>
          </div>
        </form>
      </div>
    </IonContent>
  </IonPage>
</template>

<script lang="ts" setup>
import { ChevronLeft, Info, Users } from 'lucide-vue-next'
import { Capacitor } from '@capacitor/core'
import { onIonViewWillEnter, useIonRouter } from '@ionic/vue'
import ReviewChoiceGroup from '~/components/review/ReviewChoiceGroup.vue'
import type { Cafe } from '~/types/cafe'
import type { BusynessLevel } from '~/types/shop'
import { isShopId, shopIdFromRoute } from '~/utils/approved-shops'
import {
  BUSYNESS_OPTIONS,
  checkInPath,
  cooldownRemainingMs,
  cooldownWaitCopy,
  isBusynessCooldown,
  parseBusynessLevelQuery,
  readCheckInAt,
} from '~/utils/cafe-review'
import { ANALYTICS_EVENTS, checkInStartKey } from '~/utils/analytics'

useAppTabBar('hide')

const route = useRoute()
const ionRouter = useIonRouter()
const { currentUserId, goToLogin } = useAuth()
const { track, once, consent } = useAnalytics()
const { loadCafe, reportBusyness, reporting } = useCafeReview()

const shopId = computed(() => resolveShopId())

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

const cafe = ref<Cafe | null>(null)
const level = ref<BusynessLevel | null>(parseBusynessLevelQuery(route.query.level))
const status = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')
const submitted = ref(false)
const cooldown = ref(false)
const waitCopy = ref('')
const issue = ref<string | null>(null)
const allowLeave = ref(false)
const locking = ref(false)

const busy = computed(() => locking.value || reporting.value)
const backLabel = computed(() => (submitted.value ? 'Back to this cafe' : 'Go back'))
const primaryLabel = computed(() => (busy.value ? 'Logging…' : 'Check in'))
const doneTitle = computed(() => (
  cooldown.value
    ? 'We already logged how busy this cafe is.'
    : 'Logged. Other KapéBeans can see how packed it is.'
))
const doneCopy = computed(() => {
  if (cooldown.value) {
    return `${waitCopy.value || 'You can check in again in a bit.'} Add WiFi and outlets if you have a minute.`
  }
  return `Your check-in at ${cafe.value?.name || 'this cafe'} helps people decide before they sit down.`
})

watch(
  () => route.query.level,
  (value) => {
    const next = parseBusynessLevelQuery(value)
    if (next) level.value = next
  },
)

watch(level, () => {
  issue.value = null
})

const onHardwareBack = (event: Event) => {
  const register = (event as CustomEvent<{ register: (priority: number, handler: () => void) => void }>).detail?.register
  if (!register) return
  register(20, () => {
    void goBack()
  })
}

const goHome = async () => {
  allowLeave.value = true
  await navigateTo('/app')
}

const cafeHref = (id: string) => `/app/cafes/${id}`

const sameCafePath = (path: string, id: string) => {
  const bare = path.split(/[?#]/)[0].replace(/\/$/, '')
  return bare === cafeHref(id)
}

const goToCafe = () => {
  allowLeave.value = true
  const id = shopId.value
  if (!id) {
    ionRouter.replace('/app')
    return
  }
  const previous = typeof history.state?.back === 'string' ? history.state.back : ''
  if (ionRouter.canGoBack() && sameCafePath(previous, id)) {
    ionRouter.back()
    return
  }
  ionRouter.replace(cafeHref(id))
}

const goToReview = async () => {
  const id = shopId.value
  if (!id) return
  allowLeave.value = true
  await navigateTo(`/app/cafes/${id}/review?from=check-in`)
}

const goBack = async () => {
  if (submitted.value) {
    await goToCafe()
    return
  }
  allowLeave.value = true
  if (ionRouter.canGoBack()) {
    ionRouter.back()
    return
  }
  await goHome()
}

const markCooldown = (lastAt?: string | Date | null) => {
  const remaining = cooldownRemainingMs(lastAt)
  cooldown.value = remaining > 0
  waitCopy.value = remaining > 0 ? cooldownWaitCopy(remaining) : ''
  if (remaining > 0) submitted.value = true
}

const restoreCooldown = async () => {
  if (locking.value) return
  const userId = await currentUserId()
  const id = shopId.value
  if (!userId || !id) return
  const lastAt = readCheckInAt(userId, id)
  if (isBusynessCooldown(lastAt)) {
    if (!submitted.value) markCooldown(lastAt)
    return
  }
  submitted.value = false
  cooldown.value = false
  waitCopy.value = ''
}

const onPrimary = async () => {
  if (busy.value || submitted.value) return
  issue.value = null
  if (!level.value) {
    issue.value = 'Pick how packed the cafe is right now.'
    return
  }

  locking.value = true
  try {
    const userId = await currentUserId()
    if (!userId) {
      track(ANALYTICS_EVENTS.AUTH_PROMPT_SHOWN, { trigger: 'check_in' })
      await goToLogin(checkInPath(shopId.value, level.value))
      return
    }

    const lastAt = readCheckInAt(userId, shopId.value)
    if (isBusynessCooldown(lastAt)) {
      markCooldown(lastAt)
      return
    }

    const result = await reportBusyness(shopId.value, level.value)
    if (result === 'cooldown') {
      markCooldown(readCheckInAt(userId, shopId.value) ?? new Date())
      return
    }
    cooldown.value = false
    waitCopy.value = ''
    submitted.value = true
  } catch (err) {
    issue.value = err instanceof Error ? err.message : 'Could not log how busy it is. Try again.'
  } finally {
    locking.value = false
  }
}

onBeforeRouteLeave((_to, _from, next) => {
  if (allowLeave.value || submitted.value || status.value !== 'ready') {
    next()
    return
  }
  next()
})

let loadSeq = 0
let emptyIdTimer: ReturnType<typeof window.setTimeout> | null = null

const bootstrap = async (id: string) => {
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
        void bootstrap(retry)
        return
      }
      if (!cafe.value && status.value === 'loading') status.value = 'missing'
    }, 600)
    return
  }
  if (cafe.value?.id === id && status.value === 'ready') {
    void restoreCooldown()
    return
  }

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
    void restoreCooldown()
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

watch(
  [status, cafe, consent],
  () => {
    if (consent.value !== 'granted') return
    if (status.value !== 'ready' || !cafe.value) return
    if (!once(checkInStartKey(cafe.value.id))) return
    track(ANALYTICS_EVENTS.CHECK_IN_STARTED, { cafe_id: cafe.value.id })
  },
)

onIonViewWillEnter(() => {
  const next = parseBusynessLevelQuery(route.query.level)
  if (next) level.value = next
  void restoreCooldown()
  void bootstrap(resolveShopId())
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
.checkin-content {
  --background: #f2f2f2;
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.checkin-content :deep(.inner-scroll),
.checkin-content :deep(.scroll-y) {
  height: 100%;
}

.checkin {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  min-height: 100%;
  overflow-x: clip;
  background: #f2f2f2;
}

.checkin__hero {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: max(0.75rem, env(safe-area-inset-top)) 20px 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  border-bottom: 1px solid color-mix(in srgb, var(--kd-ink) 12%, transparent);
}

.checkin__hero-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
}

.checkin__back {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  margin-left: -8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 140ms cubic-bezier(0.16, 1, 0.3, 1);
}

.checkin__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.checkin__place {
  margin-top: 12px;
  min-width: 0;
}

.checkin__place h1 {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}

.checkin__place p {
  margin: 8px 0 0;
  font-size: 0.7875rem;
  font-weight: 400;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.checkin__body,
.checkin__form {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.checkin__status,
.checkin__sheet {
  margin: 20px;
}

.checkin__status {
  color: var(--kd-ink);
  font-size: 12px;
}

.checkin__pulse {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 20px;
}

.checkin__sheet {
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.checkin__pulse span {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--kd-ink) 12%, transparent);
  transform-origin: left center;
  animation: checkin-pulse 900ms cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

.checkin__pulse span:nth-child(1) { width: 72%; }
.checkin__pulse span:nth-child(2) { width: 54%; animation-delay: 90ms; }
.checkin__pulse span:nth-child(3) { width: 38%; animation-delay: 160ms; }

.checkin__sheet h2,
.checkin__question h2 {
  margin: 0;
  color: var(--kd-ink);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.checkin__sheet--done h2 {
  transform-origin: 12% 80%;
  animation: checkin-stamp 480ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.checkin__sheet p {
  margin: 8px 0 0;
  color: var(--kd-ink);
  font-size: 12px;
  line-height: 1.35;
}

.checkin__note {
  display: flex;
  gap: 10px;
  margin: 18px 20px 0;
  color: var(--kd-ink);
}

.checkin__note p {
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
}

.checkin__question {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 18px 20px 0;
}

.checkin__topic {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  color: var(--kd-ink);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
}

.checkin__answers {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: auto;
  padding: 18px 0 8px;
}

.checkin__error {
  margin: 10px 20px 0;
  color: var(--kd-closed);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
  animation: checkin-note-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.checkin__dock {
  margin-top: auto;
  padding: 16px 20px calc(16px + env(safe-area-inset-bottom));
}

.checkin__dock--stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.checkin__cta {
  width: 100%;
  height: 44px;
  min-height: 44px;
  padding: 0 16px;
  border: 0;
  border-radius: 16px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-size: 16px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 140ms cubic-bezier(0.16, 1, 0.3, 1),
    opacity 180ms cubic-bezier(0.16, 1, 0.3, 1),
    filter 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.checkin__cta--quiet {
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  background: #faf8f5;
}

.checkin__cta:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.checkin__back:focus-visible,
.checkin__cta:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
  border-radius: 16px;
}

.checkin__back:active,
.checkin__cta:active:not(:disabled) {
  transform: scale(0.96);
}

:root.is-android .checkin__cta {
  height: 48px;
  min-height: 48px;
}

@keyframes checkin-stamp {
  from {
    opacity: 0;
    filter: blur(3px);
    transform: scale(0.86) translateY(-6px);
  }
  to {
    opacity: 1;
    filter: none;
    transform: none;
  }
}

@keyframes checkin-pulse {
  0%,
  100% { opacity: 0.45; }
  50% { opacity: 1; }
}

@keyframes checkin-note-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (min-width: 540px) {
  .checkin {
    max-width: 480px;
    margin-inline: auto;
  }

  .checkin__question {
    flex: none;
  }

  .checkin__answers {
    margin-top: 20px;
  }

  .checkin__dock {
    margin-top: 8px;
  }
}

@media (hover: hover) and (pointer: fine) {
  .checkin__cta:hover:not(:disabled) {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--kd-ink) 18%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .checkin__cta,
  .checkin__back {
    transition: none;
  }

  .checkin__sheet--done h2,
  .checkin__error,
  .checkin__pulse span {
    animation: none;
  }

  .checkin__back:active,
  .checkin__cta:active {
    transform: none;
  }
}

::selection {
  background: var(--kd-secondary);
  color: var(--kd-ink);
}
</style>
