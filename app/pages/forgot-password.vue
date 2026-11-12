<template>
  <AuthShell
    title="Reset password"
    lede="We will email a link that brings you back to choose a new password."
  >
    <p v-if="sent" class="auth-note" role="status">
      If an account exists for {{ email }}, a reset link is on the way. It opens a page where you choose a new password.
    </p>
    <template v-else>
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <form class="auth-form" @submit.prevent="onSubmit">
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
        <button type="submit" class="auth-submit" :disabled="loading">
          {{ loading ? 'Sending…' : 'Send reset link' }}
        </button>
      </form>
    </template>
    <div class="auth-links">
      <NuxtLink :to="{ path: '/login', query }">Back to sign in</NuxtLink>
    </div>
  </AuthShell>
</template>

<script setup lang="ts">
import AuthShell from '~/components/auth/AuthShell.vue'

const route = useRoute()
const { resetPassword } = useAuth()
const email = ref('')
const loading = ref(false)
const error = ref('')
const sent = ref(false)

const query = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' ? { redirect } : {}
})

const onSubmit = async () => {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    await resetPassword(email.value)
    sent.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not send a reset link.'
  } finally {
    loading.value = false
  }
}
</script>
