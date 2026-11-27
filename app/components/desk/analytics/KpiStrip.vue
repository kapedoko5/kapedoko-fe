<template>
  <section class="kpi" aria-labelledby="kpi-title">
    <h2 id="kpi-title" class="analytics-sr">Key numbers</h2>
    <ul class="kpi__grid">
      <li v-for="card in cards" :key="card.id" class="kpi__card">
        <span class="kpi__label">{{ card.label }}</span>
        <span class="kpi__value">{{ card.value }}</span>
        <span v-if="card.delta" class="kpi__delta">
          <template v-if="card.delta.reliable && card.delta.direction">
            <span
              class="kpi__chip"
              :class="`kpi__chip--${card.delta.direction}`"
            >
              <span aria-hidden="true">{{ card.delta.direction === 'up' ? '▲' : card.delta.direction === 'down' ? '▼' : '■' }}</span>
              {{ formatKpiChange(card.delta.change) }}
              <span class="analytics-sr">{{ card.delta.direction === 'flat' ? 'no change' : card.delta.direction === 'up' ? 'up' : 'down' }}</span>
            </span>
            <span class="kpi__vs">vs previous {{ days }} days</span>
          </template>
          <span v-else class="kpi__vs">Previous {{ days }} days: {{ card.previousValue }}</span>
        </span>
        <span v-else-if="card.previousValue" class="kpi__vs">Previous {{ days }} days: {{ card.previousValue }}</span>
        <svg
          v-if="card.series && card.series.length > 1"
          class="kpi__spark"
          viewBox="0 0 100 24"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <polyline :points="sparkPoints(card.series)" />
        </svg>
      </li>
    </ul>
    <p class="analytics-muted">
      Visits count cafe page opens only. Earlier numbers also included card clicks. Only visitors who allow analytics are counted.
    </p>
  </section>
</template>

<script lang="ts" setup>
import { formatKpiChange, type KpiDelta } from '~/utils/traffic-analytics'

export type KpiCard = {
  id: string
  label: string
  value: string
  delta?: KpiDelta | null
  previousValue?: string
  series?: number[]
}

defineProps<{
  cards: KpiCard[]
  days: number
}>()

const sparkPoints = (series: number[]) => {
  const max = Math.max(...series, 1)
  const step = 100 / (series.length - 1)
  return series
    .map((value, index) => `${(index * step).toFixed(2)},${(22 - (value / max) * 20).toFixed(2)}`)
    .join(' ')
}
</script>

<style scoped>
.kpi {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kpi__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  overflow: hidden;
}

.kpi__card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
  padding: 14px 16px 12px;
  border-right: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
}

.kpi__card:nth-child(2n) {
  border-right: 0;
}

.kpi__card:nth-last-child(-n + 2) {
  border-bottom: 0;
}

.kpi__label {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  line-height: 1.3;
}

.kpi__value {
  color: var(--kd-ink);
  font-size: 1.3rem;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.kpi__delta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 8px;
}

.kpi__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.kpi__chip--up {
  border-color: var(--kd-primary);
  color: var(--kd-primary);
}

.kpi__chip--down {
  border-color: var(--kd-accent);
  color: var(--kd-ink);
}

.kpi__vs {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7rem;
  line-height: 1.3;
}

.kpi__spark {
  width: 100%;
  height: 24px;
  margin-top: 4px;
}

.kpi__spark polyline {
  fill: none;
  stroke: var(--kd-primary);
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

@media (min-width: 720px) {
  .kpi__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .kpi__card:nth-child(2n) {
    border-right: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
  }

  .kpi__card:nth-child(3n) {
    border-right: 0;
  }

  .kpi__card:nth-last-child(-n + 3) {
    border-bottom: 0;
  }
}
</style>
