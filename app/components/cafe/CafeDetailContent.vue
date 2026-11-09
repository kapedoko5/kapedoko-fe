<template>
  <div class="cafe-detail" :class="`cafe-detail--${variant}`">
    <header class="cafe-detail__header">
      <div class="cafe-detail__title-row">
        <h2>{{ cafe.name }}</h2>
        <button
          type="button"
          class="cafe-detail__save"
          :aria-pressed="saved"
          :aria-label="saved ? `Remove ${cafe.name} from saved cafes` : `Save ${cafe.name}`"
          @click="onSave"
        >
          <Heart :size="18" :stroke-width="1.75" :fill="saved ? 'currentColor' : 'none'" />
        </button>
        <a
          v-if="variant !== 'page'"
          class="cafe-detail__navigate"
          :href="mapsHref"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Navigate to this cafe in Google Maps"
          @click="onNavigate"
        >
          <span class="cafe-detail__action-face cafe-detail__action-face--primary">
            <Navigation :size="14" :stroke-width="2.25" aria-hidden="true" />
            Navigate to this Cafe
          </span>
        </a>
      </div>

      <div class="cafe-detail__crowd-block">
        <p
          v-if="cafe.busyness"
          class="cafe-detail__crowd"
          :class="`is-${cafe.busyness.level}`"
          :aria-label="`${cafe.busyness.label}, based on ${cafe.busyness.count} recent check-ins`"
        >
          <span class="cafe-detail__meter" aria-hidden="true">
            <span
              v-for="n in meterSeats"
              :key="n"
              class="cafe-detail__seat"
              :class="{ 'is-on': n <= crowdFill }"
              :style="{ '--seat': n }"
            >
              <svg viewBox="0 0 16 20" fill="none">
                <path
                  class="cafe-detail__bean"
                  d="M8 1.4c3.5 0 6.4 3.6 6.4 8.6S11.5 18.6 8 18.6 1.6 15 1.6 10 4.5 1.4 8 1.4Z"
                />
                <path
                  class="cafe-detail__crease"
                  d="M8 3.6c1.15 1.7 1.75 3.8 1.75 6.4S9.15 14.7 8 16.4C6.85 14.7 6.25 12.6 6.25 10S6.85 5.3 8 3.6Z"
                />
              </svg>
            </span>
          </span>
          <span class="cafe-detail__crowd-copy">
            <strong>{{ cafe.busyness.label }}</strong>
            <span>{{ cafe.busyness.count }} check-ins</span>
          </span>
        </p>
        <p
          v-else
          class="cafe-detail__crowd is-empty"
          :aria-label="monthCopy ? 'No check-ins in the last two hours' : undefined"
        >
          <span class="cafe-detail__meter" aria-hidden="true">
            <span v-for="n in meterSeats" :key="n" class="cafe-detail__seat">
              <svg viewBox="0 0 16 20" fill="none">
                <path
                  class="cafe-detail__bean"
                  d="M8 1.4c3.5 0 6.4 3.6 6.4 8.6S11.5 18.6 8 18.6 1.6 15 1.6 10 4.5 1.4 8 1.4Z"
                />
                <path
                  class="cafe-detail__crease"
                  d="M8 3.6c1.15 1.7 1.75 3.8 1.75 6.4S9.15 14.7 8 16.4C6.85 14.7 6.25 12.6 6.25 10S6.85 5.3 8 3.6Z"
                />
              </svg>
            </span>
          </span>
          <span v-if="!monthCopy" class="cafe-detail__crowd-copy">
            <strong>How packed is it?</strong>
            <span>Check in so other KapéBeans can see.</span>
          </span>
        </p>
        <p v-if="monthCopy" class="cafe-detail__month">{{ monthCopy }}</p>
      </div>

      <p v-if="variant !== 'page' && cafe.reviews.length === 0" class="cafe-detail__prompt">
        Not yet reviewed, add your review?
      </p>

      <p class="cafe-detail__address">{{ cafe.address }}</p>

      <div class="cafe-detail__rating">
        <span class="cafe-detail__score">{{ cafe.ratingLabel }}</span>
        <span class="cafe-detail__stars" :aria-label="`Rating ${cafe.ratingLabel} out of 5`">
          <Star
            v-for="n in 5"
            :key="n"
            :size="12"
            :stroke-width="1.75"
            :fill="n <= cafe.rating ? 'currentColor' : 'none'"
          />
        </span>
        <span class="cafe-detail__rating-label">KapéBean ratings</span>
      </div>

      <div class="cafe-detail__actions">
        <div class="cafe-detail__status">
          <p
            class="cafe-detail__chip"
            :class="cafe.open ? 'is-open' : 'is-closed'"
          >
            {{ cafe.open ? 'Open' : 'Closed' }}
          </p>
          <p class="cafe-detail__hours">{{ cafe.hoursHint }}</p>
        </div>
        <a
          v-if="variant !== 'page' && cafe.phone"
          class="cafe-detail__call"
          :href="`tel:${cafe.phone}`"
          @click="onCall"
        >
          <span class="cafe-detail__action-face cafe-detail__action-face--quiet">
            <Phone :size="16" :stroke-width="2" aria-hidden="true" />
            Call this Cafe
          </span>
        </a>
      </div>

      <ul class="cafe-detail__presses" aria-label="WiFi, outlets, and payments">
        <li
          v-for="(row, index) in pressFacts"
          :key="row.kind"
          class="cafe-detail__press"
          :class="{ 'is-soft': row.soft, 'is-no': row.unavailable }"
          :data-stamp="row.stamp"
          :style="{ '--i': index, '--tilt': index % 2 ? '2.4deg' : '-2.2deg' }"
          :aria-label="row.aria"
        >
          <span class="cafe-detail__press-seal" aria-hidden="true">
            <component :is="row.stampIcon" :size="13" :stroke-width="2.4" />
          </span>
          <span class="cafe-detail__press-amenity">
            <component :is="row.icon" :size="15" :stroke-width="2.25" aria-hidden="true" />
            {{ row.noun }}
          </span>
          <span class="cafe-detail__press-mark">{{ row.label }}</span>
          <span v-if="row.meta" class="cafe-detail__press-date">{{ row.meta }}</span>
        </li>
      </ul>

      <div v-if="variant === 'page'" class="cafe-detail__page-actions">
        <a
          class="cafe-detail__navigate"
          :href="mapsHref"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Navigate to this cafe in Google Maps"
          @click="onNavigate"
        >
          <span class="cafe-detail__action-face cafe-detail__action-face--primary">
            <Navigation :size="16" :stroke-width="2.25" aria-hidden="true" />
            Navigate to this Cafe
          </span>
        </a>
        <a
          v-if="cafe.phone"
          class="cafe-detail__call"
          :href="`tel:${cafe.phone}`"
          @click="onCall"
        >
          <span class="cafe-detail__action-face cafe-detail__action-face--quiet">
            <Phone :size="16" :stroke-width="2" aria-hidden="true" />
            Call this Cafe
          </span>
        </a>
      </div>
    </header>

    <div class="cafe-detail__scroll">
      <div class="cafe-detail__gallery">
        <div class="cafe-detail__hero" :class="{ 'is-mark': heroIsMark }">
          <img
            :src="heroSrc"
            :alt="heroIsMark ? '' : `${cafe.name} interior`"
            @error="onHeroError"
          />
        </div>
        <button
          v-if="!heroIsMark"
          type="button"
          class="cafe-detail__report"
          @click="reportTarget('shop_photo')"
        >
          Report this photo
        </button>
        <div v-if="photos.length > 1" class="cafe-detail__thumbs" role="group" aria-label="Cafe photos">
          <button
            v-for="(photo, index) in photos"
            :key="`${photo}-${index}`"
            type="button"
            class="cafe-detail__thumb"
            :class="{
              'is-broken': broken[`t${index}`],
              'is-active': index === activePhoto,
            }"
            :aria-label="`Show photo ${index + 1} of ${photos.length}`"
            :aria-current="index === activePhoto ? 'true' : undefined"
            @click="selectPhoto(index)"
          >
            <img
              :src="photo"
              alt=""
              @error="broken[`t${index}`] = true"
            />
          </button>
        </div>
      </div>

      <section v-if="cafe.wifiInsight" class="cafe-detail__insight" :aria-label="cafe.wifiInsight.title">
        <Wifi :size="24" :stroke-width="2" aria-hidden="true" />
        <div>
          <h3>
            <span class="cafe-detail__said">
              {{ cafe.wifiInsight.count }} of our KapéBeans said
            </span>
            {{ cafe.wifiInsight.title }}
          </h3>
          <p>{{ cafe.wifiInsight.body }}</p>
        </div>
      </section>

      <section v-if="cafe.plugInsight" class="cafe-detail__insight" :aria-label="cafe.plugInsight.title">
        <Plug :size="24" :stroke-width="2" aria-hidden="true" />
        <div>
          <h3>
            <span class="cafe-detail__said">
              {{ cafe.plugInsight.count }} of our KapéBeans said
            </span>
            {{ cafe.plugInsight.title }}
          </h3>
          <p>{{ cafe.plugInsight.body }}</p>
        </div>
      </section>

      <section v-if="cafe.matchaInsight" class="cafe-detail__insight" :aria-label="cafe.matchaInsight.title">
        <Leaf :size="24" :stroke-width="2" aria-hidden="true" />
        <div>
          <h3>
            <span class="cafe-detail__said">
              {{ cafe.matchaInsight.count }} of our KapéBeans said
            </span>
            {{ cafe.matchaInsight.title }}
          </h3>
          <p>{{ cafe.matchaInsight.body }}</p>
        </div>
      </section>

      <div class="cafe-detail__review-block">
        <button
          type="button"
          class="cafe-detail__leave"
          @click="emit('checkin')"
        >
          I’m working here
        </button>
        <button
          type="button"
          class="cafe-detail__leave cafe-detail__leave--quiet"
          @click="emit('review')"
        >
          Leave a review
        </button>
      </div>

      <div class="cafe-detail__map">
        <ClientOnly>
          <CafePinMap
            :lat="cafe.lat"
            :lng="cafe.lng"
            :name="cafe.name"
            :address="cafe.address"
            :maps-href="mapsHref"
          />
          <template #fallback>
            <div class="cafe-detail__map-slot" aria-hidden="true" />
          </template>
        </ClientOnly>
      </div>

      <p v-if="reportNotice" class="cafe-detail__prompt" role="status">{{ reportNotice }}</p>
      <section class="cafe-detail__reviews" aria-label="KapéBean reviews">
        <h3>Reviews by our KapéBeans</h3>

        <div v-if="cafe.reviews.length === 0" class="cafe-detail__empty">
          <Coffee :size="24" :stroke-width="2" aria-hidden="true" />
          <p>Ready to be the first?</p>
        </div>

        <article
          v-for="review in cafe.reviews"
          :key="review.id"
          class="cafe-review"
        >
          <header class="cafe-review__meta">
            <span class="cafe-review__avatar" aria-hidden="true">
              {{ review.name.charAt(0) }}
            </span>
            <p class="cafe-review__name">{{ review.name }}</p>
            <span
              v-if="review.wifiVotes"
              class="cafe-review__vote"
              :aria-label="`${review.wifiVotes} WiFi ${review.wifiVotes === 1 ? 'vote' : 'votes'}`"
            >
              +{{ review.wifiVotes }}
              <Wifi :size="10" :stroke-width="2.5" aria-hidden="true" />
            </span>
            <span
              v-if="review.outletVotes"
              class="cafe-review__vote"
              :aria-label="`${review.outletVotes} outlet ${review.outletVotes === 1 ? 'vote' : 'votes'}`"
            >
              +{{ review.outletVotes }}
              <Plug :size="10" :stroke-width="2.5" aria-hidden="true" />
            </span>
          </header>
          <p>{{ review.quote }}</p>
          <button
            v-if="canReportReview(review.id)"
            type="button"
            class="cafe-detail__report"
            @click="reportTarget('review', review.id)"
          >
            Report review
          </button>
        </article>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { BadgeAlert, BadgeCheck, CircleHelp, Coffee, Heart, Leaf, MessageCircle, Navigation, Phone, Plug, Split, Star, Unplug, Users, Wallet, Wifi, WifiOff } from 'lucide-vue-next'
