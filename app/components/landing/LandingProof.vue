<template>
  <section id="how-it-works" class="landing-proof" aria-labelledby="landing-proof-title">
    <div class="landing-container">
      <h2 id="landing-proof-title">Atmosphere is not the job</h2>

      <div class="proof-switch" role="radiogroup" aria-labelledby="landing-proof-title">
        <input id="proof-search" type="radio" name="landing-proof" value="search">
        <input id="proof-stamps" type="radio" name="landing-proof" value="stamps">
        <input id="proof-hours" type="radio" name="landing-proof" value="hours" checked>
        <input id="proof-map" type="radio" name="landing-proof" value="map">
        <input id="proof-save" type="radio" name="landing-proof" value="save">

        <div class="proof-switch__tabs">
          <label for="proof-search">Search</label>
          <label for="proof-stamps">Stamps</label>
          <label for="proof-hours">Hours</label>
          <label for="proof-map">Map</label>
          <label for="proof-save">Save</label>
        </div>

        <article class="proof-panel proof-panel--search">
          <div class="proof-ui proof-search" aria-hidden="true">
            <Search :size="22" :stroke-width="2.25" />
            <span>Search a shop</span>
          </div>
          <p>Search nearby or by name. Guests browse without an account.</p>
        </article>

        <article class="proof-panel proof-panel--stamps">
          <div class="proof-ui proof-chips" aria-hidden="true">
            <span class="proof-chip is-on">Near You</span>
            <span class="proof-chip">Popular</span>
            <span class="proof-chip">WiFi</span>
            <span class="proof-chip">Plugs</span>
          </div>
          <p>Near You, Popular, WiFi, or Plugs. One stamp at a time.</p>
        </article>

        <article class="proof-panel proof-panel--hours">
          <div class="proof-ui proof-closed" aria-hidden="true">
            <span class="proof-closed__name">Hours in words</span>
            <span class="proof-closed__flag">Closed</span>
          </div>
          <p>Open or closed stays a line of type, not a color-only badge.</p>
        </article>

        <article class="proof-panel proof-panel--map">
          <div class="proof-ui proof-map" aria-hidden="true">
            <img
              src="/assets/bean-pin.png"
              alt=""
              width="28"
              height="36"
            />
            <span>Map pin</span>
          </div>
          <p>Map the exact shop. Teal pins mark live events nearby.</p>
        </article>

        <article class="proof-panel proof-panel--save">
          <div class="proof-ui proof-save" aria-hidden="true">
            <span class="proof-save__spine">
              <Heart :size="20" :stroke-width="2" />
            </span>
            <span>Save</span>
          </div>
          <p>Save on this device. Sign in later for every device.</p>
        </article>
      </div>

      <p class="landing-proof__note">
        WiFi and outlets print after enough reviews. Until then they stay unconfirmed.
        Operate a listed shop?
        <NuxtLink to="/login?redirect=/app">Claim it after you sign in</NuxtLink>.
      </p>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { Heart, Search } from 'lucide-vue-next'
</script>

<style scoped>
.landing-proof {
  padding-block: var(--section-gap-s);
  scroll-margin-top: var(--landing-header-height);
}

.proof-switch {
  position: relative;
  display: grid;
  gap: var(--space-lg);
  margin-top: var(--space-xl);
}

.proof-switch > input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}

.proof-switch__tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-xs);
}

.proof-switch__tabs label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 var(--space-sm);
  border: 1px solid color-mix(in srgb, var(--color-ink) 22%, transparent);
  border-radius: var(--radius-card);
  color: var(--color-ink);
  font-size: var(--text-sm);
  cursor: pointer;
}

#proof-search:checked ~ .proof-switch__tabs label[for='proof-search'],
#proof-stamps:checked ~ .proof-switch__tabs label[for='proof-stamps'],
#proof-hours:checked ~ .proof-switch__tabs label[for='proof-hours'],
#proof-map:checked ~ .proof-switch__tabs label[for='proof-map'],
#proof-save:checked ~ .proof-switch__tabs label[for='proof-save'] {
  background: var(--color-accent);
  border-color: var(--color-accent);
  font-weight: 700;
}

.proof-switch__tabs label:hover {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-ink) 18%, transparent);
}

.proof-switch > input:focus-visible + .proof-switch__tabs label,
#proof-search:focus-visible ~ .proof-switch__tabs label[for='proof-search'],
#proof-stamps:focus-visible ~ .proof-switch__tabs label[for='proof-stamps'],
#proof-hours:focus-visible ~ .proof-switch__tabs label[for='proof-hours'],
#proof-map:focus-visible ~ .proof-switch__tabs label[for='proof-map'],
#proof-save:focus-visible ~ .proof-switch__tabs label[for='proof-save'] {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.proof-panel {
  display: none;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-items: stretch;
  gap: var(--space-lg);
  padding: var(--space-xl);
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-card);
  background: var(--color-paper-2);
}

.proof-panel p {
  max-width: 36rem;
  font-size: var(--text-title);
  line-height: 1.4;
}

#proof-search:checked ~ .proof-panel--search,
#proof-stamps:checked ~ .proof-panel--stamps,
#proof-hours:checked ~ .proof-panel--hours,
#proof-map:checked ~ .proof-panel--map,
#proof-save:checked ~ .proof-panel--save {
  display: grid;
}

.proof-ui {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
  width: 100%;
  color: var(--color-ink);
}

.proof-search {
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--color-rule);
  color: var(--color-ink-2);
  font-size: var(--text-xl);
  font-weight: 700;
  letter-spacing: var(--tracking-display);
  white-space: nowrap;
}

.proof-search :deep(svg) {
  color: var(--color-ink);
  flex: 0 0 auto;
  width: 1.25em;
  height: 1.25em;
}

.proof-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.proof-chip {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--space-md);
  border: 1px solid color-mix(in srgb, var(--color-ink) 22%, transparent);
  border-radius: var(--radius-card);
  font-size: var(--text-md);
}

.proof-chip.is-on {
  background: var(--color-accent);
  border-color: var(--color-accent);
  font-weight: 700;
}

.proof-closed {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2xs);
}

.proof-closed__name {
  font-size: var(--text-display-s);
  font-weight: 700;
  letter-spacing: var(--tracking-display);
  overflow-wrap: break-word;
  min-width: 0;
}

.proof-closed__flag {
  color: var(--color-error);
  font-size: var(--text-xl);
  font-weight: 700;
}

.proof-map img {
  display: block;
  width: 84px;
  height: 108px;
  object-fit: contain;
}

.proof-map span,
.proof-save span:last-child {
  font-size: var(--text-xl);
  font-weight: 700;
  letter-spacing: var(--tracking-display);
}

.proof-save__spine {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 72px;
  background: var(--color-accent);
  color: var(--color-accent-ink);
}

.proof-save__spine :deep(svg) {
  width: 28px;
  height: 28px;
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
  .proof-switch__tabs {
    display: flex;
    flex-wrap: wrap;
    grid-template-columns: none;
  }

  .proof-switch__tabs label {
    justify-content: center;
    min-width: 5.5rem;
  }

  .proof-panel {
    padding: var(--space-2xl);
  }

  .proof-search {
    font-size: var(--text-3xl);
  }
}

@media (prefers-reduced-motion: reduce) {
  .proof-switch__tabs label {
    transition: none;
  }
}
</style>
