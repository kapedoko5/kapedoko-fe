<template>
  <div class="analytics-board">
    <RangeTabs
      v-model:tab="tab"
      v-model:range="range"
      :tone="tone"
      :tabs="tabs"
      :ranges="ranges"
    >
      <template #actions>
        <button
          v-if="canExport"
          type="button"
          :class="tone === 'admin' ? 'admin-btn' : 'owner-btn'"
          :disabled="exportRows.length === 0"
          @click="onExport"
        >
          Export CSV
        </button>
      </template>
    </RangeTabs>

    <div
      :id="`analytics-panel-${tab}`"
      class="analytics-panel"
      role="tabpanel"
      :aria-labelledby="`analytics-tab-${tab}`"
    >
      <template v-if="tab === 'statistics' || tab === 'promotion'">
        <EmptyState
          v-if="tab === 'statistics' && emptyKind"
          :tone="tone"
          :kind="emptyKind"
          :days="range"
        />
        <template v-else>
          <KpiStrip :cards="kpiCards" :days="range" />

          <TrendChart
            :points="series"
            :empty-text="tab === 'promotion' ? promotionEmptyCopy() : 'No café listing traffic in this window yet.'"
          />

          <Funnel :steps="funnel" />

          <Sources v-if="tab === 'statistics'" :rows="sources" />
        </template>

        <CafeLedger
          v-if="!isCafeDesk && !(tab === 'statistics' && emptyKind)"
          title="Cafes"
          title-id="analytics-cafes-title"
          :columns="statsColumns"
          :rows="statsLedgerRows"
          :sort-key="statsSortKey"
          :sort-dir="statsSortDir"
          :empty-text="statsEmpty"
          @sort="onStatsSort"
        >
          <template #controls>
            <input
              v-model="statsQuery"
              :class="tone === 'admin' ? 'admin-search' : 'owner-search'"
              type="search"
              placeholder="Search cafe"
              aria-label="Search cafe"
            />
          </template>
          <template #footer>
            <p v-if="hasMoreStats" ref="statsSentinel" class="analytics-muted">Scroll for more</p>
          </template>
        </CafeLedger>

        <template v-if="tab === 'promotion'">
          <div class="analytics-panel__filters">
            <div :class="toolbarClass" role="group" aria-label="Record type">
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
          <ActivityLog
            :tone="tone"
            :events="visibleEvents"
            :done="eventsDone"
            :status="eventsStatus"
            :error="eventsError"
            empty-text="No promotion records in this window."
            :show-cafe="!isCafeDesk"
            :show-where="false"
            :name-for="shopName"
            :cafe-href="cafeHref"
            @more="emit('more-events')"
          />
        </template>
      </template>

      <template v-else-if="tab === 'records'">
        <div class="analytics-panel__filters">
          <div :class="toolbarClass" role="group" aria-label="Record type">
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
        <ActivityLog
          :tone="tone"
          :events="visibleEvents"
          :done="eventsDone"
          :status="eventsStatus"
          :error="eventsError"
          empty-text="No records in this window."
          :show-cafe="!isCafeDesk"
          :show-where="true"
          :name-for="shopName"
          :cafe-href="cafeHref"
          @more="emit('more-events')"
        />
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
            <div :class="toolbarClass" role="group" aria-label="Activity">
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
            <div :class="toolbarClass" role="group" aria-label="Surface">
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
        <CafeLedger
          v-else-if="!isCafeDesk"
          title="Cafe traffic"
          title-id="analytics-traffic-title"
          :columns="trafficColumns"
          :rows="trafficLedgerRows"
          :sort-key="trafficSortKey"
          :sort-dir="trafficSortDir"
          empty-text=""
          @sort="onTrafficSort"
        >
          <template #footer>
            <p v-if="hasMoreTraffic" ref="trafficSentinel" class="analytics-muted">Scroll for more</p>
          </template>
        </CafeLedger>
        <CafeLedger
          v-else
          title="Traffic by source"
          title-id="analytics-traffic-title"
          :columns="trafficColumns"
          :rows="surfaceLedgerRows"
          :sort-key="trafficSortKey"
          :sort-dir="trafficSortDir"
          empty-text="No sources in this window."
          @sort="onTrafficSort"
        />
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { Capacitor } from '@capacitor/core'
import ActivityLog from '~/components/desk/analytics/ActivityLog.vue'
import CafeLedger, { type LedgerColumn, type LedgerRow } from '~/components/desk/analytics/CafeLedger.vue'
import EmptyState from '~/components/desk/analytics/EmptyState.vue'
import Funnel from '~/components/desk/analytics/Funnel.vue'
import KpiStrip, { type KpiCard } from '~/components/desk/analytics/KpiStrip.vue'
import RangeTabs from '~/components/desk/analytics/RangeTabs.vue'
import Sources from '~/components/desk/analytics/Sources.vue'
import TrendChart from '~/components/desk/analytics/TrendChart.vue'
import {
  analyticsCsvFilename,
  dailyRowsToCsv,
  downloadCsv,
} from '~/utils/analytics-export'
import {
  TRAFFIC_LEDGER_SURFACES,
  TRAFFIC_PAGE_SIZE,
  TRAFFIC_RANGES,
  TRAFFIC_TABS,
  cafeAnalyticsPath,
  filterCafeTraffic,
  filterDailyRows,
  formatTrafficCount,
  formatTrafficRatio,
  manilaDateString,
  nextTrafficSort,
  perCafeTraffic,
  perSurfaceTraffic,
  promotionEmptyCopy,
  recordsFilterCounts,
  shopTrafficSurfaceLabel,
  sortCafeTraffic,
  sortSurfaceTraffic,
  tallyFromDaily,
  trafficLedgerEmptyCopy,
  type RecordsKindFilter,
  type ShopTrafficDailyRow,
  type ShopTrafficEventRow,
  type ShopTrafficName,
  type ShopTrafficRecordsQuery,
  type ShopTrafficSurface,
  type ShopTrafficTally,
  type TrafficActivityFilter,
  type TrafficRangeDays,
  type TrafficSortDir,
  type TrafficSortKey,
  type TrafficTabId,
} from '~/utils/shop-traffic'
import {
  analyticsEmptyKind,
  buildAnalyticsQuery,
  dailySeries,
  funnelSteps,
  kpiDelta,
  parseAnalyticsQuery,
  rankSources,
  splitTrafficPeriods,
} from '~/utils/traffic-analytics'

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

