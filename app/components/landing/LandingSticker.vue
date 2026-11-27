<template>
  <component
    :is="tag"
    class="landing-sticker"
    :class="[`landing-sticker--${tone}`, { 'is-stuck': stuck }]"
    :style="{ '--tilt': tilt, '--delay': `${delay}ms` }"
  >
    <slot />
  </component>
</template>

<script lang="ts" setup>
/**
 * A die-cut sticker slapped onto the landing sheet. Springs in when `stuck`
 * turns true; reduced motion shows it flat and in place.
 */
withDefaults(defineProps<{
  tag?: string
  tone?: 'paper' | 'accent' | 'teal' | 'ink'
  tilt?: string
  delay?: number
  stuck?: boolean
}>(), {
  tag: 'span',
  tone: 'paper',
  tilt: '-4deg',
  delay: 0,
  stuck: true,
})
</script>

<style scoped>
.landing-sticker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px 6px;
  border: 1.5px solid var(--color-ink);
  border-radius: 12px;
  background: var(--color-paper-2);
  color: var(--color-ink);
  font-family: var(--font-body);
  font-size: var(--text-sm);
  font-weight: 700;
  line-height: 1.15;
  white-space: nowrap;
  rotate: var(--tilt);
  opacity: 0;
  scale: 1.35;
}

/* Peeled corner: a folded flap, printed flat (no shadow). */
.landing-sticker::after {
  content: '';
  position: absolute;
  right: -1.5px;
  bottom: -1.5px;
  width: 12px;
  height: 12px;
  border-top: 1.5px solid var(--color-ink);
  border-left: 1.5px solid var(--color-ink);
  border-top-left-radius: 4px;
  background: var(--color-paper);
}

.landing-sticker { position: relative; }

.landing-sticker--accent { background: var(--color-accent); color: var(--color-accent-ink); }
.landing-sticker--teal { background: var(--color-focus); color: #fff; }
.landing-sticker--ink { background: var(--color-ink); color: var(--color-paper-2); }

.landing-sticker :deep(svg) { flex-shrink: 0; }

.landing-sticker.is-stuck {
  opacity: 1;
  scale: 1;
  animation: landing-sticker-slap 520ms cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  animation-delay: var(--delay);
}

@keyframes landing-sticker-slap {
  0% { opacity: 0; scale: 1.35; rotate: calc(var(--tilt) * -2); }
  60% { opacity: 1; scale: 0.94; }
  100% { opacity: 1; scale: 1; rotate: var(--tilt); }
}

@media (prefers-reduced-motion: reduce) {
  .landing-sticker,
  .landing-sticker.is-stuck {
    opacity: 1;
    scale: 1;
    rotate: 0deg;
    animation: none;
  }
}
</style>