import CafePinMap from '~/components/map/CafePinMap.client.vue'
import type { Cafe } from '~/types/cafe'
import { isKapedokoMark, KAPEDOKO_BEAN_PIN_SRC } from '~/utils/logo'
import { googleMapsDirectionsUrl } from '~/utils/maps'
import {
  amenityAriaLabel,
  amenityFactMeta,
  amenityPressLabel,
  amenitySoft,
  amenityStampKind,
  type AmenityStampKind,
} from '~/utils/amenity-status'
import {
  ANALYTICS_EVENTS,
  confidenceBucketFromCafe,
  type CafeActionType,
} from '~/utils/analytics'
import { fetchOwnShopReview } from '~/utils/approved-shops'
import { BUSYNESS_METER_SEATS, busynessMeterFill, monthCheckInCopy } from '~/utils/cafe-review'

const props = withDefaults(
  defineProps<{
    cafe: Cafe
    variant?: 'sheet' | 'page'
  }>(),
  { variant: 'sheet' },
)

const emit = defineEmits<{
  review: []
  checkin: []
}>()

const favorites = useFavorites()
const { currentUserId, goToLogin, user } = useAuth()
const { track } = useAnalytics()
const supabase = useSupabaseClient()
const route = useRoute()
const broken = ref<Record<string, boolean>>({})
const activePhoto = ref(0)
const reportNotice = ref('')
const ownReviewId = ref<string | null>(null)
const ownReviewChecked = ref(false)
let ownReviewRequest = 0
const saved = computed(() => favorites.isSaved(props.cafe.id))
const monthCopy = computed(() => monthCheckInCopy(props.cafe.checkIns30d))
const meterSeats = BUSYNESS_METER_SEATS
const crowdFill = computed(() => busynessMeterFill(props.cafe.busyness?.level))

