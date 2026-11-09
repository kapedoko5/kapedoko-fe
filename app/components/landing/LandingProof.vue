<template>
  <section id="how-it-works" class="landing-proof" aria-labelledby="landing-proof-title">
    <div class="landing-container">
      <h2 id="landing-proof-title">Atmosphere is not the job</h2>

      <div class="proof-sheet">
        <article class="proof-row">
          <div class="proof-ui proof-search" aria-hidden="true">
            <Search :size="20" :stroke-width="2.25" />
            <span>Search a shop</span>
          </div>
          <p>Guests browse nearby or by name.</p>
        </article>

        <article class="proof-row">
          <div class="proof-ui proof-chips" aria-hidden="true">
            <span class="proof-chip is-on">
              <Navigation :size="14" :stroke-width="2.25" />
              Near You
            </span>
            <span class="proof-chip">
              <Flame :size="14" :stroke-width="2.25" />
              Popular
            </span>
            <span class="proof-chip">
              <Wifi :size="14" :stroke-width="2.25" />
              WiFi
            </span>
            <span class="proof-chip">
              <Plug :size="14" :stroke-width="2.25" />
              Plugs
            </span>
          </div>
          <p>One stamp at a time.</p>
        </article>

        <article class="proof-row proof-row--closed">
          <div class="proof-ui proof-closed" aria-hidden="true">
            <span class="proof-closed__name">On each cafe</span>
            <span class="proof-closed__origin">Philippines</span>
            <span class="proof-closed__flag">Closed</span>
          </div>
          <p>A shut shop still prints Closed under the name.</p>
        </article>

        <article class="proof-row">
          <div class="proof-ui proof-map" aria-hidden="true">
            <img
              src="/assets/bean-pin.png"
              alt=""
              width="64"
              height="82"
            />
          </div>
          <p>The pin is the exact shop.</p>
        </article>

        <article class="proof-row">
          <div class="proof-ui proof-event" aria-hidden="true">
            <svg class="proof-event__pin" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="16.2" fill="var(--color-focus)" stroke="var(--color-paper-2)" stroke-width="3.2" paint-order="stroke fill" />
              <rect x="12.2" y="13.4" width="15.6" height="14.2" rx="2.2" stroke="var(--color-paper-2)" stroke-width="2.1" />
              <path d="M12.2 18.2h15.6" stroke="var(--color-paper-2)" stroke-width="2.1" />
              <path d="M16.2 11.2v4.2M23.8 11.2v4.2" stroke="var(--color-paper-2)" stroke-width="2.1" stroke-linecap="round" />
            </svg>
          </div>
          <p>Teal pins. Home shows one within 5 km.</p>
        </article>

        <article class="proof-row proof-row--save">
          <div class="proof-ui proof-save" aria-hidden="true">
            <span class="proof-save__spine">
              <Heart :size="18" :stroke-width="2" fill="currentColor" />
            </span>
          </div>
          <p>On this device, then every device after sign in.</p>
        </article>

        <article class="proof-row">
          <div class="proof-ui proof-add" aria-hidden="true">
            <span class="proof-add__stamp">Add a cafe</span>
          </div>
          <p>Admins approve a Philippine shop before it lists.</p>
        </article>
      </div>

      <p class="landing-proof__note">
        WiFi and outlets stay unconfirmed until enough reviews.
        <NuxtLink to="/login?redirect=/app">Claim a listed shop after you sign in</NuxtLink>.
      </p>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { Flame, Heart, Navigation, Plug, Search, Wifi } from 'lucide-vue-next'
</script>

<style scoped>
.landing-proof {
  padding-block: var(--space-3xl) var(--space-2xl);
  scroll-margin-top: var(--landing-header-height);
}

.landing-proof h2 {
  margin-bottom: var(--space-xl);
}

.proof-sheet {
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-ink) 28%, transparent);
  border-radius: var(--radius-card);
  background: var(--color-paper-2);
}

.proof-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-sm);
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-rule-2);
}

.proof-row:last-child {
  border-bottom: 0;
}

.proof-row--closed,
.proof-row--save {
  padding-block: var(--space-xl);
}

.proof-row p {
  margin: 0;
  max-width: 28rem;
  color: var(--color-ink);
  font-size: var(--text-sm);
  line-height: 1.4;
}

.proof-ui {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
  pointer-events: none;
  color: var(--color-ink);
}

.proof-search {
  width: 100%;
  min-height: 46px;
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid color-mix(in srgb, var(--color-ink) 22%, transparent);
  color: var(--color-ink);
  font-size: var(--text-title);
  font-weight: 700;
  letter-spacing: var(--tracking-display);
}

.proof-search :deep(svg) {
  flex: 0 0 auto;
  color: var(--color-ink);
}

.proof-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.proof-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  min-height: 44px;
  padding: 0 var(--space-sm);
  border: 1px solid color-mix(in srgb, var(--color-ink) 22%, transparent);
  border-radius: var(--radius-card);
  background: transparent;
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: 400;
}

.proof-chip.is-on {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-ink);
  font-weight: 700;
}

.proof-closed {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2xs);
}

.proof-closed__name {
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: var(--tracking-display);
  overflow-wrap: break-word;
  min-width: 0;
}

.proof-closed__origin {
  color: var(--color-ink);
  font-size: var(--text-sm);
  line-height: 1.2;
}

.proof-closed__flag {
  color: var(--color-error);
  font-size: var(--text-lg);
  font-weight: 700;
}

.proof-map,
.proof-event {
  min-height: 5.5rem;
}

.proof-map img,
.proof-event__pin {
  display: block;
  width: 64px;
  height: 82px;
  object-fit: contain;
  flex-shrink: 0;
}

.proof-event__pin {
  width: 64px;
  height: 64px;
}

.proof-row--save {
  align-items: stretch;
}

.proof-save {
  justify-content: flex-end;
  width: min(12rem, 100%);
  min-height: 7.5rem;
}

.proof-save__spine {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  width: 28px;
  align-self: stretch;
  min-height: 7.5rem;
  padding-top: var(--space-sm);
  background: var(--color-accent);
  color: var(--color-accent-ink);
  flex-shrink: 0;
}

.proof-add__stamp {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--space-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-card);
  background: var(--color-accent);
  color: var(--color-accent-ink);
  font-size: var(--text-title);
  font-weight: 700;
}

.landing-proof__note {
  margin-top: var(--space-lg);
  max-width: 42rem;
  color: var(--color-ink);
  font-size: var(--text-sm);
  line-height: 1.5;
}

.landing-proof__note a {
  color: var(--color-focus);
  font-weight: 700;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.landing-proof__note a:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
}

@media (min-width: 840px) {
  .landing-proof {
    padding-block: var(--space-3xl);
  }

  .landing-proof h2 {
    margin-bottom: var(--space-2xl);
  }

  .proof-row {
    grid-template-columns: minmax(20rem, 28rem) minmax(0, 1fr);
    align-items: center;
    column-gap: var(--space-2xl);
    padding-inline: var(--space-2xl);
    padding-block: var(--space-lg);
  }

  .proof-row--closed,
  .proof-row--save {
    padding-block: var(--space-xl);
  }

  .proof-row p {
    font-size: var(--text-sm);
    line-height: 1.45;
  }

  .proof-search {
    font-size: var(--text-xl);
  }

  .proof-closed__name {
    font-size: var(--text-3xl);
  }

  .proof-closed__flag {
    font-size: var(--text-xl);
  }

  .proof-row--save {
    align-items: stretch;
  }
}
</style>
