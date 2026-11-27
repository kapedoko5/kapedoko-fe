<template>
  <section
    ref="root"
    class="landing-close landing-reveal"
    :class="{ 'is-revealed': revealed }"
    aria-labelledby="landing-close-title"
  >
    <div class="landing-container">
      <div class="landing-close__panel">
        <div class="landing-close__cup" aria-hidden="true">
          <DoodleCup />
        </div>
        <h2 id="landing-close-title">Your next good seat is one tap away.</h2>
        <p class="lead">
          No account needed to browse. Sign in later to keep saves on every device.
        </p>
        <div class="landing-close__actions">
          <NuxtLink class="landing-close__open" to="/app">Open the app</NuxtLink>
          <NuxtLink class="landing-close__secondary" to="/register?redirect=/app">
            Create an account
          </NuxtLink>
        </div>
        <span class="landing-close__stamp" aria-hidden="true">No account to browse</span>
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
import DoodleCup from '~/components/landing/doodles/DoodleCup.vue'

const root = ref<HTMLElement | null>(null)
const { revealed } = useRevealOnScroll(root)
</script>

<style scoped>
.landing-close {
  padding-block: var(--space-xl) var(--space-2xl);
}

/* The big orange stamp: ink text on orange (≈5.6:1), ink border, flat. */
.landing-close__panel {
  position: relative;
  padding: var(--space-xl) var(--space-lg) var(--space-lg);
  overflow: hidden;
  border: 2px solid var(--color-ink);
  border-radius: var(--radius-card);
  background: var(--color-accent);
  color: var(--color-accent-ink);
}

.landing-close__panel::before {
  content: '';
  position: absolute;
  inset: 8px;
  border: 1.5px dashed color-mix(in srgb, var(--color-ink) 45%, transparent);
  border-radius: 10px;
  pointer-events: none;
}

.landing-close__panel h2 {
  position: relative;
  max-width: 14ch;
  color: var(--color-accent-ink);
  font-size: var(--text-display);
  line-height: 1.02;
}

.landing-close__panel .lead { position: relative; margin-top: var(--space-sm); }

.landing-close__cup { position: absolute; top: 16px; right: 16px; width: 56px; rotate: 10deg; }

.landing-close__actions {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-md);
  margin-top: var(--space-lg);
  max-width: 22rem;
}

.landing .landing-close__open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 var(--space-lg);
  border: 2px solid var(--color-ink);
  border-radius: var(--radius-card);
  background: var(--color-ink);
  color: var(--color-paper-2);
  font-size: var(--text-title);
  font-weight: 700;
  text-decoration: none;
  transition: transform var(--dur-micro) var(--ease-out);
}

.landing .landing-close__secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  color: var(--color-accent-ink);
  font-size: var(--text-title);
  font-weight: 700;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

@media (hover: hover) and (pointer: fine) {
  .landing .landing-close__open:hover { rotate: -1.5deg; }
}

.landing .landing-close__open:active { transform: scale(0.98); }

.landing .landing-close__open:focus-visible,
.landing .landing-close__secondary:focus-visible {
  outline: 2px solid var(--color-ink);
  outline-offset: 3px;
}

.landing-close__stamp {
  position: relative;
  display: inline-block;
  margin-top: var(--space-lg);
  padding: 4px 10px;
  border: 1.5px solid var(--color-ink);
  border-radius: 8px;
  font-size: var(--text-sm);
  font-weight: 700;
  rotate: -4deg;
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
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--color-focus);
  font-size: var(--text-sm);
  font-weight: 700;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.landing-close__foot a:hover { color: var(--color-ink); }

.landing-close__foot a:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
}

@media (min-width: 840px) {
  .landing-close { padding-block: var(--space-2xl) var(--space-3xl); }
  .landing-close__panel { padding: var(--space-2xl) var(--space-2xl) var(--space-xl); }
  .landing-close__cup { top: 32px; right: 48px; width: 112px; }
  .landing-close__actions { flex-direction: row; align-items: center; max-width: none; }
}

@media (prefers-reduced-motion: reduce) {
  .landing-close__cup,
  .landing-close__stamp,
  .landing .landing-close__open:hover { rotate: 0deg; }
  .landing .landing-close__open:active { transform: none; }
}
</style>
