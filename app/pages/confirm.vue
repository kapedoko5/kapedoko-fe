<template>
  <AuthShell
    :title="title"
    :lede="lede"
  >
    <p v-if="status === 'checking'" class="auth-note" role="status">Confirming this email…</p>
    <template v-else-if="status === 'confirmed'">
      <p class="auth-note" role="status">This address is confirmed. You can sign in and keep saves under your name.</p>
      <button type="button" class="auth-submit" @click="leave">Continue</button>
    </template>
    <template v-else>
      <p class="auth-error" role="alert">{{ error }}</p>
      <div class="auth-links">
        <NuxtLink to="/login">Back to sign in</NuxtLink>
        <NuxtLink to="/register">Create an account</NuxtLink>
        <NuxtLink to="/app">Continue without an account</NuxtLink>
      </div>
    </template>
  </AuthShell>
</template>

<script setup lang="ts">
import AuthShell from '~/components/auth/AuthShell.vue'
import { parseConfirmLink } from '~/utils/auth-confirm'
import { friendlyAuthError, safeRedirectPath } from '~/utils/auth'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const route = useRoute()
const status = ref<'checking' | 'confirmed' | 'expired' | 'missing'>('checking')
const error = ref('This link expired or was already used.')

const title = computed(() => {
  if (status.value === 'confirmed') return 'Email confirmed'
  if (status.value === 'checking') return 'Confirming your email'
  return 'Confirm your email'
})

const lede = computed(() => {
  if (status.value === 'confirmed') return 'You can use this address on KapeDoko now.'
  if (status.value === 'checking') return 'This only takes a moment.'
  return 'Open the confirmation link from your email if you still need to finish this.'
})

const leave = async () => {
  const requested = Array.isArray(route.query.redirect) ? route.query.redirect[0] : route.query.redirect
  await navigateTo(safeRedirectPath(requested))
}

const sentToReset = ref(false)

const markConfirmed = () => {
  if (sentToReset.value) return
  status.value = 'confirmed'
}

const sendToReset = async () => {
  if (sentToReset.value) return
  sentToReset.value = true
  await navigateTo({ path: '/reset-password', query: route.query, hash: route.hash })
}

watch(user, (next) => {
  if (next) markConfirmed()
})

let stopAuthWatch: (() => void) | undefined

onMounted(() => {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') void sendToReset()
  })
  stopAuthWatch = () => data.subscription.unsubscribe()
  void confirmFromLink()
})

onBeforeUnmount(() => {
  stopAuthWatch?.()
})

async function confirmFromLink() {
  const intent = parseConfirmLink({
    query: route.query as Record<string, unknown>,
    hash: import.meta.client ? window.location.hash : route.hash,
  })

  if (intent.kind === 'error') {
    status.value = 'expired'
    error.value = intent.message
    return
  }

  if (intent.kind === 'otp' && intent.type === 'recovery') {
    await sendToReset()
    return
  }

  if (user.value) {
    markConfirmed()
    return
  }

  try {
    if (intent.kind === 'otp') {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: intent.tokenHash,
        type: intent.type,
      })
      if (verifyError) throw verifyError
      markConfirmed()
      return
    }

    if (intent.kind === 'code') {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(intent.code)
      if (exchangeError) throw exchangeError
      if (sentToReset.value) return
      markConfirmed()
      return
    }

    if (intent.kind === 'session') {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: intent.accessToken,
        refresh_token: intent.refreshToken,
      })
      if (sessionError) throw sessionError
      if (sentToReset.value) return
      markConfirmed()
      return
    }
  } catch (err) {
    if (sentToReset.value) return
    const session = (await supabase.auth.getSession()).data.session
    if (session) {
      markConfirmed()
      return
    }
    status.value = 'expired'
    error.value = friendlyAuthError(err instanceof Error ? err.message : '')
    return
  }

  if (sentToReset.value) return
  const existing = (await supabase.auth.getSession()).data.session
  if (existing || user.value) {
    markConfirmed()
    return
  }

  status.value = 'missing'
  error.value = 'Open the confirmation link we sent to your email.'
}
</script>
