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
    <div v-if="shop" class="admin-panel admin-span cafe-media">
      <section class="cafe-media__block" aria-labelledby="admin-cafe-poster">
        <h2 id="admin-cafe-poster">In-cafe poster</h2>
        <p class="admin-meta">{{ adminCafePosterLede() }}</p>
        <p v-if="posterSrc" class="cafe-media__preview">
          <img :src="posterSrc" alt="In-cafe poster" width="320" height="200" />
        </p>
        <label class="admin-field">
          Poster
          <input
            ref="posterInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            @change="onPoster"
          />
        </label>
        <p class="admin-meta">
          {{ draft.posterFile ? 'This file replaces the live poster when you save.' : livePoster ? adminCafePosterCurrentCopy() : adminCafePosterEmptyCopy() }}
        </p>
        <p v-if="issues.poster" class="admin-error">{{ issues.poster }}</p>
        <button
          v-if="livePoster"
          type="button"
          class="admin-btn admin-btn--ghost"
          :disabled="saving"
          @click="emit('takeDownPoster', livePoster)"
        >
          Take down
        </button>
      </section>

      <section class="cafe-media__block" aria-labelledby="admin-cafe-photos">
        <h2 id="admin-cafe-photos">Featured photos</h2>
        <p class="admin-meta">{{ adminCafePhotosLede() }}</p>
        <input
          ref="photoInput"
          class="cafe-media__file"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          aria-labelledby="admin-cafe-photos"
          @change="onPhotos"
        />
        <ul v-if="galleryItems.length" class="cafe-media__grid">
          <li v-for="item in galleryItems" :key="item.key">
            <img :src="item.src" alt="" width="96" height="96" />
            <button type="button" class="admin-link" @click="removePhoto(item.key)">Remove</button>
          </li>
        </ul>
        <div class="cafe-media__actions">
          <button
            type="button"
            class="admin-btn admin-btn--ghost"
            :disabled="galleryItems.length >= SHOP_GALLERY_MAX"
            @click="pickPhotos"
          >
            {{ galleryItems.length ? 'Add photos' : 'Choose photos' }}
          </button>
          <p class="admin-meta">{{ galleryItems.length }} of {{ SHOP_GALLERY_MAX }}</p>
        </div>
        <p v-if="issues.gallery" class="admin-error">{{ issues.gallery }}</p>
      </section>
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
import {
  adminCafeErrors,
  adminCafePhotosLede,
  adminCafePosterCurrentCopy,
  adminCafePosterEmptyCopy,
  adminCafePosterLede,
} from '~/utils/admin-shop'
import { allDayEveryDay, isValidWeeklyHours, sameHoursEveryDay } from '~/utils/hours'
import { normalizeAddress, normalizeCafeName } from '~/utils/identity'
import {
  featuredPhotoCountError,
  featuredPhotoFileError,
  posterFileError,
  SHOP_GALLERY_MAX,
  type ShopPosterRow,
} from '~/utils/owner-ads'
import { optionalPhone } from '~/utils/phone'
import { publicObjectUrl } from '~/utils/shop-mapper'
import { DAY_KEYS } from '~/types/shop'

type GalleryItem = {
  key: string
  src: string
  objectKey?: string
  file?: File
}

const props = withDefaults(defineProps<{
  shop?: ShopRow | null
  livePoster?: ShopPosterRow | null
  saving?: boolean
  submitLabel?: string
}>(), {
  shop: null,
  livePoster: null,
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
    galleryFiles?: File[]
    galleryObjectKeys?: string[]
    posterFile?: File | null
  }]
  takeDownPoster: [poster: ShopPosterRow]
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
  poster: null as string | null,
  gallery: null as string | null,
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
const posterInput = ref<HTMLInputElement | null>(null)
const photoInput = ref<HTMLInputElement | null>(null)
const posterPreview = ref('')
const posterIsBlob = ref(false)
const galleryItems = ref<GalleryItem[]>([])

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
  posterFile: null as File | null,
})

const issues = reactive(emptyIssues())

const clearPosterPreview = () => {
  if (posterIsBlob.value && posterPreview.value) URL.revokeObjectURL(posterPreview.value)
  posterPreview.value = ''
  posterIsBlob.value = false
}

const syncGallery = (keys: string[]) => {
  galleryItems.value.forEach((item) => {
    if (item.file && item.src.startsWith('blob:')) URL.revokeObjectURL(item.src)
  })
  galleryItems.value = keys.flatMap((key) => {
    const src = publicObjectUrl(key, publicBase)
    return src ? [{ key, src, objectKey: key }] : []
  })
}

