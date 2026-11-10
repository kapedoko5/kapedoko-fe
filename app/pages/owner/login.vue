<template>
  <IonPage>
    <IonContent class="owner-login-content">
      <div class="owner-login">
        <header class="owner-login__header">
          <img
            src="/assets/kapedoko-logo_dark.png"
            alt=""
            width="46"
            height="60"
            class="owner-login__mark"
          />
          <h1>Owner desk</h1>
          <p>Sign in to keep hours, contact, and the logo current on cafes you manage.</p>
        </header>
        <p v-if="error" class="owner-login__error" role="alert">{{ error }}</p>
        <form class="owner-login__form" @submit.prevent="onSubmit">
          <label class="owner-login__field" for="owner-email">
            Email
            <input
              id="owner-email"
              v-model="email"
              type="email"
              name="email"
              autocomplete="username"
              inputmode="email"
              placeholder="you@studio.ph"
              :aria-invalid="Boolean(error)"
              required
            />
          </label>
          <label class="owner-login__field" for="owner-password">
            Password
            <input
              id="owner-password"
              v-model="password"
              type="password"
              name="password"
              autocomplete="current-password"
              placeholder="Your password"
              :aria-invalid="Boolean(error)"
              required
            />
          </label>
          <button type="submit" class="owner-login__submit" :disabled="loading">
            {{ loading ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>
        <div class="owner-login__links">
          <NuxtLink to="/forgot-password">Forgot password?</NuxtLink>
          <p>
            Need an account?
            <NuxtLink to="/register">Create an account</NuxtLink>
          </p>
          <p>Claim a listed cafe in the app. An admin verifies it before this desk opens.</p>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<script lang="ts" setup>
import { settleOwnerIonPages } from '~/utils/owner-nav'
import { canAccessOwnerDesk, ownerLoginDeniedCopy, ownerStaffRedirect } from '~/utils/owner-portal'
import { parseProfileRole } from '~/utils/profile-role'

definePageMeta({
  middleware: ['owner-guest'],
})

useAppTabBar('hide')

onMounted(() => {
  settleOwnerIonPages()
})

const { signIn, loadProfile, currentUserId } = useAuth()
const ownership = useShopOwnership()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const onSubmit = async () => {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    await signIn(email.value, password.value)
    const profile = await loadProfile()
    const role = parseProfileRole(profile?.role)
    const staffTo = ownerStaffRedirect(role)
    if (staffTo) {
      await navigateTo(staffTo)
      return
    }
    await ownership.load()
    const uid = await currentUserId()
    if (!uid) throw new Error('Sign in to open the owner desk.')
    if (!canAccessOwnerDesk({ role, claimCount: ownership.claims.value.length })) {
      error.value = ownerLoginDeniedCopy()
      return
    }
    await navigateTo('/owner', { replace: true })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not sign in.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.owner-login-content {
  --background: #f2f2f2;
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.owner-login {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  max-width: 480px;
  margin-inline: auto;
  padding: max(2.75rem, calc(env(safe-area-inset-top) + 16px)) 20px calc(2rem + env(safe-area-inset-bottom));
  background: #f2f2f2;
  color: var(--kd-ink);
}

.owner-login__header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 28px;
}

.owner-login__mark {
  display: block;
  width: 46px;
  height: 60px;
  object-fit: contain;
}

.owner-login__header h1 {
  margin: 16px 0 0;
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.owner-login__header p,
.owner-login__error,
.owner-login__links p {
  margin: 8px 0 0;
  max-width: 28rem;
  font-size: 0.7875rem;
  line-height: 1.3;
}

.owner-login__error {
  margin: 0 0 12px;
  color: var(--kd-destructive);
  font-weight: 700;
}

.owner-login__form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.owner-login__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}

.owner-login__field input {
  width: 100%;
  height: 48px;
  padding: 0 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  font-size: 16px;
  font-weight: 400;
  font-family: inherit;
  caret-color: var(--kd-primary);
}

.owner-login__field input:focus {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.owner-login__submit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 44px;
  margin-top: 8px;
  padding: 0 16px;
  border: 0;
  border-radius: 16px;
  background: var(--kd-accent);
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
}

.owner-login__submit:disabled {
  opacity: 0.55;
  cursor: default;
}

.owner-login__submit:focus-visible,
.owner-login__links a:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 3px;
}

.owner-login__links {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 18px;
  font-size: 0.7875rem;
}

.owner-login__links a {
  color: var(--kd-primary);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
}

:root.is-android .owner-login__submit {
  min-height: 48px;
}
</style>
