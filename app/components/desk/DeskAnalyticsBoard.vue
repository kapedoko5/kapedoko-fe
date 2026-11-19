<template>
  <div class="analytics-board">
    <div class="analytics-controls">
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
          @click="tab = item.id"
        >
          {{ item.label }}
        </button>
      </div>

      <div :class="toolbarClass" aria-label="Date range">
        <button
          v-for="days in ranges"
          :key="days"
          type="button"
          :class="[chipClass, { 'is-active': range === days }]"
          :aria-pressed="range === days"
          @click="range = days"
        >
          {{ days }} days
        </button>
      </div>
    </div>

    <div
      :id="`analytics-panel-${tab}`"
      class="analytics-panel"
      role="tabpanel"
      :aria-labelledby="`analytics-tab-${tab}`"
    >
      <template v-if="tab === 'statistics' || tab === 'promotion'">
        <ul class="analytics-tallies" aria-label="Traffic totals">
          <li v-for="card in tallyCards" :key="card.label" class="analytics-tallies__item">
            <span class="analytics-tallies__num">{{ card.value }}</span>
            <span class="analytics-tallies__label">{{ card.label }}</span>
          </li>
        </ul>

        <section class="analytics-trend" aria-labelledby="analytics-trend-title">
          <h2 id="analytics-trend-title">Clicks and café pages</h2>
          <p v-if="maxBar === 0" class="analytics-trend__empty">
            {{ tab === 'promotion' ? promotionEmptyCopy() : 'No café listing traffic in this window yet.' }}
          </p>
          <ol v-else class="analytics-bars">
            <li v-for="bar in bars" :key="bar.day" class="analytics-bars__item">
              <span class="analytics-bars__pair">
                <span
                  class="analytics-bars__fill analytics-bars__fill--clicks"
                  :style="{ height: barHeight(bar.clicks) }"
                  :title="`${formatTrafficCount(bar.clicks)} clicks`"
                />
                <span
                  class="analytics-bars__fill analytics-bars__fill--views"
                  :style="{ height: barHeight(bar.detailViews) }"
                  :title="`${formatTrafficCount(bar.detailViews)} café pages`"
                />
              </span>
              <span class="analytics-bars__day">{{ formatTrafficDay(bar.day) }}</span>
            </li>
          </ol>
          <p v-if="maxBar > 0" class="analytics-legend">
            <span class="analytics-legend__swatch analytics-legend__swatch--clicks" /> Clicks
            <span class="analytics-legend__swatch analytics-legend__swatch--views" /> Café pages
          </p>
        </section>

        <section
          v-if="!isCafeDesk"
          class="analytics-cafes"
          aria-labelledby="analytics-cafes-title"
        >
          <div class="analytics-cafes__head">
            <h2 id="analytics-cafes-title">Cafes</h2>
            <input
              v-model="statsQuery"
              :class="tone === 'admin' ? 'admin-search' : 'owner-search'"
              type="search"
              placeholder="Search cafe"
              aria-label="Search cafe"
            />
          </div>
          <p v-if="matchedStatsCafeRows.length === 0" class="analytics-cafes__empty">{{ statsEmpty }}</p>
          <template v-else>
            <div class="admin-table-wrap analytics-table analytics-cafes__table">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th
                      v-for="column in statsColumns"
                      :key="column.key"
                      :aria-sort="statsSortKey === column.key
                        ? (statsSortDir === 'asc' ? 'ascending' : 'descending')
                        : 'none'"
                    >
                      <button
                        type="button"
                        class="analytics-sort"
                        :class="{ 'is-active': statsSortKey === column.key }"
                        :aria-label="sortColumnLabel(column, statsSortKey, statsSortDir)"
                        @click="onStatsSort(column.key)"
                      >
                        {{ column.label }}
                        <span
                          v-if="statsSortKey === column.key"
                          class="analytics-sort__mark"
                          aria-hidden="true"
                        >{{ statsSortDir === 'desc' ? '↓' : '↑' }}</span>
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in pagedStatsCafeRows" :key="row.shopId">
                    <td>
                      <NuxtLink class="analytics-cafe" :to="cafeHref(row.shopId)">{{ row.name }}</NuxtLink>
                    </td>
                    <td>{{ formatTrafficCount(row.reach) }}</td>
                    <td>{{ formatTrafficCount(row.impressions) }}</td>
                    <td>{{ formatTrafficCount(row.clicks) }}</td>
                    <td>{{ formatTrafficRatio(row.ctr) }}</td>
                    <td>{{ formatTrafficCount(row.detailViews) }}</td>
                    <td>{{ formatTrafficCount(row.engagement) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="admin-cards analytics-cards analytics-cafes__cards">
              <article v-for="row in pagedStatsCafeRows" :key="row.shopId" class="admin-card">
                <h2>
                  <NuxtLink class="analytics-cafe" :to="cafeHref(row.shopId)">{{ row.name }}</NuxtLink>
                </h2>
                <p>{{ formatTrafficCount(row.reach) }} reach · {{ formatTrafficCount(row.impressions) }} impressions · {{ formatTrafficCount(row.clicks) }} clicks</p>
                <p>{{ formatTrafficRatio(row.ctr) }} CTR · {{ formatTrafficCount(row.detailViews) }} pages · {{ formatTrafficCount(row.engagement) }} engagement</p>
              </article>
            </div>
            <p v-if="hasMoreStats" ref="statsSentinel" class="analytics-more">Scroll for more</p>
          </template>
        </section>

        <section
          v-else-if="tab === 'statistics'"
          class="analytics-cafes"
          aria-labelledby="analytics-surfaces-title"
        >
          <div class="analytics-cafes__head">
            <h2 id="analytics-surfaces-title">Where people find it</h2>
          </div>
          <div class="admin-table-wrap analytics-table analytics-cafes__table">
            <table class="admin-table">
              <thead>
                <tr>
                  <th
                    v-for="column in surfaceColumns"
                    :key="column.key"
                    :aria-sort="statsSortKey === column.key
                      ? (statsSortDir === 'asc' ? 'ascending' : 'descending')
                      : 'none'"
                  >
                    <button
                      type="button"
                      class="analytics-sort"
                      :class="{ 'is-active': statsSortKey === column.key }"
                      :aria-label="sortColumnLabel(column, statsSortKey, statsSortDir)"
                      @click="onStatsSort(column.key)"
                    >
                      {{ column.label }}
                      <span
                        v-if="statsSortKey === column.key"
                        class="analytics-sort__mark"
                        aria-hidden="true"
                      >{{ statsSortDir === 'desc' ? '↓' : '↑' }}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in sortedSurfaceRows" :key="row.surface">
                  <td>{{ row.name }}</td>
                  <td>{{ formatTrafficCount(row.reach) }}</td>
                  <td>{{ formatTrafficCount(row.impressions) }}</td>
                  <td>{{ formatTrafficCount(row.clicks) }}</td>
                  <td>{{ formatTrafficRatio(row.ctr) }}</td>
                  <td>{{ formatTrafficCount(row.detailViews) }}</td>
                  <td>{{ formatTrafficCount(row.engagement) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="admin-cards analytics-cards analytics-cafes__cards">
            <article v-for="row in sortedSurfaceRows" :key="row.surface" class="admin-card">
              <h2>{{ row.name }}</h2>
              <p>{{ formatTrafficCount(row.reach) }} reach · {{ formatTrafficCount(row.impressions) }} impressions · {{ formatTrafficCount(row.clicks) }} clicks</p>
              <p>{{ formatTrafficRatio(row.ctr) }} CTR · {{ formatTrafficCount(row.detailViews) }} pages · {{ formatTrafficCount(row.engagement) }} engagement</p>
            </article>
          </div>
        </section>

        <div v-if="tab === 'promotion'" class="analytics-panel__filters">
          <div :class="toolbarClass">
            <button
              v-for="item in recordFilters"
              :key="item.id"
              type="button"
              :class="[chipClass, { 'is-active': recordsFilter === item.id }]"
              :aria-pressed="recordsFilter === item.id"
              @click="recordsFilter = item.id"
            >
              {{ item.label }}
              <span class="analytics-count">{{ formatTrafficCount(recordsCounts[item.id]) }}</span>
            </button>
          </div>
          <label v-if="!isCafeDesk && tone === 'admin'" class="analytics-search">
            Search cafe
            <input v-model="shopQuery" type="search" placeholder="Cafe name" />
          </label>
        </div>
        <template v-if="tab === 'promotion'">
          <p v-if="eventsError" class="admin-empty">{{ eventsError }}</p>
          <p v-else-if="visibleEvents.length === 0 && eventsStatus !== 'loading'" :class="emptyClass">
            No promotion records in this window.
          </p>
          <template v-else-if="visibleEvents.length > 0 || eventsStatus === 'loading'">
            <div class="admin-table-wrap analytics-table">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th v-if="!isCafeDesk">Cafe</th>
                    <th>What</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in visibleEvents" :key="row.id">
                    <td>{{ formatTrafficWhen(row.created_at) }}</td>
                    <td v-if="!isCafeDesk">
                      <NuxtLink class="analytics-cafe" :to="cafeHref(row.shop_id)">{{ shopName(row.shop_id) }}</NuxtLink>
                    </td>
                    <td>{{ shopTrafficKindLabel(row.kind) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="admin-cards analytics-cards">
              <article v-for="row in visibleEvents" :key="row.id" class="admin-card">
                <h2 v-if="isCafeDesk">{{ shopTrafficKindLabel(row.kind) }}</h2>
                <h2 v-else>
                  <NuxtLink class="analytics-cafe" :to="cafeHref(row.shop_id)">{{ shopName(row.shop_id) }}</NuxtLink>
                </h2>
                <p v-if="!isCafeDesk">{{ shopTrafficKindLabel(row.kind) }}</p>
                <p class="admin-meta">{{ formatTrafficWhen(row.created_at) }}</p>
              </article>
            </div>
            <button
              v-if="!eventsDone"
              type="button"
              :class="tone === 'admin' ? 'admin-btn' : 'owner-btn'"
              :disabled="eventsStatus === 'loading'"
              @click="emit('more-events')"
            >
              {{ eventsStatus === 'loading' ? 'Loading…' : 'Load more' }}
            </button>
          </template>
        </template>
      </template>

      <template v-else-if="tab === 'records'">
        <div class="analytics-panel__filters">
          <div :class="toolbarClass">
            <button
              v-for="item in recordFilters"
              :key="item.id"
              type="button"
              :class="[chipClass, { 'is-active': recordsFilter === item.id }]"
              :aria-pressed="recordsFilter === item.id"
              @click="recordsFilter = item.id"
            >
              {{ item.label }}
              <span class="analytics-count">{{ formatTrafficCount(recordsCounts[item.id]) }}</span>
            </button>
          </div>
          <label v-if="!isCafeDesk && tone === 'admin'" class="analytics-search">
            Search cafe
            <input v-model="shopQuery" type="search" placeholder="Cafe name" />
          </label>
          <label v-else-if="!isCafeDesk && names.length > 1" class="analytics-search">
            Cafe
            <select v-model="recordsShopId">
              <option value="">All cafes</option>
              <option v-for="shop in names" :key="shop.id" :value="shop.id">{{ shop.name }}</option>
            </select>
          </label>
        </div>

        <p v-if="eventsError" class="admin-empty">{{ eventsError }}</p>
        <p v-else-if="visibleEvents.length === 0 && eventsStatus !== 'loading'" :class="emptyClass">
          No records in this window.
        </p>
        <template v-else>
          <div class="admin-table-wrap analytics-table">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th v-if="!isCafeDesk">Cafe</th>
                  <th>What</th>
                  <th>Where</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in visibleEvents" :key="row.id">
                  <td>{{ formatTrafficWhen(row.created_at) }}</td>
                  <td v-if="!isCafeDesk">
                    <NuxtLink class="analytics-cafe" :to="cafeHref(row.shop_id)">{{ shopName(row.shop_id) }}</NuxtLink>
                  </td>
                  <td>{{ shopTrafficKindLabel(row.kind) }}</td>
                  <td>{{ shopTrafficSurfaceLabel(row.surface) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="admin-cards analytics-cards">
            <article v-for="row in visibleEvents" :key="row.id" class="admin-card">
              <h2 v-if="isCafeDesk">{{ shopTrafficKindLabel(row.kind) }}</h2>
              <h2 v-else>
                <NuxtLink class="analytics-cafe" :to="cafeHref(row.shop_id)">{{ shopName(row.shop_id) }}</NuxtLink>
              </h2>
              <p v-if="isCafeDesk">{{ shopTrafficSurfaceLabel(row.surface) }}</p>
              <p v-else>{{ shopTrafficKindLabel(row.kind) }} · {{ shopTrafficSurfaceLabel(row.surface) }}</p>
              <p class="admin-meta">{{ formatTrafficWhen(row.created_at) }}</p>
            </article>
          </div>
          <button
            v-if="!eventsDone"
            type="button"
            :class="tone === 'admin' ? 'admin-btn' : 'owner-btn'"
            :disabled="eventsStatus === 'loading'"
            @click="emit('more-events')"
          >
            {{ eventsStatus === 'loading' ? 'Loading…' : 'Load more' }}
          </button>
        </template>
      </template>

      <template v-else-if="tab === 'traffic'">
        <div v-if="!isCafeDesk" class="analytics-panel__filters">
          <input
            v-model="trafficQuery"
            :class="tone === 'admin' ? 'admin-search' : 'owner-search'"
            type="search"
            placeholder="Search cafe"
            aria-label="Search cafe"
          />
          <div class="analytics-panel__chips">
            <div :class="toolbarClass" aria-label="Activity">
              <button
                v-for="item in activityFilters"
                :key="item.id"
                type="button"
                :class="[chipClass, { 'is-active': trafficActivity === item.id }]"
                :aria-pressed="trafficActivity === item.id"
                @click="trafficActivity = item.id"
              >
                {{ item.label }}
              </button>
            </div>
            <div :class="toolbarClass" aria-label="Surface">
              <button
                v-for="item in surfaceFilters"
                :key="item.id"
                type="button"
                :class="[chipClass, { 'is-active': surfaceFilter === item.id }]"
                :aria-pressed="surfaceFilter === item.id"
                @click="surfaceFilter = item.id"
              >
                {{ item.label }}
              </button>
            </div>
          </div>
        </div>
        <p v-if="!isCafeDesk && matchedCafeRows.length === 0" :class="emptyClass">{{ trafficEmpty }}</p>
        <template v-else-if="!isCafeDesk">
          <div class="admin-table-wrap analytics-table">
            <table class="admin-table">
              <thead>
                <tr>
                  <th
                    v-for="column in trafficColumns"
                    :key="column.key"
                    :aria-sort="trafficSortKey === column.key
                      ? (trafficSortDir === 'asc' ? 'ascending' : 'descending')
                      : 'none'"
                  >
                    <button
                      type="button"
                      class="analytics-sort"
                      :class="{ 'is-active': trafficSortKey === column.key }"
                      :aria-label="sortColumnLabel(column, trafficSortKey, trafficSortDir)"
                      @click="onTrafficSort(column.key)"
                    >
                      {{ column.label }}
                      <span
                        v-if="trafficSortKey === column.key"
                        class="analytics-sort__mark"
                        aria-hidden="true"
                      >{{ trafficSortDir === 'desc' ? '↓' : '↑' }}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in pagedCafeRows" :key="row.shopId">
                  <td>
                    <NuxtLink class="analytics-cafe" :to="cafeHref(row.shopId)">{{ row.name }}</NuxtLink>
                  </td>
                  <td>{{ formatTrafficCount(row.impressions) }}</td>
                  <td>{{ formatTrafficCount(row.clicks) }}</td>
                  <td>{{ formatTrafficRatio(row.ctr) }}</td>
                  <td>{{ formatTrafficCount(row.detailViews) }}</td>
                  <td>{{ formatTrafficCount(row.navigate) }}</td>
                  <td>{{ formatTrafficCount(row.call) }}</td>
                  <td>{{ formatTrafficCount(row.photos) }}</td>
                  <td>{{ formatTrafficRatio(row.engagementRate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="admin-cards analytics-cards">
            <article v-for="row in pagedCafeRows" :key="row.shopId" class="admin-card">
              <h2>
                <NuxtLink class="analytics-cafe" :to="cafeHref(row.shopId)">{{ row.name }}</NuxtLink>
              </h2>
              <p>{{ formatTrafficCount(row.impressions) }} impressions · {{ formatTrafficCount(row.clicks) }} clicks · {{ formatTrafficRatio(row.ctr) }} CTR</p>
              <p>{{ formatTrafficCount(row.detailViews) }} pages · {{ formatTrafficCount(row.navigate) }} directions · {{ formatTrafficCount(row.call) }} calls · {{ formatTrafficCount(row.photos) }} photos</p>
            </article>
          </div>
          <p v-if="hasMoreTraffic" ref="trafficSentinel" class="analytics-more">Scroll for more</p>
        </template>
        <template v-else>
          <div class="admin-table-wrap analytics-table">
            <table class="admin-table">
              <thead>
                <tr>
                  <th
                    v-for="column in cafeTrafficColumns"
                    :key="column.key"
                    :aria-sort="trafficSortKey === column.key
                      ? (trafficSortDir === 'asc' ? 'ascending' : 'descending')
                      : 'none'"
                  >
                    <button
                      type="button"
                      class="analytics-sort"
                      :class="{ 'is-active': trafficSortKey === column.key }"
                      :aria-label="sortColumnLabel(column, trafficSortKey, trafficSortDir)"
                      @click="onTrafficSort(column.key)"
                    >
                      {{ column.label }}
                      <span
                        v-if="trafficSortKey === column.key"
                        class="analytics-sort__mark"
                        aria-hidden="true"
                      >{{ trafficSortDir === 'desc' ? '↓' : '↑' }}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in sortedCafeSurfaceRows" :key="row.surface">
                  <td>{{ row.name }}</td>
                  <td>{{ formatTrafficCount(row.impressions) }}</td>
                  <td>{{ formatTrafficCount(row.clicks) }}</td>
                  <td>{{ formatTrafficRatio(row.ctr) }}</td>
                  <td>{{ formatTrafficCount(row.detailViews) }}</td>
                  <td>{{ formatTrafficCount(row.navigate) }}</td>
                  <td>{{ formatTrafficCount(row.call) }}</td>
                  <td>{{ formatTrafficCount(row.photos) }}</td>
                  <td>{{ formatTrafficRatio(row.engagementRate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="admin-cards analytics-cards">
            <article v-for="row in sortedCafeSurfaceRows" :key="row.surface" class="admin-card">
              <h2>{{ row.name }}</h2>
              <p>{{ formatTrafficCount(row.impressions) }} impressions · {{ formatTrafficCount(row.clicks) }} clicks · {{ formatTrafficRatio(row.ctr) }} CTR</p>
              <p>{{ formatTrafficCount(row.detailViews) }} pages · {{ formatTrafficCount(row.navigate) }} directions · {{ formatTrafficCount(row.call) }} calls · {{ formatTrafficCount(row.photos) }} photos</p>
            </article>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import {
  TRAFFIC_LEDGER_SURFACES,
  TRAFFIC_PAGE_SIZE,
  TRAFFIC_RANGES,
  TRAFFIC_TABS,
  cafeAnalyticsPath,
  dailyBars,
  filterCafeTraffic,
  filterDailyRows,
  recordsFilterCounts,
  formatTrafficCount,
  formatTrafficDay,
  formatTrafficRatio,
  formatTrafficWhen,
  manilaDateString,
  nextTrafficSort,
  perCafeTraffic,
  perSurfaceTraffic,
  promotionEmptyCopy,
  shopTrafficKindLabel,
  shopTrafficSurfaceLabel,
  sortCafeTraffic,
  sortSurfaceTraffic,
  tallyFromDaily,
  trafficLedgerEmptyCopy,
  trafficRangeStartDay,
  type RecordsKindFilter,
  type ShopTrafficRecordsQuery,
  type ShopTrafficDailyRow,
  type ShopTrafficEventRow,
  type ShopTrafficName,
  type ShopTrafficSurface,
  type TrafficActivityFilter,
  type TrafficRangeDays,
  type TrafficSortDir,
  type TrafficSortKey,
  type TrafficTabId,
} from '~/utils/shop-traffic'

const props = defineProps<{
  tone: 'admin' | 'owner'
  names: ShopTrafficName[]
  daily: ShopTrafficDailyRow[]
  events: ShopTrafficEventRow[]
  eventsDone: boolean
  eventsStatus: 'idle' | 'loading' | 'ready' | 'error'
  eventsError: string
  shopId?: string
}>()

const emit = defineEmits<{
  range: [days: TrafficRangeDays]
  records: [payload: ShopTrafficRecordsQuery]
  'more-events': []
}>()

const tab = ref<TrafficTabId>('statistics')
const range = ref<TrafficRangeDays>(30)
const recordsFilter = ref<RecordsKindFilter>('all')
const recordsShopId = ref('')
const shopQuery = ref('')
const surfaceFilter = ref<'all' | ShopTrafficSurface>('all')
const trafficQuery = ref('')
const trafficActivity = ref<TrafficActivityFilter>('all')
const trafficSortKey = ref<TrafficSortKey>('clicks')
const trafficSortDir = ref<TrafficSortDir>('desc')
const statsQuery = ref('')
const statsSortKey = ref<TrafficSortKey>('reach')
const statsSortDir = ref<TrafficSortDir>('desc')

const tabs = TRAFFIC_TABS.map((id) => ({
  id,
  label: id === 'statistics'
    ? 'Statistics'
    : id === 'records'
      ? 'Records'
      : id === 'promotion'
        ? 'Promotion'
        : 'Traffic',
}))
const ranges = TRAFFIC_RANGES
const recordFilters: Array<{ id: RecordsKindFilter, label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'reach', label: 'Reach' },
  { id: 'impressions', label: 'Impressions' },
  { id: 'clicks', label: 'Clicks' },
  { id: 'detail', label: 'Café pages' },
  { id: 'engagement', label: 'Engagement' },
]
const surfaceFilters: Array<{ id: 'all' | ShopTrafficSurface, label: string }> = [
  { id: 'all', label: 'All' },
  ...TRAFFIC_LEDGER_SURFACES.map((id) => ({ id, label: shopTrafficSurfaceLabel(id) })),
]
const activityFilters: Array<{ id: TrafficActivityFilter, label: string }> = [
  { id: 'all', label: 'All cafes' },
  { id: 'active', label: 'With traffic' },
  { id: 'quiet', label: 'No traffic' },
]
const trafficColumns: Array<{ key: TrafficSortKey, label: string }> = [
  { key: 'name', label: 'Cafe' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'ctr', label: 'CTR' },
  { key: 'detailViews', label: 'Pages' },
  { key: 'navigate', label: 'Directions' },
  { key: 'call', label: 'Call' },
  { key: 'photos', label: 'Photos' },
  { key: 'engagementRate', label: 'Engagement' },
]
const statsColumns: Array<{ key: TrafficSortKey, label: string }> = [
  { key: 'name', label: 'Cafe' },
  { key: 'reach', label: 'Reach' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'ctr', label: 'CTR' },
  { key: 'detailViews', label: 'Pages' },
  { key: 'engagement', label: 'Engagement' },
]
const surfaceColumns: Array<{ key: TrafficSortKey, label: string }> = [
  { key: 'name', label: 'Where' },
  { key: 'reach', label: 'Reach' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'ctr', label: 'CTR' },
  { key: 'detailViews', label: 'Pages' },
  { key: 'engagement', label: 'Engagement' },
]
const cafeTrafficColumns: Array<{ key: TrafficSortKey, label: string }> = [
  { key: 'name', label: 'Where' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'ctr', label: 'CTR' },
  { key: 'detailViews', label: 'Pages' },
  { key: 'navigate', label: 'Directions' },
  { key: 'call', label: 'Call' },
  { key: 'photos', label: 'Photos' },
  { key: 'engagementRate', label: 'Engagement' },
]

const chipClass = computed(() => (props.tone === 'admin' ? 'admin-chip' : 'owner-chip'))
const toolbarClass = computed(() => (props.tone === 'admin' ? 'admin-toolbar' : 'owner-toolbar'))
const emptyClass = computed(() => (props.tone === 'admin' ? 'admin-empty' : 'owner-empty'))

const focusedShopId = computed(() => props.shopId?.trim() || '')
const isCafeDesk = computed(() => Boolean(focusedShopId.value))
const cafeHref = (shopId: string) => cafeAnalyticsPath(props.tone, shopId)

const fromDay = computed(() => trafficRangeStartDay(range.value))
const today = computed(() => manilaDateString(new Date()))
const rangeDaily = computed(() => filterDailyRows(props.daily, {
  fromDay: fromDay.value,
  shopIds: focusedShopId.value ? [focusedShopId.value] : null,
}))
const overviewDaily = computed(() => filterDailyRows(props.daily, {
  fromDay: fromDay.value,
  shopIds: focusedShopId.value ? [focusedShopId.value] : null,
  surfaces: tab.value === 'promotion' ? ['promotion'] : null,
}))
const filteredDaily = computed(() => filterDailyRows(props.daily, {
  fromDay: fromDay.value,
  shopIds: focusedShopId.value ? [focusedShopId.value] : null,
  surfaces: surfaceFilter.value === 'all' || tab.value !== 'traffic' ? null : [surfaceFilter.value],
}))
const tally = computed(() => tallyFromDaily(overviewDaily.value))
const bars = computed(() => dailyBars(overviewDaily.value, fromDay.value, today.value))
const maxBar = computed(() => Math.max(0, ...bars.value.flatMap((bar) => [bar.clicks, bar.detailViews])))
const cafeRows = computed(() => perCafeTraffic(filteredDaily.value, props.names))
const statsCafeRows = computed(() => perCafeTraffic(overviewDaily.value, props.names))
const surfaceRows = computed(() => perSurfaceTraffic(rangeDaily.value))
const recordsDaily = computed(() => filterDailyRows(props.daily, {
  fromDay: fromDay.value,
  shopIds: focusedShopId.value
    ? [focusedShopId.value]
    : recordsShopId.value
      ? [recordsShopId.value]
      : null,
  surfaces: tab.value === 'promotion' ? ['promotion'] : null,
}))
const recordsCounts = computed(() => recordsFilterCounts(recordsDaily.value))
const matchedCafeRows = computed(() => filterCafeTraffic(cafeRows.value, {
  query: trafficQuery.value,
  activity: trafficActivity.value,
}))
const sortedCafeRows = computed(() => sortCafeTraffic(
  matchedCafeRows.value,
  trafficSortKey.value,
  trafficSortDir.value,
))
const trafficEmpty = computed(() => trafficLedgerEmptyCopy({
  query: trafficQuery.value,
  activity: trafficActivity.value,
}))
const trafficResetKey = computed(() => [
  tab.value,
  range.value,
  surfaceFilter.value,
  trafficQuery.value,
  trafficActivity.value,
  trafficSortKey.value,
  trafficSortDir.value,
  sortedCafeRows.value.length,
].join(':'))
const {
  slice: pagedCafeRows,
  hasMore: hasMoreTraffic,
  sentinel: trafficSentinel,
} = useInfiniteWindow(sortedCafeRows, trafficResetKey, TRAFFIC_PAGE_SIZE)

const matchedStatsCafeRows = computed(() => filterCafeTraffic(statsCafeRows.value, {
  query: statsQuery.value,
  activity: tab.value === 'promotion' ? 'active' : 'all',
}))
const sortedStatsCafeRows = computed(() => sortCafeTraffic(
  matchedStatsCafeRows.value,
  statsSortKey.value,
  statsSortDir.value,
))
const statsEmpty = computed(() => tab.value === 'promotion'
  ? promotionEmptyCopy(statsQuery.value)
  : trafficLedgerEmptyCopy({
    query: statsQuery.value,
  }))
const statsResetKey = computed(() => [
  tab.value,
  range.value,
  statsQuery.value,
  statsSortKey.value,
  statsSortDir.value,
  sortedStatsCafeRows.value.length,
].join(':'))
const {
  slice: pagedStatsCafeRows,
  hasMore: hasMoreStats,
  sentinel: statsSentinel,
} = useInfiniteWindow(sortedStatsCafeRows, statsResetKey, TRAFFIC_PAGE_SIZE)

const sortedSurfaceRows = computed(() => sortSurfaceTraffic(
  surfaceRows.value,
  statsSortKey.value,
  statsSortDir.value,
))
const sortedCafeSurfaceRows = computed(() => sortSurfaceTraffic(
  surfaceRows.value,
  trafficSortKey.value,
  trafficSortDir.value,
))

const onTrafficSort = (key: TrafficSortKey) => {
  const next = nextTrafficSort(trafficSortKey.value, trafficSortDir.value, key)
  trafficSortKey.value = next.key
  trafficSortDir.value = next.dir
}

const onStatsSort = (key: TrafficSortKey) => {
  const next = nextTrafficSort(statsSortKey.value, statsSortDir.value, key)
  statsSortKey.value = next.key
  statsSortDir.value = next.dir
}

const sortColumnLabel = (
  column: { key: TrafficSortKey, label: string },
  activeKey: TrafficSortKey,
  dir: TrafficSortDir,
) => {
  const active = activeKey === column.key
  if (column.key === 'name') {
    if (!active) return `Sort by ${column.label}, A to Z`
    return dir === 'asc' ? `Sort by ${column.label}, Z to A` : `Sort by ${column.label}, A to Z`
  }
  if (!active) return `Sort by ${column.label}, highest first`
  return dir === 'desc'
    ? `Sort by ${column.label}, lowest first`
    : `Sort by ${column.label}, highest first`
}

const tallyCards = computed(() => {
  if (isCafeDesk.value || tab.value === 'promotion') {
    return [
      { label: 'Reach', value: formatTrafficCount(tally.value.reach) },
      { label: 'Card impressions', value: formatTrafficCount(tally.value.impressions) },
      { label: 'Card clicks', value: formatTrafficCount(tally.value.clicks) },
      { label: 'Card CTR', value: formatTrafficRatio(tally.value.ctr) },
      { label: 'Café pages', value: formatTrafficCount(tally.value.detailViews) },
      { label: 'Engagement', value: formatTrafficCount(tally.value.engagement) },
    ]
  }
  return [
    { label: 'Card impressions', value: formatTrafficCount(tally.value.impressions) },
    { label: 'Card clicks', value: formatTrafficCount(tally.value.clicks) },
    { label: 'Card CTR', value: formatTrafficRatio(tally.value.ctr) },
    { label: 'Café pages', value: formatTrafficCount(tally.value.detailViews) },
    { label: 'Engagement', value: formatTrafficCount(tally.value.engagement) },
    { label: 'Page engagement', value: formatTrafficRatio(tally.value.engagementRate) },
  ]
})

const nameById = computed(() => new Map(props.names.map((shop) => [shop.id, shop.name])))
const shopName = (id: string) => nameById.value.get(id) || 'Unknown cafe'

const visibleEvents = computed(() => {
  const query = shopQuery.value.trim().toLowerCase()
  if (isCafeDesk.value || props.tone !== 'admin' || !query) return props.events
  return props.events.filter((row) => shopName(row.shop_id).toLowerCase().includes(query))
})

const barHeight = (value: number) => {
  if (maxBar.value <= 0) return '0'
  return `${Math.max(2, Math.round((value / maxBar.value) * 48))}px`
}

watch(range, (days) => {
  emit('range', days)
})

watch(
  [tab, range, recordsFilter, recordsShopId, focusedShopId],
  () => {
    if (tab.value !== 'records' && tab.value !== 'promotion') return
    emit('records', {
      days: range.value,
      filter: recordsFilter.value,
      shopId: focusedShopId.value || recordsShopId.value || null,
      surface: tab.value === 'promotion' ? 'promotion' : null,
    })
  },
)
</script>

<style scoped>
.analytics-board {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.analytics-controls,
.analytics-panel,
.analytics-panel__filters {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.analytics-panel {
  gap: 20px;
}

.analytics-panel__filters > .admin-search,
.analytics-panel__filters > .owner-search {
  width: 100%;
}

.analytics-panel__chips {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 24px;
}

.analytics-panel__chips > * {
  flex: 1 1 0;
  min-width: 0;
}

.analytics-tallies {
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

.analytics-tallies__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
  padding: 16px 16px 14px;
  border-right: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
}

.analytics-tallies__item:nth-child(2n) {
  border-right: 0;
}

.analytics-tallies__item:nth-last-child(-n + 2) {
  border-bottom: 0;
}

.analytics-tallies__num {
  color: var(--kd-ink);
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.analytics-tallies__label {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.3;
}

.analytics-trend,
.analytics-cafes {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.analytics-trend h2,
.analytics-cafes h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.analytics-cafes__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
}

.analytics-cafes__head > .admin-search,
.analytics-cafes__head > .owner-search {
  flex: 1 1 180px;
  max-width: 280px;
}

.analytics-cafes__table {
  margin: 0 -16px;
  border: 0;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
  border-radius: 0;
  background: transparent;
}

.analytics-cafes__cards {
  margin: 0;
}

.analytics-trend__empty,
.analytics-cafes__empty {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.3;
}

.analytics-bars {
  display: flex;
  gap: 6px;
  align-items: flex-end;
  overflow-x: auto;
  margin: 0;
  padding: 4px 0 0;
  list-style: none;
  min-height: 72px;
}

.analytics-bars__item {
  display: flex;
  flex: 1 0 18px;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 18px;
}

.analytics-bars__pair {
  display: flex;
  gap: 2px;
  align-items: flex-end;
  height: 48px;
}

.analytics-bars__fill {
  width: 6px;
  border-radius: 4px 4px 0 0;
  background: var(--kd-primary);
}

.analytics-bars__fill--clicks {
  background: var(--kd-accent);
}

.analytics-bars__day {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.65rem;
  white-space: nowrap;
}

.analytics-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.75rem;
  line-height: 1.3;
}

.analytics-legend__swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 6px;
  border-radius: 2px;
  background: var(--kd-primary);
}

.analytics-legend__swatch--clicks {
  background: var(--kd-accent);
}

.analytics-panel > .admin-btn,
.analytics-panel > .owner-btn {
  align-self: flex-start;
}

.analytics-more {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.3;
}

.analytics-count {
  font-variant-numeric: tabular-nums;
}

.analytics-cafe {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin: -12px -16px;
  padding: 12px 16px;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.analytics-cafe:hover {
  color: var(--kd-primary);
}

.analytics-cafe:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.analytics-cafes__cards .analytics-cafe,
.analytics-cards .analytics-cafe {
  margin: -8px -4px;
  padding: 8px 4px;
}

.analytics-sort {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  margin: -12px -16px;
  padding: 12px 16px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}

.analytics-sort.is-active {
  color: var(--kd-ink);
}

.analytics-sort__mark {
  font-weight: 700;
  line-height: 1;
}

.analytics-search {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.7875rem;
}

.analytics-search input,
.analytics-search select {
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  font: inherit;
}

.analytics-cards {
  display: none;
}

@media (max-width: 767px) {
  .analytics-table {
    display: none;
  }

  .analytics-cards {
    display: grid;
    gap: 12px;
  }

  .analytics-cafes__cards .admin-card {
    padding: 12px 0;
    border: 0;
    border-top: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
    border-radius: 0;
    background: transparent;
  }
}

@media (min-width: 720px) {
  .analytics-controls {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px 16px;
  }

  .analytics-tallies {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .analytics-tallies__item:nth-child(2n) {
    border-right: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
  }

  .analytics-tallies__item:nth-child(3n) {
    border-right: 0;
  }

  .analytics-tallies__item:nth-last-child(-n + 3) {
    border-bottom: 0;
  }
}
</style>
