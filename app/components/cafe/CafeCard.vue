<template>
  <article ref="rootRef" class="bag" :class="{ 'is-selected': selected, 'is-saved': saved }">
    <button type="button" class="bag__open" @click="emit('select', cafe.id)">
      <span class="bag__mast">
        <span class="bag__logo" aria-hidden="true">
          <img
            class="bag__mark"
            :class="{ 'bag__mark--app': usingAppLogo }"
            :src="photoSrc"
            alt=""
            width="40"
            height="40"
            @error="onPhotoError"
          />
        </span>
        <span class="bag__copy">
          <span class="bag__name">{{ cafe.name }}</span>
          <span v-if="closed" class="bag__closed">Closed</span>
          <span v-if="cafe.address" class="bag__origin">{{ cafe.address }}</span>
        </span>
      </span>
      <span class="bag__lines">
        <span v-if="hoursLine" class="bag__hours">
          <Clock :size="15" :stroke-width="2.25" aria-hidden="true" />
          <span class="bag__hours-key">Hours</span>
          <span class="bag__hours-time">{{ hoursLine }}</span>
        </span>
        <span class="bag__marks" aria-label="WiFi, outlets, and payments">
          <span
            v-for="(row, index) in stampMarks"
            :key="row.kind"
            class="bag__mark-stamp"
            :class="{ 'is-soft': row.soft, 'is-no': row.unavailable }"
            :data-stamp="row.stamp"
            :style="{ '--tilt': index % 2 ? '1.6deg' : '-1.4deg' }"
            :aria-label="row.aria"
          >
            <span class="bag__mark-noun">
              <component :is="row.icon" :size="15" :stroke-width="2.25" aria-hidden="true" />
              {{ row.noun }}
            </span>
            <span class="bag__mark-word">{{ row.words }}</span>
          </span>
        </span>
        <span v-if="teamPress" class="bag__press">
          <BadgeCheck :size="13" :stroke-width="2.4" aria-hidden="true" />
          {{ teamPress }}
        </span>
        <span v-if="distanceLabel" class="bag__hours">
          <Navigation :size="15" :stroke-width="2.25" aria-hidden="true" />
          <span class="bag__hours-key">Distance</span>
          <span class="bag__hours-time">{{ distanceLabel }}</span>
        </span>
      </span>
    </button>
    <button
      type="button"
      class="bag__save"
      :aria-pressed="saved"
      :aria-label="saved ? `Remove ${cafe.name} from saved cafes` : `Save ${cafe.name}`"
      @click="onSave"
    >
      <span class="bag__save-fill" aria-hidden="true" />
      <Heart
        class="bag__save-icon"
        :size="18"
        :stroke-width="2"
        :fill="saved ? 'currentColor' : 'none'"
      />
    </button>
  </article>
</template>

<script lang="ts" setup>
import { BadgeCheck, Clock, Heart, Navigation, Plug, Unplug, Wallet, Wifi, WifiOff } from 'lucide-vue-next'
import type { Cafe } from '~/types/cafe'
import {
  ANALYTICS_EVENTS,
  CARD_IMPRESSION_MS,
  CARD_IMPRESSION_RATIO,
  cardViewKey,
  confidenceBucketFromCafe,
  type CardSurface,
} from '~/utils/analytics'
import { watchImpression } from '~/utils/analytics-impression'
import { cafeDisplayLogo, isKapedokoMark, KAPEDOKO_APP_LOGO_SRC } from '~/utils/logo'
import { amenityAriaLabel, amenityBagPress, amenityBagValue, amenitySoft, amenityStampKind } from '~/utils/amenity-status'
import { paymentCard, paymentTeamPress } from '~/utils/cafe-payment'

