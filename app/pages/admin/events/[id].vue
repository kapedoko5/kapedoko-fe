<template>
  <IonPage>
    <AdminShell
      :title="event?.name || 'Edit event'"
      lede="Changes go live inside the display window. Ending it hides it from Home and Map."
      :status="pageStatus"
      :error="pageError"
    >
      <p v-if="formError" class="admin-error" role="alert">{{ formError }}</p>
      <AdminEventForm
        v-if="event"
        :event="event"
        :saving="saving"
        submit-label="Save changes"
        @save="onSave"
      />
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import { useIonRouter } from '@ionic/vue'
import AdminEventForm from '~/components/admin/AdminEventForm.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import type { EventRow } from '~/types/event'
import { adminActionErrorMessage } from '~/utils/admin-feedback'
import { eventIdFromRoute } from '~/utils/events'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const route = useRoute()
const ionRouter = useIonRouter()
const admin = useAdminData()
const toast = useAdminToast()
const event = ref<EventRow | null>(null)
const saving = ref(false)
const formError = ref('')
const pageError = ref('')
const pageStatus = ref<'loading' | 'ready' | 'error'>('loading')

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

const loadEvent = async () => {
  pageStatus.value = 'loading'
  pageError.value = ''
  let id = resolveEventId()
  if (!id && import.meta.client) {
    await nextTick()
    id = resolveEventId()
  }
  if (!id) {
    pageStatus.value = 'error'
    pageError.value = 'This event was not found.'
    return
  }
  try {
    await admin.load({ silent: true })
    event.value = admin.events.value.find((row) => row.id === id) ?? await admin.fetchEvent(id)
    if (!event.value) {
      pageStatus.value = 'error'
      pageError.value = 'This event was not found.'
      return
    }
    pageStatus.value = 'ready'
  } catch (err) {
    pageStatus.value = 'error'
    pageError.value = adminActionErrorMessage(err, 'Could not load this event.')
  }
}

const onSave = async (payload: Parameters<typeof admin.saveEvent>[0]) => {
  if (!event.value) return
  saving.value = true
  formError.value = ''
  try {
    event.value = await admin.saveEvent({ ...payload, id: event.value.id })
    toast.success('Event saved', `${event.value.name} was updated.`)
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not save this event.')
    toast.error('Could not save this event', formError.value)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void loadEvent()
})

watch(
  () => [route.fullPath, route.path, route.params.id],
  () => {
    void loadEvent()
  },
)
</script>
