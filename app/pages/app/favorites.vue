<template>
  <IonPage>
    <IonContent class="favorites-content">
      <div class="favorites" :class="{ 'has-detail': paneDocked }">
        <header class="favorites-hero">
          <button
            type="button"
            class="favorites-back"
            aria-label="Back to Home"
            @click="goBack"
          >
            <ArrowLeft :size="24" :stroke-width="2" />
          </button>

          <div class="favorites-heading">
            <Heart :size="22" :stroke-width="1.75" aria-hidden="true" />
            <h1>
              <span>{{ headingLead }}</span>
              <strong>{{ headingEmph }}</strong>
            </h1>
          </div>
        </header>

        <p v-if="!signedIn && savedCafes.length > 0" class="favorites-sync">
          These saves stay on this device.
          <button type="button" @click="goLogin">Sign in</button>
          to keep them on your other devices.
        </p>

        <p class="sr-only" aria-live="polite">{{ statusAnnouncement }}</p>

        <Transition name="favorites-view" mode="out-in">
          <section v-if="listStatus === 'loading'" key="loading" class="favorites-empty" aria-busy="true">
            <p>Loading saved cafes…</p>
          </section>
          <section v-else-if="listStatus === 'error'" key="error" class="favorites-empty">
            <p>{{ listError || 'Could not load saved cafes. Check your connection and try again.' }}</p>
            <button type="button" class="favorites-empty__action" @click="loadSaved">Try again</button>
          </section>
          <section
            v-else-if="savedCafes.length === 0"
            key="empty"
            class="favorites-empty"
            aria-label="No saved cafes"
          >
            <p>Save a cafe from Home when you find a place you can work from. It will show up here.</p>
            <button type="button" class="favorites-empty__action" @click="goBack">
              Find coffee shops
            </button>
          </section>

          <section
            v-else
            key="list"
            class="favorites-list"
            aria-label="Saved cafes"
          >
              <CafeCard
                v-for="(cafe, index) in savedCafes"
                :key="cafe.id"
                :cafe="cafe"
                :selected="cafe.id === detailCafe?.id"
                :style="{ '--enter': String(index % 12) }"
                surface="favorites"
                @select="openCafe"
              />
          </section>
        </Transition>
      </div>
      <AppDetailPane
        :open="paneOpen"
        :label="detailCafe?.name || 'Cafe details'"
        @close="closeDetail"
        @after-leave="afterLeave"
      >
        <CafeDetailContent
          v-if="detailCafe"
          :key="detailCafe.id"
          :cafe="detailCafe"
          variant="sheet"
          @review="onReview"
          @checkin="onCheckIn"
        />
      </AppDetailPane>
    </IonContent>
  </IonPage>
</template>

<script lang="ts" setup>
import { ArrowLeft, Heart } from 'lucide-vue-next'
import AppDetailPane from '~/components/AppDetailPane.vue'
import CafeCard from '~/components/cafe/CafeCard.vue'
import CafeDetailContent from '~/components/cafe/CafeDetailContent.vue'
import type { Cafe } from '~/types/cafe'
import { ANALYTICS_EVENTS } from '~/utils/analytics'
import { fetchApprovedCafesByIds } from '~/utils/approved-shops'

useAppTabBar('show')
const {
  cafe: detailCafe,
  paneOpen,
  paneDocked,
  openCafe: openCafePane,
  close: closeDetail,
  afterLeave,
  onReview,
  onCheckIn,
} = useListDetailPane('favorites')

const favorites = useFavorites()
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const config = useRuntimeConfig()
const { goToLogin } = useAuth()
const { track, once, consent } = useAnalytics()

const savedCafes = ref<Cafe[]>([])
const listStatus = ref<'loading' | 'ready' | 'error'>('loading')
const listError = ref('')
const signedIn = computed(() => Boolean(user.value))

let loadSeq = 0

