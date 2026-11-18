<template>
  <IonPage>
    <AdminShell
      title="Add vibe tag"
      lede="Name it, pick an icon, and choose the stamp color. Owners can stamp it on cafes they manage."
      :status="'ready'"
    >
      <AdminVibeTagForm
        :saving="saving"
        submit-label="Save vibe tag"
        :form-error="formError"
        @save="onSave"
      />
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import AdminShell from '~/components/admin/AdminShell.vue'
import AdminVibeTagForm from '~/components/admin/AdminVibeTagForm.vue'
import { adminActionErrorMessage } from '~/utils/admin-feedback'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const saving = ref(false)
const formError = ref('')

const onSave = async (payload: Parameters<typeof admin.saveVibeTag>[0]) => {
  saving.value = true
  formError.value = ''
  try {
    const created = await admin.saveVibeTag(payload)
    toast.success('Vibe tag saved', `${created.label} is ready to stamp.`)
    await navigateTo(`/admin/vibe-tags/${created.id}`)
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not save this vibe tag.')
    toast.error('Could not save this vibe tag', formError.value)
  } finally {
    saving.value = false
  }
}
</script>
