<template>
  <AuthShell
    title="Choose a new password"
    lede="Use at least 8 characters. This replaces the password on your account."
  >
    <p v-if="status === 'checking'" class="auth-note">Checking your reset link…</p>
    <template v-else-if="status === 'ready'">
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <form class="auth-form" @submit.prevent="onSubmit">
        <label class="auth-field" for="password">
          New password
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
          {{ loading ? 'Saving…' : 'Save password' }}
        </button>
      </form>
    </template>
    <template v-else>
      <p class="auth-error" role="alert">{{ error }}</p>
      <div class="auth-links">
        <NuxtLink to="/forgot-password">Request a new link</NuxtLink>
        <NuxtLink to="/login">Back to sign in</NuxtLink>
      </div>
    </template>
  </AuthShell>
</template>

<script setup lang="ts">
import AuthShell from '~/components/auth/AuthShell.vue'
import { parseConfirmLink } from '~/utils/auth-confirm'
import { friendlyAuthError } from '~/utils/auth'

const supabase = useSupabaseClient()
const route = useRoute()
const { updatePassword } = useAuth()
const password = ref('')
const loading = ref(false)
const error = ref('This reset link expired or was already used.')
const status = ref<'checking' | 'ready' | 'expired' | 'missing'>('checking')

const markReady = () => {
  status.value = 'ready'
}

let stopAuthWatch: (() => void) | undefined

onMounted(() => {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) markReady()
  })
  stopAuthWatch = () => data.subscription.unsubscribe()
  void consumeResetLink()
})

onBeforeUnmount(() => {
  stopAuthWatch?.()
})

async function consumeResetLink() {
  const intent = parseConfirmLink({
    query: route.query as Record<string, unknown>,
    hash: import.meta.client ? window.location.hash : route.hash,
  })

  if (intent.kind === 'error') {
    status.value = 'expired'
    error.value = intent.message
    return
  }

  try {
    if (intent.kind === 'otp') {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: intent.tokenHash,
        type: 'recovery',
      })
      if (verifyError) throw verifyError
      markReady()
      return
    }
    if (intent.kind === 'code') {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(intent.code)
      if (exchangeError) throw exchangeError
      markReady()
      return
    }
    if (intent.kind === 'session') {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: intent.accessToken,
        refresh_token: intent.refreshToken,
      })
      if (sessionError) throw sessionError
      markReady()
      return
    }
  } catch (err) {
    const session = (await supabase.auth.getSession()).data.session
    if (session) {
      markReady()
      return
    }
    status.value = 'expired'
    error.value = friendlyAuthError(err instanceof Error ? err.message : '')
    return
  }

  const existing = (await supabase.auth.getSession()).data.session
  if (existing) {
    markReady()
    return
  }

  status.value = 'missing'
  error.value = 'Open the reset link we sent to your email.'
}

const onSubmit = async () => {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    await updatePassword(password.value)
    await navigateTo('/app/profile')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not save that password.'
  } finally {
    loading.value = false
  }
}
</script>
