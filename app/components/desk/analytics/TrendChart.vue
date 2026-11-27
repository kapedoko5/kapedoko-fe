<template>
  <section class="analytics-section trend" aria-labelledby="analytics-trend-title">
    <h2 id="analytics-trend-title">Card clicks and cafe page visits</h2>
    <p v-if="max === 0" class="analytics-muted">{{ emptyText }}</p>
    <template v-else>
      <svg
        class="trend__svg"
        viewBox="0 0 320 120"
        preserveAspectRatio="none"
        role="img"
        :aria-label="summary"
        focusable="false"
      >
        <line class="trend__grid" x1="0" y1="4" x2="320" y2="4" />
        <line class="trend__grid" x1="0" y1="60" x2="320" y2="60" />
        <line class="trend__grid" x1="0" y1="116" x2="320" y2="116" />
        <polyline class="trend__line trend__line--clicks" :points="path('clicks')" />
        <polyline class="trend__line trend__line--visits" :points="path('visits')" />
      </svg>
      <div class="trend__axis" aria-hidden="true">
        <span>{{ formatTrafficDay(points[0]?.day ?? '') }}</span>
        <span>Peak {{ formatTrafficCount(max) }} a day</span>
        <span>{{ formatTrafficDay(points[points.length - 1]?.day ?? '') }}</span>
      </div>
      <p class="analytics-muted trend__legend">
        <span class="trend__swatch trend__swatch--clicks" aria-hidden="true" /> Card clicks
        <span class="trend__swatch trend__swatch--visits" aria-hidden="true" /> Cafe page visits
      </p>
      <details class="trend__table">
        <summary>View as a table</summary>
        <div class="trend__scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Card clicks</th>
                <th scope="col">Cafe page visits</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="point in points" :key="point.day">
                <th scope="row">{{ formatTrafficDay(point.day) }}</th>
                <td>{{ formatTrafficCount(point.clicks) }}</td>
                <td>{{ formatTrafficCount(point.visits) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </template>
  </section>
</template>

<script lang="ts" setup>
import { formatTrafficCount, formatTrafficDay } from '~/utils/shop-traffic'
import type { TrafficSeriesPoint } from '~/utils/traffic-analytics'

const props = defineProps<{
  points: TrafficSeriesPoint[]
  emptyText: string
}>()

const max = computed(() => Math.max(0, ...props.points.flatMap((p) => [p.clicks, p.visits])))

const path = (key: 'clicks' | 'visits') => {
  const count = props.points.length
  if (count === 0 || max.value === 0) return ''
  const step = count > 1 ? 320 / (count - 1) : 0
  return props.points
    .map((p, i) => `${(i * step).toFixed(1)},${(116 - (p[key] / max.value) * 112).toFixed(1)}`)
    .join(' ')
}

const summary = computed(() => {
  const clicks = props.points.reduce((sum, p) => sum + p.clicks, 0)
  const visits = props.points.reduce((sum, p) => sum + p.visits, 0)
  return `Line chart over ${props.points.length} days. ${formatTrafficCount(clicks)} card clicks and ${formatTrafficCount(visits)} cafe page visits in total. A table of every day follows.`
})
</script>

<style scoped>
.trend__svg {
  width: 100%;
  height: 120px;
}

.trend__grid {
  stroke: color-mix(in srgb, var(--kd-ink) 14%, transparent);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.trend__line {
  fill: none;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.trend__line--clicks {
  stroke: var(--kd-accent);
  stroke-dasharray: 6 4;
}

.trend__line--visits {
  stroke: var(--kd-primary);
}

.trend__axis {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7rem;
}

.trend__legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
}

.trend__swatch {
  display: inline-block;
  width: 18px;
  height: 0;
  margin-right: 2px;
  border-top: 3px solid var(--kd-primary);
  vertical-align: middle;
}

.trend__swatch--clicks {
  border-top-style: dashed;
  border-top-color: var(--kd-accent);
}

.trend__table summary {
  display: flex;
  align-items: center;
  min-height: 44px;
  color: var(--kd-primary);
  font-size: 0.7875rem;
  font-weight: 700;
  cursor: pointer;
}

.trend__table summary:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.trend__scroll {
  max-height: 280px;
  overflow: auto;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
}

.trend__scroll th[scope='row'] {
  position: static;
  font-weight: 400;
  background: transparent;
  color: var(--kd-ink);
}
</style>