const refreshOwnReview = async () => {
  const request = ++ownReviewRequest
  const shopId = props.cafe.id
  ownReviewChecked.value = false
  ownReviewId.value = null
  const userId = user.value?.id ?? await currentUserId()
  if (request !== ownReviewRequest) return
  if (!userId) {
    ownReviewChecked.value = true
    return
  }
  try {
    const row = await fetchOwnShopReview(supabase, shopId, userId)
    if (request !== ownReviewRequest) return
    ownReviewId.value = row?.id ?? null
  } catch {
    if (request !== ownReviewRequest) return
    ownReviewId.value = null
  } finally {
    if (request === ownReviewRequest) ownReviewChecked.value = true
  }
}

watch(
  () => [props.cafe.id, user.value?.id ?? ''] as const,
  () => {
    void refreshOwnReview()
  },
  { immediate: true },
)

const canReportReview = (reviewId: string) => ownReviewChecked.value && ownReviewId.value !== reviewId

const onSave = () => {
  void favorites.toggle(props.cafe.id)
}

const trackAction = (type: CafeActionType) => {
  track(ANALYTICS_EVENTS.CAFE_ACTION, {
    cafe_id: props.cafe.id,
    type,
    confidence_bucket: confidenceBucketFromCafe(props.cafe),
  }, type === 'navigate' || type === 'call' ? { instant: true } : undefined)
}