const route = useRoute()
const basePath = route.path
const initial = parseAnalyticsQuery(route.query)

const tab = ref<TrafficTabId>(initial.tab)
const range = ref<TrafficRangeDays>(initial.range)
const recordsFilter = ref<RecordsKindFilter>('all')
const recordsShopId = ref('')
const shopQuery = ref('')
const surfaceFilter = ref<'all' | ShopTrafficSurface>('all')
const trafficQuery = ref('')
const trafficActivity = ref<TrafficActivityFilter>('all')
const trafficSortKey = ref<TrafficSortKey>('clicks')
const trafficSortDir = ref<TrafficSortDir>('desc')
const statsQuery = ref('')
const statsSortKey = ref<TrafficSortKey>('visits')
const statsSortDir = ref<TrafficSortDir>('desc')
const canExport = ref(false)

const TAB_LABEL: Record<TrafficTabId, string> = {
  statistics: 'Statistics',
  records: 'Records',
  traffic: 'Traffic',
  promotion: 'Promotion',
}
const tabs = TRAFFIC_TABS.map((id) => ({ id, label: TAB_LABEL[id] }))
const ranges = TRAFFIC_RANGES
const recordFilters: Array<{ id: RecordsKindFilter, label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'visits', label: 'Visits' },
  { id: 'impressions', label: 'Impressions' },
  { id: 'clicks', label: 'Clicks' },
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
const trafficColumns: LedgerColumn[] = [
  { key: 'name', label: 'Cafe' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'ctr', label: 'CTR' },
  { key: 'visits', label: 'Visits' },
  { key: 'navigate', label: 'Directions' },
  { key: 'call', label: 'Call' },
  { key: 'photos', label: 'Photos' },
  { key: 'engagementRate', label: 'Engagement' },
]
const statsColumns: LedgerColumn[] = [
  { key: 'name', label: 'Cafe' },
  { key: 'visits', label: 'Visits' },
  { key: 'impressions', label: 'Impressions' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'ctr', label: 'CTR' },
  { key: 'engagement', label: 'Engagement' },
]

