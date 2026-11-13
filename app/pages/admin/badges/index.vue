<template>
  <IonPage>
    <AdminShell
      title="Badges"
      lede="Name a badge, set its look, then award it to approved cafes for a window. Live names show on cafe cards and cafe detail."
      :status="status"
      :error="error"
    >
      <template #actions>
        <NuxtLink class="admin-btn" to="/admin/badges/new">Add badge</NuxtLink>
      </template>

      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Badge</th>
              <th>Live cafes</th>
              <th>Window</th>
              <th>State</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in badgeNames" :key="row.id">
              <td>
                <CafeBadgeChip :badge="chipFor(row)" />
              </td>
              <td>{{ liveCafeCount(row.id) }}</td>
              <td>{{ windowCopy(row.id) }}</td>
              <td>{{ row.enabled ? nameState(row.id) : 'disabled' }}</td>
              <td>
                <div class="admin-row-actions">
                  <NuxtLink class="admin-link" :to="`/admin/badges/${row.id}`">Edit</NuxtLink>
                  <button
                    type="button"
                    class="admin-btn admin-btn--quiet"
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

      <p v-if="status === 'ready' && badgeNames.length === 0" class="admin-meta">No badges yet.</p>

      <div class="admin-cards">
        <article v-for="row in badgeNames" :key="row.id" class="admin-card">
          <h2>
            <CafeBadgeChip :badge="chipFor(row)" />
          </h2>
          <p>{{ liveCafeCount(row.id) }} live cafes</p>
          <p>{{ windowCopy(row.id) }}</p>
          <p>{{ row.enabled ? nameState(row.id) : 'disabled' }}</p>
          <div class="admin-row-actions">
            <NuxtLink class="admin-link" :to="`/admin/badges/${row.id}`">Edit</NuxtLink>
            <button
              type="button"
              class="admin-btn admin-btn--quiet"
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
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import CafeBadgeChip from '~/components/cafe/CafeBadgeChip.vue'
import type { BadgeNameRow, CafeBadge } from '~/types/admin'
import { adminActionErrorMessage } from '~/utils/admin-feedback'
import {
  badgeAwardLifecycle,
  cafeBadgeFromName,
  isBadgeAwardActive,
} from '~/utils/admin-badges'
import { formatAdminDate } from '~/utils/admin-nav'
import { publicObjectUrl } from '~/utils/shop-mapper'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const admin = useAdminData()
const toast = useAdminToast()
const { ask: askAdmin } = useAdminConfirm()
const config = useRuntimeConfig()
const publicBase = String(config.public.r2PublicBaseUrl || '')
const { badgeNames, badgeAwards, badgeAwardShops, status, error, load, disableBadgeName } = admin
const togglingId = ref('')

onMounted(() => {
  void load()
})

const chipFor = (row: BadgeNameRow): CafeBadge => cafeBadgeFromName({
  id: row.id,
  slug: row.slug,
  label: row.label,
  color: row.color,
  lucide_icon: row.lucide_icon,
  iconUrl: publicObjectUrl(row.icon_object_key, publicBase),
})

const awardsFor = (badgeId: string) => badgeAwards.value.filter((row) => row.badge_id === badgeId)

const liveCafeCount = (badgeId: string) => {
  const live = new Set(awardsFor(badgeId).filter((row) => isBadgeAwardActive(row)).map((row) => row.id))
  return new Set(
    badgeAwardShops.value.filter((row) => live.has(row.award_id)).map((row) => row.shop_id),
  ).size
}

const nameState = (badgeId: string) => {
  const rows = awardsFor(badgeId)
  if (rows.some((row) => isBadgeAwardActive(row))) return 'live'
  if (rows.some((row) => badgeAwardLifecycle(row) === 'scheduled')) return 'scheduled'
  return 'idle'
}

const windowCopy = (badgeId: string) => {
  const rows = awardsFor(badgeId)
  const live = rows.filter((row) => isBadgeAwardActive(row)).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const shown = live[0] ?? rows
    .filter((row) => badgeAwardLifecycle(row) === 'scheduled')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]
  if (!shown) return '—'
  return `${formatAdminDate(shown.starts_at)} – ${formatAdminDate(shown.ends_at)}`
}

const onToggle = async (row: BadgeNameRow) => {
  const next = !row.enabled
  if (!next) {
    const choice = await askAdmin({
      title: `Disable ${row.label}?`,
      message: 'It leaves cafe cards immediately. Awards stay on the record.',
      confirmLabel: 'Disable badge',
      variant: 'destructive',
    })
    if (!choice.confirmed) return
  }
  togglingId.value = row.id
  try {
    await disableBadgeName(row.id, next)
    toast.success(next ? 'Badge enabled' : 'Badge disabled', next ? `${row.label} can be awarded again.` : `${row.label} is hidden from cafe cards.`)
  } catch (err) {
    toast.error('Could not update this badge', adminActionErrorMessage(err, 'Could not update this badge.'))
  } finally {
    togglingId.value = ''
  }
}
</script>
