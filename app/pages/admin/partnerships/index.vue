<template>
  <IonPage>
    <AdminShell
      title="Partnerships"
      lede="Choose a cafe to set extras for that partner or sponsored window. Ending a window returns the standard pin."
      :status="status"
      :error="error"
    >
      <form ref="formRef" class="admin-panel admin-form" @submit.prevent="onCreate">
        <p v-if="editingId" class="admin-meta admin-span">
          Editing the {{ editingLife }} window for {{ selectedName }}.
        </p>
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
            :disabled="Boolean(editingId)"
            required
          />
        </label>
        <label class="admin-field">
          Pin
          <select v-model="draft.kind">
            <option value="partner">Partner</option>
            <option value="sponsored">Sponsored</option>
          </select>
        </label>
        <label class="admin-field">
          Starts
          <input v-model="draft.startsAt" type="datetime-local" required />
        </label>
        <label class="admin-field">
          Ends
          <input v-model="draft.endsAt" type="datetime-local" required />
        </label>
        <div v-if="draft.shopId" class="admin-span admin-features">
          <p class="admin-meta">{{ placementFeaturesSummary(draft.features) }}</p>
          <button type="button" class="admin-btn admin-btn--ghost" @click="openFeatures">
            Edit features
          </button>
        </div>
        <div class="admin-span admin-row-actions">
          <p v-if="formError" class="admin-error">{{ formError }}</p>
          <button class="admin-btn" type="submit" :disabled="Boolean(savingId)" :aria-busy="savingId === draft.shopId || undefined">
            <AdminBusyLabel :busy="savingId === draft.shopId">
              {{ savingId === draft.shopId ? 'Saving…' : 'Save partnership' }}
            </AdminBusyLabel>
          </button>
          <button
            v-if="editingId"
            type="button"
            class="admin-btn admin-btn--ghost"
            :disabled="Boolean(savingId)"
            @click="cancelEdit"
          >
            Cancel edit
          </button>
        </div>
      </form>

      <div class="admin-toolbar">
        <button
          v-for="filter in filters"
          :key="filter.id"
          type="button"
          class="admin-chip"
          :class="{ 'is-active': lifecycle === filter.id }"
          @click="lifecycle = filter.id"
        >
          {{ filter.label }}
        </button>
      </div>

      <p v-if="visible.length === 0" class="admin-empty">
        {{ lifecycle === 'all' ? 'No placements yet. Save one with the form above.' : 'No placements in this filter.' }}
      </p>

      <template v-else>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Cafe</th>
                <th>Kind</th>
                <th>Features</th>
                <th>Window</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in visible" :key="row.id">
                <td>{{ shopName(row.shop_id) }}</td>
                <td>{{ row.kind }}</td>
                <td>{{ featureLabel(row) }}</td>
                <td>{{ formatAdminDate(row.starts_at) }} – {{ formatAdminDate(row.ends_at) }}</td>
                <td><span class="admin-status" :class="`admin-status--${row.life}`">{{ row.life }}</span></td>
                <td>
                  <div class="admin-row-actions">
                    <button
                      v-if="canEdit(row)"
                      type="button"
                      class="admin-btn admin-btn--ghost"
                      :disabled="Boolean(savingId)"
                      @click="startEdit(row)"
                    >
                      Edit
                    </button>
                    <button
                      v-if="row.life !== 'ended'"
                      type="button"
                      class="admin-btn admin-btn--danger"
                      :disabled="savingId === row.id"
                      :aria-busy="savingId === row.id || undefined"
                      @click="onEnd(row)"
                    >
                      <AdminBusyLabel :busy="savingId === row.id">
                        {{ savingId === row.id ? 'Ending…' : 'End now' }}
                      </AdminBusyLabel>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-cards">
          <article v-for="row in visible" :key="row.id" class="admin-card">
            <h2>{{ shopName(row.shop_id) }}</h2>
            <p>{{ row.kind }} · {{ featureLabel(row) }}</p>
            <p>
              <span class="admin-status" :class="`admin-status--${row.life}`">{{ row.life }}</span>
            </p>
            <p>{{ formatAdminDate(row.starts_at) }} – {{ formatAdminDate(row.ends_at) }}</p>
            <div class="admin-row-actions">
              <button
                v-if="canEdit(row)"
                type="button"
                class="admin-btn admin-btn--ghost"
                :disabled="Boolean(savingId)"
                @click="startEdit(row)"
              >
                Edit
              </button>
              <button
                v-if="row.life !== 'ended'"
                type="button"
                class="admin-btn admin-btn--danger"
                :disabled="savingId === row.id"
                :aria-busy="savingId === row.id || undefined"
                @click="onEnd(row)"
              >
                <AdminBusyLabel :busy="savingId === row.id">
                  {{ savingId === row.id ? 'Ending…' : 'End now' }}
                </AdminBusyLabel>
              </button>
            </div>
          </article>
        </div>
      </template>
      <AdminPlacementFeaturesDialog
        :open="featuresOpen"
        :cafe-name="selectedName"
        :kind="draft.kind"
        :features="draft.features"
        :logo-src="selectedLogoSrc"
        @confirm="onFeaturesConfirm"
        @cancel="featuresOpen = false"
      />
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminPlacementFeaturesDialog from '~/components/admin/AdminPlacementFeaturesDialog.vue'
import AdminSearchPicker from '~/components/admin/AdminSearchPicker.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import type { PlacementLifecycle } from '~/types/admin'
import type { ShopPlacementKind, ShopPlacementRow } from '~/types/shop'
import { formatAdminDate, toLocalInput } from '~/utils/admin-nav'
import { adminActionErrorMessage } from '~/utils/admin-feedback'
import { cafePickerOptions } from '~/utils/admin-picker'
import { placementLifecycle, placementWindowError } from '~/utils/admin-placements'
import { shopLogoUrl } from '~/utils/shop-mapper'
import {
  defaultPlacementFeatures,
  parsePlacementFeatures,
  placementFeaturesSummary,
  type PlacementFeatures,
} from '~/utils/placement-features'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const config = useRuntimeConfig()
const publicBase = String(config.public.r2PublicBaseUrl || '')
const { ask: askAdmin } = useAdminConfirm()
const { shops, placements, status, error, savingId, load, savePlacement, endPlacement } = admin
type PlacementRow = ShopPlacementRow & { life: PlacementLifecycle }

