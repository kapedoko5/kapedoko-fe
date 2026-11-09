<template>
  <IonPage>
    <AdminShell
      title="Users"
      lede="Change roles or suspend an account. You cannot suspend or demote yourself, or remove the last admin."
      :status="status"
      :error="error"
    >
      <div class="admin-toolbar user-board">
        <input
          v-model="query"
          class="admin-search"
          type="search"
          placeholder="Search name or email"
          aria-label="Search name or email"
          @keydown.enter.prevent="load(query, 1)"
        />
        <button type="button" class="admin-btn" @click="load(query, 1)">Search</button>
      </div>

      <div class="admin-ledger user-board">
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>State</th>
                <th>Joined</th>
                <th>Activity</th>
                <th>Account</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td>
                  <strong class="user-name">{{ user.displayName || 'Unnamed' }}</strong>
                  <p class="admin-meta">{{ user.email }}</p>
                </td>
                <td>
                  <label class="sr-only" :for="`role-${user.id}`">Role for {{ personName(user) }}</label>
                  <div class="user-role" :class="`user-role--${user.role}`">
                    <span class="user-pip" :class="`user-pip--${user.role}`" aria-hidden="true" />
                    <select
                      :id="`role-${user.id}`"
                      :value="user.role"
                      :disabled="savingId === user.id || user.id === me"
                      :aria-busy="savingId === user.id && savingKind === 'role' || undefined"
                      @change="onRole(user, ($event.target as HTMLSelectElement).value, $event)"
                    >
                      <option value="user">User</option>
                      <option value="cafe-owner">Cafe owner</option>
                      <option value="auditor">Auditor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <AdminSpinner v-if="savingId === user.id && savingKind === 'role'" :size="16" />
                  </div>
                </td>
                <td>
                  <span class="user-stamp" :class="user.banned ? 'user-stamp--suspended' : 'user-stamp--active'">
                    <span class="user-stamp__mark" aria-hidden="true" />
                    {{ user.banned ? 'Suspended' : 'Active' }}
                  </span>
                </td>
                <td class="user-when">{{ formatAdminDate(user.createdAt) }}</td>
                <td class="user-activity">{{ user.shopCount }} cafes · {{ user.reviewCount }} reviews</td>
                <td>
                  <div class="user-actions">
                    <button
                      type="button"
                      :class="user.banned ? 'user-restore' : 'user-warn'"
                      :disabled="savingId === user.id || user.id === me"
                      :aria-busy="savingId === user.id && savingKind === 'account' || undefined"
                      :aria-label="accountAction(user)"
                      @click="toggleBan(user)"
                    >
                      <AdminBusyLabel :busy="savingId === user.id && savingKind === 'account'">
                        {{ accountLabel(user) }}
                      </AdminBusyLabel>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-cards">
          <article v-for="user in users" :key="user.id" class="admin-card">
            <h2 class="user-name">{{ user.displayName || 'Unnamed' }}</h2>
            <p>{{ user.email }}</p>
            <p>
              <span class="user-stamp" :class="user.banned ? 'user-stamp--suspended' : 'user-stamp--active'">
                <span class="user-stamp__mark" aria-hidden="true" />
                {{ user.banned ? 'Suspended' : 'Active' }}
              </span>
            </p>
            <label class="sr-only" :for="`role-card-${user.id}`">Role for {{ personName(user) }}</label>
            <div class="user-role" :class="`user-role--${user.role}`">
              <span class="user-pip" :class="`user-pip--${user.role}`" aria-hidden="true" />
              <select
                :id="`role-card-${user.id}`"
                :value="user.role"
                :disabled="savingId === user.id || user.id === me"
                :aria-busy="savingId === user.id && savingKind === 'role' || undefined"
                @change="onRole(user, ($event.target as HTMLSelectElement).value, $event)"
              >
                <option value="user">User</option>
                <option value="cafe-owner">Cafe owner</option>
                <option value="auditor">Auditor</option>
                <option value="admin">Admin</option>
              </select>
              <AdminSpinner v-if="savingId === user.id && savingKind === 'role'" :size="16" />
            </div>
            <p class="user-activity">{{ user.shopCount }} cafes · {{ user.reviewCount }} reviews</p>
            <div class="user-actions">
              <button
                type="button"
                :class="user.banned ? 'user-restore' : 'user-warn'"
                :disabled="savingId === user.id || user.id === me"
                :aria-busy="savingId === user.id && savingKind === 'account' || undefined"
                :aria-label="accountAction(user)"
                @click="toggleBan(user)"
              >
                <AdminBusyLabel :busy="savingId === user.id && savingKind === 'account'">
                  {{ accountLabel(user) }}
                </AdminBusyLabel>
              </button>
            </div>
          </article>
        </div>
      </div>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminSpinner from '~/components/admin/AdminSpinner.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import type { AdminUserRow } from '~/types/admin'
import type { ProfileRole } from '~/types/shop'
import { formatAdminDate } from '~/utils/admin-nav'
import { roleChangeError, suspendError } from '~/utils/admin-users'
import { authUserId } from '~/utils/auth'
import { isProfileRole, PROFILE_ROLE_LABELS } from '~/utils/profile-role'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const { users, status, error, savingId, load, setRole, setBanned } = useAdminUsers()
const toast = useAdminToast()
const { ask: askAdmin, alert: alertAdmin } = useAdminConfirm()
const sessionUser = useSupabaseUser()
const me = computed(() => authUserId(sessionUser.value))
const query = ref('')
const actionError = ref('')
const savingKind = ref<'role' | 'account' | ''>('')

const personName = (user: AdminUserRow) => user.displayName || user.email || 'this person'

