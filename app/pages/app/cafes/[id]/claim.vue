<template>
  <IonPage>
    <IonContent :scroll-y="true" class="owner-page-content">
      <div class="owner-page">
        <header class="owner-page__bar">
          <button type="button" class="owner-page__back" aria-label="Go back" @click="goBack">
            <ChevronLeft :size="22" :stroke-width="2.25" />
          </button>
          <div class="owner-page__heading">
            <h1>Claim this cafe</h1>
            <p v-if="cafe">{{ cafe.name }}</p>
          </div>
        </header>

        <div v-if="pageStatus === 'loading'" class="owner-page__state">
          <p>Loading this cafe…</p>
        </div>
        <div v-else-if="pageStatus === 'error'" class="owner-page__state">
          <h2>Could not load this cafe</h2>
          <p>Check your connection and try again.</p>
        </div>
        <div v-else-if="pageStatus === 'missing'" class="owner-page__state">
          <h2>This cafe is not on the map yet</h2>
          <p>Only listed cafes can be claimed.</p>
        </div>
        <div v-else-if="!signedIn" class="owner-page__state">
          <h2>Sign in to claim {{ cafe?.name || 'this cafe' }}</h2>
          <p>We’ll ask how you’re connected, then an admin verifies the listing before you can edit it.</p>
          <button type="button" class="owner-page__cta" @click="goLogin">Sign in</button>
        </div>
        <section v-else-if="existing" class="owner-page__panel" :aria-live="existing.status === 'pending' ? 'polite' : undefined">
          <h2>{{ existing.status === 'verified' ? 'You manage this cafe' : existing.status === 'rejected' ? 'This claim was not verified' : 'Claim sent' }}</h2>
          <p>{{ claimStatusCopy(existing.status, existing.rejection_reason) }}</p>
          <NuxtLink v-if="existing.status === 'verified'" class="owner-page__cta" :to="`/app/cafes/${shopId}/edit`">
            Edit listing
          </NuxtLink>
          <button
            v-else-if="existing.status === 'pending'"
            type="button"
            class="owner-page__cta"
            @click="goCafe"
          >
            Back to {{ cafe?.name || 'this cafe' }}
          </button>
          <form v-else-if="existing.status === 'rejected'" class="owner-page__form" @submit.prevent="onSubmit">
            <p>You can send a new claim with clearer proof.</p>
            <ClaimFields v-model:note="note" v-model:email="email" v-model:phone="phone" :issues="issues" />
            <p v-if="formError" class="owner-page__error" role="alert">{{ formError }}</p>
            <button type="submit" class="owner-page__cta" :disabled="saving">
              {{ saving ? 'Sending…' : 'Send a new claim' }}
            </button>
          </form>
        </section>
        <form v-else class="owner-page__panel owner-page__form" @submit.prevent="onSubmit">
          <h2>Prove you can represent this cafe</h2>
          <p>An admin reviews this before you can change hours, contact details, or the logo. Do not upload logos from a map listing you do not own.</p>
          <ClaimFields v-model:note="note" v-model:email="email" v-model:phone="phone" :issues="issues" />
          <p v-if="formError" class="owner-page__error" role="alert">{{ formError }}</p>
          <button type="submit" class="owner-page__cta" :disabled="saving">
            {{ saving ? 'Sending…' : 'Send claim' }}
          </button>
        </form>
      </div>
    </IonContent>
  </IonPage>
</template>

<script lang="ts" setup>
import { onIonViewWillEnter, useIonRouter } from '@ionic/vue'
import { ChevronLeft } from 'lucide-vue-next'
import ClaimFields from '~/components/owner/ClaimFields.vue'
import type { Cafe } from '~/types/cafe'
import { fetchApprovedCafeById, isShopId, resolveLiveShopId } from '~/utils/approved-shops'
import { claimFormError, claimStatusCopy, normalizeClaimNote } from '~/utils/shop-claims'
import { normalizePhone } from '~/utils/phone'

definePageMeta({
  middleware: ['auth'],
})

useAppTabBar('hide')

const route = useRoute()
const ionRouter = useIonRouter()
const supabase = useSupabaseClient()
const config = useRuntimeConfig()
const { user, goToLogin } = useAuth()
const ownership = useShopOwnership()
const { saving, submitClaim, loadClaimForShop, claimForShop } = ownership

const cafe = ref<Cafe | null>(null)
const pageStatus = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')
const note = ref('')
const email = ref('')
const phone = ref('')
const issues = reactive({ note: null as string | null, contact: null as string | null })
const formError = ref('')

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

