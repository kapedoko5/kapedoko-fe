<template>
  <IonPage>
    <IonContent :scroll-y="true" class="owner-page-content">
      <div class="owner-page">
        <header class="owner-page__bar">
          <button type="button" class="owner-page__back" aria-label="Go back" @click="goBack">
            <ChevronLeft :size="22" :stroke-width="2.25" />
          </button>
          <div class="owner-page__heading">
            <h1>Edit listing</h1>
            <p v-if="shop">{{ shop.name }}</p>
          </div>
        </header>

        <p v-if="pageStatus === 'loading'" class="owner-page__state">Loading your cafe…</p>
        <div v-else-if="pageStatus === 'forbidden'" class="owner-page__state">
          <h2>This listing is not yours to edit yet</h2>
          <p>Claim it first. An admin has to verify the claim before hours, contact, or logo can change.</p>
          <NuxtLink v-if="shopId" class="owner-page__cta" :to="`/app/cafes/${shopId}/claim`">Claim this cafe</NuxtLink>
        </div>
        <div v-else-if="!shop" class="owner-page__state">
          <h2>Cafe not found</h2>
          <p>It may have been unpublished.</p>
        </div>
        <div v-else>
          <p v-if="formError" class="owner-page__error" role="alert">{{ formError }}</p>
          <OwnerCafeForm :key="shop.id" :shop="shop" :saving="saving" @save="onSave" />
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<script lang="ts" setup>
import { onIonViewWillEnter, useIonRouter } from '@ionic/vue'
import { ChevronLeft } from 'lucide-vue-next'
import OwnerCafeForm from '~/components/owner/OwnerCafeForm.vue'
import type { ShopRow } from '~/types/shop'
import { isShopId, resolveLiveShopId } from '~/utils/approved-shops'

definePageMeta({
  middleware: ['auth'],
})

useAppTabBar('hide')

const route = useRoute()
const ionRouter = useIonRouter()
const supabase = useSupabaseClient()
const ownership = useShopOwnership()
const { saving, load: loadOwnership, isOwner, updateOwnedShop } = ownership

const shop = ref<ShopRow | null>(null)
const pageStatus = ref<'loading' | 'ready' | 'forbidden' | 'missing'>('loading')
const formError = ref('')

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

const goBack = async () => {
  if (ionRouter.canGoBack()) {
    ionRouter.back()
    return
  }
  await navigateTo('/app/profile')
}

let emptyIdTimer: ReturnType<typeof window.setTimeout> | null = null

const load = async () => {
  if (emptyIdTimer) {
    window.clearTimeout(emptyIdTimer)
    emptyIdTimer = null
  }
  pageStatus.value = shop.value ? pageStatus.value : 'loading'
  formError.value = ''
  const id = resolveShopId()
  if (!isShopId(id)) {
    if (id) {
      shop.value = null
      pageStatus.value = 'missing'
      return
    }
    emptyIdTimer = window.setTimeout(() => {
      const retry = resolveShopId()
      if (isShopId(retry)) {
        void load()
        return
      }
      if (!shop.value) pageStatus.value = 'missing'
    }, 600)
    return
  }
  try {
    try {
      await loadOwnership()
    } catch {
      // Ownership lookup is separate from whether the shop exists.
    }
    const { data, error } = await supabase.from('shops').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    shop.value = (data ?? null) as ShopRow | null
    if (!shop.value) {
      pageStatus.value = 'missing'
      return
    }
    pageStatus.value = isOwner(id) ? 'ready' : 'forbidden'
  } catch (err) {
    pageStatus.value = shop.value ? 'ready' : 'missing'
    formError.value = err instanceof Error ? err.message : 'Could not load this cafe.'
  }
}

const onSave = async (payload: Parameters<typeof updateOwnedShop>[1]) => {
  if (!shop.value) return
  formError.value = ''
  try {
    shop.value = await updateOwnedShop(shop.value.id, payload)
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Could not save this cafe.'
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
  void load()
})

onBeforeUnmount(() => {
  if (emptyIdTimer) window.clearTimeout(emptyIdTimer)
})
</script>

<style scoped>
.owner-page-content {
  --background: #faf8f5;
}

.owner-page {
  width: min(100%, var(--kd-readable-max));
  margin-inline: auto;
  min-height: 100%;
  padding: 0 16px 32px;
  background: #faf8f5;
}

.owner-page__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 52px;
  padding-top: max(0.5rem, env(safe-area-inset-top));
}

.owner-page__back {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  cursor: pointer;
}

.owner-page__heading h1,
.owner-page__heading p,
.owner-page__state h2,
.owner-page__state p {
  margin: 0;
  color: var(--kd-ink);
}

.owner-page__heading h1,
.owner-page__state h2 {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.owner-page__heading p,
.owner-page__state p {
  margin-top: 4px;
  font-size: 0.7875rem;
  color: color-mix(in srgb, var(--kd-ink) 72%, transparent);
}

.owner-page__state {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.owner-page__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--kd-accent);
  border-radius: 16px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  text-decoration: none;
}

.owner-page__error {
  margin: 12px 0;
  color: var(--kd-destructive);
  font-size: 0.7875rem;
  font-weight: 700;
}

.owner-page__back:focus-visible,
.owner-page__cta:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 3px;
}
</style>
