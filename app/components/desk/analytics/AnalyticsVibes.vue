<template>
  <section class="analytics-section vibes" aria-labelledby="analytics-vibes-title">
    <h2 id="analytics-vibes-title">Traffic by vibe tag</h2>
    <p v-if="status === 'error'" class="analytics-muted">Could not load vibe tags.</p>
    <p v-else-if="status === 'loading' || status === 'idle'" class="analytics-muted">Loading vibe tags.</p>
    <p v-else-if="rows.length === 0" class="analytics-muted">No cafes carry a vibe tag yet.</p>
    <div v-else class="vibes__scroll">
      <table class="admin-table">
        <caption class="analytics-sr">Traffic for cafes that carry each vibe tag</caption>
        <thead>
          <tr>
            <th scope="col">Vibe tag</th>
            <th scope="col">Cafes</th>
            <th scope="col">Impressions</th>
            <th scope="col">Clicks</th>
            <th scope="col">CTR</th>
            <th scope="col">Visits</th>
            <th scope="col">Visits per cafe</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.tagId">
            <th scope="row">{{ row.label }}</th>
            <td>{{ formatTrafficCount(row.cafes) }}</td>
            <td>{{ formatTrafficCount(row.impressions) }}</td>
            <td>{{ formatTrafficCount(row.clicks) }}</td>
            <td>
              {{ formatTrafficRatio(row.ctr) }}
              <span v-if="row.ctr !== null && !row.enough" class="analytics-muted"> (low volume)</span>
            </td>
            <td>{{ formatTrafficCount(row.visits) }}</td>
            <td>{{ row.visitsPerCafe === null ? '—' : formatPerCafe(row.visitsPerCafe) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="analytics-muted">
      A cafe with several tags counts toward each one, so rows do not add up to the total.
      CTR under {{ VIBE_MIN_IMPRESSIONS }} impressions is marked low volume. Only visitors who allow analytics are counted.
    </p>
  </section>
</template>

<script lang="ts" setup>
import { formatTrafficCount, formatTrafficRatio } from '~/utils/shop-traffic'
import { VIBE_MIN_IMPRESSIONS, type VibeTrafficRow } from '~/utils/traffic-vibes'

defineProps<{ rows: VibeTrafficRow[], status?: 'idle' | 'loading' | 'ready' | 'error' }>()

const formatPerCafe = (value: number) => new Intl.NumberFormat('en-PH', { maximumFractionDigits: 1 }).format(value)
</script>

<style scoped>
.vibes__scroll {
  overflow-x: auto;
}
</style>
