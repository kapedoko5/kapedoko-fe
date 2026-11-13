<template>
  <section
    v-if="showCard"
    class="cafe-owner"
    :class="{ 'cafe-owner--desk': desk }"
    :aria-labelledby="headingId"
  >
    <div class="cafe-owner__mast">
      <div class="cafe-owner__stamp" aria-hidden="true">
        <Store :size="18" :stroke-width="2.25" />
      </div>
      <h3 :id="headingId">{{ title }}</h3>
    </div>

    <div v-if="showClaimedPerson" class="cafe-owner__person">
      <span class="cafe-owner__avatar" aria-hidden="true">{{ ownerInitial }}</span>
      <div class="cafe-owner__who">
        <p class="cafe-owner__name">{{ ownerName }}</p>
        <p class="cafe-owner__role">Manages this listing</p>
      </div>
    </div>

    <p class="cafe-owner__hint">{{ hint }}</p>

    <p v-if="reportNotice" class="cafe-owner__notice" role="status">{{ reportNotice }}</p>
    <button
      v-if="showReport && !reported"
      type="button"
      class="cafe-owner__report"
      :disabled="reporting"
      :aria-busy="reporting || undefined"
      @click="reportOwner"
    >
      {{ reporting ? 'Reporting…' : cafeOwnerReportLabel() }}
    </button>

    <a
      v-if="showClaimCta"
      class="cafe-owner__claim"
      :class="{ 'is-quiet': claimQuiet }"
      :href="claimHref"
      @click.prevent="goClaim"
    >
      {{ claimLabel }}
    </a>

    <div v-if="isAdmin" class="cafe-owner__admin">
      <button
        type="button"
        class="cafe-owner__claim"
        :class="{ 'is-quiet': claimed }"
        :disabled="saving"
        @click="openPicker"
      >
        {{ transferOwnershipAction(claimed) }}
      </button>
      <p v-if="notice" class="cafe-owner__notice" role="status">{{ notice }}</p>
      <p v-if="transferError" class="cafe-owner__error" role="alert">{{ transferError }}</p>
    </div>

    <AdminUserSearchDialog
      :open="picking"
      :title="claimed ? 'Transfer ownership' : 'Assign owner'"
      :lede="claimed ? 'Search by name or email for who should take over this listing.' : 'Search by name or email. Admins cannot take a cafe themselves.'"
      :exclude-ids="assignExcludeIds"
      :busy="saving"
      @pick="askTransfer"
      @cancel="closePicker"
    />

    <AdminConfirmDialog
      :open="Boolean(pending)"
      variant="warning"
      :title="pendingTitle"
      :message="pendingMessage"
      :confirm-label="transferOwnershipAction(claimed)"
      :busy-label="transferOwnershipBusyLabel()"
      :busy="saving"
      @confirm="confirmTransfer"
      @cancel="cancelTransfer"
    />
  </section>
</template>

<script lang="ts" setup>
import { Store } from 'lucide-vue-next'
import AdminConfirmDialog from '~/components/admin/AdminConfirmDialog.vue'
import AdminUserSearchDialog from '~/components/admin/AdminUserSearchDialog.vue'
import type { AdminUserRow } from '~/types/admin'
import { parseProfileRole } from '~/utils/profile-role'
import {
  ANALYTICS_EVENTS,
} from '~/utils/analytics'
import {
  adminCannotClaimCopy,
  adminCannotOwnCopy,
  assignOwnershipTitle,
  cafeOwnerDisplayName,
  cafeOwnerInitial,
  cafeOwnerReportDoneCopy,
  cafeOwnerReportLabel,
  cafeOwnerReportReason,
  canAssignCafeOwner,
  showCafeClaimCta,
  showCafeOwnerCard,
  showCafeOwnerName,
  showCafeOwnerReport,
  transferOwnershipAction,
  transferOwnershipBusyLabel,
  transferOwnershipDoneCopy,
  transferOwnershipMessage,
  transferOwnershipTitle,
} from '~/utils/shop-claims'

const props = withDefaults(defineProps<{
  shopId: string
  cafeName: string
  desk?: boolean
  /** Skip the profile lookup. Use on admin-only routes. */
  admin?: boolean
}>(), {
  desk: false,
  admin: false,
})

const emit = defineEmits<{
  transferred: [payload: { cafeName: string; personName: string }]
}>()

const ownership = useShopOwnership()
const { loadProfile, user, currentUserId, goToLogin } = useAuth()
const { track } = useAnalytics()
const route = useRoute()
const headingId = useId()
const isAdmin = ref(props.admin)
const roleKnown = ref(props.admin)
const picking = ref(false)
const pending = ref<AdminUserRow | null>(null)
const notice = ref('')
const transferError = ref('')
const reportNotice = ref('')
const reporting = ref(false)
const reported = ref(false)

