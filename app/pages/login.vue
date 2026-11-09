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
      <button type="submit" class="auth-submit" :disabled="loading">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
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
import AuthShell from '~/components/auth/AuthShell.vue'
import { loginLedeForRedirect, safeRedirectPath } from '~/utils/auth'

definePageMeta({
  middleware: 'guest',
})

const route = useRoute()
const { signIn } = useAuth()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const query = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' ? { redirect } : {}
})
const lede = computed(() => loginLedeForRedirect(query.value.redirect))

const onSubmit = async () => {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    await signIn(email.value, password.value)
    const requested = Array.isArray(route.query.redirect) ? route.query.redirect[0] : route.query.redirect
    await navigateTo(safeRedirectPath(requested))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not sign in.'
  } finally {
    loading.value = false
  }
}
</script>
