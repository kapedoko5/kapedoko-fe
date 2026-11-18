<template>
  <IonPage>
    <AdminShell
      :title="tag?.label || 'Edit vibe tag'"
      lede="Look lives on the name — icon and color. Owners and admins stamp it on cafes from cafe edit."
      :status="pageStatus"
      :error="pageError"
    >
      <AdminVibeTagForm
        v-if="tag"
        :tag="tag"
        :saving="saving"
        submit-label="Save changes"
        :form-error="formError"
        @save="onSave"
      />

      <div v-if="tag" class="admin-panel">
        <p class="admin-meta">{{ cafeCount }} cafe{{ cafeCount === 1 ? '' : 's' }} use this stamp.</p>
        <p v-if="cafeCount > 0" class="admin-meta">
          Unassign it from every cafe before deleting. Disable it to hide it from cards without losing assignments.
        </p>
        <div class="admin-row-actions">
          <button
            type="button"
            class="admin-btn admin-btn--danger"
            :disabled="cafeCount > 0 || deleting"
            :aria-busy="deleting || undefined"
            @click="onDelete"
          >
            <AdminBusyLabel :busy="deleting">
              {{ deleting ? 'Deleting…' : 'Delete tag' }}
            </AdminBusyLabel>
          </button>
        </div>
      </div>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { useIonRouter } from '@ionic/vue'
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import AdminVibeTagForm from '~/components/admin/AdminVibeTagForm.vue'
import type { VibeTagNameRow } from '~/types/admin'
import { adminActionErrorMessage } from '~/utils/admin-feedback'
import { vibeTagIdFromRoute } from '~/utils/admin-vibe-tags'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const route = useRoute()
const ionRouter = useIonRouter()
const admin = useAdminData()
const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const { shopVibeTags, status, saveVibeTag, fetchVibeTag, deleteVibeTag } = admin

const tag = ref<VibeTagNameRow | null>(null)
const saving = ref(false)
const deleting = ref(false)
const formError = ref('')
const pageError = ref('')
const pageStatus = ref<'loading' | 'ready' | 'error'>('loading')

function resolveTagId(): string {
  const param = route.params.id
  const href = import.meta.client
    ? `${window.location.pathname}${window.location.hash}${window.location.search}`
    : ''
  return (
    vibeTagIdFromRoute(route.fullPath, param)
    || vibeTagIdFromRoute(route.path, param)
    || vibeTagIdFromRoute(String(ionRouter.routeInfo?.pathname || ''), param)
    || vibeTagIdFromRoute(href, param)
  )
}

const cafeCount = computed(() => {
  if (!tag.value) return 0
  return new Set(shopVibeTags.value.filter((row) => row.tag_id === tag.value?.id).map((row) => row.shop_id)).size
})

const loadTag = async () => {
  pageStatus.value = 'loading'
  pageError.value = ''
  const id = resolveTagId()
  if (!id) {
    pageStatus.value = 'error'
    pageError.value = 'Vibe tag was not found.'
    return
  }
  try {
    if (status.value === 'idle') await admin.load()
    tag.value = await fetchVibeTag(id)
    if (!tag.value) {
      pageStatus.value = 'error'
      pageError.value = 'Vibe tag was not found.'
      return
    }
    pageStatus.value = 'ready'
  } catch (err) {
    pageStatus.value = 'error'
    pageError.value = adminActionErrorMessage(err, 'Could not load this vibe tag.')
  }
}

const onSave = async (payload: Parameters<typeof saveVibeTag>[0]) => {
  if (!tag.value) return
  saving.value = true
  formError.value = ''
  try {
    tag.value = await saveVibeTag({ ...payload, id: tag.value.id })
    toast.success('Vibe tag saved', `${tag.value.label} is up to date.`)
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not save this vibe tag.')
    toast.error('Could not save this vibe tag', formError.value)
  } finally {
    saving.value = false
  }
}

const onDelete = async () => {
  if (!tag.value || cafeCount.value > 0) return
  const choice = await askAdmin({
    title: `Delete ${tag.value.label}?`,
    message: 'This removes the stamp from the catalog. Cafes no longer using it will not see it again.',
    confirmLabel: 'Delete tag',
    variant: 'destructive',
  })
  if (!choice.confirmed) return
  deleting.value = true
  try {
    await deleteVibeTag(tag.value)
    toast.success('Vibe tag deleted', `${tag.value.label} is gone.`)
    await navigateTo('/admin/vibe-tags')
  } catch (err) {
    toast.error('Could not delete this tag', adminActionErrorMessage(err, 'Could not delete this tag.'))
  } finally {
    deleting.value = false
  }
}

watch(
  () => [route.fullPath, route.path, route.params.id],
  () => {
    void loadTag()
  },
  { immediate: true },
)
</script>
