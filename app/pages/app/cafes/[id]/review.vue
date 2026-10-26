<template>
  <IonPage>
    <IonContent :scroll-y="true" class="review-content">
      <div class="review" :class="{ 'is-done': submitted }">
        <header class="review__hero">
          <div class="review__hero-bar">
            <button type="button" class="review__back" :aria-label="backLabel" @click="goBack">
              <ChevronLeft :size="22" :stroke-width="2.25" />
            </button>
            <p class="review__title">You are reviewing</p>
          </div>

          <div v-if="cafe" class="review__place">
            <h1>{{ cafe.name }}</h1>
            <p>{{ cafe.address }}</p>
          </div>
        </header>

        <div v-if="status === 'loading'" class="review__body">
          <p class="review__status">Loading this cafe…</p>
          <div class="review__pulse" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div v-else-if="status === 'missing' || status === 'error'" class="review__body">
          <section class="review__sheet" aria-labelledby="missing-title">
            <h2 id="missing-title">
              {{ status === 'error' ? 'Could not load this cafe' : 'This cafe is not on the map yet' }}
            </h2>
            <p>
              {{
                status === 'error'
                  ? 'Check your connection and try again. If you just opened this from the map, go back and tap Review again.'
                  : 'It may still be pending review, or the link is out of date.'
              }}
            </p>
          </section>
          <div class="review__dock">
            <button type="button" class="review__cta" @click="goHome">Back to Home</button>
          </div>
        </div>

        <div v-else-if="submitted && cafe" class="review__body">
          <section class="review__sheet review__sheet--done" aria-labelledby="done-title">
            <h2 id="done-title">Logged. Other KapéBeans can use this.</h2>
            <p>
              Your notes on {{ cafe.name }} now feed WiFi, outlets, and how packed it feels.
              You can update the review any time, and check in again when you come back.
            </p>
          </section>
          <div class="review__dock">
            <button type="button" class="review__cta" @click="goToCafe">Back to this cafe</button>
          </div>
        </div>

        <div v-else-if="!allowed" class="review__body">
          <section class="review__sheet" aria-labelledby="signin-title">
            <h2 id="signin-title">Sign in to review this cafe</h2>
            <p>Your notes stay on your account, and we will bring you back here after you sign in.</p>
          </section>
          <div class="review__dock">
            <button type="button" class="review__cta" @click="onReviewLogin">Sign in</button>
          </div>
        </div>

        <form v-else-if="cafe && allowed" class="review__form" @submit.prevent="onPrimary">
          <div class="review__note">
            <Info :size="16" :stroke-width="2.25" aria-hidden="true" />
            <p>
              This review only asks about your visit at
              <strong>{{ cafe.name }}</strong>.
              {{ editing ? 'Your previous answers are loaded — change anything that is different today.' : 'Tap through. Most screens are one choice.' }}
            </p>
          </div>

          <div class="review__ticks" :aria-label="stepLabel">
            <span v-for="n in 5" :key="n" :class="{ 'is-on': n <= chapter }" />
          </div>
          <p class="review__step">{{ stepLabel }}</p>

          <div class="review__question">
            <Transition :name="chapterMotion" mode="out-in">
              <div :key="chapter" class="review__pane">
                <p class="review__topic">
                  <component :is="topicIcon" :size="16" :stroke-width="2.25" aria-hidden="true" />
                  {{ topicLabel }}
                </p>
                <h2>{{ question }}</h2>

                <div v-if="chapter === 1" class="review__answers">
                  <ReviewChoiceGroup
                    v-model="draft.busyness"
                    :options="BUSYNESS_OPTIONS"
                    ariaLabel="How packed is it right now?"
                    :disabled="busy"
                  />
                </div>

                <div v-else-if="chapter === 2" class="review__answers">
                  <ReviewChoiceGroup
                    v-model="draft.wifiAvailable"
                    :options="TRI_OPTIONS"
                    ariaLabel="Is there WiFi here?"
                  />
                  <Transition name="review-pour">
                    <ReviewChoiceGroup
                      v-if="draft.wifiAvailable === 'yes'"
                      v-model="draft.wifiSpeed"
                      :options="WIFI_SPEED_OPTIONS"
                      legend="How’s the WiFi speed?"
                    >
                      <template #icon="{ option }">
                        <Turtle v-if="option.value === 'slow'" :size="22" :stroke-width="2" />
                        <Equal v-else-if="option.value === 'okay'" :size="22" :stroke-width="2" />
                        <Rabbit v-else :size="22" :stroke-width="2" />
                      </template>
                    </ReviewChoiceGroup>
                  </Transition>
                  <Transition name="review-pour">
                    <ReviewChoiceGroup
                      v-if="draft.wifiAvailable === 'yes'"
                      v-model="draft.wifiCap"
                      :options="WIFI_CAP_OPTIONS"
                      legend="Any WiFi time limit?"
                    />
                  </Transition>
                </div>

                <div v-else-if="chapter === 3" class="review__answers">
                  <ReviewChoiceGroup
                    v-model="draft.powerAvailable"
                    :options="TRI_OPTIONS"
                    ariaLabel="Are there power sockets?"
                  />
                  <Transition name="review-pour">
                    <ReviewChoiceGroup
                      v-if="draft.powerAvailable === 'yes'"
                      v-model="draft.powerAccess"
                      :options="POWER_ACCESS_OPTIONS"
                      legend="Could you actually plug in?"
                    />
                  </Transition>
                </div>

                <div v-else-if="chapter === 4" class="review__answers">
                  <ReviewChoiceGroup
                    v-model="draft.servesMatcha"
                    :options="TRI_OPTIONS"
                    legend="Do they serve matcha?"
                  />
                  <ReviewChoiceGroup
                    v-model="draft.noise"
                    :options="NOISE_OPTIONS"
                    legend="How loud is it?"
                  />
                  <ReviewChoiceGroup
                    v-model="draft.stayFit"
                    :options="STAY_OPTIONS"
                    legend="Could you work here a while?"
                  />
                </div>

                <div v-else class="review__answers">
                  <ReviewYesNo
                    v-model="draft.recommend"
                    legend="Would you recommend this café to others?"
                  />
                  <div class="review__follow">
                    <h3>Would you visit this café again?</h3>
                    <ReviewYesNo
                      v-model="draft.visitAgain"
                      legend="Would you visit this café again?"
                    />
                  </div>
                  <label class="review__comment">
                    <span>Anything else? Optional.</span>
                    <textarea
                      v-model="draft.comment"
                      :maxlength="REVIEW_COMMENT_MAX"
                      rows="5"
                      placeholder="A socket by the window, loud playlist, voucher at the counter…"
                      :aria-describedby="commentCountId"
                    />
                    <span :id="commentCountId" class="review__count">
                      {{ commentLength }} / {{ REVIEW_COMMENT_MAX }}
                    </span>
                  </label>
                </div>
              </div>
            </Transition>
          </div>

          <p v-if="notice" class="review__hint" role="status">{{ notice }}</p>
          <p v-if="issue" class="review__error" role="alert">{{ issue }}</p>

          <div class="review__dock">
            <button type="submit" class="review__cta" :disabled="busy" :aria-busy="busy">
              {{ primaryLabel }}
            </button>
          </div>
        </form>
      </div>
    </IonContent>
  </IonPage>
