<template>
  <span
    class="admin-spinner"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  />
</template>

<script lang="ts" setup>
/**
 * Inline spinner for admin buttons, toasts, and overlays.
 * Uses `currentColor`, so it follows the button or toast text color.
 *
 * @example
 * <AdminSpinner :size="16" />
 */
withDefaults(defineProps<{
  /** Box size in pixels. The ring stays round at any size. */
  size?: number
}>(), {
  size: 16,
})
</script>

<style scoped>
.admin-spinner {
  display: inline-block;
  box-sizing: border-box;
  flex: 0 0 auto;
  border: 2px solid color-mix(in srgb, currentColor 28%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  vertical-align: middle;
  animation: admin-spin 0.7s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .admin-spinner {
    animation: none;
    border-color: currentColor;
    opacity: 0.72;
  }
}

@keyframes admin-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
