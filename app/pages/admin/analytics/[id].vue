<template>
  <IonPage>
    <AdminShell
      :title="cafeName || 'Cafe analytics'"
      lede="How this café card and café page are seen, opened, and used."
      :status="status"
      :error="error"
    >
      <DeskAnalyticsBoard
        v-if="shopId"
        tone="admin"
        :shop-id="shopId"
        :names="names"
        :daily="daily"
        :events="events"
        :events-done="eventsDone"
        :events-status="eventsStatus"
        :events-error="eventsError"
        @range="onRange"
        @records="onRecords"
        @more-events="onMore"
      />
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { onIonViewWillEnter, useIonRouter } from '@ionic/vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import DeskAnalyticsBoard from '~/components/desk/DeskAnalyticsBoard.vue'
import { shopIdFromRoute } from '~/utils/approved-shops'
import type { ShopTrafficRecordsQuery, TrafficRangeDays } from '~/utils/shop-traffic'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const route = useRoute()
const ionRouter = useIonRouter()
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

const range = ref<TrafficRangeDays>(30)
const records = ref<ShopTrafficRecordsQuery | null>(null)

function resolveShopId(): string {
  const param = route.params.id
  const href = import.meta.client
    ? `${window.location.pathname}${window.location.hash}${window.location.search}`
    : ''
  return (
    shopIdFromRoute(route.fullPath, param)
    || shopIdFromRoute(route.path, param)
    || shopIdFromRoute(String(ionRouter.routeInfo?.pathname || ''), param)
    || shopIdFromRoute(href, param)
  )
}

const shopId = computed(() => resolveShopId())
const cafeName = computed(() => names.value[0]?.name || '')

let emptyIdTimer: ReturnType<typeof window.setTimeout> | null = null

const reload = (days: TrafficRangeDays) => {
  if (emptyIdTimer) {
    window.clearTimeout(emptyIdTimer)
    emptyIdTimer = null
  }
  const id = resolveShopId()
  if (!id) {
    emptyIdTimer = window.setTimeout(() => reload(days), 600)
    return
  }
  void loadDaily(days, undefined, id)
}

const onRange = (days: TrafficRangeDays) => {
  range.value = days
  reload(days)
  if (records.value) {
    records.value = { ...records.value, days }
    void loadEvents({ ...records.value, days })
  }
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
  reload(range.value)
})

onIonViewWillEnter(() => {
  reload(range.value)
})

onBeforeUnmount(() => {
  if (emptyIdTimer) window.clearTimeout(emptyIdTimer)
})
</script>
