<template>
  <IonPage>
    <AdminShell
      title="Partnerships"
      lede="Partner and sponsored map pins stay beside cafe data. Ending a window returns the standard pin."
      :status="status"
      :error="error"
    >
      <form class="admin-panel admin-form" @submit.prevent="onCreate">
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
          Pin
          <select v-model="draft.kind">
            <option value="partner">Partner</option>
            <option value="sponsored">Sponsored</option>
            <option value="standard">Standard (clear paid pin)</option>
          </select>
        </label>
        <label v-if="draft.kind !== 'standard'" class="admin-field">
          Starts
          <input v-model="draft.startsAt" type="datetime-local" required />
        </label>
        <label v-if="draft.kind !== 'standard'" class="admin-field">
          Ends
          <input v-model="draft.endsAt" type="datetime-local" required />
        </label>
        <div class="admin-span admin-row-actions">
          <p v-if="formError" class="admin-error">{{ formError }}</p>
          <button class="admin-btn" type="submit" :disabled="Boolean(savingId)" :aria-busy="savingId === draft.shopId || undefined">
            <AdminBusyLabel :busy="savingId === draft.shopId">
              {{ savingId === draft.shopId ? 'Saving…' : 'Save placement' }}
            </AdminBusyLabel>
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

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Cafe</th>
              <th>Kind</th>
              <th>Window</th>
              <th>State</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in visible" :key="row.id">
              <td>{{ shopName(row.shop_id) }}</td>
              <td>{{ row.kind }}</td>
              <td>{{ formatAdminDate(row.starts_at) }} – {{ formatAdminDate(row.ends_at) }}</td>
              <td><span class="admin-status" :class="`admin-status--${row.life}`">{{ row.life }}</span></td>
              <td>
                <button
                  v-if="row.life !== 'ended'"
                  type="button"
                  class="admin-btn admin-btn--ghost"
                  :disabled="savingId === row.id"
                  :aria-busy="savingId === row.id || undefined"
                  @click="onEnd(row)"
                >
                  <AdminBusyLabel :busy="savingId === row.id">
                    {{ savingId === row.id ? 'Ending…' : 'End now' }}
                  </AdminBusyLabel>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="admin-cards">
        <article v-for="row in visible" :key="row.id" class="admin-card">
          <h2>{{ shopName(row.shop_id) }}</h2>
          <p>{{ row.kind }} · {{ row.life }}</p>
          <p>{{ formatAdminDate(row.starts_at) }} – {{ formatAdminDate(row.ends_at) }}</p>
          <button
            v-if="row.life !== 'ended'"
            type="button"
            class="admin-btn admin-btn--ghost"
            :disabled="savingId === row.id"
            :aria-busy="savingId === row.id || undefined"
            @click="onEnd(row)"
          >
            <AdminBusyLabel :busy="savingId === row.id">
              {{ savingId === row.id ? 'Ending…' : 'End now' }}
            </AdminBusyLabel>
          </button>
        </article>
      </div>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminSearchPicker from '~/components/admin/AdminSearchPicker.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import type { PlacementLifecycle } from '~/types/admin'
import { formatAdminDate, toLocalInput } from '~/utils/admin-nav'
import { adminActionErrorMessage } from '~/utils/admin-feedback'
import { cafePickerOptions } from '~/utils/admin-picker'
import { placementLifecycle, placementWindowError } from '~/utils/admin-placements'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const { shops, placements, status, error, savingId, load, savePlacement, endPlacement } = admin
const now = new Date()
const later = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
const draft = reactive({
  shopId: '',
  kind: 'partner' as 'partner' | 'sponsored' | 'standard',
  startsAt: toLocalInput(now),
  endsAt: toLocalInput(later),
})
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
const rows = computed(() =>
  placements.value.map((row) => ({ ...row, life: placementLifecycle(row) })),
)
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
  if (draft.kind !== 'standard') {
    const windowIssue = placementWindowError(draft.startsAt, draft.endsAt)
    if (windowIssue) {
      formError.value = windowIssue
      toast.warning('Check the window', windowIssue)
      return
    }
  }
  try {
    await savePlacement(shop, draft.kind, draft.startsAt, draft.endsAt)
    toast.success('Placement saved', `${shop.name} is on the ${draft.kind} pin.`)
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not save this placement.')
    toast.error('Could not save this placement', formError.value)
  }
}

onMounted(() => {
  void load()
})
</script>
