<template>
  <AuthShell
    title="Create account"
    :lede="lede"
  >
    <p v-if="confirmation" class="auth-note" role="status">
      Check {{ email }} for a confirmation link. After you confirm, sign in and we will bring you back.
    </p>
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
        <button type="submit" class="auth-submit" :disabled="loading">
          {{ loading ? 'Creating account…' : 'Create account' }}
        </button>
      </form>
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
import AuthShell from '~/components/auth/AuthShell.vue'
import { registerLedeForRedirect, safeRedirectPath } from '~/utils/auth'

definePageMeta({
  middleware: 'guest',
})

const route = useRoute()
const { signUp } = useAuth()
const name = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const confirmation = ref(false)

const query = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' ? { redirect } : {}
})
const lede = computed(() => registerLedeForRedirect(query.value.redirect))

const onSubmit = async () => {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const result = await signUp(name.value, email.value, password.value)
    if (result.needsConfirmation) {
      confirmation.value = true
      password.value = ''
      return
    }
    const requested = Array.isArray(route.query.redirect) ? route.query.redirect[0] : route.query.redirect
    await navigateTo(safeRedirectPath(requested))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not create this account.'
  } finally {
    loading.value = false
  }
}
</script>