const emptyDraft = () => {
  const now = new Date()
  return {
    shopId: '',
    kind: 'partner' as ShopPlacementKind,
    startsAt: toLocalInput(now),
    endsAt: toLocalInput(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)),
    features: defaultPlacementFeatures('partner') as PlacementFeatures,
  }
}

const formRef = ref<HTMLFormElement | null>(null)
const draft = reactive(emptyDraft())
const editingId = ref('')
const hydrating = ref(false)
const featuresOpen = ref(false)
const formError = ref('')
const lifecycle = ref<PlacementLifecycle | 'all'>('current')
const filters = [
  { id: 'all' as const, label: 'All' },
  { id: 'current' as const, label: 'Current' },
  { id: 'scheduled' as const, label: 'Scheduled' },
  { id: 'ended' as const, label: 'Ended' },
]

const approved = computed(() => shops.value.filter((shop) => shop.status === 'approved'))
const cafeOptions = computed(() => cafePickerOptions(shops.value))
const pickerStatus = computed(() => {
  if (status.value === 'ready') return 'ready' as const
  if (status.value === 'error' || status.value === 'forbidden') return 'error' as const
  return 'loading' as const
})
const shopName = (id: string) => shops.value.find((shop) => shop.id === id)?.name ?? id
const selectedName = computed(() => shopName(draft.shopId))
const selectedLogoSrc = computed(() => {
  const shop = shops.value.find((item) => item.id === draft.shopId)
  return shop ? shopLogoUrl(shop, publicBase) : null
})
const placementRow = (row: ShopPlacementRow): PlacementRow => ({
  ...row,
  life: placementLifecycle(row),
})
const rows = computed(() => placements.value.map(placementRow))
const editingLife = computed(() => rows.value.find((row) => row.id === editingId.value)?.life ?? 'current')
const canEdit = (row: { life: PlacementLifecycle }) => row.life === 'current' || row.life === 'scheduled'
const featureLabel = (row: {
  kind: string
  features?: Record<string, boolean> | null
  show_on_home?: boolean
  life: PlacementLifecycle
}) => {
  if (row.life === 'ended') return '—'
  return placementFeaturesSummary(parsePlacementFeatures(row))
}

