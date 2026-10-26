<template>
  <IonPage>
    <AdminShell
      layout="cafe"
      :title="shop?.name || 'Edit cafe'"
      lede="Changes go live for approved cafes. Hidden cafes stay off Home and Map until you publish them."
      :status="pageStatus"
      :error="pageError"
    >
      <template v-if="shop" #actions>
        <NuxtLink v-if="shop.status === 'approved'" class="admin-btn admin-btn--ghost" :to="`/admin/audits/${shop.id}`">
          Audits
        </NuxtLink>
        <button
          v-if="shop.status === 'approved'"
          type="button"
          class="admin-btn admin-btn--ghost"
          :disabled="saving || acting"
          @click="askAction('unpublish')"
        >
          Unpublish
        </button>
        <button
          v-else-if="shop.status === 'hidden'"
          type="button"
          class="admin-btn"
          :disabled="saving || acting"
          @click="askAction('publish')"
        >
          Publish
        </button>
        <button
          type="button"
          class="admin-btn admin-btn--danger"
          :disabled="saving || acting"
          @click="askAction('delete')"
        >
          Delete
        </button>
      </template>
      <div v-if="shop" class="cafe-editor">
        <p class="editor-status" :class="`editor-status--${shop.status}`">
          <span class="editor-status__mark" aria-hidden="true">
            <span class="editor-status__dot" />
          </span>
          <span class="editor-status__label">Status</span>
          <span class="editor-status__word">{{ statusWord(shop.status) }}</span>
        </p>
        <p v-if="formError" class="admin-error" role="alert">{{ formError }}</p>
        <AdminCafeForm
          :key="shop.id"
          :shop="shop"
          :saving="saving || acting"
          submit-label="Save changes"
          @save="onSave"
        />
      </div>
      <AdminConfirmDialog
        :open="Boolean(pending)"
        :variant="pending ? cafeDeskConfirmVariant(pending) : 'default'"
        :title="shop && pending ? cafeDeskConfirmTitle(pending, shop.name) : ''"
        :message="pending ? cafeDeskConfirmMessage(pending) : ''"
        :confirm-label="pending ? cafeDeskConfirmAction(pending) : ''"
        :busy-label="pending ? cafeDeskBusyLabel(pending) : ''"
        :busy="acting"
        @confirm="confirmPending"
        @cancel="cancelPending"
      />
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { useIonRouter } from '@ionic/vue'
import AdminCafeForm from '~/components/admin/AdminCafeForm.vue'
import AdminConfirmDialog from '~/components/admin/AdminConfirmDialog.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import type { ShopRow } from '~/types/shop'
import {
  cafeDeskBusyLabel,
  cafeDeskConfirmAction,
  cafeDeskConfirmMessage,
  cafeDeskConfirmTitle,
  cafeDeskConfirmVariant,
  cafeDeskDoneCopy,
  shopStatusWord,
  type CafeDeskAction,
} from '~/utils/admin-shop'
import { adminActionErrorMessage } from '~/utils/admin-feedback'
import { shopIdFromRoute } from '~/utils/approved-shops'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const route = useRoute()
const ionRouter = useIonRouter()
const admin = useAdminData()
const { error, updateShop, moderate, deleteShop } = admin
const toast = useAdminToast()
const saving = ref(false)
const acting = ref(false)
const pending = ref<Extract<CafeDeskAction, 'publish' | 'unpublish' | 'delete'> | null>(null)
const formError = ref('')
const shop = ref<ShopRow | null>(null)
const lookingUp = ref(true)

function resolveShopId(): string {
  const param = route.params.id
  const href = import.meta.client
    ? `${window.location.pathname}${window.location.hash}${window.location.search}`
    : ''
  return (
    shopIdFromRoute(route.fullPath, param)
    || shopIdFromRoute(route.path, param)
    || shopIdFromRoute(String(ionRouter.routeInfo?.pathname || ''), param)
    || shopIdFromRoute(href, param)
  )
}

const pageStatus = computed(() => {
  if (lookingUp.value) return 'loading'
  if (!shop.value) return 'error'
  return 'ready'
})

const statusWord = shopStatusWord

const pageError = computed(() => {
  if (shop.value) return error.value
  if (lookingUp.value) return ''
  return error.value || 'That cafe was not found.'
})

const loadCurrent = async () => {
  lookingUp.value = true
  error.value = ''
  let id = resolveShopId()
  if (!id && import.meta.client) {
    await nextTick()
    id = resolveShopId()
  }
  if (!id) {
    shop.value = null
    lookingUp.value = false
    return
  }
  try {
    shop.value = await admin.fetchShop(id)
  } catch (err) {
    shop.value = null
    error.value = err instanceof Error ? err.message : 'Could not load this cafe.'
  } finally {
    lookingUp.value = false
  }
}

const onSave = async (payload: Parameters<typeof updateShop>[1]) => {
  if (!shop.value) return
  saving.value = true
  formError.value = ''
  try {
    shop.value = await updateShop(shop.value.id, payload)
    toast.success('Changes saved', `${shop.value.name} is up to date.`)
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not save this cafe.')
    toast.error('Could not save this cafe', formError.value)
  } finally {
    saving.value = false
  }
}