const onNavigate = () => trackAction('navigate')
const onCall = () => trackAction('call')

const reportTarget = async (target: 'review' | 'shop_photo', reviewId?: string) => {
  reportNotice.value = ''
  const userId = await currentUserId()
  if (!userId) {
    track(ANALYTICS_EVENTS.AUTH_PROMPT_SHOWN, { trigger: 'report' })
    await goToLogin(route.fullPath)
    return
  }
  if (target === 'review' && reviewId) {
    try {
      const row = await fetchOwnShopReview(supabase, props.cafe.id, userId)
      ownReviewId.value = row?.id ?? null
      ownReviewChecked.value = true
      if (row?.id === reviewId) {
        reportNotice.value = 'You cannot report your own review.'
        return
      }
    } catch {
      reportNotice.value = 'Could not send that report. Try again.'
      return
    }
  }
  const { error } = await supabase.rpc('report_content', {
    p_target_type: target,
    p_review_id: reviewId ?? null,
    p_shop_id: props.cafe.id,
    p_reason: target === 'review' ? 'Reported from cafe detail' : 'Reported photo',
  })
  const deniedOwn = typeof error?.message === 'string' && /own review/i.test(error.message)
  reportNotice.value = error
    ? (deniedOwn ? 'You cannot report your own review.' : 'Could not send that report. Try again.')
    : 'Reported. It stays hidden from the public list while an admin checks it.'
}

const photos = computed(() => {
  const list = props.cafe.photos.length ? [...props.cafe.photos] : [props.cafe.image]
  const unique = [...new Set(list)]
  return unique.slice(0, 4)
})