const accountLabel = (user: AdminUserRow) => {
  if (savingId.value === user.id) return user.banned ? 'Restoring…' : 'Suspending…'
  return user.banned ? 'Reactivate' : 'Suspend'
}

const accountAction = (user: AdminUserRow) => {
  const name = personName(user)
  return user.banned ? `Reactivate ${name}` : `Suspend ${name}`
}

const onRole = async (user: AdminUserRow, nextRaw: string, event: Event) => {
  const select = event.target as HTMLSelectElement
  const revert = () => {
    select.value = user.role
  }
  if (!isProfileRole(nextRaw)) {
    revert()
    return
  }
  const next = nextRaw as ProfileRole
  if (next === user.role) return
  const issue = roleChangeError({
    actorId: me.value,
    targetId: user.id,
    nextRole: next,
    adminCount: users.value.filter((row) => row.role === 'admin').length,
    targetRole: user.role,
  })
  if (issue) {
    revert()
    actionError.value = issue
    await alertAdmin({ title: 'Role stays the same', message: issue, variant: 'warning' })
    return
  }
  const choice = await askAdmin({
    title: `Change ${personName(user)} to ${PROFILE_ROLE_LABELS[next]}?`,
    message: 'This updates what they can open in KapeDoko.',
    confirmLabel: 'Change role',
  })
  if (!choice.confirmed) {
    revert()
    return
  }
  savingKind.value = 'role'
  try {
    await setRole(user.id, next)
    toast.success('Role updated', `${personName(user)} is now ${PROFILE_ROLE_LABELS[next]}.`)
  } catch (err) {
    revert()
    actionError.value = err instanceof Error ? err.message : 'Could not change this role.'
    toast.error('Could not change this role', err, 'Could not change this role.')
  } finally {
    savingKind.value = ''
  }
}

const toggleBan = async (user: AdminUserRow) => {
  const issue = suspendError({ actorId: me.value, targetId: user.id, banned: user.banned })
  if (issue) {
    actionError.value = issue
    await alertAdmin({ title: 'Account stays as it is', message: issue, variant: 'warning' })
    return
  }
  const name = personName(user)
  const choice = user.banned
    ? await askAdmin({
      title: `Reactivate ${name}?`,
      message: 'They can sign in again.',
      confirmLabel: 'Reactivate',
    })
    : await askAdmin({
      title: `Suspend ${name}?`,
      message: 'They stay suspended until you reactivate the account.',
      confirmLabel: 'Suspend',
      variant: 'destructive',
    })
  if (!choice.confirmed) return
  savingKind.value = 'account'
  try {
    await setBanned(user.id, !user.banned)
    toast.success(user.banned ? 'Account reactivated' : 'Account suspended', name)
  } catch (err) {
    actionError.value = err instanceof Error ? err.message : 'Could not update this account.'
    toast.error('Could not update this account', err, 'Could not update this account.')
  } finally {
    savingKind.value = ''
  }
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
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

.user-board {
  caret-color: var(--kd-primary);
}

.user-board ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.user-name {
  color: var(--kd-ink);
  font-weight: 700;
}

.user-board.admin-ledger th,
.user-board.admin-ledger td {
  vertical-align: middle;
}

.user-board.admin-ledger th:last-child,
.user-board.admin-ledger td:last-child {
  width: 1%;
  white-space: nowrap;
}

.user-role {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 8px 0 12px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.user-role select {
  min-height: 44px;
  max-width: 9.5rem;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.7875rem;
  font-weight: 700;
  cursor: pointer;
}

.user-role select:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.user-role select:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.user-pip,
.user-stamp__mark {
  width: 8px;
  height: 8px;
  border-radius: 16px;
  flex: 0 0 auto;
}

.user-pip--user {
  background: var(--kd-ink);
}

.user-pip--cafe-owner {
  background: var(--kd-accent);
}

.user-pip--auditor,
.user-pip--admin {
  background: var(--kd-primary);
}

.user-stamp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 16px;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}

.user-stamp--active {
  background: color-mix(in srgb, var(--kd-primary) 16%, #faf8f5);
  color: var(--kd-primary);
}

.user-stamp--active .user-stamp__mark {
  background: var(--kd-primary);
}

.user-stamp--suspended {
  background: color-mix(in srgb, var(--kd-destructive) 14%, #faf8f5);
  color: var(--kd-destructive);
}

.user-stamp--suspended .user-stamp__mark {
  background: var(--kd-destructive);
}

.user-when,
.user-activity {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.user-actions {
  display: flex;
  justify-content: flex-end;
}

.user-restore,
.user-warn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 16px;
  font: inherit;
  font-size: 0.7875rem;
  font-weight: 700;
  cursor: pointer;
}

.user-restore {
  border: 1px solid var(--kd-primary);
  background: transparent;
  color: var(--kd-primary);
}

.user-warn {
  border: 1px solid var(--kd-destructive);
  background: var(--kd-destructive);
  color: var(--kd-white);
}

.user-restore:hover:not(:disabled) {
  background: color-mix(in srgb, var(--kd-primary) 10%, #faf8f5);
}

.user-warn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--kd-destructive) 88%, #1c1917);
}

.user-restore:focus-visible,
.user-warn:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.user-restore:active:not(:disabled),
.user-warn:active:not(:disabled) {
  transform: translateY(1px);
}

.user-restore:disabled,
.user-warn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (max-width: 767px) {
  .user-actions {
    justify-content: stretch;
  }

  .user-restore,
  .user-warn,
  .user-role,
  .user-role select {
    width: 100%;
    max-width: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .user-restore:active:not(:disabled),
  .user-warn:active:not(:disabled) {
    transform: none;
  }
}
</style>

