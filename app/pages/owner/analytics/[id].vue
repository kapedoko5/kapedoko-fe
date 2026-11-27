<template>
  <IonPage>
    <OwnerShell
      :title="cafeName || 'Cafe analytics'"
      lede="How people find this café card and what they do on the page."
      :status="pageStatus"
      :error="pageError"
      :claim-count="waitingClaims.length"
    >
      <p v-if="ownedNames.length === 0 && liveCafes.length === 0" class="owner-empty">
        {{ ownerAnalyticsEmptyCopy(waitingClaims.length) }}
      </p>
      <EmptyState
        v-else-if="ownedNames.length === 0 || (!ownedCafe && liveCafes.some((shop) => shop.id === shopId))"
        tone="owner"
        kind="locked"
      />
      <p v-else-if="!ownedCafe" class="owner-empty">This listing is not yours to see yet.</p>
      <DeskAnalyticsBoard
        v-else-if="shopId"
        tone="owner"
        :shop-id="shopId"
        :names="ownedCafe ? [ownedCafe] : []"
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
import { onIonViewWillEnter, useIonRouter } from '@ionic/vue'
import DeskAnalyticsBoard from '~/components/desk/DeskAnalyticsBoard.vue'
import EmptyState from '~/components/desk/analytics/EmptyState.vue'
import OwnerShell from '~/components/owner-portal/OwnerShell.vue'
import { shopIdFromRoute } from '~/utils/approved-shops'
import { settleOwnerIonPages } from '~/utils/owner-nav'
import { parseAnalyticsQuery } from '~/utils/traffic-analytics'
import { ownerAnalyticsEmptyCopy, type ShopTrafficRecordsQuery, type TrafficRangeDays } from '~/utils/shop-traffic'

definePageMeta({
  middleware: ['owner'],
})

const route = useRoute()
const ionRouter = useIonRouter()
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
const ownedNames = computed(() =>
  liveCafes.value
    .filter((shop) => hasFeature(shop.id, 'analytics'))
    .map((shop) => ({ id: shop.id, name: shop.name })),
)
const ownedCafe = computed(() => ownedNames.value.find((shop) => shop.id === shopId.value) || null)
const cafeName = computed(() => ownedCafe.value?.name || '')
const pageStatus = computed(() => {
  if (access.value === 'forbidden') return 'forbidden' as const
  if (portalStatus.value === 'loading' || portalStatus.value === 'idle') return portalStatus.value
  if (ownedNames.value.length === 0 || !ownedCafe.value) return 'ready' as const
  return status.value
})
const pageError = computed(() => portalError.value || error.value)

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
  const cafe = ownedNames.value.find((shop) => shop.id === id)
  if (!cafe) return
  void loadDaily(days, [cafe], cafe.id)
}

const onRange = (days: TrafficRangeDays) => {
  range.value = days
  reload(days)
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

const boot = async () => {
  await loadDesk()
  reload(range.value)
}

onMounted(() => {
  void boot()
})

onIonViewWillEnter(() => {
  if (import.meta.client) requestAnimationFrame(settleOwnerIonPages)
  void boot()
})

onBeforeUnmount(() => {
  if (emptyIdTimer) window.clearTimeout(emptyIdTimer)
})
</script>
