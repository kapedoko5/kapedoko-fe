<template>
  <NuxtLink
    :to="to"
    class="landing-open"
    :class="{ 'landing-open--block': block }"
  >
    <slot>Open the app</slot>
  </NuxtLink>
</template>

<script lang="ts" setup>
withDefaults(defineProps<{
  to?: string
  block?: boolean
}>(), {
  to: '/app',
  block: false,
})
</script>

<style scoped>
.landing-open {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 var(--space-md);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-card);
  background: var(--color-accent);
  color: var(--color-accent-ink);
  font-family: var(--font-body);
  font-size: var(--text-title);
  font-weight: 700;
  line-height: 1.2;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform var(--dur-micro) var(--ease-out),
    box-shadow var(--dur-short) var(--ease-out);
}

.landing-open--block {
  width: 100%;
}

@media (hover: hover) and (pointer: fine) {
  .landing-open:hover {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-ink) 18%, transparent);
  }
}

.landing-open:active {
  transform: scale(0.98);
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--color-ink) 22%, transparent);
}

.landing-open:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

.landing-open[aria-disabled='true'],
.landing-open:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
  pointer-events: none;
}

.landing-open[aria-busy='true'] {
  cursor: progress;
}

:root.is-android .landing-open {
  min-height: 48px;
}

@media (prefers-reduced-motion: reduce) {
  .landing-open {
    transition: none;
  }

  .landing-open:active {
    transform: none;
  }
}
</style>