const chipClass = computed(() => (props.tone === 'admin' ? 'admin-chip' : 'owner-chip'))
const toolbarClass = computed(() => (props.tone === 'admin' ? 'admin-toolbar' : 'owner-toolbar'))
const emptyClass = computed(() => (props.tone === 'admin' ? 'admin-empty' : 'owner-empty'))

const focusedShopId = computed(() => props.shopId?.trim() || '')
const isCafeDesk = computed(() => Boolean(focusedShopId.value))
const cafeHref = (shopId: string) => cafeAnalyticsPath(props.tone, shopId)

const today = computed(() => manilaDateString(new Date()))
// daily holds 2x the range; the split yields the current and the previous window.
const split = computed(() => splitTrafficPeriods(props.daily, range.value, {
  shopIds: focusedShopId.value ? [focusedShopId.value] : null,
}))
const scoped = (rows: ShopTrafficDailyRow[]) =>
  tab.value === 'promotion' ? rows.filter((row) => row.surface === 'promotion') : rows
const currentRows = computed(() => split.value.current)
const overviewRows = computed(() => scoped(split.value.current))
const previousOverviewRows = computed(() => scoped(split.value.previous))

const tally = computed(() => tallyFromDaily(overviewRows.value))
const previousTally = computed(() => tallyFromDaily(previousOverviewRows.value))
const emptyKind = computed(() => analyticsEmptyKind(tally.value, previousTally.value))
const series = computed(() => dailySeries(overviewRows.value, split.value.currentFrom, split.value.currentTo))
const funnel = computed(() => funnelSteps(tally.value))
const sources = computed(() => rankSources(currentRows.value))

const count = (value: number) => formatTrafficCount(value)
const kpiCards = computed<KpiCard[]>(() => {
  const now = tally.value
  const before = previousTally.value
  const points = series.value
  return [
    {
      id: 'impressions',
      label: 'Card impressions',
      value: count(now.impressions),
      delta: kpiDelta('impressions', now.impressions, before.impressions),
      previousValue: count(before.impressions),
      series: points.map((p) => p.impressions),
    },
    {
      id: 'clicks',
      label: 'Card clicks',
      value: count(now.clicks),
      delta: kpiDelta('clicks', now.clicks, before.clicks),
      previousValue: count(before.clicks),
      series: points.map((p) => p.clicks),
    },
    {
      id: 'ctr',
      label: 'Card CTR',
      value: formatTrafficRatio(now.ctr),
      previousValue: formatTrafficRatio(before.ctr),
    },
    {
      id: 'visits',
      label: 'Visits',
      value: count(now.visits),
      delta: kpiDelta('visits', now.visits, before.visits),
      previousValue: count(before.visits),
      series: points.map((p) => p.visits),
    },
    {
      id: 'actions',
      label: 'Actions',
      value: count(now.engagement),
      delta: kpiDelta('actions', now.engagement, before.engagement),
      previousValue: count(before.engagement),
      series: points.map((p) => p.actions),
    },
    {
      id: 'rate',
      label: 'Actions per visit',
      value: formatTrafficRatio(now.engagementRate),
      previousValue: formatTrafficRatio(before.engagementRate),
    },
  ]
})

