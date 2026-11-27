<template>
  <section
    id="how-it-works"
    ref="root"
    class="landing-how landing-reveal"
    :class="{ 'is-revealed': revealed }"
    aria-labelledby="landing-how-title"
  >
    <div class="landing-container">
      <h2 id="landing-how-title">Three stamps to a good seat.</h2>
      <ol class="landing-how__steps">
        <li v-for="(step, index) in steps" :key="step.title" class="landing-how__step" :style="{ '--tilt': step.tilt }">
          <span class="landing-how__num" aria-hidden="true">{{ index + 1 }}</span>
          <span class="landing-how__doodle" aria-hidden="true">
            <component :is="step.doodle" />
          </span>
          <h3 class="landing-how__title">
            <span class="visually-hidden">Step {{ index + 1 }}: </span>{{ step.title }}
          </h3>
          <p class="landing-how__body">{{ step.body }}</p>
        </li>
      </ol>
      <p class="landing-how__rule">
        WiFi and outlets stay unconfirmed until enough reviews say so. A shut shop still prints Closed under its name.
      </p>
    </div>
  </section>
</template>

<script lang="ts" setup>
import DoodleCup from '~/components/landing/doodles/DoodleCup.vue'
import DoodlePlug from '~/components/landing/doodles/DoodlePlug.vue'
import DoodleWifi from '~/components/landing/doodles/DoodleWifi.vue'

const root = ref<HTMLElement | null>(null)
const { revealed } = useRevealOnScroll(root)

const steps = [
  {
    title: 'Stamp your must-haves',
    body: 'WiFi, Plugs, Long-stay WiFi, or Near You. One tap each, no account.',
    doodle: DoodleWifi,
    tilt: '-1.5deg',
  },
  {
    title: 'Read the bag',
    body: 'Every cafe prints Hours, WiFi, and Outlets in words, plus its vibe.',
    doodle: DoodlePlug,
    tilt: '1.2deg',
  },
  {
    title: 'Go sit down',
    body: 'Open the pin, save the shop, and leave a review so the next person knows.',
    doodle: DoodleCup,
    tilt: '-0.8deg',
  },
]
</script>

<style scoped>
.landing-how {
  padding-block: var(--space-2xl);
  border-top: 1px solid var(--color-rule-2);
  scroll-margin-top: var(--landing-header-height);
}

.landing-how__steps {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-lg);
  margin: var(--space-xl) 0 0;
  padding: 0;
  list-style: none;
}

.landing-how__step {
  position: relative;
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  grid-template-areas: 'doodle title' 'doodle body';
  column-gap: var(--space-md);
  row-gap: var(--space-2xs);
  align-items: start;
  padding: var(--space-lg) var(--space-lg) var(--space-lg);
  border: 1px solid color-mix(in srgb, var(--color-ink) 34%, transparent);
  border-radius: var(--radius-card);
  background: var(--color-paper-2);
  rotate: var(--tilt);
}

.landing-how__num {
  position: absolute;
  top: -14px;
  left: -6px;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 1.5px solid var(--color-ink);
  border-radius: 50% 46% 52% 44%;
  background: var(--color-accent);
  color: var(--color-accent-ink);
  font-size: var(--text-lg);
  font-weight: 700;
  rotate: -10deg;
}

.landing-how__doodle { grid-area: doodle; width: 64px; }

.landing-how__title {
  grid-area: title;
  max-width: none;
  font-size: var(--text-xl);
  line-height: 1.1;
}

.landing-how__body { grid-area: body; font-size: var(--text-md); line-height: 1.45; }

.landing-how__rule {
  max-width: 40rem;
  margin-top: var(--space-xl);
  color: var(--color-ink-2);
  font-size: var(--text-md);
}

@media (min-width: 840px) {
  .landing-how { padding-block: var(--space-3xl); }
  .landing-how__steps { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-lg); }
  .landing-how__step {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas: 'doodle' 'title' 'body';
    row-gap: var(--space-sm);
    padding: var(--space-xl) var(--space-lg) var(--space-lg);
  }
  .landing-how__doodle { width: 80px; }
}

@media (prefers-reduced-motion: reduce) {
  .landing-how__step,
  .landing-how__num { rotate: 0deg; }
}
</style>
