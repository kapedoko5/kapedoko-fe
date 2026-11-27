<template>
  <section class="analytics-section funnel" aria-labelledby="analytics-funnel-title">
    <h2 id="analytics-funnel-title">From card to action</h2>
    <ol class="funnel__list">
      <li v-for="step in steps" :key="step.id" class="funnel__step">
        <div class="funnel__row">
          <span class="funnel__label">{{ step.label }}</span>
          <span class="funnel__count">{{ formatTrafficCount(step.count) }}</span>
        </div>
        <span class="funnel__track" aria-hidden="true">
          <span class="funnel__fill" :style="{ width: barWidth(step.count) }" />
        </span>
        <span v-if="step.fromPrevious !== null || step.id !== 'impressions'" class="analytics-muted">
          {{ formatFunnelRate(step.fromPrevious) }} of {{ previousLabel(step.id) }}
        </span>
      </li>
    </ol>
    <p class="analytics-muted">
      Map taps open a cafe page without a card click, so a step can pass 100%.
      Actions are directions, calls, and photo views.
    </p>
  </section>
</template>

<script lang="ts" setup>
import { formatTrafficCount } from '~/utils/shop-traffic'
import { formatFunnelRate, type FunnelStep } from '~/utils/traffic-analytics'

const props = defineProps<{ steps: FunnelStep[] }>()

const maxCount = computed(() => Math.max(1, ...props.steps.map((step) => step.count)))
const barWidth = (count: number) => (count <= 0 ? '0' : `${Math.max(2, Math.round((count / maxCount.value) * 100))}%`)

const previousLabel = (id: FunnelStep['id']) => {
  const index = props.steps.findIndex((step) => step.id === id)
  return (props.steps[index - 1]?.label ?? '').toLowerCase()
}
</script>

<style scoped>
.funnel__list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.funnel__step {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.funnel__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.funnel__label {
  font-size: 0.7875rem;
  font-weight: 700;
}

.funnel__count {
  font-size: 1.05rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.funnel__track {
  display: block;
  height: 10px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--kd-ink) 10%, transparent);
  overflow: hidden;
}

.funnel__fill {
  display: block;
  height: 100%;
  border-radius: 6px;
  background: var(--kd-primary);
}
</style>
