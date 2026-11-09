<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="analytics-consent"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-consent-title"
      aria-describedby="analytics-consent-copy"
    >
      <div class="analytics-consent__card">
        <h2 id="analytics-consent-title">Help us improve KapéDoko?</h2>
        <p id="analytics-consent-copy">
          We record taps like search, filters, and café opens so we can see whether cafés nationwide are easy to find.
          We do not record your email, your exact location, or what you type into search.
          You can change this later in Profile.
        </p>
        <p class="analytics-consent__legal">
          <NuxtLink to="/privacy">Privacy policy</NuxtLink>
        </p>
        <div class="analytics-consent__actions">
          <button type="button" class="analytics-consent__allow" @click="allow">Allow analytics</button>
          <button type="button" class="analytics-consent__skip" @click="decline">Not now</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
const { consent, setConsent } = useAnalytics()
const route = useRoute()

const open = computed(() => (
  consent.value === null
  && !route.path.startsWith('/privacy')
))

const allow = async () => {
  await setConsent('granted')
}

const decline = async () => {
  await setConsent('declined')
}
</script>

<style scoped>
.analytics-consent {
  position: fixed;
  inset: 0;
  z-index: 20000;
  transform: translateZ(0);
  display: grid;
  place-items: end center;
  padding:
    20px
    16px
    calc(20px + env(safe-area-inset-bottom));
  background: color-mix(in srgb, #1c1917 36%, transparent);
}

html:has(nav.app-tabbar) .analytics-consent {
  padding-bottom: calc(var(--kd-tabbar-inset) + 20px);
}

.analytics-consent__card {
  width: min(100%, 420px);
  padding: 20px 18px 16px;
  border-radius: 20px;
  background: #faf8f5;
  color: var(--kd-ink);
  font-family: 'Kumbh Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  box-shadow: 0 16px 40px color-mix(in srgb, #1c1917 18%, transparent);
}

.analytics-consent__card h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.analytics-consent__card p {
  margin: 10px 0 0;
  font-size: 0.875rem;
  line-height: 1.45;
}

.analytics-consent__legal a {
  color: var(--kd-primary);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.analytics-consent__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.analytics-consent__allow,
.analytics-consent__skip {
  min-height: 44px;
  border-radius: 14px;
  font-family: inherit;
  font-size: 0.9rem;
  cursor: pointer;
}

.analytics-consent__allow {
  border: 0;
  background: var(--kd-primary);
  color: #faf8f5;
  font-weight: 700;
}

.analytics-consent__skip {
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  background: transparent;
  color: var(--kd-ink);
}

.analytics-consent__allow:focus-visible,
.analytics-consent__skip:focus-visible,
.analytics-consent__legal a:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}
</style>