</template>

<script lang="ts" setup>
import {
  ChevronLeft,
  Coffee,
  Equal,
  Info,
  Leaf,
  Plug,
  Rabbit,
  Turtle,
  Users,
  Wifi,
} from 'lucide-vue-next'
import { Capacitor } from '@capacitor/core'
import { onIonViewWillEnter, useIonRouter } from '@ionic/vue'
import ReviewChoiceGroup from '~/components/review/ReviewChoiceGroup.vue'
import ReviewYesNo from '~/components/review/ReviewYesNo.vue'
import type { Cafe } from '~/types/cafe'
import { isShopId, shopIdFromRoute } from '~/utils/approved-shops'
import {
  BUSYNESS_OPTIONS,
  chapterIssue,
  chapterLabel,
  emptyReviewDraft,
  firstReviewChapter,
  readCheckInAt,
  shouldSkipReviewBusyness,
  NOISE_OPTIONS,
  normalizeDraft,
  POWER_ACCESS_OPTIONS,
  REVIEW_CHAPTERS,
  REVIEW_COMMENT_MAX,
  reviewRowToDraft,
  STAY_OPTIONS,
  TRI_OPTIONS,
  WIFI_CAP_OPTIONS,
  WIFI_SPEED_OPTIONS,
  type CafeReviewDraft,
  type ReviewChapter,
} from '~/utils/cafe-review'
import { ANALYTICS_EVENTS, reviewStartKey } from '~/utils/analytics'

