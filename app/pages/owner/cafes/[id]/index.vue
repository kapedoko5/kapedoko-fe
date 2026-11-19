<template>
  <IonPage>
    <OwnerShell
      :title="shop?.name || 'Edit listing'"
      lede="Hours, contact, identity, logo, featured photos, and up to five vibe stamps. Verify WiFi, outlets, seating, and payment from Desk."
      :status="shellStatus"
      :error="pageError"
      :claim-count="waitingClaims.length"
    >
      <div v-if="shop && pageStatus === 'ready'" class="owner-edit">
        <p class="owner-edit__status" :class="`owner-edit__status--${shop.status}`">
          <span class="owner-edit__status-mark" aria-hidden="true">
            <span class="owner-edit__status-dot" />
          </span>
          <span class="owner-edit__status-label">Listing</span>
          <span class="owner-edit__status-word">{{ ownerLiveStatusWord(shop) }}</span>
        </p>
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
import { ownerLiveStatusWord } from '~/utils/owner-portal'

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
  align-items: flex-start;
  gap: 20px;
}

.owner-edit :deep(.owner-editor) {
  width: 100%;
}

.owner-edit__status {
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

.owner-edit__status-mark {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 1.5px solid currentColor;
  border-radius: 16px;
  flex: 0 0 auto;
}

.owner-edit__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 16px;
  background: currentColor;
}

.owner-edit__status-label {
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
}

.owner-edit__status-word {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.owner-edit__status--approved {
  border-color: color-mix(in srgb, var(--kd-primary) 48%, #faf8f5);
  background: color-mix(in srgb, var(--kd-primary) 10%, #faf8f5);
  color: var(--kd-primary);
}

.owner-edit__status--approved .owner-edit__status-word {
  color: var(--kd-primary);
}

.owner-edit__status--pending {
  border-color: color-mix(in srgb, var(--kd-accent) 62%, #faf8f5);
  background: color-mix(in srgb, var(--kd-accent) 16%, #faf8f5);
  color: var(--kd-accent);
}

.owner-edit__status--pending .owner-edit__status-word {
  color: var(--kd-ink);
}

.owner-edit__status--hidden {
  border-color: color-mix(in srgb, var(--kd-ink) 28%, #faf8f5);
  background: color-mix(in srgb, var(--kd-ink) 8%, #faf8f5);
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
}

.owner-edit__status--hidden .owner-edit__status-word {
  color: var(--kd-ink);
}

.owner-edit__status--rejected {
  border-color: color-mix(in srgb, var(--kd-destructive) 48%, #faf8f5);
  background: color-mix(in srgb, var(--kd-destructive) 10%, #faf8f5);
  color: var(--kd-destructive);
}

.owner-edit__status--rejected .owner-edit__status-word {
  color: var(--kd-destructive);
}

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

.owner-edit ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}
</style>
