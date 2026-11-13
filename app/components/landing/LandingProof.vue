<template>
  <section id="how-it-works" class="landing-proof" aria-labelledby="landing-proof-title">
    <div class="landing-container">
      <h2 id="landing-proof-title">A drink is a bad way to find there is no socket.</h2>
      <p class="landing-proof__rule">
        WiFi and outlets stay unconfirmed until enough reviews.
      </p>

      <article class="path-bag">
        <div class="path-bag__mast">
          <p class="path-bag__name">How it works</p>
        </div>
        <div class="path-bag__lines">
          <p class="path-bag__line">
            <Search :size="18" :stroke-width="2.25" aria-hidden="true" />
            <span>Search a shop by name, or look nearby.</span>
          </p>
          <p class="path-bag__line">
            <Tag :size="18" :stroke-width="2.25" aria-hidden="true" />
            <span>One stamp at a time: Near You, Popular, WiFi, or Plugs. Fast WiFi, Long-stay WiFi, and Reliable outlets sit on those same stamps.</span>
          </p>
          <p class="path-bag__line">
            <Clock :size="18" :stroke-width="2.25" aria-hidden="true" />
            <span>A shut shop still prints Closed under the name.</span>
          </p>
          <p class="path-bag__line">
            <MapPin :size="18" :stroke-width="2.25" aria-hidden="true" />
            <span>The pin is that shop. A gathering within 5 km is a separate teal pin.</span>
          </p>
        </div>
      </article>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { Clock, MapPin, Search, Tag } from 'lucide-vue-next'
</script>

<style scoped>
.landing-proof {
  padding-block: var(--space-3xl) var(--space-2xl);
  scroll-margin-top: var(--landing-header-height);
}

.landing-proof h2 {
  margin-bottom: var(--space-md);
  max-width: 18ch;
}

.landing-proof__rule {
  max-width: 36rem;
  margin-bottom: var(--space-xl);
  color: var(--color-ink);
  font-size: var(--text-lead);
  line-height: 1.4;
}

.path-bag {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
  padding: var(--space-xl) var(--space-xl) var(--space-lg);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-ink) 34%, transparent);
  border-radius: var(--radius-card);
  background: var(--color-paper-2);
  color: var(--color-ink);
}

.path-bag__mast {
  min-width: 0;
}

.path-bag__name {
  margin: 0;
  font-size: var(--text-3xl);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: var(--tracking-display);
  overflow-wrap: break-word;
}

.path-bag__lines {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  margin: 0;
  padding-top: var(--space-lg);
  border-top: 1px solid var(--color-rule-2);
}

.path-bag__line {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  margin: 0;
  max-width: 42rem;
  font-size: var(--text-md);
  line-height: 1.45;
}

.path-bag__line :deep(svg) {
  color: var(--color-accent);
  width: 1.15em;
  height: 1.15em;
  margin-top: 0.2em;
  flex-shrink: 0;
}

@media (min-width: 840px) {
  .landing-proof {
    padding-block: var(--space-3xl);
  }

  .landing-proof h2 {
    margin-bottom: var(--space-lg);
  }

  .landing-proof__rule {
    margin-bottom: var(--space-2xl);
  }

  .path-bag {
    padding: var(--space-2xl) var(--space-2xl) var(--space-xl);
  }

  .path-bag__line {
    font-size: var(--text-lg);
    line-height: 1.4;
  }
}
</style>