const shopId = computed(() => resolveShopId())
const signedIn = computed(() => Boolean(user.value))
const existing = computed(() => (shopId.value ? claimForShop(shopId.value) : null))

const goBack = async () => {
  if (ionRouter.canGoBack()) {
    ionRouter.back()
    return
  }
  if (shopId.value) await navigateTo(`/app/cafes/${shopId.value}`)
  else await navigateTo('/app')
}

const cafeHref = (id: string) => `/app/cafes/${id}`

const sameCafePath = (path: string, id: string) => {
  const bare = path.split(/[?#]/)[0].replace(/\/$/, '')
  return bare === cafeHref(id)
}

const goCafe = async () => {
  const id = resolveShopId()
  if (!isShopId(id)) return
  const previous = typeof history.state?.back === 'string' ? history.state.back : ''
  if (ionRouter.canGoBack() && sameCafePath(previous, id)) {
    ionRouter.back()
    return
  }
  ionRouter.replace(cafeHref(id))
}

const goLogin = async () => {
  await goToLogin(route.fullPath)
}

let loadSeq = 0
let emptyIdTimer: ReturnType<typeof window.setTimeout> | null = null

const load = async (force = false) => {
  if (emptyIdTimer) {
    window.clearTimeout(emptyIdTimer)
    emptyIdTimer = null
  }

  const id = resolveShopId()
  if (!isShopId(id)) {
    if (id) {
      cafe.value = null
      pageStatus.value = 'missing'
      return
    }
    pageStatus.value = cafe.value ? 'ready' : 'loading'
    emptyIdTimer = window.setTimeout(() => {
      const retry = resolveShopId()
      if (isShopId(retry)) {
        void load(force)
        return
      }
      if (!cafe.value && pageStatus.value === 'loading') pageStatus.value = 'missing'
    }, 600)
    return
  }

  if (cafe.value?.id === id && pageStatus.value === 'ready' && !force) return

  const seq = ++loadSeq
  if (!cafe.value) pageStatus.value = 'loading'
  try {
    const nextCafe = await fetchApprovedCafeById(supabase, String(config.public.r2PublicBaseUrl || ''), id)
    if (seq !== loadSeq) return
    cafe.value = nextCafe
    if (!nextCafe) {
      pageStatus.value = 'missing'
      return
    }
    pageStatus.value = 'ready'
    if (user.value) {
      try {
        await loadClaimForShop(id)
      } catch {
        // Keep the claim form up even if the existing-claim lookup fails.
      }
    }
  } catch {
    if (seq !== loadSeq) return
    pageStatus.value = cafe.value?.id === id ? 'ready' : 'error'
  }
}

const onSubmit = async () => {
  const next = claimFormError({ note: note.value, email: email.value, phone: phone.value })
  Object.assign(issues, next)
  formError.value = ''
  const id = resolveShopId()
  if (next.note || next.contact || !isShopId(id)) return
  try {
    await submitClaim({
      shopId: id,
      note: normalizeClaimNote(note.value),
      email: email.value.trim(),
      phone: normalizePhone(phone.value),
    })
    note.value = ''
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Could not send this claim.'
  }
}

watch(
  () => [route.fullPath, route.path, route.params.id, user.value?.id],
  () => {
    void load()
  },
  { immediate: true },
)

onIonViewWillEnter(() => {
  void load(true)
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
.owner-page__panel h2,
.owner-page__panel p,
.owner-page__state h2,
.owner-page__state p {
  margin: 0;
  color: var(--kd-ink);
}

.owner-page__heading h1,
.owner-page__panel h2,
.owner-page__state h2 {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.owner-page__heading p,
.owner-page__panel p,
.owner-page__state p {
  margin-top: 4px;
  font-size: 0.7875rem;
  line-height: 1.35;
  color: color-mix(in srgb, var(--kd-ink) 72%, transparent);
}

.owner-page__panel,
.owner-page__state {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.owner-page__form {
  gap: 14px;
}

.owner-page__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 10px 16px;
  border: 1px solid var(--kd-accent);
  border-radius: 16px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
}

.owner-page__cta:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (hover: hover) {
  .owner-page__cta:hover:not(:disabled) {
    box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
  }
}

.owner-page__error {
  margin: 0;
  color: var(--kd-destructive);
  font-size: 0.7875rem;
  font-weight: 700;
}

.owner-page__back:focus-visible,
.owner-page__cta:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 3px;
}

:root.is-android .owner-page__cta {
  min-height: 48px;
}
</style>
