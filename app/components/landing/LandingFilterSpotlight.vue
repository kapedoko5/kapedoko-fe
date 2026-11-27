<template>
  <section
    id="filters"
    ref="root"
    class="landing-filter landing-reveal"
    :class="{ 'is-revealed': revealed }"
    aria-labelledby="landing-filter-title"
  >
    <div class="landing-container landing-filter__grid">
      <div class="landing-filter__copy">
        <h2 id="landing-filter-title">No socket? No sale.</h2>
        <p class="lead">
          Stamp WiFi and Plugs, and the shelf keeps only cafes you can actually open a laptop in. Same filters as the app.
        </p>

        <div class="landing-filter__chips" role="group" aria-label="Sample filters">
          <button
            v-for="filter in filters"
            :key="filter.id"
            type="button"
            class="landing-filter__chip"
            :class="{ 'is-on': active.includes(filter.id) }"
            :aria-pressed="active.includes(filter.id)"
            @click="toggle(filter.id)"
          >
            <component :is="filter.icon" :size="16" :stroke-width="2.25" aria-hidden="true" />
            {{ filter.label }}
          </button>
        </div>

        <p class="landing-filter__count" aria-live="polite">
          <span class="landing-filter__count-stamp">
            {{ LANDING_SAMPLE_CAFES.length }} <span aria-hidden="true">→</span><span class="visually-hidden">narrowed to</span> {{ shown.length }}
          </span>
          {{ shown.length === 1 ? 'cafe' : 'cafes' }} on the sample shelf
        </p>

        <div class="landing-filter__doodle" aria-hidden="true">
          <DoodlePlug />
        </div>
      </div>

      <div class="landing-filter__shelf">
        <p class="landing-filter__note">Sample bags. Not listed shops.</p>
        <TransitionGroup tag="ul" name="shelf" class="landing-filter__list">
          <li v-for="cafe in shown" :key="cafe.id" class="landing-filter__item">
            <LandingSampleBag :cafe="cafe" />
          </li>
        </TransitionGroup>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { Plug, Wifi } from 'lucide-vue-next'
import LandingSampleBag from '~/components/landing/LandingSampleBag.vue'
import DoodlePlug from '~/components/landing/doodles/DoodlePlug.vue'
import {
  LANDING_SAMPLE_CAFES,
  LANDING_SPOTLIGHT_FILTERS,
  sampleMatchesFilters,
  type LandingSpotlightFilter,
} from '~/data/landing-samples'
import { CAFE_FILTERS } from '~/utils/cafe-filters'

const ICONS = { wifi: Wifi, plugs: Plug } as const

const filters = LANDING_SPOTLIGHT_FILTERS.map((id) => ({
  id,
  label: CAFE_FILTERS.find((filter) => filter.id === id)?.label ?? id,
  icon: ICONS[id],
}))

const root = ref<HTMLElement | null>(null)
const { revealed } = useRevealOnScroll(root)

const active = ref<LandingSpotlightFilter[]>([])
const shown = computed(() => LANDING_SAMPLE_CAFES.filter((cafe) => sampleMatchesFilters(cafe, active.value)))

const toggle = (id: LandingSpotlightFilter) => {
  active.value = active.value.includes(id)
    ? active.value.filter((item) => item !== id)
    : [...active.value, id]
}
</script>

<style scoped>
.landing-filter {
  padding-block: var(--space-2xl);
  border-top: 1px solid var(--color-rule-2);
  scroll-margin-top: var(--landing-header-height);
}

.landing-filter__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-xl);
}

.landing-filter__copy { position: relative; min-width: 0; }
.landing-filter__copy .lead { margin-top: var(--space-md); }

.landing-filter__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin-top: var(--space-lg);
}

.landing-filter__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 var(--space-md);
  border: 1px solid color-mix(in srgb, var(--color-ink) 22%, transparent);
  border-radius: var(--radius-card);
  background: transparent;
  color: var(--color-ink);
  font-family: inherit;
  font-size: var(--text-md);
  font-weight: 400;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color var(--dur-short) var(--ease-out), rotate var(--dur-short) cubic-bezier(0.34, 1.56, 0.64, 1);
}

.landing-filter__chip :deep(svg) { color: var(--color-accent); }

.landing-filter__chip.is-on {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-accent-ink);
  font-weight: 700;
  rotate: -2deg;
}

.landing-filter__chip.is-on :deep(svg) { color: var(--color-accent-ink); }

@media (hover: hover) and (pointer: fine) {
  .landing-filter__chip:hover {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-ink) 18%, transparent);
  }
}

.landing-filter__chip:active {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--color-ink) 35%, transparent);
}

.landing-filter__chip:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.landing-filter__count {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
  margin-top: var(--space-md);
  font-size: var(--text-md);
}

.landing-filter__count-stamp {
  display: inline-block;
  padding: 4px 10px;
  border: 1.5px solid var(--color-ink);
  border-radius: 8px;
  background: var(--color-paper-2);
  font-size: var(--text-lg);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  rotate: 2deg;
}

.landing-filter__doodle { width: 64px; margin-top: var(--space-lg); rotate: -12deg; }

.landing-filter__shelf { min-width: 0; }

.landing-filter__note {
  margin-bottom: var(--space-xs);
  color: var(--color-ink-2);
  font-size: var(--text-sm);
}

.landing-filter__list {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-sm);
  margin: 0;
  padding: 0;
  list-style: none;
}

.landing-filter__item { min-width: 0; }

.shelf-move,
.shelf-enter-active { transition: opacity 260ms var(--ease-out), transform 360ms var(--ease-out); }
.shelf-leave-active { position: absolute; width: 100%; transition: opacity 180ms ease-in, transform 180ms ease-in; }
.shelf-enter-from { opacity: 0; transform: translateY(12px); }
.shelf-leave-to { opacity: 0; transform: scale(0.96) rotate(-2deg); }

@media (min-width: 600px) {
  .landing-filter__list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .shelf-leave-active { width: calc(50% - var(--space-sm) / 2); }
}

@media (min-width: 840px) {
  .landing-filter { padding-block: var(--space-3xl); }
  .landing-filter__grid {
    grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
    column-gap: var(--space-2xl);
    align-items: start;
  }
  .landing-filter__copy { position: sticky; top: calc(var(--landing-header-height) + var(--space-lg)); }
  .landing-filter__doodle { width: 88px; }
}

@media (prefers-reduced-motion: reduce) {
  .landing-filter__chip.is-on,
  .landing-filter__count-stamp,
  .landing-filter__doodle { rotate: 0deg; }
  .shelf-enter-from,
  .shelf-leave-to { transform: none; }
}
</style>