const reset = () => {
  Object.assign(draft, emptyDraft(), { posterFile: null })
  Object.assign(issues, emptyIssues())
  clearPosterPreview()
  syncGallery([])
  if (posterInput.value) posterInput.value.value = ''
  if (photoInput.value) photoInput.value.value = ''
  resetStamp.value += 1
}

defineExpose({ reset })

const posterSrc = computed(() => {
  if (posterPreview.value) return posterPreview.value
  return publicObjectUrl(props.livePoster?.poster_object_key, publicBase)
})

syncGallery(props.shop?.gallery_object_keys ?? [])

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

const onPoster = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  const issue = posterFileError(file, false)
  if (issue) {
    input.value = ''
    draft.posterFile = null
    clearPosterPreview()
    issues.poster = issue
    return
  }
  issues.poster = null
  draft.posterFile = file
  clearPosterPreview()
  if (file) {
    posterPreview.value = URL.createObjectURL(file)
    posterIsBlob.value = true
  }
}

const pickPhotos = () => {
  photoInput.value?.click()
}

const onPhotos = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (!files.length) return
  const room = SHOP_GALLERY_MAX - galleryItems.value.length
  if (room <= 0) {
    issues.gallery = featuredPhotoCountError(SHOP_GALLERY_MAX + 1)
    return
  }
  const next = files.slice(0, room)
  for (const file of next) {
    const issue = featuredPhotoFileError(file)
    if (issue) {
      issues.gallery = issue
      return
    }
  }
  galleryItems.value = [
    ...galleryItems.value,
    ...next.map((file) => ({
      key: `file:${file.name}:${file.size}:${file.lastModified}`,
      src: URL.createObjectURL(file),
      file,
    })),
  ]
  issues.gallery = files.length > room ? featuredPhotoCountError(SHOP_GALLERY_MAX + 1) : null
}

const removePhoto = (key: string) => {
  const item = galleryItems.value.find((entry) => entry.key === key)
  if (item?.file && item.src.startsWith('blob:')) URL.revokeObjectURL(item.src)
  galleryItems.value = galleryItems.value.filter((entry) => entry.key !== key)
  issues.gallery = null
}

onMounted(() => {
  if (admin.status.value === 'idle') void admin.load()
})

onBeforeUnmount(() => {
  clearPosterPreview()
  galleryItems.value.forEach((item) => {
    if (item.file && item.src.startsWith('blob:')) URL.revokeObjectURL(item.src)
  })
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
  const galleryIssue = props.shop
    ? featuredPhotoCountError(galleryItems.value.length)
    : null
  const posterIssue = posterFileError(draft.posterFile, false)
  Object.assign(issues, { ...next, gallery: galleryIssue, poster: posterIssue, form: null })
  if (Object.values(next).some(Boolean) || galleryIssue || posterIssue || draft.lat == null || draft.lng == null) return
  emit('save', {
    name: normalizeCafeName(draft.name),
    address: normalizeAddress(draft.address),
    latitude: draft.lat,
    longitude: draft.lng,
    hours: draft.weekly,
    contact_number: optionalPhone(draft.phone),
    logoFile: draft.logoFile,
    logoObjectKey: draft.logoObjectKey,
    galleryFiles: props.shop ? galleryItems.value.flatMap((item) => item.file ? [item.file] : []) : undefined,
    galleryObjectKeys: props.shop
      ? galleryItems.value.flatMap((item) => item.file ? [] : (item.objectKey ? [item.objectKey] : []))
      : undefined,
    posterFile: props.shop ? draft.posterFile : undefined,
  })
}
</script>

<style scoped>
.admin-map {
  min-height: 420px;
}

.cafe-media {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.cafe-media__block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cafe-media__block + .cafe-media__block {
  padding-top: 20px;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
}

.cafe-media h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.cafe-media__preview img {
  display: block;
  width: min(100%, 320px);
  height: auto;
  max-height: 200px;
  object-fit: cover;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.cafe-media__file {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.cafe-media__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cafe-media__grid li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 96px;
}

.cafe-media__grid img {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 8px;
  background: #faf8f5;
}

.cafe-media__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.cafe-media .admin-btn--ghost {
  align-self: flex-start;
}

.cafe-media :deep(input[type='file']) {
  min-height: 44px;
}

.cafe-media input:focus-visible,
.cafe-media .admin-link:focus-visible,
.cafe-media .admin-btn:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

:root.is-android .cafe-media :deep(input[type='file']),
:root.is-android .cafe-media .admin-btn--ghost {
  min-height: 48px;
}

.cafe-media ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}
</style>
