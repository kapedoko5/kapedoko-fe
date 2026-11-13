<template>
  <IonPage>
    <AdminShell
      title="Add badge"
      lede="Name it, pick a color and icon, then award it to cafes from the next screen."
      :status="'ready'"
    >
      <AdminBadgeNameForm
        :saving="saving"
        submit-label="Save badge"
        :public-base="publicBase"
        :form-error="formError"
        @save="onSave"
      />
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import AdminBadgeNameForm from '~/components/admin/AdminBadgeNameForm.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import { adminActionErrorMessage } from '~/utils/admin-feedback'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const config = useRuntimeConfig()
const publicBase = String(config.public.r2PublicBaseUrl || '')
const saving = ref(false)
const formError = ref('')

const onSave = async (payload: Parameters<typeof admin.saveBadgeName>[0]) => {
  saving.value = true
  formError.value = ''
  try {
    const created = await admin.saveBadgeName(payload)
    toast.success('Badge saved', `${created.label} is ready to award.`)
    await navigateTo(`/admin/badges/${created.id}`)
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not save this badge.')
    toast.error('Could not save this badge', formError.value)
  } finally {
    saving.value = false
  }
}
</script>
