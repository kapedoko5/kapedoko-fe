<template>
  <IonPage>
    <AdminShell
      title="Add event"
      lede="Pin it in the Philippines, set the gathering hours, and choose when it should appear."
      :status="'ready'"
    >
      <p v-if="formError" class="admin-error" role="alert">{{ formError }}</p>
      <AdminEventForm :saving="saving" submit-label="Save event" @save="onSave" />
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import AdminEventForm from '~/components/admin/AdminEventForm.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import { adminActionErrorMessage } from '~/utils/admin-feedback'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const saving = ref(false)
const formError = ref('')

const onSave = async (payload: Parameters<typeof admin.saveEvent>[0]) => {
  saving.value = true
  formError.value = ''
  try {
    const created = await admin.saveEvent(payload)
    toast.success('Event saved', `${created.name} is ready for its display window.`)
    await navigateTo('/admin/events')
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not save this event.')
    toast.error('Could not save this event', formError.value)
  } finally {
    saving.value = false
  }
}
</script>
