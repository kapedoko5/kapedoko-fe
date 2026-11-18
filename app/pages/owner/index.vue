<template>
  <IonPage>
    <OwnerShell
      title="Desk"
      lede="Cafes you manage, what is live, and what still waits on admin."
      :status="pageStatus"
      :error="error"
      :claim-count="waitingClaims.length"
    >
      <div class="owner-desk">
        <OwnerClaimsRail
          :claims="waitingClaims"
          :unmarked-ids="unmarkedWaiting.map((claim) => claim.id)"
          :shop-name="shopNameForClaim"
        />

        <section class="owner-desk__shelf" aria-labelledby="owner-shelf-title">
          <h2 id="owner-shelf-title">Cafes you manage</h2>
          <p v-if="ownedShops.length === 0" class="owner-empty">
            {{ ownerDeskCafesEmptyCopy(waitingClaims.length) }}
          </p>
          <div v-else class="owner-desk__labels">
            <OwnerCafeLabel
              v-for="(shop, index) in ownedShops"
              :key="shop.id"
              :shop="shop"
              :index="index"
              :active="liftedId === shop.id"
              :dim="Boolean(liftedId) && liftedId !== shop.id"
              @mouseenter="liftedId = shop.id"
              @mouseleave="liftedId = null"
              @focusin="liftedId = shop.id"
              @focusout="liftedId = null"
            />
          </div>
        </section>
      </div>
    </OwnerShell>
  </IonPage>
</template>

<script lang="ts" setup>
import OwnerCafeLabel from '~/components/owner-portal/OwnerCafeLabel.vue'
import OwnerClaimsRail from '~/components/owner-portal/OwnerClaimsRail.vue'
import OwnerShell from '~/components/owner-portal/OwnerShell.vue'
import { ownerDeskCafesEmptyCopy } from '~/utils/owner-portal'

definePageMeta({
  middleware: ['owner'],
})

const desk = useOwnerPortal()
const {
  ownedShops,
  waitingClaims,
  unmarkedWaiting,
  status,
  error,
  shopNameForClaim,
  loadDesk,
} = desk

const liftedId = ref<string | null>(null)
const pageStatus = computed(() => {
  if (desk.access.value === 'forbidden') return 'forbidden' as const
  return status.value
})

onMounted(() => {
  void loadDesk()
})
</script>

<style scoped>
.owner-desk {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.owner-desk__shelf h2 {
  margin: 0 0 12px;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.owner-desk__labels {
  display: grid;
  gap: 12px;
}
</style>
