<template>
  <IonPage>
    <AdminShell
      :title="badge?.label || 'Edit badge'"
      lede="Look lives on the name. Award the same name to several cafes for one window."
      :status="pageStatus"
      :error="pageError"
    >
      <AdminBadgeNameForm
        v-if="badge"
        :badge="badge"
        :saving="savingName"
        submit-label="Save changes"
        :public-base="publicBase"
        :form-error="nameError"
        @save="onSaveName"
      />

      <form v-if="badge" ref="awardFormRef" class="admin-panel admin-form" @submit.prevent="onSaveAward">
        <h2 class="admin-span">{{ editingAwardId ? 'Edit award' : 'Award to cafes' }}</h2>
        <label class="admin-field admin-span">
          Cafes
          <AdminMultiSearchPicker
            v-model="awardDraft.shopIds"
            :options="cafeOptions"
            :status="pickerStatus"
            title="Choose approved cafes"
            placeholder="Choose approved cafes"
            search-placeholder="Search cafe name or address"
            empty-copy="No approved cafes yet."
            no-match-copy="No cafes match that search."
            loading-copy="Loading cafes…"
            error-copy="Could not load cafes."
            item-label="cafe"
            required
            :invalid="Boolean(awardIssues.shops)"
          />
        </label>
        <p v-if="awardIssues.shops" class="admin-error">{{ awardIssues.shops }}</p>
        <label class="admin-field">
          Starts
          <input v-model="awardDraft.startsAt" type="datetime-local" required />
        </label>
        <label class="admin-field">
          Ends
          <input v-model="awardDraft.endsAt" type="datetime-local" required />
        </label>
        <p v-if="awardIssues.window" class="admin-error admin-span">{{ awardIssues.window }}</p>
        <div class="admin-span admin-row-actions">
          <p v-if="awardError" class="admin-error">{{ awardError }}</p>
          <button class="admin-btn" type="submit" :disabled="savingAward" :aria-busy="savingAward || undefined">
            <AdminBusyLabel :busy="savingAward">
              {{ savingAward ? 'Saving…' : (editingAwardId ? 'Save award' : 'Award badge') }}
            </AdminBusyLabel>
          </button>
          <button
            v-if="editingAwardId"
            type="button"
            class="admin-btn admin-btn--quiet"
            :disabled="savingAward"
            @click="resetAwardDraft"
          >
            Cancel edit
          </button>
        </div>
      </form>

      <div v-if="badge" class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Window</th>
              <th>Cafes</th>
              <th>State</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in awards" :key="row.id">
              <td>{{ formatAdminDate(row.starts_at) }} – {{ formatAdminDate(row.ends_at) }}</td>
              <td>{{ cafeCopy(row.id) }}</td>
              <td>{{ badgeAwardLifecycle(row) }}</td>
              <td>
                <div class="admin-row-actions">
                  <button
                    v-if="badgeAwardLifecycle(row) !== 'ended'"
                    type="button"
                    class="admin-link"
                    @click="startEditAward(row)"
                  >
                    Edit
                  </button>
                  <button
                    v-if="row.enabled && !row.cancelled_at"
                    type="button"
                    class="admin-btn admin-btn--quiet"
                    :disabled="endingId === row.id || savingAward"
                    :aria-busy="endingId === row.id || undefined"
                    @click="onEndAward(row)"
                  >
                    <AdminBusyLabel :busy="endingId === row.id">
                      {{ endingId === row.id ? 'Ending…' : 'End now' }}
                    </AdminBusyLabel>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="badge && awards.length === 0" class="admin-meta">No awards yet.</p>

      <div v-if="badge" class="admin-cards">
        <article v-for="row in awards" :key="row.id" class="admin-card">
          <h2>{{ formatAdminDate(row.starts_at) }} – {{ formatAdminDate(row.ends_at) }}</h2>
          <p>{{ cafeCopy(row.id) }}</p>
          <p>{{ badgeAwardLifecycle(row) }}</p>
          <div class="admin-row-actions">
            <button
              v-if="badgeAwardLifecycle(row) !== 'ended'"
              type="button"
              class="admin-link"
              @click="startEditAward(row)"
            >
              Edit
            </button>
            <button
              v-if="row.enabled && !row.cancelled_at"
              type="button"
              class="admin-btn admin-btn--quiet"
              :disabled="endingId === row.id || savingAward"
              :aria-busy="endingId === row.id || undefined"
              @click="onEndAward(row)"
            >
              <AdminBusyLabel :busy="endingId === row.id">
                {{ endingId === row.id ? 'Ending…' : 'End now' }}
              </AdminBusyLabel>
            </button>
          </div>
        </article>
      </div>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { useIonRouter } from '@ionic/vue'