const filteredRows = computed(() => filterDailyRows(currentRows.value, {
  fromDay: split.value.currentFrom,
  surfaces: surfaceFilter.value === 'all' || tab.value !== 'traffic' ? null : [surfaceFilter.value],
}))
const cafeRows = computed(() => perCafeTraffic(filteredRows.value, props.names))
const statsCafeRows = computed(() => perCafeTraffic(overviewRows.value, props.names))
const surfaceRows = computed(() => perSurfaceTraffic(currentRows.value))
const recordsDaily = computed(() => filterDailyRows(overviewRows.value, {
  fromDay: split.value.currentFrom,
  shopIds: !focusedShopId.value && recordsShopId.value ? [recordsShopId.value] : null,
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
  : trafficLedgerEmptyCopy({ query: statsQuery.value }))
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

const sortedCafeSurfaceRows = computed(() => sortSurfaceTraffic(
  surfaceRows.value,
  trafficSortKey.value,
  trafficSortDir.value,
))

const cellsFor = (row: ShopTrafficTally): LedgerRow['cells'] => ({
  visits: count(row.visits),
  impressions: count(row.impressions),
  clicks: count(row.clicks),
  ctr: formatTrafficRatio(row.ctr),
  navigate: count(row.navigate),
  call: count(row.call),
  photos: count(row.photos),
  engagement: count(row.engagement),
  engagementRate: formatTrafficRatio(row.engagementRate),
})
const statsLedgerRows = computed<LedgerRow[]>(() => pagedStatsCafeRows.value.map((row) => ({
  id: row.shopId,
  name: row.name,
  href: cafeHref(row.shopId),
  cells: cellsFor(row),
})))
const trafficLedgerRows = computed<LedgerRow[]>(() => pagedCafeRows.value.map((row) => ({
  id: row.shopId,
  name: row.name,
  href: cafeHref(row.shopId),
  cells: cellsFor(row),
})))
const surfaceLedgerRows = computed<LedgerRow[]>(() => sortedCafeSurfaceRows.value.map((row) => ({
  id: row.surface,
  name: row.name,
  cells: cellsFor(row),
})))

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

const nameById = computed(() => new Map(props.names.map((shop) => [shop.id, shop.name])))
const shopName = (id: string) => nameById.value.get(id) || 'Unknown cafe'

const visibleEvents = computed(() => {
  const query = shopQuery.value.trim().toLowerCase()
  if (isCafeDesk.value || props.tone !== 'admin' || !query) return props.events
  return props.events.filter((row) => shopName(row.shop_id).toLowerCase().includes(query))
})

const exportRows = computed(() => overviewRows.value)
const onExport = () => {
  const scope = isCafeDesk.value ? shopName(focusedShopId.value) : 'all cafes'
  downloadCsv(
    analyticsCsvFilename(scope, range.value, today.value),
    dailyRowsToCsv(exportRows.value, props.names),
  )
}

watch(range, (days) => {
  emit('range', days)
})

// Records are re-fetched here only; parents must not fetch events on range change.
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
  { immediate: true },
)

// Keep ?tab=&range= in the URL. Uses history.replaceState instead of router.replace:
// a router navigation under Ionic's outlet re-resolves the page and was bouncing users to Home.
watch([tab, range], () => {
  if (typeof window === 'undefined' || route.path !== basePath) return
  const query = buildAnalyticsQuery(route.query, { tab: tab.value, range: range.value }) as Record<string, string>
  const search = new URLSearchParams(query).toString()
  const url = `${basePath}${search ? `?${search}` : ''}${route.hash || ''}`
  try {
    window.history.replaceState(window.history.state, '', url)
  } catch {
    // Ignore: URL state is a convenience only.
  }
})

onMounted(() => {
  canExport.value = !Capacitor.isNativePlatform()
})
</script>

<style scoped>
.analytics-board {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

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
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 24px;
}

.analytics-panel__chips > * {
  flex: 1 1 240px;
  min-width: 0;
}

.analytics-count {
  font-variant-numeric: tabular-nums;
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
</style>
