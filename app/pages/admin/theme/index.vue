<template>
  <IonPage>
    <AdminShell
      title="Theme"
      :lede="cafeThemeLede()"
      :status="status"
      :error="pageError"
    >
      <p v-if="status === 'ready' && cafes.length === 0" class="admin-empty">
        Approve a cafe before you ink its details page.
      </p>
      <CafeThemeForm
        v-else-if="status === 'ready'"
        kind="admin"
        :cafes="cafes"
        :saving="Boolean(savingId)"
        :form-error="formError"
        :picker-options="cafeOptions"
        :picker-status="pickerStatus"
        :public-base="publicBase"
        @stamp="onStamp"
      >
        <template #busy="{ busy }">
          <AdminBusyLabel :busy="busy">
            {{ busy ? 'Stamping…' : 'Stamp this look' }}
          </AdminBusyLabel>
        </template>
      </CafeThemeForm>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import CafeThemeForm from '~/components/cafe/CafeThemeForm.vue'
import { adminActionErrorMessage } from '~/utils/admin-feedback'
import { cafePickerOptions } from '~/utils/admin-picker'
import { cafeThemeLede } from '~/utils/cafe-theme'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const config = useRuntimeConfig()
const publicBase = String(config.public.r2PublicBaseUrl || '')
const formError = ref('')
const { shops, status, error, savingId, load, applyShopTheme } = admin

const cafes = computed(() => shops.value.filter((shop) => shop.status === 'approved'))
const cafeOptions = computed(() => cafePickerOptions(shops.value))
const pickerStatus = computed(() => {
  if (status.value === 'ready') return 'ready' as const
  if (status.value === 'error' || status.value === 'forbidden') return 'error' as const
  return 'loading' as const
})
const pageError = computed(() => formError.value || error.value)

onMounted(() => {
  void load()
})

const onStamp = async (payload: {
  shopIds: string[]
  buttonHex: string | null
  textHex: string | null
  backgroundHex: string | null
}) => {
  formError.value = ''
  try {
    const rows = await applyShopTheme(
      payload.shopIds,
      payload.buttonHex,
      payload.textHex,
      payload.backgroundHex,
    )
    const names = rows.map((row) => row.name).slice(0, 3).join(', ')
    toast.success(
      'Look stamped',
      rows.length === 1
        ? `${names} now wears this ink.`
        : `Stamped ${rows.length} cafes${names ? `, including ${names}` : ''}.`,
    )
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not stamp this look.')
    toast.error('Could not stamp this look', formError.value)
  }
}
</script>
