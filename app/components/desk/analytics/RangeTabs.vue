<template>
  <div class="range-tabs">
    <div class="range-tabs__scroll">
      <div :class="toolbarClass" role="tablist" aria-label="Analytics">
        <button
          v-for="item in tabs"
          :id="`analytics-tab-${item.id}`"
          :key="item.id"
          type="button"
          role="tab"
          :class="[chipClass, { 'is-active': tab === item.id }]"
          :aria-selected="tab === item.id"
          :aria-controls="`analytics-panel-${item.id}`"
          @click="emit('update:tab', item.id)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <div class="range-tabs__range">
      <div :class="toolbarClass" role="group" aria-label="Date range">
        <button
          v-for="days in ranges"
          :key="days"
          type="button"
          :class="[chipClass, { 'is-active': range === days }]"
          :aria-pressed="range === days"
          @click="emit('update:range', days)"
        >
          {{ days }} days
        </button>
      </div>
      <slot name="actions" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { TrafficRangeDays, TrafficTabId } from '~/utils/shop-traffic'

const props = defineProps<{
  tone: 'admin' | 'owner'
  tab: TrafficTabId
  range: TrafficRangeDays
  tabs: ReadonlyArray<{ id: TrafficTabId, label: string }>
  ranges: readonly TrafficRangeDays[]
}>()

const emit = defineEmits<{
  'update:tab': [tab: TrafficTabId]
  'update:range': [days: TrafficRangeDays]
}>()

const chipClass = computed(() => (props.tone === 'admin' ? 'admin-chip' : 'owner-chip'))
const toolbarClass = computed(() => (props.tone === 'admin' ? 'admin-toolbar' : 'owner-toolbar'))
</script>

<style scoped>
.range-tabs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.range-tabs__scroll {
  margin: 0 -20px;
  padding: 0 20px;
  overflow-x: auto;
  scrollbar-width: none;
}

.range-tabs__scroll::-webkit-scrollbar {
  display: none;
}

.range-tabs__scroll > [role='tablist'] {
  flex-wrap: nowrap;
  width: max-content;
}

.range-tabs__scroll .admin-chip,
.range-tabs__scroll .owner-chip {
  flex: 0 0 auto;
  white-space: nowrap;
}

.range-tabs__range {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

@media (min-width: 720px) {
  .range-tabs {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 16px;
  }

  .range-tabs__scroll {
    margin: 0;
    padding: 0;
    overflow: visible;
  }

  .range-tabs__scroll > [role='tablist'] {
    flex-wrap: wrap;
    width: auto;
  }
}
</style>