const loadSaved = async () => {
  const ids = favorites.ids.value
  if (!ids.length) {
    savedCafes.value = []
    listError.value = ''
    listStatus.value = favorites.status.value === 'idle' || favorites.status.value === 'loading'
      ? 'loading'
      : 'ready'
    return
  }
  const seq = ++loadSeq
  listStatus.value = savedCafes.value.length ? 'ready' : 'loading'
  listError.value = ''
  try {
    const next = await fetchApprovedCafesByIds(supabase, String(config.public.r2PublicBaseUrl || ''), ids)
    if (seq !== loadSeq) return
    savedCafes.value = next
    listStatus.value = 'ready'
  } catch {
    if (seq !== loadSeq) return
    listStatus.value = 'error'
    listError.value = favorites.error.value || 'Could not load saved cafes.'
  }
}

const headingLead = computed(() =>
  savedCafes.value.length === 0 ? 'No favorite' : 'Here are your favorite',
)

const headingEmph = 'coffee shops'

const statusAnnouncement = computed(() => {
  const count = savedCafes.value.length
  if (count === 0) return 'No favorite coffee shops yet.'
  return count === 1 ? '1 saved coffee shop.' : `${count} saved coffee shops.`
})

onMounted(() => {
  void loadSaved()
})

watch(() => [favorites.ids.value.join(','), favorites.status.value], () => {
  void loadSaved()
})

const openCafe = async (id: string) => {
  const fallback = savedCafes.value.find((item) => item.id === id) || null
  await openCafePane(id, fallback)
}

const goLogin = () => {
  void goToLogin('/app/favorites')
}

watch(
  [signedIn, savedCafes, listStatus, consent],
  () => {
    if (consent.value !== 'granted') return
    if (signedIn.value || listStatus.value !== 'ready' || savedCafes.value.length === 0) return
    if (!once('auth_prompt:favorites_sync')) return
    track(ANALYTICS_EVENTS.AUTH_PROMPT_SHOWN, { trigger: 'favorites_sync' })
  },
)

const goBack = async () => {
  await navigateTo('/app')
}
</script>

<style scoped>
.favorites-content {
  --background: #f2f2f2;
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.favorites-content :deep(.inner-scroll) {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.favorites {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 100%;
  background-color: #f2f2f2;
  color: var(--kd-ink);
  padding-bottom: var(--kd-tabbar-inset);
}

.favorites-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: max(1.25rem, calc(env(safe-area-inset-top) + 8px)) 20px 8px;
}

.favorites-back {
  position: absolute;
  top: max(1.1rem, calc(env(safe-area-inset-top) + 4px));
  left: 8px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 140ms cubic-bezier(0.16, 1, 0.3, 1);
}

.favorites-back:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
  border-radius: 8px;
}

.favorites-heading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 12px 8px;
  color: var(--kd-ink);
  text-align: center;
}

.favorites-heading :deep(svg) {
  color: var(--kd-accent);
}

.favorites-heading h1 {
  display: flex;
  flex-direction: column;
  margin: 0;
  max-width: 16rem;
  font-family: inherit;
}

.favorites-heading h1 span {
  font-size: 0.95rem;
  font-weight: 400;
  line-height: 1.35;
  letter-spacing: 0;
}

.favorites-heading h1 strong {
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.favorites-sync {
  margin: 0 20px 12px;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  line-height: 1.4;
  text-align: center;
}

.favorites-sync button {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-primary);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.favorites-sync button:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
  border-radius: 4px;
}

.favorites-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  padding: 4px 20px 12px;
}

.favorites-empty {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 20px;
  padding: 16px 32px 48px;
  text-align: center;
}

.favorites-empty p {
  margin: 0;
  max-width: 18rem;
  color: var(--kd-ink);
  font-size: 0.875rem;
  line-height: 1.45;
}

.favorites-empty__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 180px;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--kd-accent);
  border-radius: 16px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: box-shadow 160ms ease,
    transform 140ms cubic-bezier(0.16, 1, 0.3, 1);
}

.favorites-empty__action:hover {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

.favorites-empty__action:active {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
  transform: scale(0.94);
}

.favorites-empty__action:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 3px;
}

.favorites-back:active {
  transform: scale(0.94);
}

.favorites-view-enter-active,
.favorites-view-leave-active {
  transition: opacity 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.favorites-view-enter-from,
.favorites-view-leave-to {
  opacity: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  .favorites-back,
  .favorites-empty__action,
  .favorites-view-enter-active,
  .favorites-view-leave-active {
    transition-duration: 1ms;
  }

  .favorites-back:active,
  .favorites-empty__action:active {
    transform: none;
  }
}

::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}
</style>