import AdminBadgeNameForm from '~/components/admin/AdminBadgeNameForm.vue'
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminMultiSearchPicker from '~/components/admin/AdminMultiSearchPicker.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import type { BadgeAwardRow, BadgeNameRow } from '~/types/admin'
import { adminActionErrorMessage } from '~/utils/admin-feedback'
import {
  badgeAwardCafeCopy,
  badgeAwardLifecycle,
  badgeAwardWindowError,
  badgeIdFromRoute,
} from '~/utils/admin-badges'
import { fromLocalInput, formatAdminDate, toLocalInput } from '~/utils/admin-nav'
import { cafePickerOptions } from '~/utils/admin-picker'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const route = useRoute()
const ionRouter = useIonRouter()
const admin = useAdminData()
const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const config = useRuntimeConfig()
const publicBase = String(config.public.r2PublicBaseUrl || '')
const { shops, badgeAwards, badgeAwardShops, status, saveBadgeName, fetchBadgeName, saveBadgeAward, endBadgeAward } = admin

const badge = ref<BadgeNameRow | null>(null)
const savingName = ref(false)
const savingAward = ref(false)
const nameError = ref('')
const awardError = ref('')
const pageError = ref('')
const pageStatus = ref<'loading' | 'ready' | 'error'>('loading')
const endingId = ref('')
const editingAwardId = ref('')
const awardFormRef = ref<HTMLFormElement | null>(null)
const awardIssues = reactive({ shops: null as string | null, window: null as string | null })

const emptyAwardDraft = () => ({
  shopIds: [] as string[],
  startsAt: toLocalInput(new Date()),
  endsAt: toLocalInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
})
const awardDraft = reactive(emptyAwardDraft())

function resolveBadgeId(): string {
  const param = route.params.id
  const href = import.meta.client
    ? `${window.location.pathname}${window.location.hash}${window.location.search}`
    : ''
  return (
    badgeIdFromRoute(route.fullPath, param)
    || badgeIdFromRoute(route.path, param)
    || badgeIdFromRoute(String(ionRouter.routeInfo?.pathname || ''), param)
    || badgeIdFromRoute(href, param)
  )
}

const cafeOptions = computed(() => cafePickerOptions(shops.value))
const pickerStatus = computed(() => {
  if (status.value === 'ready') return 'ready' as const
  if (status.value === 'error' || status.value === 'forbidden') return 'error' as const
  return 'loading' as const
})
const awards = computed(() => badgeAwards.value.filter((row) => row.badge_id === badge.value?.id))
const shopName = (id: string) => shops.value.find((shop) => shop.id === id)?.name ?? id
const cafeCopy = (awardId: string) => {
  const names = badgeAwardShops.value
    .filter((row) => row.award_id === awardId)
    .map((row) => shopName(row.shop_id))
  return badgeAwardCafeCopy(names)
}