const featuresForShop = (shopId: string, kind: 'partner' | 'sponsored'): PlacementFeatures => {
  const match = rows.value.find((row) => row.shop_id === shopId && row.life === 'current' && row.kind === kind)
    ?? rows.value.find((row) => row.shop_id === shopId && row.life === 'scheduled' && row.kind === kind)
  return match ? parsePlacementFeatures(match) : defaultPlacementFeatures(kind)
}

let featuresTimer: ReturnType<typeof setTimeout> | null = null
const queueFeatures = () => {
  if (featuresTimer) window.clearTimeout(featuresTimer)
  featuresTimer = window.setTimeout(() => {
    featuresTimer = null
    if (draft.shopId) featuresOpen.value = true
  }, 200)
}

const openFeatures = () => {
  if (!draft.shopId) return
  featuresOpen.value = true
}

const runHydrate = (fn: () => void) => {
  if (featuresTimer) {
    window.clearTimeout(featuresTimer)
    featuresTimer = null
  }
  hydrating.value = true
  fn()
  void nextTick(() => {
    hydrating.value = false
  })
}

watch(
  () => draft.kind,
  (kind) => {
    if (hydrating.value) return
    draft.features = draft.shopId ? featuresForShop(draft.shopId, kind) : defaultPlacementFeatures(kind)
    if (draft.shopId) queueFeatures()
  },
)

watch(
  () => draft.shopId,
  (shopId) => {
    if (hydrating.value || !shopId) return
    draft.features = featuresForShop(shopId, draft.kind)
    queueFeatures()
  },
)

const startEdit = (row: PlacementRow) => {
  if (!canEdit(row)) return
  runHydrate(() => {
    editingId.value = row.id
    draft.shopId = row.shop_id
    draft.kind = row.kind
    draft.startsAt = toLocalInput(new Date(row.starts_at))
    draft.endsAt = toLocalInput(new Date(row.ends_at))
    draft.features = parsePlacementFeatures(row)
    formError.value = ''
    featuresOpen.value = false
  })
  formRef.value?.scrollIntoView({ block: 'start' })
}

const cancelEdit = () => {
  runHydrate(() => {
    Object.assign(draft, emptyDraft())
    editingId.value = ''
    formError.value = ''
    featuresOpen.value = false
  })
}

const onFeaturesConfirm = (features: PlacementFeatures) => {
  draft.features = features
  featuresOpen.value = false
}

const visible = computed(() =>
  lifecycle.value === 'all' ? rows.value : rows.value.filter((row) => row.life === lifecycle.value),
)

const onEnd = async (row: { id: string; shop_id: string; kind: string }) => {
  const name = shopName(row.shop_id)
  const choice = await askAdmin({
    title: `End the ${row.kind} pin for ${name}?`,
    message: 'The map returns to the standard pin.',
    confirmLabel: 'End placement',
    variant: 'destructive',
  })
  if (!choice.confirmed) return
  try {
    await endPlacement(row.id)
    toast.success('Placement ended', `${name} is back on the standard pin.`)
    if (editingId.value === row.id) cancelEdit()
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not end this placement.')
    toast.error('Could not end this placement', formError.value)
  }
}

const onCreate = async () => {
  formError.value = ''
  const shop = approved.value.find((item) => item.id === draft.shopId)
  if (!shop) {
    formError.value = 'Choose an approved cafe.'
    toast.warning('Choose a cafe', formError.value)
    return
  }
  const windowIssue = placementWindowError(draft.startsAt, draft.endsAt)
  if (windowIssue) {
    formError.value = windowIssue
    toast.warning('Check the window', windowIssue)
    return
  }
  const wasEdit = Boolean(editingId.value)
  try {
    await savePlacement(shop, draft.kind, draft.startsAt, draft.endsAt, draft.features.home_carousel, draft.features)
    toast.success(
      wasEdit ? 'Placement updated' : 'Placement saved',
      `${shop.name} is on the ${draft.kind} pin. ${placementFeaturesSummary(draft.features)}.`,
    )
    if (wasEdit) cancelEdit()
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not save this placement.')
    toast.error('Could not save this placement', formError.value)
  }
}

onMounted(() => {
  void load()
})

onBeforeUnmount(() => {
  if (featuresTimer) window.clearTimeout(featuresTimer)
})
</script>

<style scoped>
.admin-features {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.admin-features .admin-meta {
  margin: 0;
}
</style>
