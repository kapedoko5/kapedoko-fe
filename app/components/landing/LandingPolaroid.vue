<template>
  <figure class="landing-polaroid" :style="{ '--tilt': tilt }" aria-hidden="true">
    <div class="landing-polaroid__photo">
      <NuxtImg
        v-if="src"
        :src="src"
        alt=""
        format="webp"
        loading="lazy"
        :width="width"
        :height="height"
        sizes="160px sm:200px"
        class="landing-polaroid__img"
      />
      <div v-else class="landing-polaroid__placeholder">
        <slot><DoodleCup /></slot>
      </div>
    </div>
    <figcaption v-if="caption" class="landing-polaroid__caption">{{ caption }}</figcaption>
  </figure>
</template>

<script lang="ts" setup>
import DoodleCup from '~/components/landing/doodles/DoodleCup.vue'

/**
 * Polaroid sticker. Photo slot is optional: until an approved royalty-free photo
 * is added under /public/assets/landing/, a doodle prints in its place.
 * Decorative only (aria-hidden): never proof of a listed shop.
 */
withDefaults(defineProps<{
  src?: string
  caption?: string
  tilt?: string
  width?: number
  height?: number
}>(), {
  src: undefined,
  caption: '',
  tilt: '3deg',
  width: 400,
  height: 400,
})
</script>

<style scoped>
.landing-polaroid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  margin: 0;
  padding: 8px 8px 10px;
  border: 1.5px solid var(--color-ink);
  border-radius: 6px;
  background: var(--color-paper-2);
  rotate: var(--tilt);
  box-sizing: border-box;
}

.landing-polaroid__photo {
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--color-rule);
  border-radius: 3px;
  background: color-mix(in srgb, var(--color-accent) 18%, var(--color-paper-2));
}

.landing-polaroid__img { display: block; width: 100%; height: 100%; object-fit: cover; }

.landing-polaroid__placeholder {
  display: grid;
  place-items: center;
  height: 100%;
  padding: 18%;
  box-sizing: border-box;
}

.landing-polaroid__caption {
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .landing-polaroid { rotate: 0deg; }
}
</style>
