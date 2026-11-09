<template>
  <IonPage>
    <AdminShell
      title="Ads"
      lede="Upload a wide banner, set a window, and send taps to an approved cafe. Home falls back to partner pins if nothing is live."
      :status="status"
      :error="error"
    >
      <form ref="formRef" class="admin-panel admin-form" @submit.prevent="onSave">
        <label class="admin-field">
          Cafe
          <AdminSearchPicker
            v-model="draft.shopId"
            :options="cafeOptions"
            :status="pickerStatus"
            title="Choose an approved cafe"
            placeholder="Choose an approved cafe"
            search-placeholder="Search cafe name or address"
            empty-copy="No approved cafes yet."
            no-match-copy="No cafes match that search."
            loading-copy="Loading cafes…"
            error-copy="Could not load cafes."
            item-label="cafe"
            required
          />
        </label>
        <label class="admin-field">
          Internal label
          <input v-model="draft.label" maxlength="80" placeholder="Optional" />
        </label>
        <label class="admin-field">
          Starts
          <input v-model="draft.startsAt" type="datetime-local" required />
        </label>
        <label class="admin-field">
          Ends
          <input v-model="draft.endsAt" type="datetime-local" required />
        </label>
        <label class="admin-field">
          Priority
          <input v-model.number="draft.priority" type="number" min="0" max="100" />
        </label>
        <label class="admin-field">
          Banner
          <input type="file" accept="image/jpeg,image/png,image/webp" @change="onFile" />
        </label>
        <p v-if="preview" class="admin-span">
          <img :src="preview" alt="Banner preview" width="640" height="200" class="ad-preview" />
        </p>
        <p v-if="editingId && !draft.file" class="admin-meta admin-span">
          Using the current banner. Choose a file only to replace it.
        </p>
        <div class="admin-span admin-row-actions">
          <p v-if="formError" class="admin-error">{{ formError }}</p>
          <button class="admin-btn" type="submit" :disabled="saving" :aria-busy="saving || undefined">
            <AdminBusyLabel :busy="saving">
              {{ saving ? 'Saving…' : (editingId ? 'Save changes' : 'Schedule banner') }}
            </AdminBusyLabel>
          </button>
          <button
            v-if="editingId"
            type="button"
            class="admin-btn admin-btn--quiet"
            :disabled="saving"
            @click="cancelEdit"
          >
            Cancel edit
          </button>
        </div>
      </form>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Cafe</th>
              <th>Window</th>
              <th>State</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="ad in ads" :key="ad.id">
              <td>{{ shopName(ad.shop_id) }}</td>
              <td>{{ formatAdminDate(ad.starts_at) }} – {{ formatAdminDate(ad.ends_at) }}</td>
              <td>{{ adState(ad) }}</td>
              <td>
                <div class="admin-row-actions">
                  <button
                    v-if="canEdit(ad)"
                    type="button"
                    class="admin-link"
                    @click="startEdit(ad)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="ad.enabled && !ad.cancelled_at"
                    type="button"
                    class="admin-btn admin-btn--quiet"
                    :disabled="endingId === ad.id || saving"
                    :aria-busy="endingId === ad.id || undefined"
                    @click="onEndAd(ad)"
                  >
                    <AdminBusyLabel :busy="endingId === ad.id">
                      {{ endingId === ad.id ? 'Ending…' : 'End now' }}
                    </AdminBusyLabel>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-cards">
        <article v-for="ad in ads" :key="ad.id" class="admin-card">
          <h2>{{ shopName(ad.shop_id) }}</h2>
          <p>{{ formatAdminDate(ad.starts_at) }} – {{ formatAdminDate(ad.ends_at) }}</p>
          <p>{{ adState(ad) }}</p>
          <div class="admin-row-actions">
            <button
              v-if="canEdit(ad)"
              type="button"
              class="admin-link"
              @click="startEdit(ad)"
            >
              Edit
            </button>
            <button
              v-if="ad.enabled && !ad.cancelled_at"
              type="button"
              class="admin-btn admin-btn--quiet"
              :disabled="endingId === ad.id || saving"
              :aria-busy="endingId === ad.id || undefined"
              @click="onEndAd(ad)"
            >
              <AdminBusyLabel :busy="endingId === ad.id">
                {{ endingId === ad.id ? 'Ending…' : 'End now' }}
              </AdminBusyLabel>
            </button>
          </div>
        </article>
      </div>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminSearchPicker from '~/components/admin/AdminSearchPicker.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import type { AdCampaignRow } from '~/types/admin'
