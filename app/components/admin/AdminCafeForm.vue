<template>
  <form class="admin-form" @submit.prevent="onSubmit">
    <div class="admin-panel">
      <CafeIdentityStep
        :key="`identity-${resetStamp}`"
        :name="draft.name"
        :logo-file="draft.logoFile"
        :logo-object-key="draft.logoObjectKey"
        :logo-preview-url="logoPreviewUrl"
        :logo-source-label="logoSourceLabel"
        :logo-sources="logoSources"
        :logo-sources-status="logoSourcesStatus"
        :name-issue="issues.name"
        :logo-issue="issues.logo"
        lede="This cafe is published as soon as you save it. It can sit anywhere, including outside Metro Manila."
        @update:name="draft.name = $event"
        @update:logoFile="onLogoFile"
        @update:logoObjectKey="onLogoObjectKey"
      />
      <CafeDetailsStep
        :key="`details-${resetStamp}`"
        :phone="draft.phone"
        :same-every-day="draft.sameEveryDay"
        :all-day="draft.allDay"
        :open-time="draft.openTime"
        :close-time="draft.closeTime"
        :weekly="draft.weekly"
        :phone-issue="issues.phone"
        :hours-issue="issues.hours"
        @update:phone="draft.phone = $event"
        @update:sameEveryDay="draft.sameEveryDay = $event"
        @update:allDay="draft.allDay = $event"
        @update:openTime="draft.openTime = $event"
        @update:closeTime="draft.closeTime = $event"
        @update:weekly="draft.weekly = $event"
      />
    </div>
    <div class="admin-panel admin-map">
      <ClientOnly>
        <CafeLocationPicker
          :key="`map-${resetStamp}`"
          unrestricted
          :lat="draft.lat"
          :lng="draft.lng"
          :address="draft.address"
          :address-issue="issues.address || issues.pin"
          @update:lat="draft.lat = $event"
          @update:lng="draft.lng = $event"
          @update:address="draft.address = $event"
        />
      </ClientOnly>
    </div>
    <div class="admin-span admin-row-actions">
      <p v-if="issues.form" class="admin-error" role="alert">{{ issues.form }}</p>
      <button type="submit" class="admin-btn" :disabled="saving" :aria-busy="saving || undefined">
        <AdminBusyLabel :busy="saving">{{ saving ? 'Saving…' : submitLabel }}</AdminBusyLabel>
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import CafeIdentityStep from '~/components/submit/CafeIdentityStep.vue'
import CafeDetailsStep from '~/components/submit/CafeDetailsStep.vue'
import CafeLocationPicker from '~/components/submit/CafeLocationPicker.client.vue'
import type { ShopRow, WeeklyHours } from '~/types/shop'
import { cafeLogoSources, findCafeLogoSource } from '~/utils/admin-logos'
import { adminCafeErrors } from '~/utils/admin-shop'
import { allDayEveryDay, isValidWeeklyHours, sameHoursEveryDay } from '~/utils/hours'
import { normalizeAddress, normalizeCafeName } from '~/utils/identity'
import { optionalPhone } from '~/utils/phone'
import { publicObjectUrl } from '~/utils/shop-mapper'
import { DAY_KEYS } from '~/types/shop'

const props = withDefaults(defineProps<{
  shop?: ShopRow | null
  saving?: boolean
  submitLabel?: string
}>(), {
  shop: null,
  saving: false,
  submitLabel: 'Save cafe',
})

const emit = defineEmits<{
  save: [payload: {
    name: string
    address: string
    latitude: number
    longitude: number
    hours: WeeklyHours
    contact_number: string | null
    logoFile: File | null
    logoObjectKey: string | null
  }]
}>()

const hoursFromShop = (hours: WeeklyHours | null | undefined): {
  sameEveryDay: boolean
  allDay: boolean
  openTime: string
  closeTime: string
  weekly: WeeklyHours
} => {
  const weekly = hours && isValidWeeklyHours(hours) ? hours : sameHoursEveryDay('08:00', '20:00')
  const allDay = DAY_KEYS.every((key) => weekly[key].kind === 'all_day')
  const first = weekly.mon
  const sameEveryDay = DAY_KEYS.every((key) => JSON.stringify(weekly[key]) === JSON.stringify(first))
  return {
    weekly,
    allDay,
    sameEveryDay,
    openTime: first.kind === 'open' ? first.open : '08:00',
    closeTime: first.kind === 'open' ? first.close : '20:00',
  }
}

