<template>
  <IonPage>
    <OwnerShell
      :title="shop?.name || 'Edit listing'"
      lede="Hours, contact, identity, and the logo. WiFi and outlets still come from visitor reviews."
      :status="shellStatus"
      :error="pageError"
      :claim-count="waitingClaims.length"
    >
      <div v-if="shop && pageStatus === 'ready'" class="owner-edit">
        <p class="owner-edit__live">{{ ownerLiveCopy(shop) }}</p>
        <p v-if="formError" class="owner-edit__error" role="alert">{{ formError }}</p>
        <OwnerCafeEditor
          :key="shop.id"
          :shop="shop"
          :saving="saving"
          @save="onSave"
        />
      </div>
      <div v-else-if="pageStatus === 'forbidden'" class="owner-edit__empty">
        <p>This listing is not yours to edit yet. An admin has to verify the claim first.</p>
        <NuxtLink class="owner-btn" to="/owner/claims">Open claims</NuxtLink>
      </div>
    </OwnerShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { onIonViewWillEnter, useIonRouter } from '@ionic/vue'
import OwnerCafeEditor from '~/components/owner-portal/OwnerCafeEditor.vue'
import OwnerShell from '~/components/owner-portal/OwnerShell.vue'
import type { ShopRow } from '~/types/shop'
import { isShopId, resolveLiveShopId } from '~/utils/approved-shops'
import { settleOwnerIonPages } from '~/utils/owner-nav'
import { ownerLiveCopy } from '~/utils/owner-portal'

definePageMeta({
  middleware: ['owner'],
})

const route = useRoute()
const ionRouter = useIonRouter()
const supabase = useSupabaseClient()
const toast = useOwnerToast()
const desk = useOwnerPortal()
const {
  waitingClaims,
  saving,
  isOwner,
  shopById,
  updateOwnedShop,
  loadDesk,
  error,
} = desk

const shop = ref<ShopRow | null>(null)
const pageStatus = ref<'idle' | 'loading' | 'ready' | 'forbidden' | 'error'>('loading')
const formError = ref('')
const pageError = computed(() => formError.value || error.value)
const shellStatus = computed(() => {
  if (desk.access.value === 'forbidden') return 'forbidden' as const
  if (pageStatus.value === 'forbidden') return 'ready' as const
  return pageStatus.value
})

const shopId = computed(() => resolveShopId())

function resolveShopId(): string {
  const param = route.params.id
  const href = import.meta.client
    ? `${window.location.pathname}${window.location.hash}${window.location.search}`
    : ''
  return resolveLiveShopId(route.fullPath, route.path, param, {
    ionPath: String(ionRouter.routeInfo?.pathname || ''),
    href,
  })
}

let emptyIdTimer: ReturnType<typeof window.setTimeout> | null = null

const load = async () => {
  if (emptyIdTimer) {
    window.clearTimeout(emptyIdTimer)
    emptyIdTimer = null
  }
  formError.value = ''
  const id = resolveShopId()
  if (!isShopId(id)) {
    if (id) {
      shop.value = null
      pageStatus.value = 'error'
      formError.value = 'Cafe not found.'
      return
    }
    pageStatus.value = shop.value ? pageStatus.value : 'loading'
    emptyIdTimer = window.setTimeout(() => {
      const retry = resolveShopId()
      if (isShopId(retry)) {
        void load()
        return
      }
      if (!shop.value) {
        pageStatus.value = 'error'
        formError.value = 'Cafe not found.'
      }
    }, 600)
    return
  }
  pageStatus.value = shop.value?.id === id ? pageStatus.value : 'loading'
  try {
    await loadDesk()
    const owned = shopById(id)
    if (owned) {
      shop.value = owned
      pageStatus.value = 'ready'
      return
    }
    const { data, error: shopError } = await supabase.from('shops').select('*').eq('id', id).maybeSingle()
    if (shopError) throw shopError
    shop.value = (data ?? null) as ShopRow | null
    if (!shop.value) {
      pageStatus.value = 'error'
      formError.value = 'Cafe not found.'
      return
    }
    pageStatus.value = isOwner(id) ? 'ready' : 'forbidden'
  } catch (err) {
    pageStatus.value = shop.value && isOwner(id) ? 'ready' : 'error'
    formError.value = err instanceof Error ? err.message : 'Could not load this cafe.'
  }
}

const onSave = async (payload: Parameters<typeof updateOwnedShop>[1]) => {
  if (!shop.value) return
  formError.value = ''
  try {
    shop.value = await updateOwnedShop(shop.value.id, payload)
    toast.success('Saved', `${shop.value.name} is updated on Home and Map.`)
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Could not save this cafe.'
    toast.error('Could not save', err, 'Could not save this cafe.')
  }
}

watch(
  () => [route.fullPath, route.path, route.params.id],
  () => {
    void load()
  },
  { immediate: true },
)

onIonViewWillEnter(() => {
  if (import.meta.client) requestAnimationFrame(settleOwnerIonPages)
  void load()
})

onBeforeUnmount(() => {
  if (emptyIdTimer) window.clearTimeout(emptyIdTimer)
})
</script>

<style scoped>
.owner-edit {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.owner-edit__live,
.owner-edit__error,
.owner-edit__empty p {
  margin: 0;
  font-size: 0.7875rem;
  line-height: 1.3;
}

.owner-edit__error {
  color: var(--kd-destructive);
  font-weight: 700;
}

.owner-edit__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
</style>
