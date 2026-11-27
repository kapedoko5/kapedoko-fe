<template>
  <span
    class="bag__mark-stamp"
    :class="{ 'is-soft': soft, 'is-no': unavailable }"
    :data-stamp="stamp"
    :style="{ '--tilt': tilt }"
    :aria-label="aria"
  >
    <span class="bag__mark-noun">
      <component :is="icon" :size="15" :stroke-width="2.25" aria-hidden="true" />
      {{ noun }}
    </span>
    <span v-if="words" class="bag__mark-word">{{ words }}</span>
  </span>
</template>

<script lang="ts" setup>
import type { Component } from 'vue'

/**
 * Tilted amenity stamp printed on a bag label (WiFi / Outlets / Seats / Pay).
 * Shared by CafeCard on Home and the landing sample bags.
 */
withDefaults(defineProps<{
  noun: string
  icon: Component
  words?: string
  /** amenity stamp kind: team | owner | community | recheck | unknown … */
  stamp?: string
  soft?: boolean
  unavailable?: boolean
  tilt?: string
  aria?: string
}>(), {
  words: '',
  stamp: 'unknown',
  soft: false,
  unavailable: false,
  tilt: '-1.4deg',
  aria: undefined,
})
</script>

<style scoped>
.bag__mark-stamp {
  display: grid;
  flex: 0 0 auto;
  gap: 1px;
  min-width: 92px;
  padding: 8px 10px 7px;
  border: 1px solid color-mix(in srgb, #1c1917 34%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, #d9793b 16%, #faf8f5);
  color: #1c1917;
  transform: rotate(var(--tilt, -1.4deg));
  transform-origin: 30% 80%;
  scroll-snap-align: start;
}

.bag__mark-stamp[data-stamp='community'] {
  background: #faf8f5;
}

.bag__mark-stamp[data-stamp='recheck'],
.bag__mark-stamp.is-no {
  background: color-mix(in srgb, #8c3a2f 10%, #faf8f5);
  border-color: color-mix(in srgb, #8c3a2f 40%, transparent);
}

.bag__mark-stamp.is-soft {
  background: #faf8f5;
  border-style: dashed;
}

.bag__mark-noun {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.2;
}

.bag__mark-noun :deep(svg) {
  color: #d9793b;
}

.bag__mark-word {
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.03em;
  white-space: nowrap;
}

.bag__mark-stamp.is-soft .bag__mark-word {
  font-weight: 600;
  color: color-mix(in srgb, #1c1917 72%, #faf8f5);
}
</style>
