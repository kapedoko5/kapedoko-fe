<template>
  <article
    class="owner-bag"
    :class="{ 'is-active': active, 'is-dim': dim }"
    :style="{ '--enter': String(index) }"
  >
    <div class="owner-bag__mast">
      <span class="owner-bag__logo" aria-hidden="true">
        <img
          class="owner-bag__mark"
          :class="{ 'is-app': usingAppLogo }"
          :src="photoSrc"
          alt=""
          width="40"
          height="40"
          @error="broken = true"
        />
      </span>
      <div class="owner-bag__copy">
        <div class="owner-bag__title">
          <h2 class="owner-bag__name">{{ shop.name }}</h2>
          <p class="admin-status" :class="`admin-status--${shop.status}`">{{ statusWord }}</p>
          <p v-if="closed" class="owner-bag__closed">Closed</p>
        </div>
        <p v-if="shop.address" class="owner-bag__origin">{{ shop.address }}</p>
      </div>
    </div>
    <div class="owner-bag__actions">
      <NuxtLink
        class="owner-btn"
        :to="editTo"
        :aria-label="`Edit listing for ${shop.name}`"
        @click="onEdit"
      >
        Edit listing
      </NuxtLink>
      <NuxtLink
        class="owner-btn owner-btn--ghost"
        :to="verifyTo"
        :aria-label="`Verify amenities for ${shop.name}`"
        @click="onVerify"
      >
        Verify your cafe
      </NuxtLink>
    </div>
    <div class="owner-bag__lines">
      <p class="owner-bag__hours">
        <Clock :size="15" :stroke-width="2.25" aria-hidden="true" />
        <span class="owner-bag__hours-key">Hours</span>
        <span class="owner-bag__hours-time">{{ hoursLine }}</span>
      </p>
      <p v-if="phone" class="owner-bag__hours">
        <Phone :size="15" :stroke-width="2.25" aria-hidden="true" />
        <span class="owner-bag__hours-key">Contact</span>
        <span class="owner-bag__hours-time">{{ phone }}</span>
      </p>
      <p v-if="liveNote" class="owner-bag__live">{{ liveNote }}</p>
    </div>
  </article>
</template>

<script lang="ts" setup>
import { Clock, Phone } from 'lucide-vue-next'
import type { ShopRow } from '~/types/shop'
import { cafeDisplayLogo, isKapedokoMark } from '~/utils/logo'
import { ownerCafeEditPath, ownerCafeVerifyPath, settleOwnerIonPages } from '~/utils/owner-nav'
import { ownerCafeIsClosed, ownerHoursLine, ownerLiveCopy, ownerLiveStatusWord } from '~/utils/owner-portal'
import { shopImageUrl } from '~/utils/shop-mapper'

const props = withDefaults(defineProps<{
  shop: ShopRow
  index?: number
  active?: boolean
  dim?: boolean
}>(), {
  index: 0,
  active: false,
  dim: false,
})

const config = useRuntimeConfig()
const broken = ref(false)
const photoSrc = computed(() => {
  if (broken.value) return cafeDisplayLogo(null)
  return cafeDisplayLogo(shopImageUrl(props.shop, String(config.public.r2PublicBaseUrl || '')))
})
const usingAppLogo = computed(() => broken.value || isKapedokoMark(photoSrc.value))
const closed = computed(() => ownerCafeIsClosed(props.shop.hours))
const hoursLine = computed(() => ownerHoursLine(props.shop.hours))
const statusWord = computed(() => ownerLiveStatusWord(props.shop))
const liveNote = computed(() => (
  props.shop.status === 'approved' ? '' : ownerLiveCopy(props.shop)
))
const phone = computed(() => props.shop.contact_number?.trim() || '')
const editTo = computed(() => ownerCafeEditPath(props.shop.id))
const verifyTo = computed(() => ownerCafeVerifyPath(props.shop.id))

const goOwner = (event: MouseEvent, to: string) => {
  if (event.defaultPrevented) return
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  void navigateTo(to).then(() => {
    if (import.meta.client) requestAnimationFrame(settleOwnerIonPages)
  })
}

const onEdit = (event: MouseEvent) => goOwner(event, editTo.value)
const onVerify = (event: MouseEvent) => goOwner(event, verifyTo.value)
</script>

<style scoped>
.owner-bag {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px 20px;
  padding: 20px;
  background: #faf8f5;
  color: var(--kd-ink);
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  animation: owner-bag-settle 460ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--enter, 0) * 32ms);
  transition:
    opacity 220ms cubic-bezier(0.16, 1, 0.3, 1),
    border-color 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.owner-bag.is-active {
  border-color: var(--kd-primary);
}

.owner-bag.is-dim {
  opacity: 0.42;
}

.owner-bag__mast {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.owner-bag__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  overflow: hidden;
  background: #faf8f5;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 8px;
}

.owner-bag__mark {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.owner-bag__mark.is-app {
  padding: 4px;
}

.owner-bag__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.owner-bag__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
}

.owner-bag__name,
.owner-bag__closed,
.owner-bag__origin,
.owner-bag__hours,
.owner-bag__live {
  margin: 0;
}

.owner-bag__name {
  min-width: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}

.owner-bag__origin,
.owner-bag__live {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  line-height: 1.3;
}

.owner-bag__live {
  grid-column: 1 / -1;
}

.owner-bag__closed {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--kd-destructive) 14%, #faf8f5);
  color: var(--kd-destructive);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
}

.admin-status--hidden {
  background: color-mix(in srgb, var(--kd-ink) 10%, #faf8f5);
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
}

.owner-bag__lines {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 20px;
  grid-column: 1 / -1;
  padding-top: 12px;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
}

.owner-bag__hours {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
  font-size: 0.7875rem;
  line-height: 1.3;
}

.owner-bag__hours :deep(svg) {
  flex: 0 0 auto;
  color: var(--kd-accent);
  transform: translateY(2px);
}

.owner-bag__hours-key {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-weight: 700;
}

.owner-bag__hours-time {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.owner-bag__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 8px;
  grid-column: 2;
  grid-row: 1;
}

.owner-bag ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

@keyframes owner-bag-settle {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 639px) {
  .owner-bag {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .owner-bag__lines {
    grid-template-columns: 1fr;
  }

  .owner-bag__actions {
    justify-content: flex-start;
    order: 3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .owner-bag {
    animation: none;
    transition: none;
  }
}

:root.is-android .owner-bag__actions .owner-btn {
  min-height: 48px;
}
</style>