const props = defineProps<{
  cafe: Pick<Cafe, 'id' | 'name' | 'address' | 'image' | 'open' | 'status' | 'amenities' | 'work' | 'rating' | 'hoursHint' | 'payment'>
  selected?: boolean
  distanceLabel?: string
  surface?: CardSurface
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const favorites = useFavorites()
const { track, once, consent } = useAnalytics()
const rootRef = ref<HTMLElement | null>(null)
const broken = ref(false)
const saved = computed(() => favorites.isSaved(props.cafe.id))
const usingAppLogo = computed(() => broken.value || isKapedokoMark(props.cafe.image))
const photoSrc = computed(() => cafeDisplayLogo(broken.value ? null : props.cafe.image))
const closed = computed(() => props.cafe.status === 'Closed')

const wifiStatus = computed(() => props.cafe.work?.wifiStatus)
const outletStatus = computed(() => props.cafe.work?.outletsStatus)

const teamPress = computed(() => amenityBagPress(wifiStatus.value, outletStatus.value) ?? paymentTeamPress(props.cafe.payment))

const stampMarks = computed(() => {
  const amenities = [
    { kind: 'wifi' as const, noun: 'WiFi', status: wifiStatus.value },
    { kind: 'outlets' as const, noun: 'Outlets', status: outletStatus.value },
  ].map((row) => {
    const status = row.status
    return {
      kind: row.kind,
      noun: row.noun,
      words: status ? amenityBagValue(row.kind, status) : 'Unknown',
      stamp: status ? amenityStampKind(status) : 'unknown',
      soft: status ? amenitySoft(status) : true,
      unavailable: status?.availability === 'unavailable',
      aria: status ? amenityAriaLabel(row.kind, status) : `${row.noun}, Unknown`,
      icon: row.kind === 'wifi'
        ? (status?.availability === 'unavailable' ? WifiOff : Wifi)
        : (status?.availability === 'unavailable' ? Unplug : Plug),
    }
  })
  const pay = paymentCard(props.cafe.payment)
  if (!pay) return amenities
  return [
    ...amenities,
    {
      kind: 'pay' as const,
      noun: 'Pay',
      words: pay.label,
      stamp: pay.stamp,
      soft: pay.stamp === 'unknown',
      unavailable: pay.unavailable,
      aria: pay.aria,
      icon: Wallet,
    },
  ]
})

const hoursLine = computed(() => {
  const hint = props.cafe.hoursHint
  if (!hint || hint === 'Hours to confirm' || hint === 'Closed today') return ''
  return hint.replace(/^Opens\s+/, '').replace(/:00/g, '')
})

const onSave = () => {
  void favorites.toggle(props.cafe.id)
}

const onPhotoError = () => {
  if (photoSrc.value === KAPEDOKO_APP_LOGO_SRC) return
  broken.value = true
}

let stopImpression: (() => void) | undefined

const bindImpression = () => {
  stopImpression?.()
  stopImpression = undefined
  const el = rootRef.value
  const surface = props.surface
  if (!el || !surface || consent.value !== 'granted') return
  stopImpression = watchImpression(el, {
    ratio: CARD_IMPRESSION_RATIO,
    dwellMs: CARD_IMPRESSION_MS,
    onView: () => {
      if (!once(cardViewKey(props.cafe.id, surface))) return
      track(ANALYTICS_EVENTS.CAFE_CARD_VIEWED, {
        cafe_id: props.cafe.id,
        surface,
        confidence_bucket: confidenceBucketFromCafe(props.cafe),
      })
    },
  })
}

onMounted(() => {
  const stopConsent = watch(consent, bindImpression, { immediate: true })
  onBeforeUnmount(stopConsent)
})

onBeforeUnmount(() => {
  stopImpression?.()
})
</script>

<style scoped>
.bag {
  position: relative;
  margin: 0;
  padding: 16px 40px 12px 16px;
  background-color: #faf8f5;
  color: #1c1917;
  border: 1px solid rgba(28, 25, 23, 0.34);
  border-radius: 16px;
  animation: bag-settle 460ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--enter, 0) * 32ms);
  overflow: hidden;
}

.bag.is-selected {
  border-color: #1f6f6b;
}

