<template>
  <span class="owner-busy-label">
    <OwnerSpinner v-if="busy" :size="size" />
    <slot />
  </span>
</template>

<script lang="ts" setup>
import OwnerSpinner from '~/components/owner-portal/OwnerSpinner.vue'

withDefaults(defineProps<{
  busy?: boolean
  size?: number
}>(), {
  busy: false,
  size: 16,
})
</script>

<style scoped>
.owner-busy-label {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
</style>