const heroPhoto = computed(() => photos.value[activePhoto.value] ?? photos.value[0])
const heroIsMark = computed(() => Boolean(broken.value.hero) || isKapedokoMark(heroPhoto.value))
const heroSrc = computed(() => (heroIsMark.value ? KAPEDOKO_BEAN_PIN_SRC : heroPhoto.value))

const onHeroError = () => {
  if (heroPhoto.value === KAPEDOKO_BEAN_PIN_SRC) return
  if (!isKapedokoMark(heroPhoto.value)) broken.value.hero = true
}

const stampIcon = (kind: AmenityStampKind) => {
  if (kind === 'team') return BadgeCheck
  if (kind === 'community') return Users
  if (kind === 'reported') return MessageCircle
  if (kind === 'recheck') return BadgeAlert
  if (kind === 'mixed') return Split
  return CircleHelp
}

const amenityFacts = computed(() => {
  const rows = [
    { kind: 'wifi' as const, noun: 'WiFi', status: props.cafe.work.wifiStatus },
    { kind: 'outlets' as const, noun: 'Outlets', status: props.cafe.work.outletsStatus },
  ]
  return rows.map((row) => {
    const stamp = amenityStampKind(row.status)
    return {
      ...row,
      icon: row.kind === 'wifi'
        ? (row.status.availability === 'unavailable' ? WifiOff : Wifi)
        : (row.status.availability === 'unavailable' ? Unplug : Plug),
      stamp,
      stampIcon: stampIcon(stamp),
      label: amenityPressLabel(row.kind, row.status),
      meta: amenityFactMeta(row.status),
      aria: amenityAriaLabel(row.kind, row.status),
      soft: amenitySoft(row.status),
      unavailable: row.status.availability === 'unavailable',
    }
  })
})

const pressFacts = computed(() => {
  const pay = paymentCard(props.cafe.payment)
  const payments = pay
    ? [{
        kind: 'pay' as const,
        noun: 'Pay',
        icon: Wallet,
        stamp: pay.stamp,
        stampIcon: pay.stamp === 'team' ? BadgeCheck : CircleHelp,
        label: pay.label,
        meta: paymentDateLabel(props.cafe.payment),
        aria: pay.aria,
        soft: pay.stamp === 'unknown',
        unavailable: pay.unavailable,
      }]
    : []
  return [...amenityFacts.value, ...payments]
})

const mapsHref = computed(() => googleMapsDirectionsUrl(props.cafe.lat, props.cafe.lng))

watch(
  () => props.cafe.id,
  () => {
    broken.value = {}
    activePhoto.value = 0
  },
)

const selectPhoto = (index: number) => {
  activePhoto.value = index
  broken.value.hero = Boolean(broken.value[`t${index}`])
  trackAction('photo_view')
}
</script>

<style scoped>
.cafe-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  color: var(--kd-ink);
  padding: 8px 0 0;
  font-family: 'Kumbh Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.cafe-detail--page {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  min-height: 100%;
  overflow-x: clip;
  padding-top: 0;
  background: #f2f2f2;
}

.cafe-detail--page .cafe-detail__header {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: auto;
  max-width: 100%;
  padding: 4px 20px 0;
  background: #faf8f5;
}

.cafe-detail--page .cafe-detail__header > :not(.cafe-detail__presses) {
  min-width: 0;
  max-width: 100%;
}

.cafe-detail--page .cafe-detail__title-row { order: 1; }
.cafe-detail--page .cafe-detail__address { order: 2; }
.cafe-detail--page .cafe-detail__actions { order: 3; }
.cafe-detail--page .cafe-detail__presses { order: 4; }
.cafe-detail--page .cafe-detail__crowd-block { order: 5; }
.cafe-detail--page .cafe-detail__rating { order: 6; }
.cafe-detail--page .cafe-detail__page-actions { order: 7; }

.cafe-detail--page .cafe-detail__title-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  align-items: center;
  gap: 12px;
}

.cafe-detail--page .cafe-detail__header h2 {
  font-size: 1.6rem;
}

.cafe-detail--page .cafe-detail__address,
.cafe-detail--page .cafe-detail__hours,
.cafe-detail--page .cafe-detail__prompt {
  white-space: normal;
  overflow-wrap: anywhere;
}

