<template>
  <button
    type="button"
    class="vibe-sticker"
    :class="{ 'is-on': pressed, 'is-popping': popping }"
    :style="stickerStyle"
    :aria-pressed="pressed"
  >
    <span class="vibe-sticker__bubble" aria-hidden="true">
      <component :is="iconComponent" :size="20" :stroke-width="2.25" />
    </span>
    <span class="vibe-sticker__label">{{ label }}</span>
    <span class="vibe-sticker__check" aria-hidden="true">
      <Check :size="13" :stroke-width="3" />
    </span>
  </button>
</template>

<script lang="ts" setup>
import { Check } from 'lucide-vue-next'
import { normalizeVibeTagColor, vibeTagLucideComponent } from '~/utils/admin-vibe-tags'
import { vibeStickerColors } from '~/utils/vibe-contrast'

/**
 * Tilted vibe sticker toggle. Shared by the "What's your vibe?" modal and the
 * landing vibe spotlight. Click / animationend listeners fall through to the button.
 */
const props = withDefaults(defineProps<{
  label: string
  lucideIcon?: string | null
  color?: string | null
  /** Grid position: picks the tilt and the entrance stagger. */
  index?: number
  pressed?: boolean
  popping?: boolean
}>(), {
  lucideIcon: null,
  color: null,
  index: 0,
  pressed: false,
  popping: false,
})

// Sticker tilts cycle so neighbours never lean the same way in the 2- or 3-column grid.
const TILTS = ['-1.6deg', '1.2deg', '-0.6deg', '1.8deg', '-1.1deg', '0.8deg']

const iconComponent = computed(() => vibeTagLucideComponent(props.lucideIcon))

const stickerStyle = computed(() => {
  const vibe = normalizeVibeTagColor(props.color)
  const { fill, on } = vibeStickerColors(vibe)
  return {
    '--vibe-color': vibe,
    '--vibe-fill': fill,
    '--vibe-on': on,
    '--tilt': TILTS[props.index % TILTS.length],
    '--i': String(Math.min(props.index, 14)),
  }
})
</script>

<style scoped>
.vibe-sticker {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 64px;
  padding: 10px 12px;
  border: 1.5px solid color-mix(in srgb, var(--vibe-color) 70%, var(--kd-ink));
  border-bottom-width: 3.5px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--vibe-color) 12%, var(--kd-stock));
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.15;
  text-align: left;
  rotate: var(--tilt, -1deg);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  animation: vibe-stick 420ms cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  animation-delay: calc(80ms + var(--i, 0) * 32ms);
  transition:
    rotate 220ms cubic-bezier(0.34, 1.56, 0.64, 1),
    scale 220ms cubic-bezier(0.34, 1.56, 0.64, 1),
    background-color 180ms ease-out,
    border-color 180ms ease-out,
    color 180ms ease-out,
    box-shadow 120ms ease-out;
}

.vibe-sticker__bubble {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--vibe-fill);
  color: var(--vibe-on);
  transition: background-color 180ms ease-out, color 180ms ease-out;
}

.vibe-sticker__label {
  min-width: 0;
  overflow-wrap: anywhere;
}

.vibe-sticker__check {
  position: absolute;
  top: -8px;
  right: -6px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 2px solid var(--kd-stock);
  border-radius: 8px;
  background: var(--kd-ink);
  color: var(--kd-stock);
  opacity: 0;
  scale: 0.4;
  rotate: -20deg;
  transition:
    opacity 140ms ease-out,
    scale 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
    rotate 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@media (hover: hover) and (pointer: fine) {
  .vibe-sticker:hover {
    rotate: 0deg;
    scale: 1.04;
    border-color: color-mix(in srgb, var(--vibe-color) 55%, var(--kd-ink));
  }
}

.vibe-sticker:active {
  rotate: 0deg;
  scale: 0.96;
  box-shadow: inset 0 2px 0 color-mix(in srgb, var(--kd-ink) 18%, transparent);
}

/* Selected: the sticker fills with its vibe color (contrast-safe pair from vibeStickerColors). */
.vibe-sticker.is-on {
  rotate: 0deg;
  border-color: color-mix(in srgb, var(--vibe-fill) 65%, var(--kd-ink));
  background: var(--vibe-fill);
  color: var(--vibe-on);
}

.vibe-sticker.is-on .vibe-sticker__bubble {
  background: color-mix(in srgb, var(--vibe-on) 16%, transparent);
  color: var(--vibe-on);
}

.vibe-sticker.is-on .vibe-sticker__check {
  opacity: 1;
  scale: 1;
  rotate: 0deg;
}

/* Keep vibe-stick in the list so toggling the class never replays the entrance. */
.vibe-sticker.is-popping {
  animation:
    vibe-stick 420ms cubic-bezier(0.34, 1.56, 0.64, 1) backwards,
    vibe-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
  animation-delay: calc(80ms + var(--i, 0) * 32ms), 0ms;
}

.vibe-sticker:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 3px;
}

@keyframes vibe-stick {
  from {
    opacity: 0;
    translate: 0 10px;
    scale: 0.88;
  }
}

@keyframes vibe-pop {
  0% { scale: 0.94; }
  45% { scale: 1.08; }
  75% { scale: 0.98; }
  100% { scale: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .vibe-sticker,
  .vibe-sticker:hover,
  .vibe-sticker:active,
  .vibe-sticker.is-on,
  .vibe-sticker.is-popping {
    rotate: 0deg;
    scale: 1;
    animation: none;
    transition: background-color 120ms linear, border-color 120ms linear, color 120ms linear;
  }

  .vibe-sticker__check {
    scale: 1;
    rotate: 0deg;
    transition: opacity 120ms linear;
  }
}
</style>