.bag__open {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.bag__mast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.bag__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  overflow: hidden;
  background-color: #faf8f5;
  border: 1px solid rgba(28, 25, 23, 0.34);
  border-radius: 8px;
}

.bag__mark {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.bag__mark--app {
  padding: 4px;
}

.bag__copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.bag__name {
  color: #1c1917;
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.bag__origin,
.bag__closed {
  font-size: 0.75rem;
  line-height: 1.2;
}

.bag__origin {
  color: #1c1917;
}

.bag__closed {
  color: #8c3a2f;
  font-weight: 700;
}

.bag__lines {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding-top: 10px;
  overflow: visible;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 12%, transparent);
  animation: bag-reprint 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--enter, 0) * 32ms);
}

.bag__hours {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  color: #1c1917;
  font-size: 0.7875rem;
  line-height: 1.3;
}

.bag__hours :deep(svg) {
  color: #d9793b;
  transform: translateY(2px);
}

.bag__hours-key {
  font-weight: 400;
}

.bag__hours-time {
  font-weight: 700;
}

.bag__marks {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px 10px;
  max-width: 100%;
  padding: 4px 4px 6px 0;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.bag__marks::-webkit-scrollbar {
  display: none;
}

.bag__marks::after {
  content: '';
  flex: 0 0 6px;
}

.bag__mark-stamp {
  display: grid;
  flex: 0 0 auto;
  gap: 1px;
  min-width: 92px;
  padding: 8px 10px 7px;
  border: 1px solid color-mix(in srgb, #1c1917 34%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, #d9793b 16%, #faf8f5);
  color: #1c1917;
  transform: rotate(var(--tilt, -1.4deg));
  transform-origin: 30% 80%;
  scroll-snap-align: start;
}

.bag__mark-stamp[data-stamp='community'] {
  background: #faf8f5;
}

.bag__mark-stamp[data-stamp='recheck'],
.bag__mark-stamp.is-no {
  background: color-mix(in srgb, #8c3a2f 10%, #faf8f5);
  border-color: color-mix(in srgb, #8c3a2f 40%, transparent);
}

.bag__mark-stamp.is-soft {
  background: #faf8f5;
  border-style: dashed;
}

.bag__mark-noun {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.2;
}

.bag__mark-noun :deep(svg) {
  color: #d9793b;
}

.bag__mark-word {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.03em;
  white-space: nowrap;
}

.bag__mark-stamp.is-soft .bag__mark-word {
  font-weight: 600;
  color: color-mix(in srgb, #1c1917 72%, #faf8f5);
}

.bag__press {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #1c1917;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.2;
}

.bag__press :deep(svg) {
  color: #d9793b;
}

.bag__save {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  width: 44px;
  min-height: 44px;
  padding: 14px 5px 0 0;
  border: 0;
  background: transparent;
  color: #d9793b;
  cursor: pointer;
  overflow: hidden;
}

.bag.is-saved .bag__save {
  color: #1c1917;
}

.bag__save-fill {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  width: 28px;
  background: #d9793b;
  clip-path: inset(0 0 100% 0);
  transition: clip-path 280ms cubic-bezier(0.16, 1, 0.3, 1);
  pointer-events: none;
}

.bag.is-saved .bag__save-fill {
  clip-path: inset(0 0 0 0);
  box-shadow: inset 1px 0 0 color-mix(in srgb, #1c1917 18%, transparent);
}

.bag__save-icon {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
}

.bag__open:focus-visible,
.bag__save:focus-visible {
  outline: 2px solid #1f6f6b;
  outline-offset: 2px;
}

.bag__open:active {
  opacity: 0.72;
}

@keyframes bag-settle {
  from { transform: translateY(12px) rotate(0.35deg); }
  to { transform: none; }
}

@keyframes bag-reprint {
  from { clip-path: inset(0 0 100% 0); }
  to { clip-path: inset(0 0 0 0); }
}

@media (prefers-reduced-motion: reduce) {
  .bag,
  .bag__lines {
    animation: none;
  }

  .bag__save-fill {
    transition: none;
  }
}
</style>
