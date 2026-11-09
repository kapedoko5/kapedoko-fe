<template>
  <form class="admin-form event-form" @submit.prevent="onSubmit">
    <div class="admin-panel">
      <label class="admin-field">
        Event name
        <input v-model="draft.name" maxlength="80" required placeholder="Coffee Fest Manila" />
      </label>
      <p v-if="issues.name" class="admin-error">{{ issues.name }}</p>

      <label class="admin-field">
        Organizer name
        <input v-model="draft.organizerName" maxlength="80" required placeholder="Kape Guild" />
      </label>
      <p v-if="issues.organizerName" class="admin-error">{{ issues.organizerName }}</p>

      <label class="admin-field">
        Organizer contact name
        <input v-model="draft.organizerContactName" maxlength="80" placeholder="Optional" />
      </label>
      <label class="admin-field">
        Organizer contact number
        <input v-model="draft.organizerContactNumber" maxlength="24" placeholder="Optional, 0917 123 4567" />
      </label>
      <p v-if="issues.organizerContactNumber" class="admin-error">{{ issues.organizerContactNumber }}</p>

      <label class="admin-field admin-span">
        About this event
        <textarea v-model="draft.description" rows="4" maxlength="2000" placeholder="Optional" />
      </label>
      <p v-if="issues.description" class="admin-error">{{ issues.description }}</p>
    </div>

    <div class="admin-panel admin-map">
      <ClientOnly>
        <CafeLocationPicker
          :key="`map-${resetStamp}`"
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

    <div class="admin-panel">
      <label class="admin-field">
        Event starts
        <input v-model="draft.eventStartsAt" type="datetime-local" required />
      </label>
      <label class="admin-field">
        Event ends
        <input v-model="draft.eventEndsAt" type="datetime-local" required />
      </label>
      <p v-if="issues.eventWindow" class="admin-error admin-span">{{ issues.eventWindow }}</p>
      <label class="admin-field">
        Show from
        <input v-model="draft.displayStartsAt" type="datetime-local" required />
      </label>
      <label class="admin-field">
        Hide after
        <input v-model="draft.displayEndsAt" type="datetime-local" required />
      </label>
      <p v-if="issues.displayWindow" class="admin-error admin-span">{{ issues.displayWindow }}</p>
    </div>

    <div class="admin-panel">
      <label class="admin-field admin-span">
        Poster
        <input type="file" accept="image/jpeg,image/png,image/webp" @change="onPoster" />
      </label>
      <p v-if="posterPreview" class="admin-span">
        <img :src="posterPreview" alt="Poster preview" width="240" height="160" class="event-form__poster" />
      </p>
      <p v-if="event && !draft.posterFile" class="admin-meta admin-span">
        Using the current poster. Choose a file only to replace it.
      </p>
      <p v-if="issues.poster" class="admin-error">{{ issues.poster }}</p>

      <label class="admin-field admin-span">
        Additional images
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple @change="onGallery" />
      </label>
      <p v-if="issues.gallery" class="admin-error">{{ issues.gallery }}</p>
      <ul v-if="galleryPreviews.length" class="event-form__gallery">
        <li v-for="item in galleryPreviews" :key="item.key">
          <img :src="item.src" alt="" width="96" height="96" />
          <button type="button" class="admin-link" @click="removeGallery(item.key)">Remove</button>
        </li>
      </ul>
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
import CafeLocationPicker from '~/components/submit/CafeLocationPicker.client.vue'
import type { EventRow } from '~/types/event'
import { toLocalInput } from '~/utils/admin-nav'
import {
  EVENT_GALLERY_MAX,
  adminEventErrors,
  eventImageFileError,
} from '~/utils/events'
import { publicObjectUrl } from '~/utils/shop-mapper'

const props = withDefaults(defineProps<{
  event?: EventRow | null
  saving?: boolean
  submitLabel?: string
}>(), {
  event: null,
  saving: false,
  submitLabel: 'Save event',
})

const emit = defineEmits<{
  save: [payload: {
    name: string
    organizer_name: string
    organizer_contact_name: string
    organizer_contact_number: string
    description: string
    address: string
    latitude: number
    longitude: number
    event_starts_at: string
    event_ends_at: string
    display_starts_at: string
    display_ends_at: string
    posterFile: File | null
    poster_object_key: string | null
    galleryFiles: File[]
    gallery_object_keys: string[]
    enabled: boolean
  }]
}>()

const config = useRuntimeConfig()
const publicBase = String(config.public.r2PublicBaseUrl || '')
const resetStamp = ref(0)
const issues = reactive<Record<string, string | null>>({})
const posterPreview = ref('')
const posterIsBlob = ref(false)

type GalleryItem = { key: string; src: string; file?: File }
const galleryItems = ref<GalleryItem[]>([])

const emptyDraft = () => {
  const now = new Date()
  const later = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  return {
    name: '',
    organizerName: '',
    organizerContactName: '',
    organizerContactNumber: '',
    description: '',
    address: '',
    lat: null as number | null,
    lng: null as number | null,
    eventStartsAt: toLocalInput(later),
    eventEndsAt: toLocalInput(new Date(later.getTime() + 6 * 60 * 60 * 1000)),
    displayStartsAt: toLocalInput(now),
    displayEndsAt: toLocalInput(new Date(later.getTime() + 6 * 60 * 60 * 1000)),
    posterFile: null as File | null,
    posterObjectKey: null as string | null,
  }
}

