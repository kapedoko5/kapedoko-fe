<template>
  <section class="bench" aria-labelledby="bench-title">
    <h2 id="bench-title" class="bench__title">How you compare</h2>
    <ul class="bench__list">
      <li v-for="row in rows" :key="row.scope" class="bench__group">
        <h3 class="bench__group-title">{{ row.label }}</h3>
        <dl class="bench__metrics">
          <div v-if="row.ctr" class="bench__metric">
            <dt>Card CTR</dt>
            <dd class="bench__value">{{ formatBenchmarkValue(row.ctr.own) }}</dd>
            <dd class="bench__sub">Median {{ formatBenchmarkValue(row.ctr.median) }}</dd>
            <dd class="bench__sub">{{ benchmarkPercentileCopy(row.ctr.percentile, row.scope) }}</dd>
          </div>
          <div v-if="row.actionRate" class="bench__metric">
            <dt>Actions per visit</dt>
            <dd class="bench__value">{{ formatBenchmarkValue(row.actionRate.own) }}</dd>
            <dd class="bench__sub">Median {{ formatBenchmarkValue(row.actionRate.median) }}</dd>
            <dd class="bench__sub">{{ benchmarkPercentileCopy(row.actionRate.percentile, row.scope) }}</dd>
          </div>
        </dl>
      </li>
    </ul>
    <p class="bench__note">
      Compared with other cafes this period. A group shows only when at least {{ BENCHMARK_MIN_GROUP }} cafes
      have enough traffic, and no other cafe is named. Only visitors who allow analytics are counted.
    </p>
  </section>
</template>

<script lang="ts" setup>
import {
  BENCHMARK_MIN_GROUP,
  benchmarkPercentileCopy,
  formatBenchmarkValue,
  type BenchmarkRow,
} from '~/utils/traffic-benchmark'

defineProps<{ rows: BenchmarkRow[] }>()
</script>

<style scoped>
.bench {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bench__title {
  margin: 0;
  color: var(--kd-ink);
  font-size: 1rem;
  font-weight: 700;
}

.bench__list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  overflow: hidden;
}

.bench__group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
}

.bench__group + .bench__group {
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
}

.bench__group-title {
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.875rem;
  font-weight: 700;
}

.bench__metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

.bench__metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.bench__metric dt {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
}

.bench__metric dd {
  margin: 0;
}

.bench__value {
  color: var(--kd-ink);
  font-size: 1.3rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.bench__sub {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7rem;
  line-height: 1.3;
}

.bench__note {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  line-height: 1.4;
}
</style>
