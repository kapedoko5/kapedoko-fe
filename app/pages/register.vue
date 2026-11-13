<template>
  <AuthShell
    title="Create account"
    :lede="lede"
  >
    <p v-if="confirmation" class="auth-note" role="status">
      Check {{ email }} for a confirmation link. After you confirm, we will bring you back.
    </p>
    <p v-if="confirmation && resent" class="auth-note" role="status">
      We sent another link to {{ email }}.
    </p>
    <p v-if="confirmation && error" class="auth-error" role="alert">{{ error }}</p>
    <button
      v-if="confirmation"
      type="button"
      class="auth-submit"
      :disabled="resending"
      @click="onResend"
    >
      {{ resending ? 'Sending…' : 'Send another link' }}
    </button>
    <template v-else>
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <form class="auth-form" @submit.prevent="onSubmit">
        <label class="auth-field" for="name">
          Name
          <input
            id="name"
            v-model="name"
            type="text"
            name="name"
            autocomplete="name"
            placeholder="Your name"
            required
          />
        </label>
        <label class="auth-field" for="email">
          Email
          <input
            id="email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            inputmode="email"
            placeholder="you@example.com"
            required
          />
        </label>
        <label class="auth-field" for="password">
          Password
          <input
            id="password"
            v-model="password"
            type="password"
            name="password"
            autocomplete="new-password"
            placeholder="At least 8 characters"
            minlength="8"
            required
          />
        </label>
        <button type="submit" class="auth-submit" :disabled="busy">
          {{ loading ? 'Creating account…' : 'Create account' }}
        </button>
      </form>
      <AuthGoogleButton
        v-if="showGoogle"
        :loading="googleLoading"
        :disabled="busy"
        @click="onGoogle"
      />
    </template>
    <div class="auth-links">
      <p>
        Already have an account?
        <NuxtLink :to="{ path: '/login', query }">Sign in</NuxtLink>
      </p>
      <p>
        <NuxtLink to="/privacy">Privacy policy</NuxtLink>
      </p>
    </div>
  </AuthShell>
</template>

<script setup lang="ts">
import { Capacitor } from '@capacitor/core'
import AuthGoogleButton from '~/components/auth/AuthGoogleButton.vue'
import AuthShell from '~/components/auth/AuthShell.vue'
import {
  consumeAuthRedirect,
  registerLedeForRedirect,
  rememberAuthEmail,
  rememberAuthRedirect,
  shouldOfferGoogleAuth,
} from '~/utils/auth'

definePageMeta({
  middleware: 'guest',
})

const route = useRoute()
const { signUp, signInWithGoogle, resendConfirmation } = useAuth()
const name = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const googleLoading = ref(false)
const resending = ref(false)
const error = ref('')
const confirmation = ref(false)
const resent = ref(false)
const showGoogle = ref(false)

const query = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' ? { redirect } : {}
})
const lede = computed(() => registerLedeForRedirect(query.value.redirect))
const busy = computed(() => loading.value || googleLoading.value)

onMounted(() => {
  showGoogle.value = shouldOfferGoogleAuth(Capacitor.isNativePlatform())
})

const requestedRedirect = () => {
  const requested = Array.isArray(route.query.redirect) ? route.query.redirect[0] : route.query.redirect
  rememberAuthRedirect(requested)
  return requested
}

const onSubmit = async () => {
  if (busy.value) return
  loading.value = true
  error.value = ''
  try {
    const requested = requestedRedirect()
    const result = await signUp(name.value, email.value, password.value)
    if (result.needsConfirmation) {
      rememberAuthEmail(email.value)
      confirmation.value = true
      password.value = ''
      return
    }
    await navigateTo(consumeAuthRedirect(requested))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not create this account.'
  } finally {
    loading.value = false
  }
}

const onResend = async () => {
  if (resending.value) return
  resending.value = true
  error.value = ''
  try {
    await resendConfirmation(email.value)
    resent.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not send another link.'
  } finally {
    resending.value = false
  }
}

const onGoogle = async () => {
  if (busy.value) return
  googleLoading.value = true
  error.value = ''
  try {
    requestedRedirect()
    await signInWithGoogle()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not continue with Google.'
    googleLoading.value = false
  }
}
</script>
