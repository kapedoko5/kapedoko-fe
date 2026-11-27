<template>
  <div class="landing-phone" aria-hidden="true">
    <div class="landing-phone__screen">
      <div class="landing-phone__notch" />
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* A flat CSS phone frame: ink bezel, no shadow. Purely illustrative. */
.landing-phone {
  width: 100%;
  max-width: 300px;
  aspect-ratio: 9 / 18.5;
  padding: 10px;
  border: 1.5px solid var(--color-ink);
  border-radius: 40px;
  background: var(--color-ink);
  box-sizing: border-box;
}

.landing-phone__screen {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  padding: 30px 12px 12px;
  overflow: hidden;
  border-radius: 30px;
  background: var(--color-paper);
  box-sizing: border-box;
}

.landing-phone__notch {
  position: absolute;
  top: 8px;
  left: 50%;
  width: 72px;
  height: 16px;
  border-radius: 10px;
  background: var(--color-ink);
  translate: -50% 0;
}
</style>
