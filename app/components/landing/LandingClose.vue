<template>
  <section class="landing-place" aria-labelledby="landing-place-title">
    <div class="landing-container">
      <h2 id="landing-place-title">Public submissions cover the Philippines</h2>
      <p class="lead">Pins outside the country stay blocked.</p>
    </div>
  </section>

  <section class="landing-close" aria-labelledby="landing-close-title">
    <div class="landing-container">
      <div class="landing-close__panel">
        <h2 id="landing-close-title">Open the cafe shelf</h2>
        <p class="lead">
          No account needed to browse. Sign in later for saves on every device.
        </p>
        <div class="landing-close__actions">
          <LandingOpen block />
          <NuxtLink class="landing-close__secondary" to="/register?redirect=/app">
            Create an account
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>

  <footer class="landing-close__foot">
    <div class="landing-container">
      <NuxtLink to="/privacy">Privacy</NuxtLink>
      <NuxtLink to="/login?redirect=/app">Sign in</NuxtLink>
    </div>
  </footer>
</template>

<script lang="ts" setup>
import LandingOpen from '~/components/landing/LandingOpen.vue'
</script>

<style scoped>
.landing-place {
  padding-block: var(--space-2xl) var(--space-xl);
}

.landing-place .landing-container {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-md);
}

.landing-place h2 {
  max-width: 18ch;
  font-size: var(--text-display);
  line-height: 1.02;
  overflow-wrap: break-word;
  min-width: 0;
  text-wrap: balance;
}

.landing-place .lead {
  margin: 0;
  font-size: var(--text-lg);
}

.landing-close {
  padding-block: var(--space-xl) var(--space-2xl);
}

.landing-close__panel {
  padding: var(--space-xl);
  border: 1px solid color-mix(in srgb, var(--color-ink) 34%, transparent);
  border-radius: var(--radius-card);
  background: var(--color-paper-2);
}

.landing-close__panel h2 {
  max-width: 22ch;
}

.landing-close__panel .lead {
  margin-top: var(--space-sm);
}

.landing-close__actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-md);
  margin-top: var(--space-lg);
  max-width: 22rem;
}

.landing-close__secondary {
  color: var(--color-focus);
  font-size: var(--text-title);
  font-weight: 700;
  line-height: 1.3;
  text-align: center;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.landing-close__secondary:hover,
.landing-close__foot a:hover {
  color: var(--color-ink);
}

.landing-close__secondary:focus-visible,
.landing-close__foot a:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
}

.landing-close__foot {
  padding-block: var(--space-lg) calc(var(--space-xl) + env(safe-area-inset-bottom));
}

.landing-close__foot .landing-container {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}

.landing-close__foot a {
  color: var(--color-focus);
  font-size: var(--text-sm);
  font-weight: 700;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

@media (min-width: 840px) {
  .landing-place {
    padding-block: var(--space-3xl) var(--space-2xl);
  }

  .landing-place .landing-container {
    grid-template-columns: minmax(0, 8fr) minmax(0, 4fr);
    align-items: end;
    column-gap: var(--gap-columns);
  }

  .landing-close {
    padding-block: var(--space-2xl);
  }

  .landing-close__panel {
    padding: var(--space-2xl) var(--space-2xl) var(--space-xl);
  }

  .landing-close__actions {
    flex-direction: row;
    align-items: center;
    max-width: none;
  }

  .landing-close__actions :deep(.landing-open) {
    width: auto;
  }
}
</style>
