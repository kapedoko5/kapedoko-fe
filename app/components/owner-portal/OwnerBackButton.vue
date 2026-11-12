<template>
  <NuxtLink
    class="owner-back"
    :to="to"
    :aria-label="accessibleName"
    @click="onClick"
  >
    <ChevronLeft :size="22" :stroke-width="2.25" aria-hidden="true" />
    <span class="owner-back__label">{{ label }}</span>
  </NuxtLink>
</template>

<script lang="ts" setup>
import { ChevronLeft } from 'lucide-vue-next'

const props = defineProps<{
  to: string
  label: string
}>()

const emit = defineEmits<{
  navigate: [to: string]
}>()

const accessibleName = computed(() => `Back to ${props.label}`)

const onClick = (event: MouseEvent) => {
  if (event.defaultPrevented) return
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  emit('navigate', props.to)
}
</script>

<style scoped>
.owner-back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
  min-width: 44px;
  min-height: 44px;
  padding: 0 8px 0 2px;
  border-radius: 16px;
  color: var(--kd-primary);
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.2;
  text-decoration: none;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
  transition:
    background-color 160ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 140ms cubic-bezier(0.16, 1, 0.3, 1);
}

.owner-back:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.owner-back:active {
  transform: scale(0.98);
}

@media (hover: hover) and (pointer: fine) {
  .owner-back:hover {
    background: color-mix(in srgb, var(--kd-primary) 10%, #faf8f5);
  }
}

@media (prefers-reduced-motion: reduce) {
  .owner-back {
    transition: none;
  }

  .owner-back:active {
    transform: none;
  }
}

:root.is-android .owner-back {
  min-width: 48px;
  min-height: 48px;
}
</style>