const loadBadge = async () => {
  pageStatus.value = 'loading'
  pageError.value = ''
  let id = resolveBadgeId()
  if (!id && import.meta.client) {
    await nextTick()
    id = resolveBadgeId()
  }
  if (!id) {
    pageStatus.value = 'error'
    pageError.value = 'This badge was not found.'
    return
  }
  try {
    await admin.load({ silent: true })
    badge.value = admin.badgeNames.value.find((row) => row.id === id) ?? await fetchBadgeName(id)
    if (!badge.value) {
      pageStatus.value = 'error'
      pageError.value = 'This badge was not found.'
      return
    }
    pageStatus.value = 'ready'
  } catch (err) {
    pageStatus.value = 'error'
    pageError.value = adminActionErrorMessage(err, 'Could not load this badge.')
  }
}

const onSaveName = async (payload: Parameters<typeof saveBadgeName>[0]) => {
  if (!badge.value) return
  savingName.value = true
  nameError.value = ''
  try {
    badge.value = await saveBadgeName({ ...payload, id: badge.value.id })
    toast.success('Badge saved', `${badge.value.label} was updated.`)
  } catch (err) {
    nameError.value = adminActionErrorMessage(err, 'Could not save this badge.')
    toast.error('Could not save this badge', nameError.value)
  } finally {
    savingName.value = false
  }
}

const resetAwardDraft = () => {
  Object.assign(awardDraft, emptyAwardDraft())
  editingAwardId.value = ''
  awardError.value = ''
  awardIssues.shops = null
  awardIssues.window = null
}

const startEditAward = (row: BadgeAwardRow) => {
  editingAwardId.value = row.id
  awardDraft.shopIds = badgeAwardShops.value.filter((item) => item.award_id === row.id).map((item) => item.shop_id)
  awardDraft.startsAt = toLocalInput(new Date(row.starts_at))
  awardDraft.endsAt = toLocalInput(new Date(row.ends_at))
  awardError.value = ''
  awardFormRef.value?.scrollIntoView({ block: 'start' })
}

const onSaveAward = async () => {
  if (!badge.value) return
  awardIssues.shops = awardDraft.shopIds.length ? null : 'Choose at least one cafe.'
  awardIssues.window = badgeAwardWindowError(fromLocalInput(awardDraft.startsAt), fromLocalInput(awardDraft.endsAt))
  if (awardIssues.shops || awardIssues.window) return
  savingAward.value = true
  awardError.value = ''
  try {
    await saveBadgeAward({
      id: editingAwardId.value || undefined,
      badge_id: badge.value.id,
      starts_at: fromLocalInput(awardDraft.startsAt),
      ends_at: fromLocalInput(awardDraft.endsAt),
      shop_ids: awardDraft.shopIds,
    })
    toast.success(editingAwardId.value ? 'Award saved' : 'Badge awarded', `${badge.value.label} is on ${awardDraft.shopIds.length} cafe${awardDraft.shopIds.length === 1 ? '' : 's'}.`)
    resetAwardDraft()
  } catch (err) {
    awardError.value = adminActionErrorMessage(err, 'Could not save this award.')
    toast.error('Could not save this award', awardError.value)
  } finally {
    savingAward.value = false
  }
}

const onEndAward = async (row: BadgeAwardRow) => {
  const choice = await askAdmin({
    title: 'End this award now?',
    message: 'It leaves cafe cards immediately.',
    confirmLabel: 'End now',
    variant: 'destructive',
  })
  if (!choice.confirmed) return
  endingId.value = row.id
  try {
    await endBadgeAward(row.id)
    if (editingAwardId.value === row.id) resetAwardDraft()
    toast.success('Award ended', 'Those cafes no longer show this badge.')
  } catch (err) {
    toast.error('Could not end this award', adminActionErrorMessage(err, 'Could not end this award.'))
  } finally {
    endingId.value = ''
  }
}

onMounted(() => {
  void loadBadge()
})

watch(
  () => [route.fullPath, route.path, route.params.id],
  () => {
    void loadBadge()
  },
)
</script>
