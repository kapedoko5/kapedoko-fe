<template>
  <section class="promo-split" aria-labelledby="promo-split-title">
    <h2 id="promo-split-title" class="promo-split__title">Banners and featured cafes</h2>
    <div class="promo-split__wrap">
      <table class="promo-split__table">
        <thead>
          <tr>
            <th scope="col">Where</th>
            <th scope="col">Impressions</th>
            <th scope="col">Clicks</th>
            <th scope="col">CTR</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.placement">
            <th scope="row">{{ row.label }}</th>
            <td>{{ formatTrafficCount(row.totals.impressions) }}</td>
            <td>{{ formatTrafficCount(row.totals.clicks) }}</td>
            <td>{{ formatTrafficRatio(row.totals.ctr) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="promo-split__note">
      <template v-if="tone === 'owner'">Shows the featured row on Home for cafes you manage.</template>
      <template v-else>Home banners are counted per campaign; featured cafes are counted per cafe.</template>
      Only visitors who allow analytics are counted.
    </p>
  </section>
</template>

<script lang="ts" setup>
import {
  adPlacementLabel,
  type AdPlacement,
  type AdPlacementSummary,
} from '~/utils/ad-attribution'
import { formatTrafficCount, formatTrafficRatio } from '~/utils/shop-traffic'

const props = defineProps<{
  tone: 'admin' | 'owner'
  summary: AdPlacementSummary
}>()

// Owners only ever see featured rows, so the banner row is left out for them.
const rows = computed(() => {
  const placements: AdPlacement[] = props.tone === 'owner' ? ['featured'] : ['banner', 'featured']
  return placements.map((placement) => ({
    placement,
    label: adPlacementLabel(placement),
    totals: props.summary[placement],
  }))
})
</script>

<style scoped>
.promo-split {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.promo-split__title {
  margin: 0;
  color: var(--kd-ink);
  font-size: 1rem;
  font-weight: 700;
}

.promo-split__wrap {
  overflow-x: auto;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.promo-split__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.promo-split__table th,
.promo-split__table td {
  padding: 12px 16px;
  text-align: right;
  white-space: nowrap;
}

.promo-split__table th:first-child {
  text-align: left;
}

.promo-split__table thead th {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-weight: 600;
}

.promo-split__table tbody tr + tr > * {
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
}

.promo-split__note {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  line-height: 1.4;
}
</style>
