<template>
  <IonPage>
    <AdminShell
      title="Analytics"
      lede="How café cards and café pages are seen, opened, and used."
      :status="status"
      :error="error"
    >
      <DeskAnalyticsBoard
        tone="admin"
        :names="names"
        :daily="daily"
        :events="events"
        :events-done="eventsDone"
        :events-status="eventsStatus"
        :events-error="eventsError"
        :ad-summary="adStats.summary.value"
        @range="onRange"
        @records="onRecords"
        @more-events="onMore"
      />
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import AdminShell from '~/components/admin/AdminShell.vue'
import DeskAnalyticsBoard from '~/components/desk/DeskAnalyticsBoard.vue'
import { parseAnalyticsQuery } from '~/utils/traffic-analytics'
import type { ShopTrafficRecordsQuery, TrafficRangeDays } from '~/utils/shop-traffic'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const route = useRoute()
const desk = useShopTrafficDesk()
const {
  daily,
  events,
  names,
  status,
  eventsStatus,
  error,
  eventsError,
  eventsDone,
  loadDaily,
  loadEvents,
} = desk

const adStats = useAdCampaignStats()
const range = ref<TrafficRangeDays>(parseAnalyticsQuery(route.query).range)
const records = ref<ShopTrafficRecordsQuery | null>(null)

const onRange = (days: TrafficRangeDays) => {
  range.value = days
  void loadDaily(days)
  void adStats.loadAdmin(days)
  // Records are re-fetched by the board's own `records` event, not here.
}

const onRecords = (payload: ShopTrafficRecordsQuery) => {
  records.value = payload
  void loadEvents(payload)
}

const onMore = () => {
  if (!records.value) return
  void loadEvents({ ...records.value, append: true })
}

onMounted(() => {
  void loadDaily(range.value)
  void adStats.loadAdmin(range.value)
})
</script>
