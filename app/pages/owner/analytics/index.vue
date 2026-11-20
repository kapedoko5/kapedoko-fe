<template>
  <IonPage>
    <OwnerShell
      title="Analytics"
      lede="How people find your café cards and what they do on the page."
      :status="pageStatus"
      :error="pageError"
      :claim-count="waitingClaims.length"
    >
      <p v-if="ownedNames.length === 0" class="owner-empty">
        {{ liveCafes.length === 0 ? ownerAnalyticsEmptyCopy(waitingClaims.length) : ownerAnalyticsLockedCopy() }}
      </p>
      <DeskAnalyticsBoard
        v-else
        tone="owner"
        :names="ownedNames"
        :daily="daily"
        :events="events"
        :events-done="eventsDone"
        :events-status="eventsStatus"
        :events-error="eventsError"
        @range="onRange"
        @records="onRecords"
        @more-events="onMore"
      />
    </OwnerShell>
  </IonPage>
</template>

<script lang="ts" setup>
import DeskAnalyticsBoard from '~/components/desk/DeskAnalyticsBoard.vue'
import OwnerShell from '~/components/owner-portal/OwnerShell.vue'
import { ownerAnalyticsEmptyCopy, ownerAnalyticsLockedCopy, type ShopTrafficRecordsQuery, type TrafficRangeDays } from '~/utils/shop-traffic'

definePageMeta({
  middleware: ['owner'],
})

const portal = useOwnerPortal()
const {
  liveCafes,
  waitingClaims,
  hasFeature,
  status: portalStatus,
  error: portalError,
  access,
  loadDesk,
} = portal

const desk = useShopTrafficDesk()
const {
  daily,
  events,
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

const ownedNames = computed(() =>
  liveCafes.value
    .filter((shop) => hasFeature(shop.id, 'analytics'))
    .map((shop) => ({ id: shop.id, name: shop.name })),
)
const ownedIds = () => ownedNames.value.map((shop) => shop.id)
const pageStatus = computed(() => {
  if (access.value === 'forbidden') return 'forbidden' as const
  if (portalStatus.value === 'loading' || portalStatus.value === 'idle') return portalStatus.value
  if (ownedNames.value.length === 0) return 'ready' as const
  return status.value
})
const pageError = computed(() => portalError.value || error.value)

const reload = (days: TrafficRangeDays) => {
  if (ownedNames.value.length === 0) return
  void loadDaily(days, ownedNames.value)
}

const onRange = (days: TrafficRangeDays) => {
  range.value = days
  reload(days)
  if (records.value) {
    records.value = { ...records.value, days }
    void loadEvents({ ...records.value, days, shopIds: ownedIds() })
  }
}

const onRecords = (payload: ShopTrafficRecordsQuery) => {
  records.value = payload
  void loadEvents({ ...payload, shopIds: ownedIds() })
}

const onMore = () => {
  if (!records.value) return
  void loadEvents({ ...records.value, append: true, shopIds: ownedIds() })
}

onMounted(async () => {
  await loadDesk()
  reload(range.value)
})
</script>