const emptyIssues = () => ({
  name: null as string | null,
  logo: null as string | null,
  address: null as string | null,
  pin: null as string | null,
  phone: null as string | null,
  hours: null as string | null,
  form: null as string | null,
})

const emptyDraft = () => {
  const hours = hoursFromShop(null)
  return {
    name: '',
    logoFile: null as File | null,
    logoObjectKey: null as string | null,
    lat: null as number | null,
    lng: null as number | null,
    address: '',
    phone: '',
    sameEveryDay: hours.sameEveryDay,
    allDay: hours.allDay,
    openTime: hours.openTime,
    closeTime: hours.closeTime,
    weekly: hours.weekly,
  }
}

const admin = useAdminData()
const config = useRuntimeConfig()
const publicBase = String(config.public.r2PublicBaseUrl || '')
const resetStamp = ref(0)

const initial = hoursFromShop(props.shop?.hours)
const draft = reactive({
  ...emptyDraft(),
  name: props.shop?.name ?? '',
  logoObjectKey: (props.shop?.logo_object_key ?? null) as string | null,
  lat: props.shop?.latitude ?? null as number | null,
  lng: props.shop?.longitude ?? null as number | null,
  address: props.shop?.address ?? '',
  phone: props.shop?.contact_number ?? '',
  sameEveryDay: initial.sameEveryDay,
  allDay: initial.allDay,
  openTime: initial.openTime,
  closeTime: initial.closeTime,
  weekly: initial.weekly,
})

const issues = reactive(emptyIssues())

const reset = () => {
  Object.assign(draft, emptyDraft())
  Object.assign(issues, emptyIssues())
  resetStamp.value += 1
}

defineExpose({ reset })

const logoSources = computed(() => cafeLogoSources(admin.shops.value, publicBase, {
  excludeShopId: props.shop?.id,
}))
const logoSourcesStatus = computed(() => {
  if (admin.status.value === 'loading' || admin.status.value === 'idle') return 'loading' as const
  if (admin.status.value === 'error' || admin.status.value === 'forbidden') return 'error' as const
  return 'ready' as const
})
const selectedSource = computed(() => findCafeLogoSource(logoSources.value, draft.logoObjectKey))
const logoPreviewUrl = computed(() => {
  if (draft.logoFile || !draft.logoObjectKey) return null
  return selectedSource.value?.logoUrl ?? publicObjectUrl(draft.logoObjectKey, publicBase)
})
const logoSourceLabel = computed(() => {
  if (draft.logoFile || !draft.logoObjectKey) return null
  if (selectedSource.value) return `Using ${selectedSource.value.name}’s logo`
  if (props.shop?.logo_object_key === draft.logoObjectKey) return 'Current logo'
  return 'Using an existing cafe logo'
})

const onLogoFile = (file: File | null) => {
  draft.logoFile = file
  if (file) draft.logoObjectKey = null
}

const onLogoObjectKey = (key: string | null) => {
  draft.logoObjectKey = key
  if (key) draft.logoFile = null
}

onMounted(() => {
  if (admin.status.value === 'idle') void admin.load()
})

const onSubmit = () => {
  if (draft.sameEveryDay) {
    draft.weekly = draft.allDay ? allDayEveryDay() : sameHoursEveryDay(draft.openTime, draft.closeTime)
  }
  const next = adminCafeErrors({
    name: draft.name,
    address: draft.address,
    lat: draft.lat,
    lng: draft.lng,
    phone: draft.phone,
    hours: draft.weekly,
    logoFile: draft.logoFile,
  })
  Object.assign(issues, { ...next, form: null })
  if (Object.values(next).some(Boolean) || draft.lat == null || draft.lng == null) return
  emit('save', {
    name: normalizeCafeName(draft.name),
    address: normalizeAddress(draft.address),
    latitude: draft.lat,
    longitude: draft.lng,
    hours: draft.weekly,
    contact_number: optionalPhone(draft.phone),
    logoFile: draft.logoFile,
    logoObjectKey: draft.logoObjectKey,
  })
}
</script>

<style scoped>
.admin-map {
  min-height: 420px;
}
</style>
