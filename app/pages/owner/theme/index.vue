<template>
  <IonPage>
    <OwnerShell
      title="Theme"
      :lede="cafeThemeLede()"
      :status="pageStatus"
      :error="pageError"
      :claim-count="waitingClaims.length"
    >
      <p v-if="cafes.length === 0" class="owner-empty">
        Claim and verify a cafe before you ink its details page.
      </p>
      <CafeThemeForm
        v-else
        kind="owner"
        :cafes="cafes"
        :saving="saving"
        :form-error="formError"
        :public-base="publicBase"
        @stamp="onStamp"
      >
        <template #busy="{ busy }">
          <OwnerBusyLabel :busy="busy">
            {{ busy ? 'Stamping…' : 'Stamp this look' }}
          </OwnerBusyLabel>
        </template>
      </CafeThemeForm>
    </OwnerShell>
  </IonPage>
</template>

<script lang="ts" setup>
import CafeThemeForm from '~/components/cafe/CafeThemeForm.vue'
import OwnerBusyLabel from '~/components/owner-portal/OwnerBusyLabel.vue'
import OwnerShell from '~/components/owner-portal/OwnerShell.vue'
import { adminActionErrorMessage } from '~/utils/admin-feedback'
import { cafeThemeLede } from '~/utils/cafe-theme'
import { approvedOwnedCafes } from '~/utils/owner-ads'

definePageMeta({
  middleware: ['owner'],
})

const desk = useOwnerPortal()
const toast = useOwnerToast()
const config = useRuntimeConfig()
const publicBase = String(config.public.r2PublicBaseUrl || '')
const formError = ref('')
const {
  ownedShops,
  waitingClaims,
  saving,
  status,
  error,
  loadDesk,
  applyOwnedShopTheme,
} = desk

const cafes = computed(() => approvedOwnedCafes(ownedShops.value))
const pageStatus = computed(() => {
  if (desk.access.value === 'forbidden') return 'forbidden' as const
  return status.value
})
const pageError = computed(() => formError.value || error.value)

onMounted(() => {
  void loadDesk()
})

const onStamp = async (payload: {
  shopIds: string[]
  buttonHex: string | null
  textHex: string | null
  backgroundHex: string | null
}) => {
  formError.value = ''
  try {
    const rows = await applyOwnedShopTheme(
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
