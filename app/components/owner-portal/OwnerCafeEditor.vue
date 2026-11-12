<template>
  <form class="owner-editor" @submit.prevent="onSubmit">
    <CafeIdentityStep
      :name="draft.name"
      :logo-file="draft.logoFile"
      :logo-object-key="draft.logoObjectKey"
      :logo-preview-url="logoPreviewUrl"
      :logo-source-label="logoSourceLabel"
      :name-issue="issues.name"
      :logo-issue="issues.logo"
      :lede="lede"
      @update:name="draft.name = $event"
      @update:logoFile="onLogoFile"
    />
    <CafeDetailsStep
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
    <div class="owner-editor__map">
      <ClientOnly>
        <CafeLocationPicker
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
    <div class="owner-editor__actions">
      <p v-if="issues.form" class="owner-editor__error" role="alert">{{ issues.form }}</p>
      <button type="submit" class="owner-btn" :disabled="saving" :aria-busy="saving || undefined">
        <OwnerBusyLabel :busy="saving">
          {{ saving ? 'Saving…' : submitLabel }}
        </OwnerBusyLabel>
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import CafeIdentityStep from '~/components/submit/CafeIdentityStep.vue'
import CafeDetailsStep from '~/components/submit/CafeDetailsStep.vue'
import CafeLocationPicker from '~/components/submit/CafeLocationPicker.client.vue'
import OwnerBusyLabel from '~/components/owner-portal/OwnerBusyLabel.vue'
import type { ShopRow, WeeklyHours } from '~/types/shop'
import { DAY_KEYS } from '~/types/shop'
import { allDayEveryDay, isValidWeeklyHours, sameHoursEveryDay } from '~/utils/hours'
import { normalizeAddress, normalizeCafeName } from '~/utils/identity'
import { ownerCafeErrors, ownerEditorLede } from '~/utils/owner-portal'
import { optionalPhone } from '~/utils/phone'
import { publicObjectUrl } from '~/utils/shop-mapper'

const props = withDefaults(defineProps<{
  shop: ShopRow
  saving?: boolean
  submitLabel?: string
  lede?: string
}>(), {
  saving: false,
  submitLabel: 'Save changes',
  lede: ownerEditorLede(),
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

const hoursFromShop = (hours: WeeklyHours | null | undefined) => {
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

const config = useRuntimeConfig()
const publicBase = String(config.public.r2PublicBaseUrl || '')
const initial = hoursFromShop(props.shop.hours)
const draft = reactive({
  name: props.shop.name,
  logoFile: null as File | null,
  logoObjectKey: props.shop.logo_object_key as string | null,
  lat: props.shop.latitude as number | null,
  lng: props.shop.longitude as number | null,
  address: props.shop.address,
  phone: props.shop.contact_number ?? '',
  sameEveryDay: initial.sameEveryDay,
  allDay: initial.allDay,
  openTime: initial.openTime,
  closeTime: initial.closeTime,
  weekly: initial.weekly,
})

const issues = reactive({
  name: null as string | null,
  logo: null as string | null,
  address: null as string | null,
  pin: null as string | null,
  phone: null as string | null,
  hours: null as string | null,
  form: null as string | null,
})

const logoPreviewUrl = computed(() => {
  if (draft.logoFile || !draft.logoObjectKey) return null
  return publicObjectUrl(draft.logoObjectKey, publicBase)
})
const logoSourceLabel = computed(() => {
  if (draft.logoFile || !draft.logoObjectKey) return null
  if (props.shop.logo_object_key === draft.logoObjectKey) return 'Current logo'
  return null
})

const onLogoFile = (file: File | null) => {
  draft.logoFile = file
  if (file) draft.logoObjectKey = null
}

const onSubmit = () => {
  if (draft.sameEveryDay) {
    draft.weekly = draft.allDay ? allDayEveryDay() : sameHoursEveryDay(draft.openTime, draft.closeTime)
  }
  const next = ownerCafeErrors({
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
.owner-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.owner-editor__map {
  min-height: 360px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
}

.owner-editor__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.owner-editor__error {
  margin: 0;
  color: var(--kd-destructive);
  font-size: 0.7875rem;
  font-weight: 700;
}
</style>
