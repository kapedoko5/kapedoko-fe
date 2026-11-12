<template>
  <AuthShell
    :title="title"
    :lede="lede"
  >
    <p v-if="status === 'checking'" class="auth-note" role="status">
      {{ oauthReturn ? 'Signing you in…' : 'Confirming this email…' }}
    </p>
    <template v-else-if="status === 'confirmed'">
      <p class="auth-note" role="status">This address is confirmed. You can keep saves under your name.</p>
      <button type="button" class="auth-submit" @click="leave">Continue</button>
    </template>
    <template v-else>
      <p class="auth-error" role="alert">{{ error }}</p>
      <p v-if="resent" class="auth-note" role="status">Check {{ resendEmail }} for a new confirmation link.</p>
      <button
        v-if="resendEmail"
        type="button"
        class="auth-submit"
        :disabled="resending"
        @click="onResend"
      >
        {{ resending ? 'Sending…' : 'Send another link' }}
      </button>
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
import {
  clearAuthCallbackSnapshot,
  parseConfirmLocation,
  readAuthCallbackSnapshot,
  shouldVerifyConfirmIntent,
  withTimeout,
} from '~/utils/auth-confirm'
import {
  consumeAuthRedirect,
  friendlyAuthError,
  isGoogleAuthUser,
  peekAuthEmail,
} from '~/utils/auth'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const route = useRoute()
const { resendConfirmation } = useAuth()
const status = ref<'checking' | 'confirmed' | 'expired' | 'missing'>('checking')
const error = ref('This link expired or was already used.')
const resendEmail = ref('')
const resending = ref(false)
const resent = ref(false)
const verifying = ref(false)
const finishing = ref(false)
const oauthReturn = ref(false)

const title = computed(() => {
  if (status.value === 'confirmed') return 'Email confirmed'
  if (status.value === 'checking') return oauthReturn.value ? 'Signing you in' : 'Confirming your email'
  return 'Confirm your email'
})

const lede = computed(() => {
  if (status.value === 'confirmed') return 'You can use this address on KapeDoko now.'
  if (status.value === 'checking') return 'This only takes a moment.'
  return 'Use the Confirm email button in the mail we sent.'
})

const leave = async () => {
  const requested = Array.isArray(route.query.redirect) ? route.query.redirect[0] : route.query.redirect
  await navigateTo(consumeAuthRedirect(requested), { replace: true })
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

const finishWithSession = async (sessionUser?: unknown) => {
  if (sentToReset.value || finishing.value) return
  clearAuthCallbackSnapshot(callbackStorage())
  const next = sessionUser ?? user.value
  if (isGoogleAuthUser(next)) {
    finishing.value = true
    await leave()
    return
  }
  markConfirmed()
}

const onResend = async () => {
  if (resending.value || !resendEmail.value) return
  resending.value = true
  error.value = ''
  try {
    await resendConfirmation(resendEmail.value)
    resent.value = true
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not send another link.'
  } finally {
    resending.value = false
  }
}

watch(user, (next) => {
  if (!next || sentToReset.value || finishing.value) return
  void finishWithSession(next)
})

let stopAuthWatch: (() => void) | undefined
let capturedHref = ''

onMounted(() => {
  capturedHref = window.location.href
  resendEmail.value = peekAuthEmail()
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') void sendToReset()
  })
  stopAuthWatch = () => data.subscription.unsubscribe()
  void confirmFromLink()
})

onBeforeUnmount(() => {
  stopAuthWatch?.()
})

function callbackStorage() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

async function confirmFromLink() {
  const intent = parseConfirmLocation({
    query: route.query as Record<string, unknown>,
    hash: import.meta.client ? window.location.hash : route.hash,
    pathname: import.meta.client ? window.location.pathname : route.path,
    token: route.params.token,
    href: capturedHref || (import.meta.client ? window.location.href : ''),
    snapshot: readAuthCallbackSnapshot(callbackStorage()),
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

  if (intent.kind === 'code') oauthReturn.value = true

  if (!shouldVerifyConfirmIntent(intent)) {
    const existing = (await supabase.auth.getSession()).data.session
    if (existing || user.value) {
      await finishWithSession(existing?.user ?? user.value)
      return
    }
    status.value = 'missing'
    error.value = 'This page opened without a confirmation token. Use the Confirm email button in the mail, or send another link.'
    return
  }

  verifying.value = true
  try {
    if (intent.kind === 'otp') {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: intent.tokenHash,
        type: intent.type,
      })
      if (verifyError) throw verifyError
      await finishWithSession(data.session?.user)
      return
    }

    if (intent.kind === 'code') {
      const existing = (await supabase.auth.getSession()).data.session
      if (existing) {
        if (sentToReset.value) return
        await finishWithSession(existing.user)
        return
      }
      const { data, error: exchangeError } = await withTimeout(
        supabase.auth.exchangeCodeForSession(intent.code),
        8000,
      )
      if (exchangeError) throw exchangeError
      if (sentToReset.value) return
      await finishWithSession(data.session?.user)
      return
    }

    if (intent.kind === 'session') {
      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: intent.accessToken,
        refresh_token: intent.refreshToken,
      })
      if (sessionError) throw sessionError
      if (sentToReset.value) return
      await finishWithSession(data.user ?? data.session?.user)
    }
  } catch (err) {
    if (sentToReset.value) return
    const session = (await supabase.auth.getSession()).data.session
    if (session) {
      await finishWithSession(session.user)
      return
    }
    status.value = 'expired'
    error.value = friendlyAuthError(err instanceof Error ? err.message : '')
  } finally {
    verifying.value = false
  }
}
</script>