definePageMeta({
  middleware: 'auth',
})

useAppTabBar('hide')

const route = useRoute()
const ionRouter = useIonRouter()
const { currentUserId, goToLogin } = useAuth()
const { track, once, consent } = useAnalytics()
const allowed = ref(false)
const { loadCafe, loadOwnReview, saveReview, reportBusyness, submitting, reporting } = useCafeReview()

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
const draft = reactive<CafeReviewDraft>(emptyReviewDraft())
const lastCheckInAt = ref<string | null>(null)
const skipBusyness = computed(() => shouldSkipReviewBusyness(route.query.from, lastCheckInAt.value))
const startChapter = computed(() => firstReviewChapter(route.query.from, lastCheckInAt.value))
const chapter = ref<ReviewChapter>(startChapter.value)
const chapterDir = ref<'forward' | 'back'>('forward')
const status = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')
const submitted = ref(false)
const editing = ref(false)
const issue = ref<string | null>(null)
const notice = ref('')
const allowLeave = ref(false)
const locking = ref(false)
const commentCountId = 'review-comment-count'

const commentLength = computed(() => draft.comment.length)
const busy = computed(() => submitting.value || reporting.value || locking.value)
const stepLabel = computed(() => chapterLabel(chapter.value))
const chapterMotion = computed(() => (chapterDir.value === 'back' ? 'review-back' : 'review-next'))
const backLabel = computed(() => (submitted.value ? 'Back to this cafe' : 'Go back'))
const primaryLabel = computed(() => {
  if (submitting.value) return 'Saving…'
  if (reporting.value || locking.value) return 'Logging…'
  if (chapter.value === REVIEW_CHAPTERS) return editing.value ? 'Update your review' : 'Submit your review'
  return 'Continue'
})

const topicLabel = computed(() => {
  if (chapter.value === 1) return 'Right now'
  if (chapter.value === 2) return 'WiFi connection'
  if (chapter.value === 3) return 'Power plugs / sockets'
  if (chapter.value === 4) return 'Cafe extras'
  return 'Service and environment'
})

const topicIcon = computed(() => {
  if (chapter.value === 1) return Users
  if (chapter.value === 2) return Wifi
  if (chapter.value === 3) return Plug
  if (chapter.value === 4) return Leaf
  return Coffee
})

const question = computed(() => {
  if (chapter.value === 1) return 'How packed is it right now?'
  if (chapter.value === 2) return 'Is there a WiFi connection available in this cafe?'
  if (chapter.value === 3) return 'Were there power sockets available in the cafe?'
  if (chapter.value === 4) return 'A few extras while you are here.'
  return 'Would you recommend this café to others?'
})

