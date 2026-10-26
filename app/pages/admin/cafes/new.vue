<template>
  <IonPage>
    <AdminShell
      title="Add cafe"
      lede="Saved unpublished. Publish it from the cafe page when the listing is ready."
      :status="'ready'"
    >
      <p v-if="formError" class="admin-error" role="alert">{{ formError }}</p>
      <AdminCafeForm
        :key="formEpoch"
        ref="formRef"
        :saving="saving"
        submit-label="Save cafe"
        @save="onSave"
      />
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { onIonViewWillEnter } from '@ionic/vue'
import AdminCafeForm from '~/components/admin/AdminCafeForm.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import { adminActionErrorMessage } from '~/utils/admin-feedback'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const saving = ref(false)
const formError = ref('')
const formRef = ref<{ reset: () => void } | null>(null)
const formEpoch = ref(0)
const resetAfterSave = ref(false)

const resetCreateForm = () => {
  formRef.value?.reset()
  formEpoch.value += 1
  formError.value = ''
}

const onSave = async (payload: Parameters<typeof admin.createShop>[0]) => {
  saving.value = true
  formError.value = ''
  try {
    const created = await admin.createShop(payload)
    toast.success('Cafe saved', `${created.name} landed unpublished.`)
    saving.value = false
    resetAfterSave.value = true
    resetCreateForm()
    await nextTick()
    await navigateTo('/admin/cafes')
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not save this cafe.')
    toast.error('Could not save this cafe', formError.value)
  } finally {
    saving.value = false
  }
}

onIonViewWillEnter(() => {
  if (!resetAfterSave.value) return
  resetCreateForm()
  resetAfterSave.value = false
})
</script>
