<template>
  <section id="top" class="landing-hero" aria-labelledby="landing-offer">
    <div class="landing-container landing-hero__grid">
      <div class="landing-hero__copy">
        <p class="landing-hero__eyebrow">
          <span class="landing-hero__eyebrow-stamp">For laptop people</span>
        </p>
        <h1 id="landing-offer">Filter your next brew.</h1>
        <p class="lead">
          WiFi, outlets, hours, and vibe for cafes in Metro Manila, Cebu, and Davao. Find the seat before you buy the drink.
        </p>
        <div class="landing-hero__actions">
          <LandingOpen />
          <NuxtLink class="landing-hero__sign-in" to="/login?redirect=/app">Sign in</NuxtLink>
        </div>
        <div class="landing-hero__arrow" aria-hidden="true">
          <DoodleArrow />
        </div>
      </div>

      <div class="landing-hero__stage">
        <LandingPhone class="landing-hero__phone">
          <div class="mini-home">
            <div class="mini-home__top">
              <span class="mini-home__hello">Good morning</span>
              <img src="/assets/kapedoko-horizontal-text_dark.png" alt="" width="60" height="13" class="mini-home__mark">
            </div>
            <div class="mini-home__search">Search cafes</div>
            <div class="mini-home__chips">
              <span class="mini-home__chip"><Navigation :size="10" :stroke-width="2.5" /> Near</span>
              <span class="mini-home__chip is-on"><Wifi :size="10" :stroke-width="2.5" /> WiFi</span>
              <span class="mini-home__chip"><Plug :size="10" :stroke-width="2.5" /> Plugs</span>
            </div>
            <LandingSampleBag
              v-for="(cafe, i) in phoneCafes"
              :key="cafe.id"
              :cafe="cafe"
              :vibe="i === 0 ? heroVibe : null"
              mini
            />
          </div>
        </LandingPhone>

        <div class="landing-hero__decor" aria-hidden="true">
          <LandingSticker class="hero-sticker hero-sticker--wifi" tone="accent" tilt="-8deg" :delay="250">
            <Wifi :size="16" :stroke-width="2.5" /> WiFi <Check :size="16" :stroke-width="3" />
          </LandingSticker>
          <LandingSticker class="hero-sticker hero-sticker--plugs" tone="teal" tilt="6deg" :delay="400">
            <Plug :size="16" :stroke-width="2.5" /> Plugs <Check :size="16" :stroke-width="3" />
          </LandingSticker>
          <LandingSticker class="hero-sticker hero-sticker--vibe" tilt="-3deg" :delay="550">
            <VolumeX :size="16" :stroke-width="2.5" /> Quiet corner
          </LandingSticker>
          <div class="hero-sticker hero-sticker--cup">
            <LandingPolaroid src="/assets/landing/hero-refill.jpg" caption="3pm refill" tilt="7deg" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { Check, Navigation, Plug, VolumeX, Wifi } from 'lucide-vue-next'
import LandingOpen from '~/components/landing/LandingOpen.vue'
import LandingPhone from '~/components/landing/LandingPhone.vue'
import LandingPolaroid from '~/components/landing/LandingPolaroid.vue'
import LandingSampleBag from '~/components/landing/LandingSampleBag.vue'
import LandingSticker from '~/components/landing/LandingSticker.vue'
import DoodleArrow from '~/components/landing/doodles/DoodleArrow.vue'
import { LANDING_FALLBACK_VIBES, LANDING_SAMPLE_CAFES } from '~/data/landing-samples'

const phoneCafes = LANDING_SAMPLE_CAFES.filter((cafe) => cafe.wifi === true).slice(0, 3)
const heroVibe = LANDING_FALLBACK_VIBES[0]
</script>

<style scoped>
.landing-hero {
  padding-block: var(--space-lg) var(--space-2xl);
  scroll-margin-top: var(--landing-header-height);
  overflow-x: clip;
}

.landing-hero__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-xl);
  min-width: 0;
}

.landing-hero__copy { position: relative; min-width: 0; }

.landing-hero__eyebrow { margin: 0 0 var(--space-sm); }

.landing-hero__eyebrow-stamp {
  display: inline-block;
  padding: 4px 10px;
  border: 1.5px solid var(--color-focus);
  border-radius: 8px;
  color: var(--color-focus);
  font-size: var(--text-sm);
  font-weight: 700;
  rotate: -2deg;
}

.landing-hero__copy .lead { margin-top: var(--space-md); }

.landing-hero__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.landing-hero__sign-in {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--color-focus);
  font-size: var(--text-title);
  font-weight: 700;
  line-height: 1.3;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  white-space: nowrap;
}

.landing-hero__sign-in:hover { color: var(--color-ink); }

.landing-hero__sign-in:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
}

.landing-hero__arrow { display: none; width: 96px; margin-top: var(--space-md); margin-left: 40%; }

/* Stage: phone in the middle, stickers slapped around it, kept inside the column. */
.landing-hero__stage {
  position: relative;
  display: grid;
  justify-items: center;
  min-width: 0;
  padding: 28px 8px 12px;
}

.landing-hero__phone { width: min(260px, 72vw); }

.landing-hero__decor { position: absolute; inset: 0; pointer-events: none; }

.hero-sticker { position: absolute; }
.hero-sticker--wifi { top: 8%; left: 0; }
.hero-sticker--plugs { top: 30%; right: 0; }
.hero-sticker--vibe { bottom: 22%; left: 0; }
.hero-sticker--cup { bottom: 0; right: 0; width: 104px; }

.mini-home { display: flex; flex-direction: column; gap: 7px; min-width: 0; }

.mini-home__top { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.mini-home__hello { font-size: 0.7rem; font-weight: 700; }
.mini-home__mark { width: 60px; height: 13px; object-fit: contain; }

.mini-home__search {
  padding: 4px 0 5px;
  border-bottom: 1px solid var(--color-rule);
  color: var(--color-muted);
  font-size: 0.65rem;
  font-weight: 700;
}

.mini-home__chips { display: flex; gap: 4px; }

.mini-home__chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 7px;
  border: 1px solid color-mix(in srgb, var(--color-ink) 22%, transparent);
  border-radius: 8px;
  font-size: 0.6rem;
  white-space: nowrap;
}

.mini-home__chip.is-on {
  border-color: var(--color-accent);
  background: var(--color-accent);
  font-weight: 700;
}

@media (min-width: 600px) {
  .landing-hero__phone { width: 280px; }
  .hero-sticker--wifi { left: 8%; }
  .hero-sticker--plugs { right: 8%; }
  .hero-sticker--vibe { left: 6%; }
  .hero-sticker--cup { right: 6%; width: 132px; }
}

@media (min-width: 840px) {
  .landing-hero {
    padding-block: var(--space-2xl) var(--space-3xl);
  }

  .landing-hero__grid {
    grid-template-columns: minmax(0, 6fr) minmax(0, 6fr);
    align-items: center;
    column-gap: var(--space-2xl);
  }

  .landing-hero__arrow { display: block; }

  .landing-hero__phone { width: 300px; }
  .hero-sticker--wifi { left: 0; }
  .hero-sticker--plugs { right: 0; }
  .hero-sticker--vibe { left: 2%; }
  .hero-sticker--cup { right: 2%; width: 148px; }
}

@media (prefers-reduced-motion: reduce) {
  .landing-hero__eyebrow-stamp { rotate: 0deg; }
}
</style>