watch(
  () => [
    draft.busyness,
    draft.wifiAvailable,
    draft.wifiSpeed,
    draft.wifiCap,
    draft.powerAvailable,
    draft.powerAccess,
    draft.servesMatcha,
    draft.noise,
    draft.stayFit,
    draft.recommend,
    draft.visitAgain,
    draft.comment,
  ],
  () => {
    issue.value = null
    Object.assign(draft, normalizeDraft(draft))
  },
)

watch(
  () => draft.wifiAvailable,
  (value) => {
    if (value !== 'yes') {
      draft.wifiSpeed = null
      draft.wifiCap = null
    }
  },
)

watch(
  () => draft.powerAvailable,
  (value) => {
    if (value !== 'yes') draft.powerAccess = null
  },
)

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

const setChapter = (next: ReviewChapter) => {
  chapterDir.value = next < chapter.value ? 'back' : 'forward'
  chapter.value = next
  issue.value = null
}

const goBack = async () => {
  if (submitted.value) {
    await goToCafe()
    return
  }
  if (chapter.value > startChapter.value) {
    setChapter((chapter.value - 1) as ReviewChapter)
    return
  }
  allowLeave.value = true
  if (ionRouter.canGoBack()) {
    ionRouter.back()
    return
  }
  await goHome()
}

const onPrimary = async () => {
  if (busy.value) return
  issue.value = null
  notice.value = ''
  const currentIssue = chapterIssue(chapter.value, draft)
  if (currentIssue) {
    issue.value = currentIssue
    return
  }

  locking.value = true
  try {
    if (chapter.value === 1 && draft.busyness && !skipBusyness.value) {
      try {
        const result = await reportBusyness(shopId.value, draft.busyness)
        if (result === 'cooldown') {
          notice.value = 'We already logged how busy this cafe is. You can check in again later.'
        }
      } catch (err) {
        issue.value = err instanceof Error ? err.message : 'Could not log how busy it is. Try again.'
        return
      }
    }

    if (chapter.value < REVIEW_CHAPTERS) {
      setChapter((chapter.value + 1) as ReviewChapter)
      return
    }

    await saveReview(shopId.value, draft)
    submitted.value = true
  } catch (err) {
    issue.value = err instanceof Error ? err.message : 'Could not save this review. Try again.'
  } finally {
    locking.value = false
  }
}

onBeforeRouteLeave((_to, _from, next) => {
  if (allowLeave.value || submitted.value || status.value !== 'ready') {
    next()
    return
  }
  if (chapter.value > startChapter.value) {
    setChapter((chapter.value - 1) as ReviewChapter)
    next(false)
    return
  }
  next()
})

let loadSeq = 0
let emptyIdTimer: ReturnType<typeof window.setTimeout> | null = null

const applyCheckInSkip = async () => {
  const userId = await currentUserId()
  const id = shopId.value
  lastCheckInAt.value = userId && id ? readCheckInAt(userId, id) : null
  if (!submitted.value && chapter.value < startChapter.value) {
    chapter.value = startChapter.value
  }
}

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
    await applyCheckInSkip()
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
    const own = await loadOwnReview(id)
    if (seq !== loadSeq) return
    if (own) {
      editing.value = true
      Object.assign(draft, reviewRowToDraft(own))
    }
    await applyCheckInSkip()
    if (seq !== loadSeq) return
    status.value = 'ready'
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

const ensureSignedIn = async () => {
  const userId = await currentUserId()
  if (!userId) {
    allowed.value = false
    await goToLogin(route.fullPath)
    return
  }
  await applyCheckInSkip()
  allowed.value = true
}

const onReviewLogin = () => {
  track(ANALYTICS_EVENTS.AUTH_PROMPT_SHOWN, { trigger: 'review' })
  void goToLogin(route.fullPath)
}

watch(
  [status, allowed, cafe, consent],
  () => {
    if (consent.value !== 'granted') return
    if (status.value !== 'ready' || !allowed.value || !cafe.value) return
    if (!once(reviewStartKey(cafe.value.id))) return
    track(ANALYTICS_EVENTS.REVIEW_STARTED, { cafe_id: cafe.value.id })
  },
)