import { adminActionErrorMessage } from '~/utils/admin-feedback'
import { bannerAspectError, bannerFileError, campaignWindowError, isAdCampaignActive } from '~/utils/admin-ads'
import { formatAdminDate, toLocalInput } from '~/utils/admin-nav'
import { cafePickerOptions } from '~/utils/admin-picker'
import { publicObjectUrl } from '~/utils/shop-mapper'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const config = useRuntimeConfig()
const publicBase = String(config.public.r2PublicBaseUrl || '')
const { shops, ads, status, error, load, saveAd, cancelAd: cancelAdRow } = admin
const formRef = ref<HTMLFormElement | null>(null)
const emptyDraft = () => ({
  shopId: '',
  label: '',
  startsAt: toLocalInput(new Date()),
  endsAt: toLocalInput(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
  priority: 0,
  file: null as File | null,
  bannerObjectKey: null as string | null,
})
const draft = reactive(emptyDraft())
const preview = ref('')
const previewIsBlob = ref(false)
const formError = ref('')
const saving = ref(false)
const endingId = ref('')
const editingId = ref('')
const cafeOptions = computed(() => cafePickerOptions(shops.value))
const pickerStatus = computed(() => {
  if (status.value === 'ready') return 'ready' as const
  if (status.value === 'error' || status.value === 'forbidden') return 'error' as const
  return 'loading' as const
})
const shopName = (id: string) => shops.value.find((shop) => shop.id === id)?.name ?? id
const editingAd = computed(() => ads.value.find((ad) => ad.id === editingId.value) ?? null)

const adState = (ad: AdCampaignRow) => {
  if (ad.cancelled_at || !ad.enabled) return 'ended'
  if (isAdCampaignActive(ad)) return 'live'
  if (new Date(ad.starts_at).getTime() > Date.now()) return 'scheduled'
  return 'ended'
}

const canEdit = (ad: AdCampaignRow) => adState(ad) !== 'ended'

const clearPreview = () => {
  if (previewIsBlob.value && preview.value) URL.revokeObjectURL(preview.value)
  preview.value = ''
  previewIsBlob.value = false
}

const resetDraft = () => {
  Object.assign(draft, emptyDraft())
  editingId.value = ''
  formError.value = ''
  clearPreview()
}

const startEdit = (ad: AdCampaignRow) => {
  clearPreview()
  editingId.value = ad.id
  draft.shopId = ad.shop_id
  draft.label = ad.label ?? ''
  draft.startsAt = toLocalInput(new Date(ad.starts_at))
  draft.endsAt = toLocalInput(new Date(ad.ends_at))
  draft.priority = ad.priority
  draft.file = null
  draft.bannerObjectKey = ad.banner_object_key
  preview.value = publicObjectUrl(ad.banner_object_key, publicBase) ?? ''
  formError.value = ''
  formRef.value?.scrollIntoView({ block: 'start' })
}

const cancelEdit = () => {
  resetDraft()
}

const onFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  if (!file) return
  const issue = bannerFileError(file)
  if (issue) {
    input.value = ''
    formError.value = issue
    toast.warning('Check the banner', issue)
    return
  }
  formError.value = ''
  clearPreview()
  draft.file = file
  preview.value = URL.createObjectURL(file)
  previewIsBlob.value = true
  const image = new Image()
  image.src = preview.value
  await new Promise((resolve) => {
    image.onload = resolve
    image.onerror = resolve
  })
  formError.value = bannerAspectError(image.naturalWidth, image.naturalHeight) ?? ''
  if (formError.value) {
    draft.file = null
    clearPreview()
    if (draft.bannerObjectKey) preview.value = publicObjectUrl(draft.bannerObjectKey, publicBase) ?? ''
    toast.warning('Check the banner', formError.value)
  }
}

const onSave = async () => {
  if (!draft.shopId) {
    formError.value = 'Choose an approved cafe.'
    toast.warning('Choose a cafe', formError.value)
    return
  }
  formError.value = campaignWindowError(draft.startsAt, draft.endsAt)
    ?? bannerFileError(draft.file, !draft.bannerObjectKey)
    ?? ''
  if (formError.value) {
    toast.warning('Check the banner', formError.value)
    return
  }
  saving.value = true
  const wasEdit = Boolean(editingId.value)
  try {
    const saved = await saveAd({
      id: editingId.value || undefined,
      shop_id: draft.shopId,
      bannerFile: draft.file,
      banner_object_key: draft.bannerObjectKey,
      starts_at: draft.startsAt,
      ends_at: draft.endsAt,
      label: draft.label,
      priority: Number(draft.priority) || 0,
      enabled: editingAd.value ? editingAd.value.enabled && !editingAd.value.cancelled_at : true,
    })
    editingId.value = saved.id
    draft.file = null
    draft.bannerObjectKey = saved.banner_object_key
    clearPreview()
    preview.value = publicObjectUrl(saved.banner_object_key, publicBase) ?? ''
    toast.success(wasEdit ? 'Banner saved' : 'Banner scheduled', shopName(saved.shop_id))
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not save this ad.')
    toast.error('Could not save this ad', formError.value)
  } finally {
    saving.value = false
  }
}

const onEndAd = async (ad: AdCampaignRow) => {
  const name = shopName(ad.shop_id)
  const choice = await askAdmin({
    title: `End this banner for ${name}?`,
    message: 'It leaves Home immediately.',
    confirmLabel: 'End banner',
    variant: 'destructive',
  })
  if (!choice.confirmed) return
  endingId.value = ad.id
  try {
    await cancelAdRow(ad.id)
    if (editingId.value === ad.id) resetDraft()
    toast.success('Banner ended', `${name} is off Home.`)
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not end this ad.')
    toast.error('Could not end this ad', formError.value)
  } finally {
    endingId.value = ''
  }
}

onMounted(() => {
  void load()
})

onBeforeUnmount(() => {
  if (previewIsBlob.value && preview.value) URL.revokeObjectURL(preview.value)
})
</script>

<style scoped>
.ad-preview {
  display: block;
  width: min(640px, 100%);
  height: auto;
  border-radius: 8px;
  background: var(--kd-secondary);
}
</style>
