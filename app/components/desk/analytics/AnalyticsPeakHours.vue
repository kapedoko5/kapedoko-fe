<template>
  <section class="analytics-section peak" aria-labelledby="analytics-peak-title">
    <div class="analytics-section__head">
      <h2 id="analytics-peak-title">Busy times</h2>
      <div v-if="sources.length > 1" :class="toolbarClass" role="group" aria-label="Busy times source">
        <button
          v-for="item in sources"
          :key="item.id"
          type="button"
          :class="[chipClass, { 'is-active': active.id === item.id }]"
          :aria-pressed="active.id === item.id"
          @click="sourceId = item.id"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <p v-if="!active.grid || active.grid.total === 0" class="analytics-muted">
      {{ active.empty }}
    </p>
    <template v-else>
      <p class="peak__summary">{{ summary }}</p>
      <svg
        class="peak__svg"
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        role="img"
        :aria-label="`${summary} A table of the busiest times follows.`"
        focusable="false"
      >
        <text
          v-for="hour in HOUR_TICKS"
          :key="`h${hour}`"
          class="peak__tick"
          :x="LEFT + hour * CELL + CELL / 2"
          y="10"
          text-anchor="middle"
        >
          {{ formatHourLabel(hour) }}
        </text>
        <g v-for="(dow, row) in DOW_DISPLAY_ORDER" :key="dow">
          <text class="peak__tick" x="0" :y="TOP + row * CELL + CELL - 3">{{ DOW_LABELS[dow] }}</text>
          <rect
            v-for="hour in 24"
            :key="hour"
            :class="['peak__cell', `peak__cell--${heatLevel(active.grid.cells[dow]![hour - 1]!, active.grid.max)}`]"
            :x="LEFT + (hour - 1) * CELL"
            :y="TOP + row * CELL"
            :width="CELL - 1"
            :height="CELL - 1"
            rx="2"
          />
        </g>
      </svg>
      <p class="analytics-muted peak__legend" aria-hidden="true">
        Fewer
        <span v-for="level in 5" :key="level" :class="['peak__swatch', `peak__cell--${level - 1}`]" />
        More. All times are Manila time.
      </p>
      <details class="peak__table">
        <summary>View as a table</summary>
        <div class="peak__scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Time</th>
                <th scope="col">{{ active.unit }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="slot in slots" :key="`${slot.dow}-${slot.hour}`">
                <th scope="row">{{ DOW_NAMES[slot.dow] }}</th>
                <td>{{ formatHourLabel(slot.hour) }} to {{ formatHourLabel(slot.hour + 1) }}</td>
                <td>{{ formatTrafficCount(slot.count) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="analytics-muted">The five busiest hours of the week.</p>
      </details>
    </template>
    <p class="analytics-muted">{{ active.note }}</p>
  </section>
</template>

<script lang="ts" setup>
import {
  DOW_DISPLAY_ORDER,
  DOW_LABELS,
  DOW_NAMES,
  describeSlot,
  formatHourLabel,
  heatLevel,
  topSlots,
  type HourlyGrid,
} from '~/utils/peak-hours'
import { formatTrafficCount } from '~/utils/shop-traffic'

const props = defineProps<{
  tone: 'admin' | 'owner'
  /** Check-ins, last 14 days. */
  checkins?: HourlyGrid | null
  /** Cafe page visits by hour. Omit until the RPC answers. */
  visits?: HourlyGrid | null
  days: number
}>()

const WIDTH = 330
const LEFT = 30
const TOP = 16
const CELL = 12.5
const HEIGHT = TOP + 7 * CELL
const HOUR_TICKS = [0, 6, 12, 18]

const chipClass = computed(() => (props.tone === 'admin' ? 'admin-chip' : 'owner-chip'))
const toolbarClass = computed(() => (props.tone === 'admin' ? 'admin-toolbar' : 'owner-toolbar'))

type Source = { id: 'checkins' | 'visits', label: string, grid: HourlyGrid | null, unit: string, empty: string, note: string }
const sources = computed<Source[]>(() => {
  const list: Source[] = []
  if (props.visits) {
    list.push({
      id: 'visits',
      label: 'Visits',
      grid: props.visits,
      unit: 'Visits',
      empty: `No cafe page visits in the last ${props.days} days yet.`,
      note: 'Visits count people who allow analytics, so the shape is reliable even if the counts are low.',
    })
  }
  list.push({
    id: 'checkins',
    label: 'Check-ins',
    grid: props.checkins ?? null,
    unit: 'Check-ins',
    empty: 'No check-ins in the last 14 days yet. Visitors report how busy a cafe is from its page.',
    note: 'Check-ins are the last 14 days of visitors reporting how busy the cafe is. They are a separate count from visits and are never compared to them.',
  })
  return list
})
const sourceId = ref<'checkins' | 'visits'>('visits')
const active = computed(() => sources.value.find((item) => item.id === sourceId.value) ?? sources.value[0]!)

const slots = computed(() => (active.value.grid ? topSlots(active.value.grid, 5) : []))
const summary = computed(() => {
  const peak = active.value.grid?.peak
  if (!peak) return ''
  return `${active.value.unit} peak on ${describeSlot(peak.dow, peak.hour)}.`
})
</script>

<style scoped>
.peak__summary {
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  font-weight: 700;
}

.peak__svg {
  width: 100%;
  height: auto;
}

.peak__tick {
  fill: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 9px;
}

.peak__cell--0 {
  fill: color-mix(in srgb, var(--kd-ink) 7%, #faf8f5);
  background: color-mix(in srgb, var(--kd-ink) 7%, #faf8f5);
}

.peak__cell--1 {
  fill: color-mix(in srgb, var(--kd-primary) 22%, #faf8f5);
  background: color-mix(in srgb, var(--kd-primary) 22%, #faf8f5);
}

.peak__cell--2 {
  fill: color-mix(in srgb, var(--kd-primary) 45%, #faf8f5);
  background: color-mix(in srgb, var(--kd-primary) 45%, #faf8f5);
}

.peak__cell--3 {
  fill: color-mix(in srgb, var(--kd-primary) 70%, #faf8f5);
  background: color-mix(in srgb, var(--kd-primary) 70%, #faf8f5);
}

.peak__cell--4 {
  fill: var(--kd-primary);
  background: var(--kd-primary);
}

.peak__legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.peak__swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 3px;
}

.peak__scroll {
  overflow-x: auto;
}

.peak__table summary {
  display: flex;
  align-items: center;
  min-height: 44px;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
}
</style>