watch(
  startChapter,
  (next) => {
    if (!submitted.value && chapter.value < next) chapter.value = next
  },
  { immediate: true },
)

onIonViewWillEnter(() => {
  const restart = submitted.value
  if (restart) {
    submitted.value = false
    chapterDir.value = 'forward'
  }
  void applyCheckInSkip().then(() => {
    if (restart) chapter.value = startChapter.value
  })
  void ensureSignedIn()
  void bootstrap(resolveShopId())
})

onMounted(() => {
  if (Capacitor.getPlatform() === 'android') {
    document.documentElement.classList.add('is-android')
  }
  document.addEventListener('ionBackButton', onHardwareBack)
  void ensureSignedIn()
})

onBeforeUnmount(() => {
  if (emptyIdTimer) window.clearTimeout(emptyIdTimer)
  document.removeEventListener('ionBackButton', onHardwareBack)
})
</script>

<style scoped>
.review-content {
  --background: #f2f2f2;
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.review-content :deep(.inner-scroll),
.review-content :deep(.scroll-y) {
  height: 100%;
}

.review {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  min-height: 100%;
  overflow-x: clip;
  background: #f2f2f2;
}

.review__hero {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: max(0.75rem, env(safe-area-inset-top)) 20px 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  border-bottom: 1px solid color-mix(in srgb, var(--kd-ink) 12%, transparent);
}

.review__hero-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
}

