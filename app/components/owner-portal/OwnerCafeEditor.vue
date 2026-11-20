<template>
  <form class="owner-editor" @submit.prevent="onSubmit">
    <div class="owner-editor__panel">
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
        :tags="pickerTags"
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
        show-price
        :phone="draft.phone"
        :price="draft.menuPrice"
        :same-every-day="draft.sameEveryDay"
        :all-day="draft.allDay"
        :open-time="draft.openTime"
        :close-time="draft.closeTime"
        :weekly="draft.weekly"
        :phone-issue="issues.phone"
        :price-issue="issues.price"
        :hours-issue="issues.hours"
        @update:phone="draft.phone = $event"
        @update:price="draft.menuPrice = $event"
        @update:sameEveryDay="draft.sameEveryDay = $event"
        @update:allDay="draft.allDay = $event"
        @update:openTime="draft.openTime = $event"
        @update:closeTime="draft.closeTime = $event"
        @update:weekly="draft.weekly = $event"
      />
    </div>
    <div class="owner-editor__panel owner-editor__map">
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
import CafeVibeTagPicker from '~/components/cafe/CafeVibeTagPicker.vue'
import CafeIdentityStep from '~/components/submit/CafeIdentityStep.vue'
import CafeDetailsStep from '~/components/submit/CafeDetailsStep.vue'
import CafeLocationPicker from '~/components/submit/CafeLocationPicker.client.vue'
import OwnerBusyLabel from '~/components/owner-portal/OwnerBusyLabel.vue'
import OwnerFeaturedPhotos from '~/components/owner-portal/OwnerFeaturedPhotos.vue'
import type { ShopRow, WeeklyHours } from '~/types/shop'
import {
  formatMenuPricePhp,
  hiddenUserVibeTagCount,
  parseMenuPricePhp,
  pickerVibeTags,
  selectedUserVibeTagIds,
  vibeIdsWithoutBudgetFriendly,
  vibeTagCountError,
} from '~/utils/admin-vibe-tags'
import { DAY_KEYS } from '~/types/shop'
import { allDayEveryDay, isValidWeeklyHours, sameHoursEveryDay } from '~/utils/hours'
import { normalizeAddress, normalizeCafeName } from '~/utils/identity'
import { featuredPhotoCountError } from '~/utils/owner-ads'
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
    galleryFiles: File[]
    galleryObjectKeys: string[]
    vibeTagIds?: string[]
    menu_price_php: number | null
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
const selectedEnabledIds = () => selectedUserVibeTagIds(assignedForShop(), ownership.vibeTagNames.value)
const draft = reactive({
  name: props.shop.name,
  logoFile: null as File | null,
  logoObjectKey: props.shop.logo_object_key as string | null,
  lat: props.shop.latitude as number | null,
  lng: props.shop.longitude as number | null,
  address: props.shop.address,
  phone: props.shop.contact_number ?? '',
  menuPrice: formatMenuPricePhp(props.shop.menu_price_php),
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
  price: null as string | null,
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

const pickerTags = computed(() => pickerVibeTags(ownership.vibeTagNames.value))
const hiddenCount = computed(() => hiddenUserVibeTagCount(assignedForShop(), ownership.vibeTagNames.value))
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
  const next = ownerCafeErrors({
    name: draft.name,
    address: draft.address,
    lat: draft.lat,
    lng: draft.lng,
    phone: draft.phone,
    hours: draft.weekly,
    logoFile: draft.logoFile,
    price: draft.menuPrice,
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
    vibeTagIds: pickerStatus.value === 'ready'
      ? vibeIdsWithoutBudgetFriendly(draft.vibeTagIds, ownership.vibeTagNames.value)
      : undefined,
    menu_price_php: parseMenuPricePhp(draft.menuPrice),
  })
}
</script>

<style scoped>
.owner-editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.owner-editor__panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  padding: 20px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.owner-editor__panel:not(.owner-editor__map) {
  gap: 0;
}

.owner-editor__panel:not(.owner-editor__map) > * + * {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
}

.owner-editor__panel :deep(.identity),
.owner-editor__panel :deep(.details) {
  gap: 16px;
}

.owner-editor__panel :deep(.identity__intro),
.owner-editor__panel :deep(.details__intro),
.owner-editor__panel :deep(.featured__intro) {
  gap: 6px;
}

.owner-editor__panel :deep(#identity-title),
.owner-editor__panel :deep(.details h2),
.owner-editor__panel :deep(.featured h2),
.owner-editor__panel :deep(.vibe-picker__head h2),
.owner-editor__map :deep(.picker__copy h2) {
  font-size: 0.95rem;
  line-height: 1.2;
  letter-spacing: -0.03em;
}

.owner-editor__panel :deep(.identity__mark) {
  width: 16px;
  height: 16px;
  margin-top: 1px;
}

.owner-editor__panel :deep(.identity__lede),
.owner-editor__panel :deep(.details__lede),
.owner-editor__panel :deep(.featured__lede),
.owner-editor__panel :deep(.vibe-picker__lede) {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
}

.owner-editor__panel :deep(.identity__logo) {
  gap: 8px;
}

.owner-editor__panel :deep(.identity__logo-row) {
  gap: 16px;
  margin-top: 4px;
}

.owner-editor__panel :deep(.identity__logo-actions) {
  gap: 8px;
}

.owner-editor__panel :deep(.details__hours) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.owner-editor__panel :deep(.details__hours-label),
.owner-editor__panel :deep(.details__toggle),
.owner-editor__panel :deep(.details__times),
.owner-editor__panel :deep(.details__days) {
  margin-top: 0;
  margin-bottom: 0;
}

.owner-editor__map :deep(.picker) {
  gap: 16px;
}

.owner-editor__map :deep(.picker__map),
.owner-editor__map :deep(.picker__canvas) {
  min-height: 280px;
}

.owner-editor__map :deep(.picker__copy p) {
  margin-top: 8px;
}

.owner-editor__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.owner-editor__actions .owner-btn {
  min-width: 160px;
}

.owner-editor__error {
  margin: 0;
  color: var(--kd-destructive);
  font-size: 0.7875rem;
  font-weight: 700;
}

.owner-editor ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

@media (max-width: 520px) {
  .owner-editor__panel :deep(.details__day-controls:has(input)) {
    grid-template-columns: 1fr 1fr;
  }

  .owner-editor__panel :deep(.details__day-controls select) {
    grid-column: 1 / -1;
  }
}
</style>
