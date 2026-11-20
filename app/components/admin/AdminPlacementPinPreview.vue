<template>
  <span class="pin-preview" :class="kind === 'sponsored' ? 'is-sponsored' : 'is-partner'" aria-hidden="true">
    <span class="pin-preview__stage">
      <span class="pin-preview__stack">
        <span class="pin-preview__mark" :class="{ 'is-logo': showLogo }">
          <img
            v-if="showLogo"
            :src="logoSrc"
            alt=""
            width="44"
            height="44"
            @error="onLogoError"
          />
          <svg v-else viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="16.2" fill="#372d25" stroke="#ffffff" stroke-width="3.2" paint-order="stroke fill" />
            <path d="M15.6 10.8v3.8M21.4 10.3v4.2" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />
            <path d="M11.4 16.4h14.4v7.4a3.7 3.7 0 0 1-3.7 3.7h-7a3.7 3.7 0 0 1-3.7-3.7z" fill="#ffffff" />
            <path d="M25.8 18.1c3.6.15 4.4 2.55 4.4 4s-1 3.9-4.45 4.05" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" />
          </svg>
        </span>
        <span class="pin-preview__label">{{ pinLabel(cafeName || 'Cafe') }}</span>
      </span>
    </span>
  </span>
</template>

<script lang="ts" setup>
import { pinLabel } from '~/utils/marker-tier'

const props = defineProps<{
  kind: 'partner' | 'sponsored'
  cafeName: string
  logoSrc?: string | null
}>()

const logoFailed = ref(false)
const showLogo = computed(() => props.kind === 'sponsored' && Boolean(props.logoSrc) && !logoFailed.value)

watch(() => [props.kind, props.logoSrc].join('|'), () => {
  logoFailed.value = false
})

const onLogoError = () => {
  logoFailed.value = true
}
</script>

<style scoped>
.pin-preview {
  display: block;
  flex: 0 0 auto;
}

.pin-preview__stage {
  display: grid;
  place-items: center;
  width: 108px;
  height: 92px;
  border-radius: 12px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--kd-primary) 10%, #e7efe8), color-mix(in srgb, var(--kd-ink) 6%, #dce6de));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--kd-ink) 8%, transparent);
}

.pin-preview__stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.pin-preview__mark {
  display: block;
  width: 44px;
  height: 44px;
  filter: drop-shadow(0 3px 5px var(--kd-shadow));
}

.pin-preview.is-sponsored .pin-preview__mark {
  width: 52px;
  height: 52px;
  filter: drop-shadow(0 6px 12px var(--kd-shadow));
}

.pin-preview__mark.is-logo {
  overflow: hidden;
  border-radius: 999px;
  background: var(--kd-white);
  box-shadow: 0 0 0 3px var(--kd-white), 0 0 0 5px var(--kd-primary);
  filter: none;
}

.pin-preview__mark svg,
.pin-preview__mark img {
  display: block;
  width: 100%;
  height: 100%;
}

.pin-preview__mark.is-logo img {
  object-fit: cover;
}

.pin-preview__label {
  max-width: 88px;
  margin-top: 3px;
  padding: 2px 6px;
  overflow: hidden;
  border-radius: 4px;
  background: var(--kd-white);
  color: var(--kd-ink);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  text-overflow: ellipsis;
  box-shadow: 0 2px 6px var(--kd-shadow);
}

.pin-preview.is-sponsored .pin-preview__label {
  box-shadow: 0 3px 8px var(--kd-shadow);
}
</style>
