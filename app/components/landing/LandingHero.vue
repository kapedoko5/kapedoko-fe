<template>
  <section id="top" class="landing-hero" aria-labelledby="landing-offer">
    <div class="landing-container landing-hero__grid">
      <div class="landing-hero__copy">
        <h1 id="landing-offer">A cafe you can actually work from</h1>
        <p class="lead">
          WiFi, outlets, and hours in Metro Manila, Cebu, or Davao.
        </p>
        <div class="landing-hero__actions">
          <LandingOpen />
          <NuxtLink class="landing-hero__sign-in" to="/login?redirect=/app">Sign in</NuxtLink>
        </div>
      </div>

      <figure class="landing-hero__visual">
        <div
          class="demo-filters"
          role="radiogroup"
          aria-label="Show how a cafe label reprints"
        >
          <button
            v-for="filter in filters"
            :key="filter.id"
            type="button"
            class="demo-filters__chip"
            :class="{ 'is-active': active === filter.id }"
            role="radio"
            :aria-checked="active === filter.id"
            @click="setFilter(filter.id)"
          >
            <component :is="filter.icon" :size="14" :stroke-width="2.25" aria-hidden="true" />
            {{ filter.label }}
          </button>
        </div>

        <article class="demo-bag" :class="{ 'is-settled': settled, 'is-reprinting': reprinting }">
          <div class="demo-bag__mast">
            <div class="demo-bag__copy">
              <p class="demo-bag__name">On each cafe</p>
              <p class="demo-bag__origin">Philippines</p>
            </div>
          </div>
          <div :key="reprintKey" class="demo-bag__lines">
            <p class="demo-bag__fact">
              <Clock :size="18" :stroke-width="2.25" aria-hidden="true" />
              <span class="demo-bag__fact-key">Hours</span>
              <span class="demo-bag__fact-value">{{ facts.hours }}</span>
            </p>
            <p class="demo-bag__fact" :class="{ 'is-soft': facts.wifi.soft }">
              <Wifi :size="18" :stroke-width="2.25" aria-hidden="true" />
              <span class="demo-bag__fact-key">WiFi</span>
              <span class="demo-bag__fact-value">{{ facts.wifi.word }}</span>
            </p>
            <p class="demo-bag__fact" :class="{ 'is-soft': facts.outlets.soft }">
              <Plug :size="18" :stroke-width="2.25" aria-hidden="true" />
              <span class="demo-bag__fact-key">Outlets</span>
              <span class="demo-bag__fact-value">{{ facts.outlets.word }}</span>
            </p>
          </div>
        </article>
        <figcaption class="landing-hero__caption">
          Sample label. Not a listed shop. Press a filter to reprint Hours, WiFi, and Outlets.
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { Clock, Navigation, Plug, Wifi } from 'lucide-vue-next'
import LandingOpen from '~/components/landing/LandingOpen.vue'

type FilterId = 'near' | 'wifi' | 'plugs'

const filters = [
  { id: 'near' as const, label: 'Near You', icon: Navigation },
  { id: 'wifi' as const, label: 'WiFi', icon: Wifi },
  { id: 'plugs' as const, label: 'Plugs', icon: Plug },
]

const FACTS: Record<FilterId, {
  hours: string
  wifi: { word: string, soft: boolean }
  outlets: { word: string, soft: boolean }
}> = {
  near: {
    hours: 'Open now',
    wifi: { word: 'Yes', soft: false },
    outlets: { word: 'Yes', soft: false },
  },
  wifi: {
    hours: 'Open now',
    wifi: { word: 'Yes', soft: false },
    outlets: { word: 'Unknown', soft: true },
  },
  plugs: {
    hours: 'Open now',
    wifi: { word: 'Unknown', soft: true },
    outlets: { word: 'Yes', soft: false },
  },
}

const active = ref<FilterId>('near')
const reprintKey = ref(0)
const reprinting = ref(false)
const settled = ref(false)
const facts = computed(() => FACTS[active.value])

onMounted(() => {
  settled.value = true
})

const setFilter = (id: FilterId) => {
  if (id === active.value) return
  active.value = id
  reprintKey.value += 1
  reprinting.value = true
}
</script>

<style scoped>
.landing-hero {
  display: grid;
  align-items: center;
  min-height: calc(100svh - var(--landing-header-height));
  padding-block: var(--space-xl);
  scroll-margin-top: var(--landing-header-height);
}

