<template>
  <span class="admin-busy-label">
    <AdminSpinner v-if="busy" :size="size" />
    <slot />
  </span>
</template>

<script lang="ts" setup>
/**
 * Button label that shows a spinner while an admin write is in flight.
 * Put it inside a button that is also `disabled` and `aria-busy`.
 *
 * @example
 * <button type="submit" class="admin-btn" :disabled="saving" :aria-busy="saving || undefined">
 *   <AdminBusyLabel :busy="saving">{{ saving ? 'Saving…' : 'Save changes' }}</AdminBusyLabel>
 * </button>
 */
withDefaults(defineProps<{
  busy?: boolean
  /** Spinner size in pixels. */
  size?: number
}>(), {
  busy: false,
  size: 16,
})
</script>

<style scoped>
.admin-busy-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
