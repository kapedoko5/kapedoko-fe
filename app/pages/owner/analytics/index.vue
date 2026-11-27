<template>
  <IonPage>
    <OwnerShell
      title="Analytics"
      lede="How people find your café cards and what they do on the page."
      :status="pageStatus"
      :error="pageError"
      :claim-count="waitingClaims.length"
    >
      <p v-if="ownedNames.length === 0 && liveCafes.length === 0" class="owner-empty">
        {{ ownerAnalyticsEmptyCopy(waitingClaims.length) }}
      </p>
      <EmptyState v-else-if="ownedNames.length === 0" tone="owner" kind="locked" />
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
import { onIonViewWillEnter } from '@ionic/vue'
import DeskAnalyticsBoard from '~/components/desk/DeskAnalyticsBoard.vue'
import EmptyState from '~/components/desk/analytics/EmptyState.vue'
import OwnerShell from '~/components/owner-portal/OwnerShell.vue'
import { parseAnalyticsQuery } from '~/utils/traffic-analytics'
import { ownerAnalyticsEmptyCopy, type ShopTrafficRecordsQuery, type TrafficRangeDays } from '~/utils/shop-traffic'

definePageMeta({
  middleware: ['owner'],
})

const route = useRoute()
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

const range = ref<TrafficRangeDays>(parseAnalyticsQuery(route.query).range)
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
  // Records are re-fetched by the board's own `records` event, not here.
}

const onRecords = (payload: ShopTrafficRecordsQuery) => {
  records.value = payload
  void loadEvents({ ...payload, shopIds: ownedIds() })
}

const onMore = () => {
  if (!records.value) return
  void loadEvents({ ...records.value, append: true, shopIds: ownedIds() })
}

// Share one in-flight boot so mount and view-enter do not double-load.
let booting: Promise<void> | null = null
const boot = () => {
  booting ??= (async () => {
    try {
      await loadDesk()
      reload(range.value)
    } finally {
      booting = null
    }
  })()
  return booting
}

onMounted(() => {
  void boot()
})

// Ionic keeps this page alive when you leave it, so reload when you come back.
onIonViewWillEnter(() => {
  void boot()
})
</script>
