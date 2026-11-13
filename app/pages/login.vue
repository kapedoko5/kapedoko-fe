<template>
  <AuthShell
    title="Sign in"
    :lede="lede"
  >
    <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
    <form class="auth-form" @submit.prevent="onSubmit">
      <label class="auth-field" for="email">
        Email
        <input
          id="email"
          v-model="email"
          type="email"
          name="email"
          autocomplete="username"
          inputmode="email"
          placeholder="you@example.com"
          :aria-invalid="Boolean(error)"
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
          autocomplete="current-password"
          placeholder="Your password"
          :aria-invalid="Boolean(error)"
          required
        />
      </label>
      <button type="submit" class="auth-submit" :disabled="busy">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
    <AuthGoogleButton
      v-if="showGoogle"
      :loading="googleLoading"
      :disabled="busy"
      @click="onGoogle"
    />
    <div class="auth-links">
      <NuxtLink :to="{ path: '/forgot-password', query }">Forgot password?</NuxtLink>
      <p>
        New here?
        <NuxtLink :to="{ path: '/register', query }">Create an account</NuxtLink>
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
  loginLedeForRedirect,
  rememberAuthRedirect,
  shouldOfferGoogleAuth,
} from '~/utils/auth'

definePageMeta({
  middleware: 'guest',
})

const route = useRoute()
const { signIn, signInWithGoogle } = useAuth()
const email = ref('')
const password = ref('')
const loading = ref(false)
const googleLoading = ref(false)
const error = ref('')
const showGoogle = ref(false)

const query = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' ? { redirect } : {}
})
const lede = computed(() => loginLedeForRedirect(query.value.redirect))
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
    await signIn(email.value, password.value)
    await navigateTo(consumeAuthRedirect(requested))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not sign in.'
  } finally {
    loading.value = false
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