const askAction = (action: Extract<CafeDeskAction, 'publish' | 'unpublish' | 'delete'>) => {
  if (!shop.value || saving.value || acting.value) return
  pending.value = action
}

const cancelPending = () => {
  if (acting.value) return
  pending.value = null
}

const confirmPending = async () => {
  const action = pending.value
  const current = shop.value
  if (!action || !current || acting.value) return
  acting.value = true
  try {
    if (action === 'delete') {
      await deleteShop(current)
      pending.value = null
      toast.success('Cafe deleted', cafeDeskDoneCopy('delete', current.name))
      await navigateTo('/admin/cafes')
      return
    }
    const next = action === 'unpublish' ? 'hidden' : 'approved'
    shop.value = await moderate(current, next)
    toast.success(action === 'unpublish' ? 'Unpublished' : 'Published', cafeDeskDoneCopy(action, current.name))
    pending.value = null
  } catch (err) {
    const fallback = action === 'delete' ? 'Could not delete this cafe.' : 'Could not update this cafe.'
    toast.error(action === 'delete' ? 'Could not delete' : 'Could not update this cafe', err, fallback)
  } finally {
    acting.value = false
  }
}

onMounted(() => {
  void loadCurrent()
})

watch(
  () => [route.fullPath, route.path, route.params.id],
  () => {
    void loadCurrent()
  },
)
</script>

<style scoped>
.cafe-editor {
  display: flex;
  flex-direction: column;
  gap: 20px;
  caret-color: var(--kd-primary);
}

.cafe-editor ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.editor-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  max-width: 100%;
  min-height: 40px;
  margin: 0;
  padding: 6px 14px 6px 8px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  line-height: 1.2;
}

.editor-status__mark {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1.5px solid currentColor;
  border-radius: 16px;
  flex: 0 0 auto;
}

.editor-status__dot {
  width: 8px;
  height: 8px;
  border-radius: 16px;
  background: currentColor;
}

.editor-status__label {
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
}

.editor-status__word {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.editor-status--approved {
  border-color: color-mix(in srgb, var(--kd-primary) 48%, #faf8f5);
  background: color-mix(in srgb, var(--kd-primary) 10%, #faf8f5);
  color: var(--kd-primary);
}

.editor-status--approved .editor-status__word {
  color: var(--kd-primary);
}

.editor-status--pending {
  border-color: color-mix(in srgb, var(--kd-accent) 62%, #faf8f5);
  background: color-mix(in srgb, var(--kd-accent) 16%, #faf8f5);
  color: var(--kd-accent);
}

.editor-status--pending .editor-status__word {
  color: var(--kd-ink);
}

.editor-status--hidden {
  border-color: color-mix(in srgb, var(--kd-ink) 28%, #faf8f5);
  background: color-mix(in srgb, var(--kd-ink) 8%, #faf8f5);
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
}

.editor-status--hidden .editor-status__word {
  color: var(--kd-ink);
}

.editor-status--rejected {
  border-color: color-mix(in srgb, var(--kd-destructive) 48%, #faf8f5);
  background: color-mix(in srgb, var(--kd-destructive) 10%, #faf8f5);
  color: var(--kd-destructive);
}

.editor-status--rejected .editor-status__word {
  color: var(--kd-destructive);
}

.cafe-editor :deep(.admin-form) {
  gap: 20px;
}

.cafe-editor :deep(.admin-form > .admin-panel) {
  padding: 20px;
}

.cafe-editor :deep(.admin-form > .admin-panel:not(.admin-map)) {
  display: flex;
  flex-direction: column;
}

.cafe-editor :deep(.details) {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid color-mix(in srgb, var(--kd-ink) 14%, transparent);
}

.cafe-editor :deep(.identity__logo) {
  gap: 8px;
}

.cafe-editor :deep(.identity__logo-row) {
  gap: 16px;
  margin-top: 4px;
}

.cafe-editor :deep(.identity__logo-actions) {
  gap: 10px;
}

.cafe-editor :deep(.details__hours) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cafe-editor :deep(.details__hours-label),
.cafe-editor :deep(.details__toggle),
.cafe-editor :deep(.details__times),
.cafe-editor :deep(.details__days) {
  margin-top: 0;
  margin-bottom: 0;
}

.cafe-editor :deep(.details__days) {
  gap: 16px;
}

.cafe-editor :deep(.details__day-name) {
  margin-bottom: 8px;
}

.cafe-editor :deep(.details__day-controls) {
  gap: 12px;
}

.cafe-editor :deep(.picker) {
  gap: 16px;
}

.cafe-editor :deep(.picker__copy p) {
  margin-top: 8px;
}

@media (min-width: 768px) {
  .cafe-editor :deep(.admin-form.admin-form) {
    grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
    column-gap: 24px;
    row-gap: 20px;
  }
}

@media (max-width: 520px) {
  .cafe-editor :deep(.details__day-controls:has(input)) {
    grid-template-columns: 1fr 1fr;
  }

  .cafe-editor :deep(.details__day-controls select) {
    grid-column: 1 / -1;
  }
}

.admin-btn--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--kd-destructive) 88%, #1c1917);
}
</style>