.cafe-detail--page .cafe-detail__address {
  margin-top: 8px;
  font-size: 0.7875rem;
  line-height: 1.4;
}

.cafe-detail--page .cafe-detail__actions {
  margin-top: 14px;
}

.cafe-detail__page-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.cafe-detail__page-actions .cafe-detail__navigate,
.cafe-detail__page-actions .cafe-detail__call {
  display: flex;
  width: 100%;
}

.cafe-detail__page-actions .cafe-detail__action-face {
  width: 100%;
}

.cafe-detail__header {
  flex-shrink: 0;
  padding: 20px 20px 14px;
}

.cafe-detail--page .cafe-detail__header {
  padding-top: 8px;
}

.cafe-detail__title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}

.cafe-detail__header h2 {
  margin: 0;
  min-width: 0;
  flex: 1;
  color: var(--kd-ink);
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}

.cafe-detail__save {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-accent);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.cafe-detail__save[aria-pressed='true'] {
  border-color: var(--kd-accent);
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.cafe-detail__save:focus-visible,
.cafe-detail__report:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.cafe-detail__report {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.cafe-detail__navigate,
.cafe-detail__call {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  min-height: 44px;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}

.cafe-detail__action-face {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 16px;
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}

.cafe-detail__action-face--primary {
  border: 1px solid var(--kd-accent);
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.cafe-detail__action-face--quiet {
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  background: #faf8f5;
  color: var(--kd-ink);
}

.cafe-detail__prompt,
.cafe-detail__crowd {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin: 8px 0 0;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.2;
}

.cafe-detail__prompt {
  font-weight: 400;
}

.cafe-detail__presses {
  display: flex;
  flex-wrap: nowrap;
  gap: 12px 14px;
  margin: 12px 0 2px;
  padding: 16px 0 18px;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  list-style: none;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 12%, transparent);
}

.cafe-detail__presses::-webkit-scrollbar {
  display: none;
}

.cafe-detail__presses::after {
  content: '';
  flex: 0 0 6px;
}

.cafe-detail__press {
  position: relative;
  display: grid;
  flex: 0 0 auto;
  gap: 2px;
  min-width: 138px;
  padding: 12px 28px 10px 12px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--kd-accent) 16%, #faf8f5);
  color: var(--kd-ink);
  transform: rotate(var(--tilt, -2.2deg));
  transform-origin: 40% 20%;
  scroll-snap-align: start;
  animation: cafe-press 640ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--i, 0) * 90ms);
}

.cafe-detail__press[data-stamp='community'] {
  background: #faf8f5;
}

