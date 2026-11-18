<template>
  <form class="owner-form" @submit.prevent="onSubmit">
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
    <CafeVibeTagPicker
      v-model="draft.vibeTagIds"
      :tags="enabledTags"
      :hidden-count="hiddenCount"
      :issue="issues.vibeTags"
      :status="pickerStatus"
      @issue="issues.vibeTags = $event"
    />
    <OwnerFeaturedPhotos
      :object-keys="draft.galleryObjectKeys"
      :issue="issues.gallery"
      @change="onGallery"
      @issue="issues.gallery = $event"
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
    <div class="owner-form__map">
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
    <div class="owner-form__actions">
      <p v-if="issues.form" class="owner-form__error" role="alert">{{ issues.form }}</p>
      <button type="submit" class="owner-form__save" :disabled="saving">
        {{ saving ? 'Saving…' : submitLabel }}
      </button>
    </div>
  </form>
</template>

<script lang="ts" setup>
import CafeVibeTagPicker from '~/components/cafe/CafeVibeTagPicker.vue'
import CafeIdentityStep from '~/components/submit/CafeIdentityStep.vue'
import CafeDetailsStep from '~/components/submit/CafeDetailsStep.vue'
import CafeLocationPicker from '~/components/submit/CafeLocationPicker.client.vue'
import OwnerFeaturedPhotos from '~/components/owner-portal/OwnerFeaturedPhotos.vue'
import type { ShopRow, WeeklyHours } from '~/types/shop'
import { enabledVibeTags, vibeTagCountError } from '~/utils/admin-vibe-tags'
import { adminCafeErrors } from '~/utils/admin-shop'
import { allDayEveryDay, isValidWeeklyHours, sameHoursEveryDay } from '~/utils/hours'
import { normalizeAddress, normalizeCafeName } from '~/utils/identity'
import { featuredPhotoCountError } from '~/utils/owner-ads'
import { optionalPhone } from '~/utils/phone'
import { publicObjectUrl } from '~/utils/shop-mapper'
import { DAY_KEYS } from '~/types/shop'

const props = withDefaults(defineProps<{
  shop: ShopRow
  saving?: boolean
  submitLabel?: string
  lede?: string
}>(), {
  saving: false,
  submitLabel: 'Save changes',
  lede: 'These details go live on Home and Map. WiFi and outlets still come from visitor reviews.',
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
    galleryFiles: File[]
    galleryObjectKeys: string[]
    vibeTagIds?: string[]
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
const ownership = useShopOwnership()
const initial = hoursFromShop(props.shop.hours)
const assignedForShop = () => ownership.shopVibeTags.value.filter((row) => row.shop_id === props.shop.id)
const selectedEnabledIds = () => {
  const enabled = new Set(enabledVibeTags(ownership.vibeTagNames.value).map((tag) => tag.id))
  return assignedForShop().flatMap((row) => enabled.has(row.tag_id) ? [row.tag_id] : [])
}
const draft = reactive({
  name: props.shop.name,
  logoFile: null as File | null,
  logoObjectKey: props.shop.logo_object_key as string | null,
  lat: props.shop.latitude as number | null,
  lng: props.shop.longitude as number | null,
  address: props.shop.address,
  phone: props.shop.contact_number ?? '',
  galleryFiles: [] as File[],
  galleryObjectKeys: [...(props.shop.gallery_object_keys ?? [])],
  vibeTagIds: selectedEnabledIds(),
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
  gallery: null as string | null,
  vibeTags: null as string | null,
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

const onGallery = (payload: { files: File[]; objectKeys: string[] }) => {
  draft.galleryFiles = payload.files
  draft.galleryObjectKeys = payload.objectKeys
  issues.gallery = featuredPhotoCountError(payload.files.length + payload.objectKeys.length)
}

const enabledTags = computed(() => enabledVibeTags(ownership.vibeTagNames.value))
const hiddenCount = computed(() => {
  const enabled = new Set(enabledTags.value.map((tag) => tag.id))
  return assignedForShop().filter((row) => !enabled.has(row.tag_id)).length
})
const pickerStatus = computed(() => {
  if (ownership.status.value === 'error') return 'error' as const
  if (ownership.status.value === 'loading' || ownership.status.value === 'idle') return 'loading' as const
  return 'ready' as const
})

watch(
  () => (props.shop.gallery_object_keys ?? []).join('|'),
  () => {
    draft.galleryFiles = []
    draft.galleryObjectKeys = [...(props.shop.gallery_object_keys ?? [])]
  },
)

watch(
  () => [props.shop.id, ownership.shopVibeTags.value.map((row) => `${row.shop_id}:${row.tag_id}`).join('|')].join('|'),
  () => {
    draft.vibeTagIds = selectedEnabledIds()
  },
)

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
  const galleryIssue = featuredPhotoCountError(draft.galleryFiles.length + draft.galleryObjectKeys.length)
  const vibeIssue = vibeTagCountError(draft.vibeTagIds.length, hiddenCount.value)
  Object.assign(issues, { ...next, gallery: galleryIssue, vibeTags: vibeIssue, form: null })
  if (Object.values(next).some(Boolean) || galleryIssue || vibeIssue || draft.lat == null || draft.lng == null) return
  emit('save', {
    name: normalizeCafeName(draft.name),
    address: normalizeAddress(draft.address),
    latitude: draft.lat,
    longitude: draft.lng,
    hours: draft.weekly,
    contact_number: optionalPhone(draft.phone),
    logoFile: draft.logoFile,
    logoObjectKey: draft.logoObjectKey,
    galleryFiles: draft.galleryFiles,
    galleryObjectKeys: draft.galleryObjectKeys,
    vibeTagIds: pickerStatus.value === 'ready' ? draft.vibeTagIds : undefined,
  })
}
</script>

<style scoped>
.owner-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.owner-form__map {
  min-height: 360px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
}

.owner-form__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.owner-form__error {
  margin: 0;
  color: var(--kd-destructive);
  font-size: 0.7875rem;
  font-weight: 700;
}

.owner-form__save {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--kd-accent);
  border-radius: 16px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
}

.owner-form__save:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.owner-form__save:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 3px;
}

:root.is-android .owner-form__save {
  min-height: 48px;
}
</style>
