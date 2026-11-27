<template>
  <IonPage>
    <AdminShell
      title="Ads"
      lede="Upload a wide banner, set a window, and send taps to an approved cafe, an in-app page, or an external site. Home falls back to partner pins if nothing is live."
      :status="status"
      :error="error"
    >
      <form ref="formRef" class="admin-panel admin-form" @submit.prevent="onSave">
        <label class="admin-field">
          Destination
          <select v-model="draft.destinationKind" @change="onDestinationKindChange">
            <option value="cafe">Cafe</option>
            <option value="internal">Internal path</option>
            <option value="external">External link</option>
          </select>
        </label>
        <label v-if="draft.destinationKind === 'cafe'" class="admin-field">
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
        <label v-else-if="draft.destinationKind === 'internal'" class="admin-field">
          Internal path
          <input
            v-model="draft.destinationUrl"
            type="text"
            inputmode="url"
            placeholder="/app/events/…"
            required
          />
        </label>
        <label v-else class="admin-field">
          External link
          <input
            v-model="draft.destinationUrl"
            type="url"
            placeholder="https://"
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
          Banner
          <span class="admin-meta">{{ bannerFileHint() }}</span>
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
            class="admin-btn admin-btn--ghost"
            :disabled="saving"
            @click="cancelEdit"
          >
            Cancel edit
          </button>
        </div>
      </form>

      <section v-if="liveAds.length > 0" class="admin-panel ad-live" aria-label="Live on Home">
        <h2 class="ad-live__title">Live on Home</h2>
        <p class="admin-meta">Drag or use the arrows to set the order visitors see.</p>
        <ol class="ad-live__list">
          <li
            v-for="(ad, index) in liveAds"
            :key="ad.id"
            class="ad-live__item"
            :draggable="liveAds.length > 1 && !reordering"
            @dragstart="onLiveDragStart(ad.id, $event)"
            @dragover.prevent
            @drop="onLiveDrop(ad.id, $event)"
          >
            <span class="ad-live__grip" aria-hidden="true">
              <GripVertical :size="16" :stroke-width="2.25" />
            </span>
            <span class="ad-live__name">{{ destinationLabel(ad) }}</span>
            <span class="admin-row-actions ad-live__move">
              <button
                type="button"
                class="admin-btn admin-btn--ghost"
                :disabled="reordering || index === 0"
                @pointerdown.stop
                @click="moveLive(index, -1)"
              >
                Up
              </button>
              <button
                type="button"
                class="admin-btn admin-btn--ghost"
                :disabled="reordering || index === liveAds.length - 1"
                @pointerdown.stop
                @click="moveLive(index, 1)"
              >
                Down
              </button>
            </span>
          </li>
        </ol>
      </section>

      <p v-if="ads.length === 0" class="admin-empty">No banners yet. Schedule one with the form above.</p>

      <template v-else>
        <div class="admin-toolbar">
          <button
            v-for="filter in stateFilters"
            :key="filter.id"
            type="button"
            class="admin-chip"
            :class="{ 'is-active': stateFilter === filter.id }"
            @click="stateFilter = filter.id"
          >
            {{ filter.label }}
          </button>
        </div>
        <div class="ad-filters">
          <label class="admin-field">
            Cafe name
            <input v-model="cafeQuery" type="search" placeholder="Cafe or destination" />
          </label>
          <label class="admin-field">
            From
            <input v-model="windowFrom" type="datetime-local" />
          </label>
          <label class="admin-field">
            To
            <input v-model="windowTo" type="datetime-local" />
          </label>
        </div>

        <p v-if="visibleAds.length === 0" class="admin-empty">No banners in this filter.</p>

        <template v-else>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Destination</th>
                  <th>Window</th>
                  <th>State</th>
                  <th v-if="adStats.available.value">Impressions (30d)</th>
                  <th v-if="adStats.available.value">Clicks</th>
                  <th v-if="adStats.available.value">CTR</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ad in visibleAds" :key="ad.id">
                  <td>{{ destinationLabel(ad) }}</td>
                  <td>{{ formatAdminDate(ad.starts_at) }} – {{ formatAdminDate(ad.ends_at) }}</td>
                  <td>
                    <span class="admin-status" :class="`admin-status--${adCampaignState(ad)}`">{{ adCampaignState(ad) }}</span>
                  </td>
                  <td v-if="adStats.available.value">{{ formatTrafficCount(campaignTotals(ad.id).impressions) }}</td>
                  <td v-if="adStats.available.value">{{ formatTrafficCount(campaignTotals(ad.id).clicks) }}</td>
                  <td v-if="adStats.available.value">{{ formatTrafficRatio(campaignTotals(ad.id).ctr) }}</td>
                  <td>
                    <div class="admin-row-actions">
                      <button
                        v-if="canEdit(ad)"
                        type="button"
                        class="admin-btn admin-btn--ghost"
                        @click="startEdit(ad)"
                      >
                        Edit
                      </button>
                      <button
                        v-if="ad.enabled && !ad.cancelled_at"
                        type="button"
                        class="admin-btn admin-btn--danger"
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
            <article v-for="ad in visibleAds" :key="ad.id" class="admin-card">
              <h2>{{ destinationLabel(ad) }}</h2>
              <p>{{ formatAdminDate(ad.starts_at) }} – {{ formatAdminDate(ad.ends_at) }}</p>
              <p>
                <span class="admin-status" :class="`admin-status--${adCampaignState(ad)}`">{{ adCampaignState(ad) }}</span>
              </p>
              <div class="admin-row-actions">
                <button
                  v-if="canEdit(ad)"
                  type="button"
                  class="admin-btn admin-btn--ghost"
                  @click="startEdit(ad)"
                >
                  Edit
                </button>
                <button
                  v-if="ad.enabled && !ad.cancelled_at"
                  type="button"
                  class="admin-btn admin-btn--danger"
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
        </template>
      </template>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { GripVertical } from 'lucide-vue-next'
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminSearchPicker from '~/components/admin/AdminSearchPicker.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import type { AdCampaignRow, AdDestinationKind } from '~/types/admin'
import { adminActionErrorMessage } from '~/utils/admin-feedback'
import {
  adCampaignState,
  adDestinationError,
  adDestinationKind,
  adDestinationLabel,
  adListMatches,
  bannerAspectError,
  bannerFileError,
  bannerFileHint,
  campaignWindowError,
  isAdCampaignActive,
  sortActiveAds,
  type AdListStateFilter,
} from '~/utils/admin-ads'
import { formatAdminDate, toLocalInput } from '~/utils/admin-nav'
import { cafePickerOptions } from '~/utils/admin-picker'
import { publicObjectUrl } from '~/utils/shop-mapper'
import { adStatsByCampaign, type AdTotals } from '~/utils/ad-attribution'
import { formatTrafficCount, formatTrafficRatio } from '~/utils/shop-traffic'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const config = useRuntimeConfig()
const publicBase = String(config.public.r2PublicBaseUrl || '')
const { shops, ads, status, error, load, saveAd, reorderAds, cancelAd: cancelAdRow } = admin
const formRef = ref<HTMLFormElement | null>(null)
// Impressions and CTR per banner. Hidden until the ad_campaign_stats RPC exists.
const adStats = useAdCampaignStats()
const statsByCampaign = computed(() => adStatsByCampaign(adStats.rows.value))
const NO_AD_TRAFFIC: AdTotals = { impressions: 0, clicks: 0, ctr: null }
const campaignTotals = (id: string): AdTotals => statsByCampaign.value.get(id) ?? NO_AD_TRAFFIC
const emptyDraft = () => ({
  destinationKind: 'cafe' as AdDestinationKind,
  shopId: '',
  destinationUrl: '',
  label: '',
  startsAt: toLocalInput(new Date()),
  endsAt: toLocalInput(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
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
const reordering = ref(false)
const dragId = ref('')
const cafeQuery = ref('')
const windowFrom = ref('')
const windowTo = ref('')
const stateFilter = ref<AdListStateFilter>('all')
const stateFilters = [
  { id: 'all' as const, label: 'All' },
  { id: 'live' as const, label: 'Live' },
  { id: 'scheduled' as const, label: 'Scheduled' },
  { id: 'ended' as const, label: 'Ended' },
]
const cafeOptions = computed(() => cafePickerOptions(shops.value))
const pickerStatus = computed(() => {
  if (status.value === 'ready') return 'ready' as const
  if (status.value === 'error' || status.value === 'forbidden') return 'error' as const
  return 'loading' as const
})
const shopName = (id: string | null | undefined) => {
  if (!id) return ''
  return shops.value.find((shop) => shop.id === id)?.name ?? id
}
const destinationLabel = (ad: AdCampaignRow) => adDestinationLabel(ad, shopName(ad.shop_id))
const editingAd = computed(() => ads.value.find((ad) => ad.id === editingId.value) ?? null)
const liveAds = computed(() => sortActiveAds(ads.value.filter((ad) => isAdCampaignActive(ad))))
const visibleAds = computed(() => ads.value.filter((ad) => adListMatches(ad, {
  cafeQuery: cafeQuery.value,
  windowFrom: windowFrom.value,
  windowTo: windowTo.value,
  state: stateFilter.value,
}, shopName(ad.shop_id))))

const canEdit = (ad: AdCampaignRow) => adCampaignState(ad) !== 'ended'

const onDestinationKindChange = () => {
  if (draft.destinationKind === 'cafe') draft.destinationUrl = ''
  else draft.shopId = ''
}

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
  draft.destinationKind = adDestinationKind(ad)
  draft.shopId = ad.shop_id ?? ''
  draft.destinationUrl = ad.destination_url ?? ''
  draft.label = ad.label ?? ''
  draft.startsAt = toLocalInput(new Date(ad.starts_at))
  draft.endsAt = toLocalInput(new Date(ad.ends_at))
  draft.file = null
  draft.bannerObjectKey = ad.banner_object_key
  preview.value = publicObjectUrl(ad.banner_object_key, publicBase) ?? ''
  formError.value = ''
  formRef.value?.scrollIntoView({ block: 'start' })
}

const cancelEdit = () => {
  resetDraft()
}

const persistLiveOrder = async (ids: string[]) => {
  reordering.value = true
  formError.value = ''
  try {
    await reorderAds(ids)
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not reorder these ads.')
    toast.error('Could not reorder these ads', formError.value)
  } finally {
    reordering.value = false
    dragId.value = ''
  }
}

const onLiveDragStart = (id: string, event: DragEvent) => {
  if (liveAds.value.length < 2 || reordering.value) {
    event.preventDefault()
    return
  }
  dragId.value = id
  event.dataTransfer?.setData('text/plain', id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

const onLiveDrop = async (targetId: string, event: DragEvent) => {
  event.preventDefault()
  const sourceId = dragId.value || event.dataTransfer?.getData('text/plain') || ''
  if (!sourceId || sourceId === targetId || reordering.value) return
  const ids = liveAds.value.map((ad) => ad.id)
  const from = ids.indexOf(sourceId)
  const to = ids.indexOf(targetId)
  if (from < 0 || to < 0) return
  ids.splice(from, 1)
  ids.splice(to, 0, sourceId)
  await persistLiveOrder(ids)
}

const moveLive = async (index: number, delta: number) => {
  const next = index + delta
  const ids = liveAds.value.map((ad) => ad.id)
  if (next < 0 || next >= ids.length || reordering.value) return
  const [moved] = ids.splice(index, 1)
  if (!moved) return
  ids.splice(next, 0, moved)
  await persistLiveOrder(ids)
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
  formError.value = adDestinationError(draft.destinationKind, draft.shopId, draft.destinationUrl)
    ?? campaignWindowError(draft.startsAt, draft.endsAt)
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
      destination_kind: draft.destinationKind,
      shop_id: draft.destinationKind === 'cafe' ? draft.shopId : null,
      destination_url: draft.destinationKind === 'cafe' ? null : draft.destinationUrl.trim(),
      bannerFile: draft.file,
      banner_object_key: draft.bannerObjectKey,
      starts_at: draft.startsAt,
      ends_at: draft.endsAt,
      label: draft.label,
      priority: editingAd.value?.priority ?? 0,
      enabled: editingAd.value ? editingAd.value.enabled && !editingAd.value.cancelled_at : true,
    })
    editingId.value = saved.id
    draft.file = null
    draft.bannerObjectKey = saved.banner_object_key
    clearPreview()
    preview.value = publicObjectUrl(saved.banner_object_key, publicBase) ?? ''
    toast.success(wasEdit ? 'Banner saved' : 'Banner scheduled', destinationLabel(saved))
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not save this ad.')
    toast.error('Could not save this ad', formError.value)
  } finally {
    saving.value = false
  }
}

const onEndAd = async (ad: AdCampaignRow) => {
  const name = destinationLabel(ad)
  const choice = await askAdmin({
    title: name ? `End this banner for ${name}?` : 'End this banner?',
    message: 'It leaves Home immediately.',
    confirmLabel: 'End banner',
    variant: 'destructive',
  })
  if (!choice.confirmed) return
  endingId.value = ad.id
  try {
    await cancelAdRow(ad.id)
    if (editingId.value === ad.id) resetDraft()
    toast.success('Banner ended', name ? `${name} is off Home.` : 'This banner is off Home.')
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not end this ad.')
    toast.error('Could not end this ad', formError.value)
  } finally {
    endingId.value = ''
  }
}

onMounted(() => {
  void adStats.loadAdmin(30)
  void load()
})

onBeforeUnmount(() => {
  if (previewIsBlob.value && preview.value) URL.revokeObjectURL(preview.value)
})
</script>

<style scoped>
.admin-field .admin-meta {
  margin: 0;
  font-weight: 400;
}

.ad-preview {
  display: block;
  width: min(640px, 100%);
  height: auto;
  border-radius: 8px;
  background: var(--kd-secondary);
}

.ad-live {
  display: grid;
  gap: 10px;
}

.ad-live__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.ad-live__list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ad-live__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 12px;
  background: #faf8f5;
}

.ad-live__grip {
  display: inline-flex;
  color: color-mix(in srgb, var(--kd-ink) 55%, #faf8f5);
}

.ad-live__name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 700;
}

.ad-live__move {
  justify-content: flex-end;
}

.ad-filters {
  display: grid;
  gap: 12px;
}

@media (min-width: 768px) {
  .ad-filters {
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr);
    align-items: end;
  }
}
</style>