.cafe-detail__press[data-stamp='recheck'],
.cafe-detail__press.is-no {
  background: color-mix(in srgb, #8c3a2f 10%, #faf8f5);
  border-color: color-mix(in srgb, #8c3a2f 45%, transparent);
}

.cafe-detail__press.is-soft {
  background: #faf8f5;
  border-style: dashed;
}

.cafe-detail__press-seal {
  position: absolute;
  top: 8px;
  right: 8px;
  display: grid;
  place-items: center;
  color: var(--kd-accent);
}

.cafe-detail__press[data-stamp='recheck'] .cafe-detail__press-seal,
.cafe-detail__press.is-no .cafe-detail__press-seal {
  color: #8c3a2f;
}

.cafe-detail__press-amenity {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.2;
}

.cafe-detail__press-amenity :deep(svg) {
  color: var(--kd-accent);
}

.cafe-detail__press-mark {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.03em;
  white-space: nowrap;
}

.cafe-detail__press-date {
  margin-top: 2px;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
}

.cafe-detail__crowd-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  margin-top: 10px;
}

.cafe-detail__crowd {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  margin: 0;
  padding: 6px 10px 6px 8px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
}

.cafe-detail__crowd.is-empty {
  background: transparent;
}

.cafe-detail__meter {
  display: flex;
  align-items: center;
  gap: 3px;
}

.cafe-detail__seat {
  display: grid;
  width: 14px;
  height: 18px;
  transform-origin: 50% 80%;
}

.cafe-detail__seat svg {
  display: block;
  width: 14px;
  height: 18px;
  overflow: visible;
}

.cafe-detail__bean {
  fill: none;
  stroke: color-mix(in srgb, var(--kd-ink) 28%, transparent);
  stroke-width: 1.35;
  stroke-linejoin: round;
}

.cafe-detail__crease {
  fill: none;
  stroke: color-mix(in srgb, var(--kd-ink) 22%, transparent);
  stroke-width: 1.15;
  stroke-linecap: round;
}

.cafe-detail__seat.is-on {
  animation: cafe-bean-pop 420ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc((var(--seat, 1) - 1) * 70ms);
}

.cafe-detail__seat.is-on .cafe-detail__bean {
  fill: var(--kd-accent);
  stroke: var(--kd-ink);
}

.cafe-detail__seat.is-on .cafe-detail__crease {
  stroke: var(--kd-ink);
}

.cafe-detail__crowd.is-full .cafe-detail__seat.is-on .cafe-detail__bean {
  fill: #8c3a2f;
  stroke: #8c3a2f;
}

.cafe-detail__crowd.is-full .cafe-detail__seat.is-on .cafe-detail__crease {
  stroke: #faf8f5;
}

.cafe-detail__crowd-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.cafe-detail__crowd-copy strong {
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}

.cafe-detail__crowd-copy span {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.6875rem;
  font-weight: 400;
  line-height: 1.2;
}

.cafe-detail__month {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.3;
}

.cafe-detail__address {
  margin: 10px 0 0;
  color: var(--kd-ink);
  font-size: 0.75rem;
  line-height: 1.35;
}

.cafe-detail__rating {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  color: var(--kd-ink);
}

.cafe-detail__score {
  font-size: 0.75rem;
  font-weight: 700;
}

.cafe-detail__stars {
  display: flex;
  gap: 2px;
  color: var(--kd-accent);
}

.cafe-detail__rating-label {
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 400;
}

.cafe-detail__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.cafe-detail__status {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.cafe-detail__chip {
  margin: 0;
  padding: 6px 12px;
  border-radius: 16px;
  color: #ffffff;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.2;
}

.cafe-detail__chip.is-open {
  background: var(--kd-ink);
}

.cafe-detail__chip.is-closed {
  background: #8c3a2f;
}

.cafe-detail__hours {
  margin: 0;
  min-width: 0;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.2;
}

.cafe-detail__scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 20px calc(16px + env(safe-area-inset-bottom));
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: var(--kd-ink-25) transparent;
}

.cafe-detail--page .cafe-detail__scroll {
  flex: none;
  overflow: visible;
  padding: 0 0 12px;
}

.cafe-detail--page .cafe-detail__gallery {
  padding: 16px 20px 20px;
  background: #faf8f5;
  border-bottom: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
}

.cafe-detail--page .cafe-detail__hero {
  height: 220px;
}

.cafe-detail--page .cafe-detail__insight,
.cafe-detail--page .cafe-detail__review-block,
.cafe-detail--page .cafe-detail__reviews,
.cafe-detail--page .cafe-detail__scroll > .cafe-detail__prompt,
.cafe-detail--page .cafe-detail__map {
  margin-right: 20px;
  margin-left: 20px;
}

.cafe-detail--page .cafe-detail__leave {
  border-color: var(--kd-accent);
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.cafe-detail--page .cafe-detail__leave--quiet {
  border-color: color-mix(in srgb, var(--kd-ink) 34%, transparent);
  background: #ffffff;
}

.cafe-detail__hero {
  overflow: hidden;
  height: 175px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #f2f2f2;
}

.cafe-detail__hero img,
.cafe-detail__thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cafe-detail__hero.is-mark {
  background: #faf8f5;
}

.cafe-detail__hero.is-mark img {
  object-fit: contain;
  padding: 28px 40px;
}

.cafe-detail__hero.is-broken,
.cafe-detail__thumb.is-broken {
  background: #f2f2f2;
}

.cafe-detail__hero.is-broken img,
.cafe-detail__thumb.is-broken img {
  display: none;
}

.cafe-detail__thumbs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 10px;
}

.cafe-detail__thumb {
  overflow: hidden;
  height: 71px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.cafe-detail__thumb.is-active {
  box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px var(--kd-primary);
}

.cafe-detail__insight {
  display: flex;
  gap: 12px;
  margin-top: 22px;
  color: var(--kd-ink);
}

.cafe-detail__insight > :first-child {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--kd-accent);
}

.cafe-detail__insight h3 {
  margin: 0;
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.35;
}

.cafe-detail__said {
  display: block;
  margin-bottom: 2px;
  font-size: 0.75rem;
  font-weight: 400;
}

.cafe-detail__insight p {
  margin: 6px 0 0;
  font-size: 0.7875rem;
  line-height: 1.35;
}

.cafe-detail__review-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 22px;
}