.review__back {
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

.review__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.review__place {
  margin-top: 12px;
  min-width: 0;
}

.review__place h1 {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}

.review__place p {
  margin: 8px 0 0;
  font-size: 0.7875rem;
  font-weight: 400;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.review__body,
.review__form {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.review__status,
.review__sheet {
  margin: 20px;
}

.review__status {
  color: var(--kd-ink);
  font-size: 12px;
}

.review__pulse {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0 20px;
}

.review__sheet {
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.review__pulse span {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--kd-ink) 12%, transparent);
  transform-origin: left center;
  animation: review-pulse 900ms cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

.review__pulse span:nth-child(1) { width: 72%; }
.review__pulse span:nth-child(2) { width: 54%; animation-delay: 90ms; }
.review__pulse span:nth-child(3) { width: 38%; animation-delay: 160ms; }

.review__sheet h2,
.review__question h2 {
  margin: 0;
  color: var(--kd-ink);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.review__sheet--done h2 {
  transform-origin: 12% 80%;
  animation: review-stamp 480ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.review__sheet p {
  margin: 8px 0 0;
  color: var(--kd-ink);
  font-size: 12px;
  line-height: 1.35;
}

.review__note {
  display: flex;
  gap: 10px;
  margin: 18px 20px 0;
  color: var(--kd-ink);
}

.review__note p {
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
}

.review__ticks {
  display: flex;
  gap: 5px;
  width: 84px;
  margin: 16px 20px 0;
}

.review__ticks span {
  position: relative;
  overflow: hidden;
  flex: 1;
  height: 5px;
  border-radius: 999px;
  background: var(--kd-placeholder);
}

.review__ticks span::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--kd-accent);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

.review__ticks span:nth-child(2)::after { transition-delay: 40ms; }
.review__ticks span:nth-child(3)::after { transition-delay: 80ms; }
.review__ticks span:nth-child(4)::after { transition-delay: 120ms; }
.review__ticks span:nth-child(5)::after { transition-delay: 160ms; }

.review__ticks span.is-on::after {
  transform: scaleX(1);
}

.review__step {
  margin: 8px 20px 0;
  color: var(--kd-ink);
  font-size: 12px;
  line-height: 1.2;
}

.review__question {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 18px 20px 0;
  overflow: hidden;
}

.review__pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.review__topic {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
  color: var(--kd-ink);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
}

.review__answers {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: auto;
  padding: 18px 0 8px;
}

.review__follow h3 {
  margin: 0 0 10px;
  color: var(--kd-ink);
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.review__comment {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: var(--kd-ink);
  font-size: 12px;
  font-weight: 700;
}

.review__comment textarea {
  width: 100%;
  min-height: 144px;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  font-size: 12px;
  font-weight: 400;
  font-family: inherit;
  line-height: 1.4;
  resize: vertical;
  caret-color: var(--kd-primary);
  transition: box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.review__comment textarea:focus {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.review__comment textarea::placeholder {
  color: #5c534c;
}

.review__count {
  align-self: flex-end;
  font-weight: 400;
}

.review__hint,
.review__error {
  margin: 10px 20px 0;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
}

.review__hint {
  color: var(--kd-ink);
  animation: review-note-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.review__error {
  color: var(--kd-closed);
  animation: review-note-in 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.review__dock {
  margin-top: auto;
  padding: 16px 20px calc(16px + env(safe-area-inset-bottom));
}

.review__cta {
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

.review__cta:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.review__back:focus-visible,
.review__cta:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
  border-radius: 16px;
}

.review__back:active,
.review__cta:active:not(:disabled) {
  transform: scale(0.96);
}

:root.is-android .review__cta {
  height: 48px;
  min-height: 48px;
}

.review-next-enter-active,
.review-next-leave-active,
.review-back-enter-active,
.review-back-leave-active {
  transition:
    opacity 220ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
    filter 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.review-next-leave-to {
  opacity: 0;
  filter: blur(4px);
  transform: translateX(-16px);
}

.review-next-enter-from {
  opacity: 0;
  filter: blur(4px);
  transform: translateX(20px);
}

.review-back-leave-to {
  opacity: 0;
  filter: blur(4px);
  transform: translateX(16px);
}

.review-back-enter-from {
  opacity: 0;
  filter: blur(4px);
  transform: translateX(-20px);
}

.review-pour-enter-active {
  transition:
    opacity 240ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 240ms cubic-bezier(0.16, 1, 0.3, 1),
    filter 240ms cubic-bezier(0.16, 1, 0.3, 1),
    clip-path 240ms cubic-bezier(0.16, 1, 0.3, 1);
}

.review-pour-leave-active {
  transition:
    opacity 160ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

.review-pour-enter-from {
  opacity: 0;
  filter: blur(3px);
  transform: translateY(10px);
  clip-path: inset(0 0 70% 0);
}

.review-pour-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@keyframes review-stamp {
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

@keyframes review-pulse {
  0%,
  100% { opacity: 0.45; }
  50% { opacity: 1; }
}

@keyframes review-note-in {
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
  .review {
    max-width: 480px;
    margin-inline: auto;
  }

  .review__question,
  .review__pane {
    flex: none;
  }

  .review__answers {
    margin-top: 20px;
  }

  .review__dock {
    margin-top: 8px;
  }
}

@media (hover: hover) and (pointer: fine) {
  .review__cta:hover:not(:disabled) {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--kd-ink) 18%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .review__ticks span::after,
  .review__cta,
  .review__back {
    transition: none;
  }

  .review__sheet--done h2,
  .review__hint,
  .review__error,
  .review__pulse span {
    animation: none;
  }

  .review-next-enter-active,
  .review-next-leave-active,
  .review-back-enter-active,
  .review-back-leave-active,
  .review-pour-enter-active,
  .review-pour-leave-active {
    transition: opacity 120ms ease;
  }

  .review-next-enter-from,
  .review-next-leave-to,
  .review-back-enter-from,
  .review-back-leave-to,
  .review-pour-enter-from,
  .review-pour-leave-to {
    transform: none;
    filter: none;
    clip-path: none;
  }

  .review__back:active,
  .review__cta:active {
    transform: none;
  }
}

::selection {
  background: var(--kd-secondary);
  color: var(--kd-ink);
}
</style>
