<template>
  <section
    id="vibes"
    ref="root"
    class="landing-vibe landing-reveal"
    :class="{ 'is-revealed': revealed }"
    aria-labelledby="landing-vibe-title"
  >
    <div class="landing-container landing-vibe__grid">
      <div class="landing-vibe__copy">
        <h2 id="landing-vibe-title">What's your vibe?</h2>
        <p class="lead">
          Some days need a quiet corner. Some days need loud music and a third iced latte. Tap a sticker and the bag reprints its vibe.
        </p>

        <div class="landing-vibe__stickers" role="group" aria-label="Sample vibes">
          <VibeSticker
            v-for="(vibe, index) in vibes"
            :key="vibe.id"
            :label="vibe.label"
            :lucide-icon="vibe.lucideIcon"
            :color="vibe.color"
            :index="index"
            :pressed="picked === vibe.id"
            :popping="popped === vibe.id"
            @click="pick(vibe.id)"
            @animationend="onAnimationEnd($event, vibe.id)"
          />
        </div>

        <LandingOpen class="landing-vibe__cta" to="/app">Find my vibe in the app</LandingOpen>
      </div>

      <div class="landing-vibe__sample">
        <div class="landing-vibe__steam" aria-hidden="true">
          <DoodleSteam />
        </div>
        <LandingSampleBag :cafe="sampleCafe" :vibe="pickedVibe" />
        <p class="landing-vibe__note" aria-live="polite">
          Sample bag now reads <strong>{{ pickedVibe?.label ?? 'no vibe' }}</strong>.
        </p>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import LandingOpen from '~/components/landing/LandingOpen.vue'
import LandingSampleBag from '~/components/landing/LandingSampleBag.vue'
import DoodleSteam from '~/components/landing/doodles/DoodleSteam.vue'
import VibeSticker from '~/components/vibe/VibeSticker.vue'
import { LANDING_FALLBACK_VIBES, LANDING_SAMPLE_CAFES } from '~/data/landing-samples'

const MAX_STICKERS = 6

const root = ref<HTMLElement | null>(null)
const { revealed } = useRevealOnScroll(root)
const { catalog, status, loadCatalog } = useVibeFilter()

// Load the live vibe catalog only once this section is on screen.
watch(revealed, (on) => {
  if (on) void loadCatalog()
}, { immediate: true })

const vibes = computed(() => {
  if (status.value === 'ready' && catalog.value.length) {
    return catalog.value.slice(0, MAX_STICKERS).map((tag) => ({
      id: tag.id,
      label: tag.label,
      lucideIcon: tag.lucide_icon,
      color: tag.color,
    }))
  }
  return LANDING_FALLBACK_VIBES
})

const sampleCafe = LANDING_SAMPLE_CAFES[0]!
const picked = ref<string | null>(null)
const popped = ref<string | null>(null)

// Default to the first sticker; follow the list when the live catalog swaps in.
watch(vibes, (list) => {
  if (!list.some((vibe) => vibe.id === picked.value)) picked.value = list[0]?.id ?? null
}, { immediate: true })

const pickedVibe = computed(() => vibes.value.find((vibe) => vibe.id === picked.value) ?? null)

const pick = (id: string) => {
  picked.value = id
  popped.value = id
}

const onAnimationEnd = (event: AnimationEvent, id: string) => {
  if (event.animationName.includes('vibe-pop') && popped.value === id) popped.value = null
}
</script>

<style scoped>
.landing-vibe {
  padding-block: var(--space-2xl);
  border-top: 1px solid var(--color-rule-2);
  scroll-margin-top: var(--landing-header-height);
}

.landing-vibe__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-xl);
}

.landing-vibe__copy { min-width: 0; }
.landing-vibe__copy .lead { margin-top: var(--space-md); }

.landing-vibe__stickers {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-sm);
  margin-top: var(--space-lg);
  padding: 8px 4px 4px;
  font-family: var(--font-body);
}

.landing-vibe__cta { margin-top: var(--space-lg); }

.landing-vibe__sample {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
  padding-top: var(--space-xl);
}

.landing-vibe__steam {
  position: absolute;
  top: 0;
  left: 28px;
  width: 32px;
  color: var(--color-ink-2);
}

.landing-vibe__note { color: var(--color-ink-2); font-size: var(--text-sm); }
.landing-vibe__note strong { color: var(--color-ink); }

@media (min-width: 600px) {
  .landing-vibe__stickers { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

@media (min-width: 840px) {
  .landing-vibe { padding-block: var(--space-3xl); }
  .landing-vibe__grid {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
    column-gap: var(--space-2xl);
    align-items: center;
  }
  .landing-vibe__sample { rotate: 1.5deg; }
}

@media (prefers-reduced-motion: reduce) {
  .landing-vibe__sample { rotate: 0deg; }
}
</style>