.landing-hero__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-sm);
  min-width: 0;
}

.landing-hero__copy {
  min-width: 0;
}

.landing-hero__visual {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-width: 0;
  margin: 0;
}

.landing-hero__copy .lead {
  margin-top: var(--space-md);
}

.landing-hero__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.landing-hero__sign-in {
  color: var(--color-focus);
  font-size: var(--text-title);
  font-weight: 700;
  line-height: 1.3;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  white-space: nowrap;
}

.landing-hero__sign-in:hover {
  color: var(--color-ink);
}

.landing-hero__sign-in:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
}

.demo-filters {
  display: flex;
  gap: var(--space-xs);
  overflow-x: auto;
  scrollbar-width: none;
}

.demo-filters::-webkit-scrollbar {
  display: none;
}

.demo-filters__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  flex: 0 0 auto;
  min-height: 44px;
  padding: 0 var(--space-sm);
  border: 1px solid color-mix(in srgb, var(--color-ink) 22%, transparent);
  border-radius: var(--radius-card);
  background: transparent;
  color: var(--color-ink);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 400;
  white-space: nowrap;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.demo-filters__chip.is-active {
  background: var(--color-accent);
  border-color: var(--color-accent);
  font-weight: 700;
}

@media (hover: hover) and (pointer: fine) {
  .demo-filters__chip:hover {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-ink) 18%, transparent);
  }
}

.demo-filters__chip:active {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--color-ink) 35%, transparent);
}

.demo-filters__chip:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.demo-filters__chip:disabled,
.demo-filters__chip[aria-disabled='true'] {
  opacity: 0.55;
  cursor: not-allowed;
}

.demo-bag {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
  min-height: 20rem;
  padding: var(--space-xl) var(--space-xl) var(--space-lg);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-ink) 34%, transparent);
  border-radius: var(--radius-card);
  background: var(--color-paper-2);
  color: var(--color-ink);
}

.demo-bag.is-settled {
  animation: demo-bag-settle var(--dur-long) var(--ease-out) both;
}

.demo-bag__mast {
  display: flex;
  align-items: flex-start;
  min-width: 0;
}

.demo-bag__copy {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  min-width: 0;
}

.demo-bag__name {
  margin: 0;
  font-size: var(--text-3xl);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: var(--tracking-display);
  overflow-wrap: break-word;
  min-width: 0;
}

.demo-bag__origin {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.2;
}

.demo-bag__lines {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  flex: 1 1 auto;
  gap: var(--space-lg);
  margin: 0;
  padding-top: var(--space-lg);
  border-top: 1px solid var(--color-rule-2);
}

.demo-bag.is-reprinting .demo-bag__lines {
  animation: demo-bag-reprint var(--dur-long) var(--ease-out) both;
}

.demo-bag__fact {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-sm);
  margin: 0;
  font-size: var(--text-xl);
  line-height: 1.2;
}

.demo-bag__fact :deep(svg) {
  color: var(--color-accent);
  width: 1.15em;
  height: 1.15em;
  transform: translateY(2px);
  flex-shrink: 0;
}

.demo-bag__fact-value {
  font-weight: 700;
}

.demo-bag__fact.is-soft .demo-bag__fact-value {
  font-weight: 400;
}

.landing-hero__caption {
  margin: 0;
  color: var(--color-ink-2);
  font-size: var(--text-sm);
  line-height: 1.35;
}

@keyframes demo-bag-settle {
  from { transform: translateY(12px) rotate(0.35deg); }
  to { transform: none; }
}

@keyframes demo-bag-reprint {
  from { clip-path: inset(0 0 100% 0); }
  to { clip-path: inset(0 0 0 0); }
}

@media (min-width: 840px) {
  .landing-hero__grid {
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    align-items: center;
    column-gap: var(--space-2xl);
    row-gap: var(--space-sm);
  }

  .demo-bag {
    min-height: min(32rem, 62svh);
  }

  .demo-bag__fact {
    font-size: var(--text-3xl);
  }
}

@media (max-width: 839px) {
  .landing-hero {
    min-height: 0;
    padding-block: var(--space-lg) var(--space-xl);
  }
}

@media (prefers-reduced-motion: reduce) {
  .demo-bag.is-settled,
  .demo-bag.is-reprinting .demo-bag__lines {
    animation: none;
  }

  .demo-filters__chip:active {
    box-shadow: none;
  }
}
</style>
