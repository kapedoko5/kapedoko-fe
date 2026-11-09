<template>
  <IonPage>
    <IonContent :scroll-y="true" class="event-page-content">
      <div class="event-page">
        <header class="event-page__bar">
          <button type="button" class="event-page__back" aria-label="Go back" @click="goBack">
            <ChevronLeft :size="22" :stroke-width="2.25" />
          </button>
          <h1 class="sr-only">{{ heading }}</h1>
        </header>

        <div v-if="status === 'loading'" class="event-page__state">
          <p>Loading this event…</p>
          <div class="event-page__pulse" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div v-else-if="status === 'missing' || status === 'error'" class="event-page__state">
          <h2>
            {{ status === 'error' ? 'Could not load this event' : 'This event is not on the map yet' }}
          </h2>
          <p>
            {{
              status === 'error'
                ? 'Check your connection and try again.'
                : 'It may have ended, or the link is out of date.'
            }}
          </p>
          <button type="button" class="event-page__home" @click="goHome">Back to Home</button>
        </div>

        <EventDetailContent v-else-if="event" :event="event" variant="page" />
      </div>
    </IonContent>
  </IonPage>
</template>

<script lang="ts" setup>
import { Capacitor } from '@capacitor/core'
import { onIonViewWillEnter, useIonRouter } from '@ionic/vue'
import { ChevronLeft } from 'lucide-vue-next'
import EventDetailContent from '~/components/event/EventDetailContent.vue'
import type { ActiveEventRow, KapeEvent } from '~/types/event'
import { eventIdFromRoute, isEventId, mapActiveEvent } from '~/utils/events'

useAppTabBar('hide')

const route = useRoute()
const ionRouter = useIonRouter()
const supabase = useSupabaseClient()
const config = useRuntimeConfig()

const event = ref<KapeEvent | null>(null)
const status = ref<'loading' | 'ready' | 'missing' | 'error'>('loading')
const heading = computed(() => event.value?.name || 'Event details')

function resolveEventId(): string {
  const param = route.params.id
  const href = import.meta.client
    ? `${window.location.pathname}${window.location.hash}${window.location.search}`
    : ''
  return (
    eventIdFromRoute(route.fullPath, param)
    || eventIdFromRoute(route.path, param)
    || eventIdFromRoute(String(ionRouter.routeInfo?.pathname || ''), param)
    || eventIdFromRoute(href, param)
  )
}

const publicBase = () => String(config.public.r2PublicBaseUrl || '')

const loadEvent = async (id: string): Promise<KapeEvent | null> => {
  const { data, error } = await supabase
    .from('active_events')
    .select('id, name, organizer_name, organizer_contact_name, organizer_contact_number, description, address, latitude, longitude, event_starts_at, event_ends_at, display_starts_at, display_ends_at, poster_object_key, gallery_object_keys')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapActiveEvent(data as ActiveEventRow, publicBase())
}

const goHome = async () => {
  await navigateTo('/app')
}

const goBack = async () => {
  if (ionRouter.canGoBack()) {
    ionRouter.back()
    return
  }
  await goHome()
}

const onHardwareBack = (event: Event) => {
  const register = (event as CustomEvent<{ register: (priority: number, handler: () => void) => void }>).detail?.register
  if (!register) return
  register(20, () => {
    void goBack()
  })
}

let loadSeq = 0
let emptyIdTimer: ReturnType<typeof window.setTimeout> | null = null

const bootstrap = async (id: string, force = false) => {
  if (emptyIdTimer) {
    window.clearTimeout(emptyIdTimer)
    emptyIdTimer = null
  }

  if (!isEventId(id)) {
    if (id) {
      status.value = 'missing'
      return
    }
    status.value = event.value ? 'ready' : 'loading'
    emptyIdTimer = window.setTimeout(() => {
      const retry = resolveEventId()
      if (isEventId(retry)) {
        void bootstrap(retry, force)
        return
      }
      if (!event.value && status.value === 'loading') status.value = 'missing'
    }, 600)
    return
  }
  if (event.value?.id === id && status.value === 'ready' && !force) return

  const seq = ++loadSeq
  if (!event.value) status.value = 'loading'
  try {
    const next = await loadEvent(id)
    if (seq !== loadSeq) return
    if (!next) {
      event.value = null
      status.value = 'missing'
      return
    }
    event.value = next
    status.value = 'ready'
  } catch {
    if (seq !== loadSeq) return
    status.value = event.value?.id === id ? 'ready' : 'error'
  }
}

watch(
  () => [route.fullPath, route.path, route.params.id],
  () => {
    void bootstrap(resolveEventId())
  },
  { immediate: true },
)

onIonViewWillEnter(() => {
  void bootstrap(resolveEventId(), true)
})

onMounted(() => {
  if (Capacitor.getPlatform() === 'android') {
    document.documentElement.classList.add('is-android')
  }
  document.addEventListener('ionBackButton', onHardwareBack)
})

onBeforeUnmount(() => {
  if (emptyIdTimer) window.clearTimeout(emptyIdTimer)
  document.removeEventListener('ionBackButton', onHardwareBack)
})
</script>

<style scoped>
.event-page-content {
  --background: #f2f2f2;
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.event-page {
  width: 100%;
  max-width: 100%;
  min-height: 100%;
  overflow-x: clip;
  background: #f2f2f2;
}

.event-page__bar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: max(0.75rem, env(safe-area-inset-top)) 12px 0 8px;
  background: #faf8f5;
}

.event-page__back {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
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

.event-page__state {
  padding: 20px;
}

.event-page__state p,
.event-page__state h2 {
  margin: 0;
  color: var(--kd-ink);
}

.event-page__state h2 {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.event-page__state p {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.35;
}

.event-page__pulse {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.event-page__pulse span {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: var(--kd-secondary);
  animation: event-page-pulse 900ms cubic-bezier(0.16, 1, 0.3, 1) infinite;
}

.event-page__pulse span:nth-child(1) { width: 72%; }
.event-page__pulse span:nth-child(2) { width: 54%; animation-delay: 90ms; }
.event-page__pulse span:nth-child(3) { width: 38%; animation-delay: 160ms; }

.event-page__home {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 45px;
  margin-top: 20px;
  padding: 0 20px;
  border: 0;
  border-radius: 16px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-size: 16px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
}

.event-page__back:focus-visible,
.event-page__home:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 3px;
  border-radius: 16px;
}

@keyframes event-page-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}

@media (min-width: 540px) {
  .event-page {
    max-width: 480px;
    margin-inline: auto;
  }
}

:root.is-android .event-page__home {
  min-height: 48px;
}

@media (prefers-reduced-motion: reduce) {
  .event-page__pulse span {
    animation: none;
  }
}
</style>
