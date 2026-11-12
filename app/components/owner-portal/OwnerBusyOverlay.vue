<template>
  <Teleport to="body">
    <div
      v-if="overlay"
      class="owner-busy"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="owner-busy__card">
        <OwnerSpinner :size="22" />
        <p>{{ overlay.message }}</p>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
import OwnerSpinner from '~/components/owner-portal/OwnerSpinner.vue'

const { overlay } = useOwnerBusy()
</script>

<style scoped>
.owner-busy {
  position: fixed;
  inset: 0;
  z-index: 34;
  display: grid;
  place-items: end center;
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  background: color-mix(in srgb, var(--kd-ink) 46%, transparent);
  font-family: 'Kumbh Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.owner-busy__card {
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(420px, 100%);
  min-height: 72px;
  padding: 16px 20px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
}

.owner-busy__card p {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
}
</style>
