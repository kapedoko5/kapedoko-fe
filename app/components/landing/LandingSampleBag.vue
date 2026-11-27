<template>
  <article class="sample-bag" :class="{ 'sample-bag--mini': mini }">
    <div class="sample-bag__mast">
      <span class="sample-bag__logo" aria-hidden="true">
        <Coffee :size="mini ? 14 : 18" :stroke-width="2.25" />
      </span>
      <span class="sample-bag__copy">
        <span class="sample-bag__name">{{ cafe.name }}</span>
        <span class="sample-bag__origin">{{ cafe.origin }}</span>
      </span>
    </div>
    <div class="sample-bag__lines">
      <span class="sample-bag__hours">
        <Clock :size="mini ? 12 : 15" :stroke-width="2.25" aria-hidden="true" />
        <span>Hours</span>
        <strong>{{ cafe.hours }}</strong>
      </span>
      <span v-if="!mini" class="sample-bag__marks">
        <CafeAmenityStamp
          noun="WiFi"
          :icon="cafe.wifi === false ? WifiOff : Wifi"
          :words="amenityWord(cafe.wifi)"
          :stamp="cafe.wifi === true ? 'team' : 'unknown'"
          :soft="cafe.wifi === null"
          :unavailable="cafe.wifi === false"
          tilt="-1.4deg"
          :aria="`WiFi, ${amenityWord(cafe.wifi)}`"
        />
        <CafeAmenityStamp
          noun="Outlets"
          :icon="cafe.plug === false ? Unplug : Plug"
          :words="amenityWord(cafe.plug)"
          :stamp="cafe.plug === true ? 'team' : 'unknown'"
          :soft="cafe.plug === null"
          :unavailable="cafe.plug === false"
          tilt="1.6deg"
          :aria="`Outlets, ${amenityWord(cafe.plug)}`"
        />
      </span>
      <span v-else class="sample-bag__mini-marks">
        <span :class="{ 'is-yes': cafe.wifi === true }"><Wifi :size="11" :stroke-width="2.5" aria-hidden="true" /> {{ amenityWord(cafe.wifi) }}</span>
        <span :class="{ 'is-yes': cafe.plug === true }"><Plug :size="11" :stroke-width="2.5" aria-hidden="true" /> {{ amenityWord(cafe.plug) }}</span>
      </span>
      <Transition name="sample-vibe" mode="out-in">
        <span
          v-if="vibe"
          :key="vibe.label"
          class="sample-bag__vibe"
          :style="vibeTagColorStyle(vibe.color)"
        >
          <component :is="vibeTagLucideComponent(vibe.lucideIcon)" :size="13" :stroke-width="2.25" aria-hidden="true" />
          {{ vibe.label }}
        </span>
      </Transition>
    </div>
  </article>
</template>

<script lang="ts" setup>
import { Clock, Coffee, Plug, Unplug, Wifi, WifiOff } from 'lucide-vue-next'
import CafeAmenityStamp from '~/components/cafe/CafeAmenityStamp.vue'
import { amenityWord, type LandingSampleCafe, type LandingSampleVibe } from '~/data/landing-samples'
import { vibeTagColorStyle, vibeTagLucideComponent } from '~/utils/admin-vibe-tags'

/** Landing-only bag label for a fictional sample cafe. Same print language as CafeCard, no save spine. */
defineProps<{
  cafe: LandingSampleCafe
  vibe?: LandingSampleVibe | null
  mini?: boolean
}>()
</script>

<style scoped>
.sample-bag {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 16px 16px 12px;
  border: 1px solid color-mix(in srgb, var(--color-ink) 34%, transparent);
  border-radius: var(--radius-card);
  background: var(--color-paper-2);
  color: var(--color-ink);
  text-align: left;
}

.sample-bag__mast { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }

.sample-bag__logo {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border: 1px solid color-mix(in srgb, var(--color-ink) 34%, transparent);
  border-radius: var(--radius-logo);
  color: var(--color-accent);
}

.sample-bag__copy { display: flex; flex-direction: column; gap: 1px; min-width: 0; }

.sample-bag__name {
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
  overflow-wrap: anywhere;
}

.sample-bag__origin { font-size: 0.75rem; line-height: 1.2; }

.sample-bag__lines {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--color-rule-2);
}

.sample-bag__hours {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: 0.7875rem;
  line-height: 1.3;
}

.sample-bag__hours :deep(svg) { color: var(--color-accent); transform: translateY(2px); }

.sample-bag__marks { display: flex; flex-wrap: wrap; gap: 8px 10px; padding: 4px 0 6px; }

.sample-bag__vibe {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border: 1px solid var(--vibe-color, var(--color-accent));
  border-radius: 8px;
  background: color-mix(in srgb, var(--vibe-color, #d9793b) 22%, #faf8f5);
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  rotate: -1.4deg;
}

.sample-bag__vibe :deep(svg) { color: var(--vibe-color, var(--color-accent)); }

/* Mini: the bag as it sits inside the hero phone. */
.sample-bag--mini { gap: 5px; padding: 8px 9px 7px; border-radius: 10px; }
.sample-bag--mini .sample-bag__logo { width: 24px; height: 24px; border-radius: 6px; }
.sample-bag--mini .sample-bag__mast { gap: 6px; }
.sample-bag--mini .sample-bag__name { font-size: 0.82rem; }
.sample-bag--mini .sample-bag__origin { font-size: 0.6rem; }
.sample-bag--mini .sample-bag__lines { gap: 4px; padding-top: 5px; }
.sample-bag--mini .sample-bag__hours { font-size: 0.6rem; gap: 4px; }
.sample-bag--mini .sample-bag__vibe { padding: 3px 6px; font-size: 0.58rem; }

.sample-bag__mini-marks { display: flex; gap: 6px; font-size: 0.6rem; font-weight: 700; }
.sample-bag__mini-marks > span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border: 1px dashed color-mix(in srgb, var(--color-ink) 34%, transparent);
  border-radius: 6px;
}
.sample-bag__mini-marks > span.is-yes {
  border-style: solid;
  background: color-mix(in srgb, var(--color-accent) 16%, var(--color-paper-2));
}
.sample-bag__mini-marks :deep(svg) { color: var(--color-accent); }

.sample-vibe-enter-active,
.sample-vibe-leave-active { transition: opacity 160ms ease-out, scale 260ms cubic-bezier(0.34, 1.56, 0.64, 1); }
.sample-vibe-enter-from { opacity: 0; scale: 1.3; }
.sample-vibe-leave-to { opacity: 0; scale: 0.9; }

@media (prefers-reduced-motion: reduce) {
  .sample-bag__vibe { rotate: 0deg; }
  .sample-vibe-enter-from,
  .sample-vibe-leave-to { scale: 1; }
}
</style>
