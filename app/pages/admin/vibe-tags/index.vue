<template>
  <IonPage>
    <AdminShell
      title="Vibe tags"
      lede="Name a stamp, pick an icon and a color. Owners and admins can ink up to five on a cafe. Live stamps print on cafe cards and cafe detail — they are not a filter."
      :status="status"
      :error="error"
    >
      <template #actions>
        <NuxtLink class="admin-btn" to="/admin/vibe-tags/new">Add vibe tag</NuxtLink>
      </template>

      <p v-if="status === 'ready' && vibeTagNames.length === 0" class="admin-empty">
        No vibe tags yet. Add one so cafe owners can stamp their listings.
      </p>

      <template v-else>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Stamp</th>
                <th>Cafes</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in vibeTagNames" :key="row.id">
                <td>
                  <span class="vibe-cell" :style="vibeTagColorStyle(row.color)">
                    <component :is="vibeTagLucideComponent(row.lucide_icon)" :size="15" :stroke-width="2.25" aria-hidden="true" />
                    {{ row.label }}
                  </span>
                </td>
                <td>{{ cafeCount(row.id) }}</td>
                <td>
                  <span class="admin-status" :class="row.enabled ? 'admin-status--enabled' : 'admin-status--disabled'">
                    {{ row.enabled ? 'enabled' : 'disabled' }}
                  </span>
                </td>
                <td>
                  <div class="admin-row-actions">
                    <NuxtLink class="admin-btn admin-btn--ghost" :to="`/admin/vibe-tags/${row.id}`">Edit</NuxtLink>
                    <button
                      type="button"
                      class="admin-btn"
                      :class="row.enabled ? 'admin-btn--danger' : 'admin-btn--ghost'"
                      :disabled="togglingId === row.id"
                      :aria-busy="togglingId === row.id || undefined"
                      @click="onToggle(row)"
                    >
                      <AdminBusyLabel :busy="togglingId === row.id">
                        {{ togglingId === row.id ? 'Saving…' : (row.enabled ? 'Disable' : 'Enable') }}
                      </AdminBusyLabel>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-cards">
          <article v-for="row in vibeTagNames" :key="row.id" class="admin-card">
            <h2>
              <span class="vibe-cell" :style="vibeTagColorStyle(row.color)">
                <component :is="vibeTagLucideComponent(row.lucide_icon)" :size="15" :stroke-width="2.25" aria-hidden="true" />
                {{ row.label }}
              </span>
            </h2>
            <p>{{ cafeCount(row.id) }} cafes</p>
            <p>
              <span class="admin-status" :class="row.enabled ? 'admin-status--enabled' : 'admin-status--disabled'">
                {{ row.enabled ? 'enabled' : 'disabled' }}
              </span>
            </p>
            <div class="admin-row-actions">
              <NuxtLink class="admin-btn admin-btn--ghost" :to="`/admin/vibe-tags/${row.id}`">Edit</NuxtLink>
              <button
                type="button"
                class="admin-btn"
                :class="row.enabled ? 'admin-btn--danger' : 'admin-btn--ghost'"
                :disabled="togglingId === row.id"
                :aria-busy="togglingId === row.id || undefined"
                @click="onToggle(row)"
              >
                <AdminBusyLabel :busy="togglingId === row.id">
                  {{ togglingId === row.id ? 'Saving…' : (row.enabled ? 'Disable' : 'Enable') }}
                </AdminBusyLabel>
              </button>
            </div>
          </article>
        </div>
      </template>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import type { VibeTagNameRow } from '~/types/admin'
import { adminActionErrorMessage } from '~/utils/admin-feedback'
import { vibeTagColorStyle, vibeTagLucideComponent } from '~/utils/admin-vibe-tags'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const { vibeTagNames, shopVibeTags, status, error, load, disableVibeTag } = admin
const togglingId = ref('')

onMounted(() => {
  void load()
})

const cafeCount = (tagId: string) =>
  new Set(shopVibeTags.value.filter((row) => row.tag_id === tagId).map((row) => row.shop_id)).size

const onToggle = async (row: VibeTagNameRow) => {
  const next = !row.enabled
  if (!next) {
    const choice = await askAdmin({
      title: `Disable ${row.label}?`,
      message: 'It leaves cafe cards immediately. Cafes keep the assignment so it comes back if you enable it again.',
      confirmLabel: 'Disable tag',
      variant: 'destructive',
    })
    if (!choice.confirmed) return
  }
  togglingId.value = row.id
  try {
    await disableVibeTag(row.id, next)
    toast.success(
      next ? 'Tag enabled' : 'Tag disabled',
      next ? `${row.label} can be stamped again.` : `${row.label} is hidden from cafe cards.`,
    )
  } catch (err) {
    toast.error('Could not update this tag', adminActionErrorMessage(err, 'Could not update this tag.'))
  } finally {
    togglingId.value = ''
  }
}
</script>

<style scoped>
.vibe-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--vibe-color, #d9793b);
  border-radius: 8px;
  background: color-mix(in srgb, var(--vibe-color, #d9793b) 22%, #faf8f5);
  font-weight: 700;
}

.vibe-cell :deep(svg) {
  color: var(--vibe-color, #d9793b);
}
</style>
