<template>
  <IonPage>
    <IonContent class="auth-content">
      <div class="auth">
        <header class="auth__header">
          <img
            src="/assets/kapedoko-logo_dark.png"
            alt=""
            width="46"
            height="60"
            class="auth__mark"
          />
          <h1>{{ title }}</h1>
          <p v-if="lede">{{ lede }}</p>
        </header>
        <slot />
      </div>
    </IonContent>
  </IonPage>
</template>

<script lang="ts" setup>
defineProps<{
  title: string
  lede?: string
}>()
</script>

<style scoped>
.auth-content {
  --background: #f2f2f2;
  --padding-start: 0;
  --padding-end: 0;
  --padding-top: 0;
  --padding-bottom: 0;
}

.auth {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  width: min(100%, var(--kd-readable-max));
  margin-inline: auto;
  padding: max(2.75rem, calc(env(safe-area-inset-top) + 16px)) 20px calc(2rem + env(safe-area-inset-bottom));
  background: #f2f2f2;
  color: var(--kd-ink);
}

.auth__header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 28px;
  color: var(--kd-ink);
}

.auth__mark {
  display: block;
  width: 46px;
  height: 60px;
  object-fit: contain;
}

.auth__header h1 {
  margin: 16px 0 0;
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.auth__header p {
  margin: 8px 0 0;
  max-width: 28rem;
  color: var(--kd-ink);
  font-size: 0.875rem;
  line-height: 1.45;
}
</style>

<style>
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
}

.auth-field input {
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

.auth-field input::placeholder {
  color: color-mix(in srgb, var(--kd-ink) 62%, #faf8f5);
}

.auth-field input:focus {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.auth-error {
  margin: 0 0 12px;
  color: var(--kd-destructive);
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.4;
}

.auth-submit {
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
  font-size: 1rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 140ms cubic-bezier(0.16, 1, 0.3, 1);
}

.auth-submit:disabled {
  opacity: 0.55;
  cursor: default;
}

.auth-submit:focus-visible,
.auth-google:focus-visible,
.auth-links a:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 3px;
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 18px 0 8px;
  color: color-mix(in srgb, var(--kd-ink) 62%, #f2f2f2);
  font-size: 0.75rem;
  font-weight: 700;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: color-mix(in srgb, var(--kd-ink) 18%, transparent);
}

.auth-google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  margin-top: 8px;
  padding: 0 16px;
  border: 1px solid var(--kd-primary);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-primary);
  font-size: 1rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 140ms cubic-bezier(0.16, 1, 0.3, 1);
}

.auth-google:disabled {
  opacity: 0.55;
  cursor: default;
}

.auth-google svg {
  flex-shrink: 0;
}

.auth-links {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 18px;
  color: var(--kd-ink);
  font-size: 14px;
  line-height: 1.4;
}

.auth-links a {
  color: var(--kd-primary);
  font-weight: 700;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}

.auth-note {
  margin: 0;
  color: var(--kd-ink);
  font-size: 14px;
  line-height: 1.45;
}

:root.is-android .auth-submit,
:root.is-android .auth-google,
:root.is-android .auth-field input {
  min-height: 48px;
}

.auth-submit:active:not(:disabled),
.auth-google:active:not(:disabled) {
  transform: scale(0.98);
}

@media (hover: hover) and (pointer: fine) {
  .auth-submit:hover:not(:disabled) {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--kd-ink) 18%, transparent);
  }

  .auth-google:hover:not(:disabled) {
    background: color-mix(in srgb, var(--kd-primary) 8%, #faf8f5);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-submit,
  .auth-google {
    transition: none;
  }

  .auth-submit:active,
  .auth-google:active {
    transform: none;
  }
}

::selection {
  background: color-mix(in srgb, var(--kd-accent) 35%, #faf8f5);
  color: var(--kd-ink);
}
</style>