const draft = reactive(emptyDraft())

const clearPosterPreview = () => {
  if (posterIsBlob.value && posterPreview.value) URL.revokeObjectURL(posterPreview.value)
  posterPreview.value = ''
  posterIsBlob.value = false
}

const hydrate = () => {
  Object.assign(draft, emptyDraft())
  clearPosterPreview()
  galleryItems.value.forEach((item) => {
    if (item.file) URL.revokeObjectURL(item.src)
  })
  galleryItems.value = []
  Object.keys(issues).forEach((key) => {
    issues[key] = null
  })
  const row = props.event
  if (!row) {
    resetStamp.value += 1
    return
  }
  draft.name = row.name
  draft.organizerName = row.organizer_name
  draft.organizerContactName = row.organizer_contact_name ?? ''
  draft.organizerContactNumber = row.organizer_contact_number ?? ''
  draft.description = row.description ?? ''
  draft.address = row.address
  draft.lat = row.latitude
  draft.lng = row.longitude
  draft.eventStartsAt = toLocalInput(new Date(row.event_starts_at))
  draft.eventEndsAt = toLocalInput(new Date(row.event_ends_at))
  draft.displayStartsAt = toLocalInput(new Date(row.display_starts_at))
  draft.displayEndsAt = toLocalInput(new Date(row.display_ends_at))
  draft.posterFile = null
  draft.posterObjectKey = row.poster_object_key
  posterPreview.value = publicObjectUrl(row.poster_object_key, publicBase) ?? ''
  galleryItems.value = (row.gallery_object_keys ?? []).map((key) => ({
    key,
    src: publicObjectUrl(key, publicBase) ?? '',
  })).filter((item) => item.src)
  resetStamp.value += 1
}

const galleryPreviews = computed(() => galleryItems.value.filter((item) => item.src))

const onPoster = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  if (!file) return
  const issue = eventImageFileError(file, true)
  if (issue) {
    input.value = ''
    issues.poster = issue
    return
  }
  clearPosterPreview()
  draft.posterFile = file
  posterPreview.value = URL.createObjectURL(file)
  posterIsBlob.value = true
  issues.poster = null
}

const onGallery = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  for (const file of files) {
    const issue = eventImageFileError(file)
    if (issue) {
      issues.gallery = issue
      return
    }
    if (galleryItems.value.length >= EVENT_GALLERY_MAX) {
      issues.gallery = `Keep extra photos to ${EVENT_GALLERY_MAX}.`
      return
    }
    galleryItems.value.push({
      key: `file:${file.name}:${file.size}:${file.lastModified}`,
      src: URL.createObjectURL(file),
      file,
    })
  }
  issues.gallery = null
}

const removeGallery = (key: string) => {
  const item = galleryItems.value.find((entry) => entry.key === key)
  if (item?.file) URL.revokeObjectURL(item.src)
  galleryItems.value = galleryItems.value.filter((entry) => entry.key !== key)
}

const onSubmit = () => {
  const next = adminEventErrors({
    name: draft.name,
    organizerName: draft.organizerName,
    organizerContactName: draft.organizerContactName,
    organizerContactNumber: draft.organizerContactNumber,
    description: draft.description,
    address: draft.address,
    lat: draft.lat,
    lng: draft.lng,
    eventStartsAt: draft.eventStartsAt,
    eventEndsAt: draft.eventEndsAt,
    displayStartsAt: draft.displayStartsAt,
    displayEndsAt: draft.displayEndsAt,
    posterFile: draft.posterFile,
    posterObjectKey: draft.posterObjectKey,
    galleryCount: galleryItems.value.length,
  })
  Object.assign(issues, next)
  issues.form = Object.values(next).find(Boolean) ?? null
  if (issues.form) return
  emit('save', {
    name: draft.name,
    organizer_name: draft.organizerName,
    organizer_contact_name: draft.organizerContactName,
    organizer_contact_number: draft.organizerContactNumber,
    description: draft.description,
    address: draft.address,
    latitude: Number(draft.lat),
    longitude: Number(draft.lng),
    event_starts_at: draft.eventStartsAt,
    event_ends_at: draft.eventEndsAt,
    display_starts_at: draft.displayStartsAt,
    display_ends_at: draft.displayEndsAt,
    posterFile: draft.posterFile,
    poster_object_key: draft.posterObjectKey,
    galleryFiles: galleryItems.value.flatMap((item) => item.file ? [item.file] : []),
    gallery_object_keys: galleryItems.value.flatMap((item) => item.file ? [] : [item.key]),
    enabled: true,
  })
}

watch(() => props.event?.id, hydrate, { immediate: true })

onBeforeUnmount(() => {
  clearPosterPreview()
  galleryItems.value.forEach((item) => {
    if (item.file) URL.revokeObjectURL(item.src)
  })
})
</script>

<style scoped>
.event-form__poster {
  display: block;
  max-width: min(100%, 280px);
  height: auto;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  object-fit: cover;
}

.event-form__gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.event-form__gallery li {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 96px;
}

.event-form__gallery img {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 8px;
  background: #faf8f5;
}
</style>
