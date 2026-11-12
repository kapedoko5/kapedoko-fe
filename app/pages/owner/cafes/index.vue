<template>
  <IonPage>
    <OwnerShell
      title="Cafes"
      lede="Keep hours, contact, and the logo current. Publish status stays with admin."
      :status="pageStatus"
      :error="error"
      :claim-count="waitingClaims.length"
    >
      <div class="owner-cafes">
        <input
          v-if="ownedShops.length > 4"
          v-model="query"
          class="owner-search"
          type="search"
          placeholder="Search cafe name or address"
          aria-label="Search cafe name or address"
        />
        <p v-if="visible.length === 0" class="owner-cafes__empty">
          {{ ownedShops.length === 0 ? ownerCafesEmptyCopy() : 'No cafes match that search.' }}
        </p>
        <div v-else class="owner-cafes__labels">
          <OwnerCafeLabel
            v-for="(shop, index) in visible"
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
      </div>
    </OwnerShell>
  </IonPage>
</template>

<script lang="ts" setup>
import OwnerCafeLabel from '~/components/owner-portal/OwnerCafeLabel.vue'
import OwnerShell from '~/components/owner-portal/OwnerShell.vue'
import { ownerCafesEmptyCopy } from '~/utils/owner-portal'

definePageMeta({
  middleware: ['owner'],
})

const desk = useOwnerPortal()
const { ownedShops, waitingClaims, status, error, loadDesk } = desk
const query = ref('')
const liftedId = ref<string | null>(null)
const pageStatus = computed(() => {
  if (desk.access.value === 'forbidden') return 'forbidden' as const
  return status.value
})

const visible = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return ownedShops.value
  return ownedShops.value.filter((shop) => {
    return shop.name.toLowerCase().includes(needle) || shop.address.toLowerCase().includes(needle)
  })
})

onMounted(() => {
  void loadDesk()
})
</script>

<style scoped>
.owner-cafes {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.owner-cafes__empty {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.3;
}

.owner-cafes__labels {
  display: grid;
  gap: 12px;
}
</style>
