<template>
  <Teleport to="body">
    <div
      v-if="overlay"
      class="admin-busy"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="admin-busy__card">
        <AdminSpinner :size="22" />
        <p>{{ overlay.message }}</p>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
/**
 * Blocking status card for multi-row admin writes.
 * Show it with `useAdminBusy().track(message, run)`.
 * It sits under the confirm dialog so a question can still be answered.
 */
const { overlay } = useAdminBusy()
</script>

<style scoped>
.admin-busy {
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

.admin-busy__card {
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
  caret-color: var(--kd-primary);
}

.admin-busy__card p {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.admin-busy ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

@media (min-width: 540px) {
  .admin-busy {
    place-items: center;
    padding: 20px;
  }
}
</style>
