<template>
  <IonPage>
    <AdminShell
      title="Events"
      lede="Pin a gathering, set when it happens, and choose when it should appear on Home and Map."
      :status="status"
      :error="error"
    >
      <template #actions>
        <NuxtLink class="admin-btn" to="/admin/events/new">Add event</NuxtLink>
      </template>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Happens</th>
              <th>Shown</th>
              <th>State</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in events" :key="row.id">
              <td>{{ row.name }}</td>
              <td>{{ formatAdminDate(row.event_starts_at) }} – {{ formatAdminDate(row.event_ends_at) }}</td>
              <td>{{ formatAdminDate(row.display_starts_at) }} – {{ formatAdminDate(row.display_ends_at) }}</td>
              <td>{{ eventLifecycle(row) }}</td>
              <td>
                <div class="admin-row-actions">
                  <NuxtLink
                    v-if="eventLifecycle(row) !== 'ended'"
                    class="admin-link"
                    :to="`/admin/events/${row.id}`"
                  >
                    Edit
                  </NuxtLink>
                  <button
                    v-if="row.enabled && !row.cancelled_at"
                    type="button"
                    class="admin-btn admin-btn--quiet"
                    :disabled="endingId === row.id"
                    :aria-busy="endingId === row.id || undefined"
                    @click="onEnd(row)"
                  >
                    <AdminBusyLabel :busy="endingId === row.id">
                      {{ endingId === row.id ? 'Ending…' : 'End now' }}
                    </AdminBusyLabel>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="status === 'ready' && events.length === 0" class="admin-meta">No events yet.</p>

      <div class="admin-cards">
        <article v-for="row in events" :key="row.id" class="admin-card">
          <h2>{{ row.name }}</h2>
          <p>{{ formatAdminDate(row.event_starts_at) }} – {{ formatAdminDate(row.event_ends_at) }}</p>
          <p>{{ eventLifecycle(row) }}</p>
          <div class="admin-row-actions">
            <NuxtLink
              v-if="eventLifecycle(row) !== 'ended'"
              class="admin-link"
              :to="`/admin/events/${row.id}`"
            >
              Edit
            </NuxtLink>
            <button
              v-if="row.enabled && !row.cancelled_at"
              type="button"
              class="admin-btn admin-btn--quiet"
              :disabled="endingId === row.id"
              :aria-busy="endingId === row.id || undefined"
              @click="onEnd(row)"
            >
              <AdminBusyLabel :busy="endingId === row.id">
                {{ endingId === row.id ? 'Ending…' : 'End now' }}
              </AdminBusyLabel>
            </button>
          </div>
        </article>
      </div>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import type { EventRow } from '~/types/event'
import { adminActionErrorMessage } from '~/utils/admin-feedback'
import { formatAdminDate } from '~/utils/admin-nav'
import { eventLifecycle } from '~/utils/events'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const { events, status, error, load, cancelEvent } = admin
const endingId = ref('')

onMounted(() => {
  void load()
})

const onEnd = async (row: EventRow) => {
  const choice = await askAdmin({
    title: `End ${row.name}?`,
    message: 'It leaves Home and Map as soon as you end it.',
    confirmLabel: 'End now',
    variant: 'destructive',
  })
  if (!choice.confirmed) return
  endingId.value = row.id
  try {
    await cancelEvent(row.id)
    toast.success('Event ended', `${row.name} is no longer shown.`)
  } catch (err) {
    toast.error('Could not end this event', adminActionErrorMessage(err, 'Could not end this event.'))
  } finally {
    endingId.value = ''
  }
}
</script>
