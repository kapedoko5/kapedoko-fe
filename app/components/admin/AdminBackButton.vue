<template>
  <NuxtLink
    class="admin-back"
    :to="to"
    :aria-label="accessibleName"
    @click="onClick"
  >
    <ChevronLeft :size="22" :stroke-width="2.25" aria-hidden="true" />
    <span class="admin-back__label">{{ label }}</span>
  </NuxtLink>
</template>

<script lang="ts" setup>
import { ChevronLeft } from 'lucide-vue-next'

/**
 * Header back control for nested admin pages.
 * Navigates to a resolved parent route (never history.back()) so claims,
 * requests, and deep links cannot trap the staffer in a history loop.
 *
 * @example
 * <AdminBackButton to="/admin/cafes" label="Cafes" @navigate="go" />
 */
const props = defineProps<{
  /** Explicit parent path, e.g. `/admin/cafes` or `/admin/audits/:shopId`. */
  to: string
  /** Visible destination name. Combined into “Back to {label}” for the accessible name. */
  label: string
}>()

const emit = defineEmits<{
  /** Fired for a primary click so the shell can settle Ionic pages the same way as sidebar nav. */
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
.admin-back {
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

.admin-back__label {
  padding-right: 4px;
}

.admin-back:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.admin-back:active {
  transform: scale(0.98);
}

@media (hover: hover) and (pointer: fine) {
  .admin-back:hover {
    background: color-mix(in srgb, var(--kd-primary) 10%, #faf8f5);
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-back {
    transition: none;
  }

  .admin-back:active {
    transform: none;
  }
}

:root.is-android .admin-back {
  min-width: 48px;
  min-height: 48px;
}
</style>