const claimed = computed(() => Boolean(props.shopId) && ownership.shopHasVerifiedOwner(props.shopId))
const owner = computed(() => (props.shopId ? ownership.shopOwner(props.shopId) : null))
const ownerClaim = computed(() => (props.shopId ? ownership.claimForShop(props.shopId) : null))
const ownerKnown = computed(() => Boolean(props.shopId) && ownership.shopOwnerFlagKnown(props.shopId))
const ownerName = computed(() => cafeOwnerDisplayName(owner.value?.displayName))
const ownerInitial = computed(() => cafeOwnerInitial(owner.value?.displayName))
const saving = computed(() => ownership.saving.value)
const showClaimedPerson = computed(() => (
  showCafeOwnerName({ desk: props.desk, hasVerifiedOwner: claimed.value })
  && Boolean(owner.value?.claimantId || owner.value?.displayName)
))
const showReport = computed(() => roleKnown.value && showCafeOwnerReport({
  desk: props.desk,
  isAdmin: isAdmin.value,
  myClaimStatus: ownerClaim.value?.status ?? null,
  hasVerifiedOwner: claimed.value,
}))

const showCard = computed(() => showCafeOwnerCard({
  myClaimStatus: ownerClaim.value?.status ?? null,
  hasVerifiedOwner: claimed.value,
  ownerKnown: ownerKnown.value,
  isAdmin: isAdmin.value,
}))

const title = computed(() => {
  if (isAdmin.value) return claimed.value ? 'This cafe is claimed' : 'This cafe has no owner'
  if (ownerClaim.value?.status === 'verified') return 'You manage this cafe'
  if (ownerClaim.value?.status === 'pending') return 'We’re reviewing your claim'
  if (claimed.value) return 'This cafe is claimed'
  return 'Are you the owner of this cafe?'
})

const hint = computed(() => {
  if (isAdmin.value) {
    return claimed.value
      ? 'Hours, contact, and the logo stay with the person who manages this listing.'
      : adminCannotClaimCopy()
  }
  if (ownerClaim.value?.status === 'verified') return 'Hours, contact, and the logo are yours to keep current.'
  if (ownerClaim.value?.status === 'pending') return 'This listing stays on the map while we check.'
  if (ownerClaim.value?.status === 'rejected' && !claimed.value) return 'You can send a clearer claim and we’ll look again.'
  if (claimed.value) return 'Hours, contact, and the logo stay with the person who manages this listing.'
  return 'Hours and the logo stay truer when the shop keeps them.'
})

const claimHref = computed(() => {
  if (!props.shopId) return ''
  if (!user.value) return `/login?redirect=${encodeURIComponent(`/app/cafes/${props.shopId}/claim`)}`
  if (ownerClaim.value?.status === 'verified') return `/app/cafes/${props.shopId}/edit`
  return `/app/cafes/${props.shopId}/claim`
})

const claimLabel = computed(() => {
  if (!user.value) return 'Sign in to claim this cafe'
  if (ownerClaim.value?.status === 'verified') return 'Edit listing'
  if (ownerClaim.value?.status === 'pending') return 'View claim'
  if (ownerClaim.value?.status === 'rejected') return 'Send a new claim'
  return 'Claim this cafe'
})

const claimQuiet = computed(() => ownerClaim.value?.status === 'pending')
const showClaimCta = computed(() => roleKnown.value && showCafeClaimCta({
  myClaimStatus: ownerClaim.value?.status ?? null,
  hasVerifiedOwner: claimed.value,
  ownerKnown: ownerKnown.value,
  isAdmin: isAdmin.value,
}) && Boolean(claimHref.value))

const pendingName = computed(() => cafeOwnerDisplayName(pending.value?.displayName || pending.value?.email))
const pendingTitle = computed(() => {
  if (!pending.value) return ''
  return claimed.value
    ? transferOwnershipTitle(props.cafeName, pendingName.value)
    : assignOwnershipTitle(props.cafeName, pendingName.value)
})
const pendingMessage = computed(() => {
  if (!pending.value) return ''
  return transferOwnershipMessage({
    claimed: claimed.value,
    fromName: owner.value?.displayName,
    toName: pendingName.value,
  })
})

const personName = (row: AdminUserRow) => cafeOwnerDisplayName(row.displayName || row.email)
const assignExcludeIds = computed(() => [user.value?.id, owner.value?.claimantId].filter((id): id is string => Boolean(id)))

const refreshOwner = async () => {
  if (!props.shopId) return
  await ownership.loadShopOwner(props.shopId)
  if (user.value) {
    try {
      await ownership.loadClaimForShop(props.shopId)
    } catch {
      /* Keep the card up even if the existing-claim lookup fails. */
    }
  }
}

const refreshAdmin = async () => {
  if (props.admin) {
    isAdmin.value = true
    roleKnown.value = true
    return
  }
  if (!user.value) {
    isAdmin.value = false
    roleKnown.value = true
    return
  }
  try {
    const profile = await loadProfile()
    isAdmin.value = parseProfileRole(profile?.role) === 'admin'
  } catch {
    isAdmin.value = false
  } finally {
    roleKnown.value = true
  }
}

const goClaim = async () => {
  if (!claimHref.value) return
  if (!user.value) {
    track(ANALYTICS_EVENTS.AUTH_PROMPT_SHOWN, { trigger: 'claim' })
  }
  await navigateTo(claimHref.value)
}

