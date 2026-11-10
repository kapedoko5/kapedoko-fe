<template>
  <header class="landing-header">
    <div class="landing-container landing-header__bar">
      <button type="button" class="landing-header__brand" @click="scrollTo('top')">
        <img
          src="/assets/kapedoko-horizontal-text_dark.png"
          alt="kapé DOKO"
          width="120"
          height="26"
          class="landing-header__wordmark"
        />
      </button>
      <nav class="landing-header__nav" aria-label="Landing">
        <button type="button" class="landing-header__link" @click="scrollTo('how-it-works')">
          How it works
        </button>
        <LandingOpen />
      </nav>
    </div>
  </header>
</template>

<script lang="ts" setup>
import LandingOpen from '~/components/landing/LandingOpen.vue'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const scrollTo = (id: string) => {
  const node = document.getElementById(id)
  node?.scrollIntoView({
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  })
}
</script>

<style scoped>
.landing-header {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky-nav);
  background: var(--color-paper);
  border-bottom: var(--rule-hair) solid var(--color-rule-2);
}

.landing-header__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  min-height: var(--landing-header-height);
  padding-block: max(var(--space-sm), env(safe-area-inset-top)) var(--space-sm);
}

.landing-header__brand {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.landing-header__wordmark {
  display: block;
  width: 120px;
  height: 26px;
  object-fit: contain;
  object-position: left center;
}

.landing-header__nav {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex: 0 0 auto;
}

.landing-header__link {
  display: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-focus);
  font-family: inherit;
  font-size: var(--text-title);
  font-weight: 700;
  line-height: 1.3;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  white-space: nowrap;
  cursor: pointer;
}

.landing-header__link:hover,
.landing-header__brand:hover {
  color: var(--color-ink);
}

.landing-header__link:active {
  transform: translateY(1px);
}

.landing-header__link:focus-visible,
.landing-header__brand:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
}

.landing-header__link:disabled,
.landing-header__brand:disabled,
.landing-header__link[aria-disabled='true'],
.landing-header__brand[aria-disabled='true'] {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

@media (min-width: 600px) {
  .landing-header__link {
    display: inline;
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-header__link:active {
    transform: none;
  }
}
</style>
