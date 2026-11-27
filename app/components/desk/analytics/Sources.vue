<template>
  <section class="analytics-section sources" aria-labelledby="analytics-sources-title">
    <h2 id="analytics-sources-title">Where people find it</h2>
    <p v-if="rows.length === 0" class="analytics-muted">No sources in this window yet.</p>
    <ol v-else class="sources__list">
      <li v-for="row in rows" :key="row.surface" class="sources__item">
        <div class="sources__head">
          <span class="sources__name">{{ row.name }}</span>
          <span class="sources__share">{{ formatTrafficRatio(row.share) }} of visits</span>
        </div>
        <span class="sources__track" aria-hidden="true">
          <span class="sources__fill" :style="{ width: `${Math.round((row.share ?? 0) * 100)}%` }" />
        </span>
        <dl class="sources__facts">
          <div>
            <dt>Impressions</dt>
            <dd>{{ formatTrafficCount(row.impressions) }}</dd>
          </div>
          <div>
            <dt>Clicks</dt>
            <dd>{{ formatTrafficCount(row.clicks) }}</dd>
          </div>
          <div>
            <dt>CTR</dt>
            <dd>{{ formatTrafficRatio(row.ctr) }}</dd>
          </div>
          <div>
            <dt>Visits</dt>
            <dd>{{ formatTrafficCount(row.visits) }}</dd>
          </div>
        </dl>
      </li>
    </ol>
  </section>
</template>

<script lang="ts" setup>
import { formatTrafficCount, formatTrafficRatio } from '~/utils/shop-traffic'
import type { SourceRow } from '~/utils/traffic-analytics'

defineProps<{ rows: SourceRow[] }>()
</script>

<style scoped>
.sources__list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sources__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sources__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.sources__name {
  font-size: 0.95rem;
  font-weight: 700;
}

.sources__share {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.sources__track {
  display: block;
  height: 8px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--kd-ink) 10%, transparent);
  overflow: hidden;
}

.sources__fill {
  display: block;
  height: 100%;
  border-radius: 6px;
  background: var(--kd-accent);
}

.sources__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
  margin: 0;
}

.sources__facts div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.sources__facts dt {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
}

.sources__facts dd {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

@media (min-width: 720px) {
  .sources__facts {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