.cafe-detail__map-slot {
  height: 240px;
  margin-top: 32px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.cafe-detail--page :deep(.cafe-pin-map__frame),
.cafe-detail--page .cafe-detail__map-slot {
  height: 260px;
}

.cafe-detail__leave {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 44px;
  margin: 0;
  padding: 0 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 16px;
  background: #ffffff;
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
}

.cafe-detail__reviews {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
}

.cafe-detail__reviews h3 {
  margin: 0 0 12px;
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
}

.cafe-detail__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 20px 8px;
  color: var(--kd-ink);
  text-align: center;
}

.cafe-detail__empty :deep(svg) {
  color: var(--kd-accent);
}

.cafe-detail__empty p {
  margin: 0;
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.35;
}

.cafe-review {
  padding: 16px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--kd-ink) 12%, transparent);
  color: var(--kd-ink);
}

.cafe-review:last-child {
  border-bottom: 0;
}

.cafe-review__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.cafe-review__avatar {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
}

.cafe-review__name {
  margin: 0;
  flex: 1;
  font-size: 0.7875rem;
  font-weight: 700;
}

.cafe-review__vote {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 15px;
  padding: 2px 6px;
  border-radius: 8px;
  background: var(--kd-ink);
  color: #ffffff;
  font-size: 0.6875rem;
  font-weight: 700;
}

.cafe-review p {
  margin: 0;
  font-size: 0.7875rem;
  line-height: 1.4;
}

:root.is-android .cafe-detail__leave,
:root.is-android .cafe-detail__page-actions .cafe-detail__action-face {
  min-height: 48px;
}

.cafe-detail__navigate:focus-visible,
.cafe-detail__call:focus-visible,
.cafe-detail__leave:focus-visible,
.cafe-detail__thumb:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.cafe-detail__thumb:focus-visible {
  border-radius: 16px;
}

.cafe-detail__action-face--primary:active,
.cafe-detail__action-face--quiet:active,
.cafe-detail__leave:active,
.cafe-detail__thumb:active {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

@media (hover: hover) {
  .cafe-detail__navigate:hover .cafe-detail__action-face--primary {
    box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
  }

  .cafe-detail__call:hover .cafe-detail__action-face--quiet {
    border-color: color-mix(in srgb, var(--kd-ink) 34%, transparent);
  }

  .cafe-detail__leave:hover {
    background: #faf8f5;
  }

  .cafe-detail--page .cafe-detail__leave:hover {
    background: var(--kd-accent);
    box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
  }

  .cafe-detail--page .cafe-detail__leave--quiet:hover {
    background: #faf8f5;
    box-shadow: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cafe-detail__press {
    animation: none;
    transform: rotate(var(--tilt, 0deg));
  }

  .cafe-detail__seat.is-on {
    animation: none;
  }

  .cafe-detail__action-face--primary:active,
  .cafe-detail__action-face--quiet:active,
  .cafe-detail__leave:active,
  .cafe-detail__thumb:active {
    box-shadow: none;
  }
}

@keyframes cafe-bean-pop {
  from {
    opacity: 0.4;
    filter: blur(2px);
    transform: scale(0.72) translateY(4px);
  }
  to {
    opacity: 1;
    filter: none;
    transform: none;
  }
}

@keyframes cafe-press {
  0% {
    opacity: 0.35;
    filter: blur(2px);
    clip-path: inset(-30% -30% 72% -30%);
    transform: rotate(calc(var(--tilt, 0deg) - 18deg)) scale(1.2) translateY(-12px);
  }
  58% {
    opacity: 1;
    filter: blur(0);
    clip-path: inset(-30%);
    transform: rotate(calc(var(--tilt, 0deg) + 1.8deg)) scale(0.97) translateY(1px);
  }
  100% {
    opacity: 1;
    filter: none;
    clip-path: inset(-30%);
    transform: rotate(var(--tilt, 0deg)) scale(1);
  }
}
</style>