const reportOwner = async () => {
  if (!props.shopId || reporting.value) return
  reportNotice.value = ''
  const userId = await currentUserId()
  if (!userId) {
    track(ANALYTICS_EVENTS.AUTH_PROMPT_SHOWN, { trigger: 'report' })
    await goToLogin(route.fullPath)
    return
  }
  reporting.value = true
  try {
    const supabase = useSupabaseClient()
    const { error } = await supabase.rpc('report_content', {
      p_target_type: 'shop_owner',
      p_review_id: null,
      p_shop_id: props.shopId,
      p_reason: cafeOwnerReportReason(),
    })
    const ownListing = typeof error?.message === 'string' && /listing you manage/i.test(error.message)
    const missingSql = typeof error?.message === 'string' && /unknown report target|shop_owner/i.test(error.message)
    if (error) {
      reportNotice.value = ownListing
        ? 'You cannot report a listing you manage.'
        : missingSql
          ? 'Apply db/20261118_report_shop_owner.sql in the SQL editor, then try again.'
          : 'Could not send that report. Try again.'
      return
    }
    reported.value = true
    reportNotice.value = cafeOwnerReportDoneCopy()
  } finally {
    reporting.value = false
  }
}

const openPicker = () => {
  if (saving.value) return
  transferError.value = ''
  notice.value = ''
  picking.value = true
}

const closePicker = () => {
  if (saving.value) return
  picking.value = false
}

const askTransfer = (person: AdminUserRow) => {
  picking.value = false
  if (person.banned) {
    transferError.value = 'Reactivate this account before it can manage a cafe.'
    return
  }
  if (!canAssignCafeOwner({
    actorId: user.value?.id,
    targetId: person.id,
    currentOwnerId: owner.value?.claimantId,
  })) {
    transferError.value = adminCannotOwnCopy()
    return
  }
  transferError.value = ''
  notice.value = ''
  pending.value = person
}

const cancelTransfer = () => {
  if (saving.value) return
  pending.value = null
}

const confirmTransfer = async () => {
  const person = pending.value
  if (!person || !props.shopId || saving.value) return
  transferError.value = ''
  notice.value = ''
  try {
    await ownership.transferShopOwnership(props.shopId, person.id)
    await refreshOwner()
    const name = personName(person)
    notice.value = transferOwnershipDoneCopy(props.cafeName, name)
    picking.value = false
    pending.value = null
    emit('transferred', { cafeName: props.cafeName, personName: name })
  } catch (err) {
    transferError.value = err instanceof Error ? err.message : 'Could not transfer this cafe.'
  }
}

watch(
  () => [props.shopId, user.value?.id ?? ''] as const,
  () => {
    reported.value = false
    reportNotice.value = ''
    void refreshOwner()
    void refreshAdmin()
  },
  { immediate: true },
)
</script>

<style scoped>
.cafe-owner {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 22px;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  caret-color: var(--kd-primary);
}

.cafe-owner--desk {
  margin-top: 0;
  padding: 20px;
}

.cafe-owner__mast {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cafe-owner__stamp {
  display: grid;
  place-items: center;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--kd-accent) 18%, #faf8f5);
  color: var(--kd-ink);
}

.cafe-owner__mast h3,
.cafe-owner__hint,
.cafe-owner__name,
.cafe-owner__role,
.cafe-owner__notice,
.cafe-owner__error,
.cafe-owner__report {
  margin: 0;
  color: var(--kd-ink);
  overflow-wrap: anywhere;
}

.cafe-owner__mast h3 {
  min-width: 0;
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.03em;
}

.cafe-owner__hint,
.cafe-owner__role {
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
  font-size: 0.75rem;
  line-height: 1.3;
}

.cafe-owner__person {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cafe-owner__avatar {
  display: grid;
  place-items: center;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
}

.cafe-owner__who {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cafe-owner__name {
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.3;
}

.cafe-owner__claim {
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
  line-height: 1.2;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.cafe-owner__claim.is-quiet {
  border-color: color-mix(in srgb, var(--kd-ink) 22%, transparent);
  background: #faf8f5;
}

.cafe-owner__claim:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cafe-owner__admin {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cafe-owner__notice {
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.3;
}

.cafe-owner__error {
  color: var(--kd-destructive);
  font-size: 0.7875rem;
  font-weight: 700;
}

.cafe-owner ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.cafe-owner__report {
  align-self: flex-start;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-ink);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
  text-align: left;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.cafe-owner__report:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cafe-owner__claim:focus-visible,
.cafe-owner__report:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

@media (hover: hover) {
  .cafe-owner__claim:hover:not(:disabled) {
    box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
  }

  .cafe-owner__report:hover:not(:disabled) {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

.cafe-owner__claim:active:not(:disabled) {
  box-shadow: inset 0 3px 0 color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

.cafe-owner__report:active:not(:disabled) {
  color: var(--kd-primary);
}

:root.is-android .cafe-owner__claim,
:root.is-android .cafe-owner__report {
  min-height: 48px;
}

@media (prefers-reduced-motion: reduce) {
  .cafe-owner__claim {
    transition: none;
  }
}
</style>
