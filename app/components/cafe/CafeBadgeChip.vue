<template>
  <span
    class="cafe-badge"
    :style="{ '--badge-fill': fill, '--badge-ink': ink }"
  >
    <img
      v-if="badge.iconUrl"
      class="cafe-badge__image"
      :src="badge.iconUrl"
      alt=""
      width="14"
      height="14"
    >
    <component
      :is="lucideIcon"
      v-else
      class="cafe-badge__icon"
      :size="14"
      :stroke-width="2.25"
      aria-hidden="true"
    />
    <span class="cafe-badge__label">{{ badge.label }}</span>
  </span>
</template>

<script lang="ts" setup>
import type { CafeBadge } from '~/types/cafe'
import { badgeInkOn, badgeLucideComponent, normalizeBadgeColor } from '~/utils/admin-badges'

const props = defineProps<{
  badge: Pick<CafeBadge, 'label' | 'color' | 'lucideIcon' | 'iconUrl'>
}>()

const fill = computed(() => normalizeBadgeColor(props.badge.color))
const ink = computed(() => badgeInkOn(fill.value))
const lucideIcon = computed(() => badgeLucideComponent(props.badge.lucideIcon))
</script>

<style scoped>
.cafe-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  min-height: 22px;
  padding: 2px 8px 2px 6px;
  border-radius: 16px;
  background: var(--badge-fill);
  color: var(--badge-ink);
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1.2;
}

.cafe-badge__icon,
.cafe-badge__image {
  flex: 0 0 auto;
  width: 14px;
  height: 14px;
}

.cafe-badge__image {
  object-fit: contain;
  border-radius: 3px;
}

.cafe-badge__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
