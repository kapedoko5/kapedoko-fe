<template>
  <span
    class="owner-spinner"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  />
</template>

<script lang="ts" setup>
withDefaults(defineProps<{
  size?: number
}>(), {
  size: 16,
})
</script>

<style scoped>
.owner-spinner {
  display: inline-block;
  box-sizing: border-box;
  flex: 0 0 auto;
  border: 2px solid color-mix(in srgb, currentColor 28%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  vertical-align: middle;
  animation: owner-spin 0.7s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .owner-spinner {
    animation: none;
    border-color: currentColor;
    opacity: 0.72;
  }
}

@keyframes owner-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
