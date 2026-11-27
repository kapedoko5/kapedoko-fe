<template>
  <section
    id="proof"
    ref="root"
    class="landing-proof landing-reveal"
    :class="{ 'is-revealed': revealed }"
    aria-labelledby="landing-proof-title"
  >
    <div class="landing-container landing-proof__grid">
      <div class="landing-proof__copy">
        <h2 id="landing-proof-title">Checked by people who actually sat there.</h2>
        <p class="lead">
          WiFi and outlet stamps come from reviews, owners, and our own visits, and each says which. No paid stars, no made-up scores.
        </p>
        <p v-if="shopCount" class="landing-proof__stat">
          <span class="landing-proof__stat-num">{{ shopCount.toLocaleString('en-PH') }}</span>
          cafes on the map right now
        </p>
        <ul class="landing-proof__cities" aria-label="Cities on the map">
          <li v-for="(city, index) in cities" :key="city" class="landing-proof__city" :style="{ '--tilt': tilts[index % tilts.length] }">
            <MapPin :size="16" :stroke-width="2.25" aria-hidden="true" />
            {{ city }}
          </li>
        </ul>
        <p class="landing-proof__claim">
          Own a cafe?
          <NuxtLink to="/login?redirect=/app">Sign in</NuxtLink>
          and claim it. An admin verifies before hours, contact, and logo can be edited. Public submissions cover the Philippines only.
        </p>
      </div>

      <div class="landing-proof__board" aria-hidden="true">
        <LandingPolaroid class="landing-proof__polaroid landing-proof__polaroid--a" src="/assets/landing/corner-seat.jpg" caption="Corner seat" tilt="-5deg" />
        <LandingPolaroid class="landing-proof__polaroid landing-proof__polaroid--b" src="/assets/landing/iced-latte.jpg" caption="Iced, obviously" tilt="4deg" />
        <LandingSticker class="landing-proof__tape" tone="teal" tilt="-6deg" :stuck="revealed" :delay="200">
          <BadgeCheck :size="16" :stroke-width="2.5" /> Team checked
        </LandingSticker>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { BadgeCheck, MapPin } from 'lucide-vue-next'
import LandingPolaroid from '~/components/landing/LandingPolaroid.vue'
import LandingSticker from '~/components/landing/LandingSticker.vue'
import { countApprovedShops } from '~/utils/approved-shops'

const root = ref<HTMLElement | null>(null)
const { revealed } = useRevealOnScroll(root)
const supabase = useSupabaseClient()

// Live count from the same query Home uses ("12 of N shops"). No number prints if it fails.
const shopCount = ref<number | null>(null)
watch(revealed, async (on) => {
  if (!on || shopCount.value !== null) return
  try {
    const count = await countApprovedShops(supabase)
    shopCount.value = count > 0 ? count : null
  } catch {
    shopCount.value = null
  }
}, { immediate: true })

const cities = ['Metro Manila', 'Cebu', 'Davao']
const tilts = ['-2deg', '1.5deg', '-1deg']
</script>

<style scoped>
.landing-proof {
  padding-block: var(--space-2xl);
  border-top: 1px solid var(--color-rule-2);
  scroll-margin-top: var(--landing-header-height);
}

.landing-proof__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-xl);
}

.landing-proof__copy { min-width: 0; }
.landing-proof__copy .lead { margin-top: var(--space-md); }

.landing-proof__stat {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
  margin-top: var(--space-lg);
  font-size: var(--text-md);
  font-weight: 700;
}

.landing-proof__stat-num {
  display: inline-block;
  padding: 2px 12px;
  border: 2px solid var(--color-ink);
  border-radius: 10px;
  background: var(--color-accent);
  color: var(--color-accent-ink);
  font-size: var(--text-2xl);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  rotate: -3deg;
}

.landing-proof__cities {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin: var(--space-lg) 0 0;
  padding: 0;
  list-style: none;
}

.landing-proof__city {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0 var(--space-sm);
  border: 1.5px solid var(--color-ink);
  border-radius: var(--radius-card);
  background: var(--color-paper-2);
  font-size: var(--text-md);
  font-weight: 700;
  rotate: var(--tilt);
}

.landing-proof__city :deep(svg) { color: var(--color-accent); }

.landing-proof__claim {
  max-width: 36rem;
  margin-top: var(--space-lg);
  font-size: var(--text-md);
  line-height: 1.45;
}

.landing-proof__board {
  position: relative;
  min-height: 320px;
  max-width: 420px;
  width: 100%;
  justify-self: center;
}

.landing-proof__polaroid { position: absolute; width: 46%; }
.landing-proof__polaroid--a { top: 0; left: 4%; }
.landing-proof__polaroid--b { top: 18%; right: 4%; }
.landing-proof__tape { position: absolute; bottom: 4%; left: 30%; }

@media (min-width: 840px) {
  .landing-proof { padding-block: var(--space-3xl); }
  .landing-proof__grid {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
    column-gap: var(--space-2xl);
    align-items: center;
  }
  .landing-proof__board { min-height: 380px; }
}

@media (prefers-reduced-motion: reduce) {
  .landing-proof__city,
  .landing-proof__stat-num { rotate: 0deg; }
}
</style>
