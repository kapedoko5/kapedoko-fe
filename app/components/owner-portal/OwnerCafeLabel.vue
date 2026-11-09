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
        <h2 class="owner-bag__name">{{ shop.name }}</h2>
        <p v-if="closed" class="owner-bag__closed">Closed</p>
        <p v-if="shop.address" class="owner-bag__origin">{{ shop.address }}</p>
      </div>
    </div>
    <div class="owner-bag__lines">
      <p class="owner-bag__hours">
        <Clock :size="15" :stroke-width="2.25" aria-hidden="true" />
        <span class="owner-bag__hours-key">Hours</span>
        <span class="owner-bag__hours-time">{{ hoursLine }}</span>
      </p>
      <p class="owner-bag__live">{{ liveCopy }}</p>
      <p v-if="phone" class="owner-bag__hours">
        <Phone :size="15" :stroke-width="2.25" aria-hidden="true" />
        <span class="owner-bag__hours-key">Contact</span>
        <span class="owner-bag__hours-time">{{ phone }}</span>
      </p>
    </div>
    <NuxtLink
      class="owner-bag__edit"
      :to="editTo"
      :aria-label="`Edit listing for ${shop.name}`"
    >
      Edit listing
    </NuxtLink>
  </article>
</template>

<script lang="ts" setup>
import { Clock, Phone } from 'lucide-vue-next'
import type { ShopRow } from '~/types/shop'
import { cafeDisplayLogo, isKapedokoMark } from '~/utils/logo'
import { ownerCafeEditPath } from '~/utils/owner-nav'
import { ownerCafeIsClosed, ownerHoursLine, ownerLiveCopy } from '~/utils/owner-portal'
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
const liveCopy = computed(() => ownerLiveCopy(props.shop))
const phone = computed(() => props.shop.contact_number?.trim() || '')
const editTo = computed(() => ownerCafeEditPath(props.shop.id))
</script>

<style scoped>
.owner-bag {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 16px 12px;
  background: #faf8f5;
  color: #1c1917;
  border: 1px solid rgba(28, 25, 23, 0.34);
  border-radius: 16px;
  animation: owner-bag-settle 460ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--enter, 0) * 32ms);
  transition:
    opacity 220ms cubic-bezier(0.16, 1, 0.3, 1),
    border-color 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.owner-bag.is-active {
  border-color: #1f6f6b;
}

.owner-bag.is-dim {
  opacity: 0.42;
}

.owner-bag__mast {
  display: flex;
  align-items: flex-start;
  gap: 10px;
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
  border: 1px solid rgba(28, 25, 23, 0.34);
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
  min-width: 0;
}

.owner-bag__name,
.owner-bag__closed,
.owner-bag__origin,
.owner-bag__hours,
.owner-bag__live {
  margin: 0;
}

.owner-bag__name {
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.owner-bag__origin,
.owner-bag__closed,
.owner-bag__live {
  font-size: 0.75rem;
  line-height: 1.2;
}

.owner-bag__closed {
  color: #8c3a2f;
  font-weight: 700;
}

.owner-bag__lines {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 12%, transparent);
}

.owner-bag__hours {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: 0.7875rem;
  line-height: 1.3;
}

.owner-bag__hours :deep(svg) {
  color: #d9793b;
  transform: translateY(2px);
}

.owner-bag__hours-time {
  font-weight: 700;
}

.owner-bag__edit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--kd-accent);
  border-radius: 16px;
  background: var(--kd-accent);
  color: #1c1917;
  font-size: 0.7875rem;
  font-weight: 700;
  text-decoration: none;
}

.owner-bag__edit:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
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

@media (prefers-reduced-motion: reduce) {
  .owner-bag {
    animation: none;
    transition: none;
  }
}

:root.is-android .owner-bag__edit {
  min-height: 48px;
}
</style>
