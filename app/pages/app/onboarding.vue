<template>
  <IonPage>
    <IonContent :scroll-y="false" class="onboarding-content">
      <div class="onboarding">
        <div class="onboarding__frame">
          <button type="button" class="onboarding__skip" @click="skip">Skip</button>
          <div
            ref="shellRef"
            class="onboarding__track"
            tabindex="0"
            role="region"
            aria-roledescription="carousel"
            :aria-label="`Onboarding, step ${activeStep + 1} of 3`"
            @scroll.passive="onScroll"
            @keydown="onKeydown"
          >
            <OnboardingStep1
              class="onboarding__slide"
              :active-step="activeStep"
              :inert="activeStep !== 0"
              @next="goTo(1)"
              @go-to="goTo"
            />
            <OnboardingStep2
              class="onboarding__slide"
              :active-step="activeStep"
              :inert="activeStep !== 1"
              @next="goTo(2)"
              @go-to="goTo"
            />
            <OnboardingStep3
              class="onboarding__slide"
              :active-step="activeStep"
              :inert="activeStep !== 2"
              @complete="finish"
              @go-to="goTo"
            />
          </div>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<script lang="ts" setup>
import { useIonRouter } from '@ionic/vue'
import OnboardingStep1 from '~/components/onboarding/OnboardingStep1.vue'
import OnboardingStep2 from '~/components/onboarding/OnboardingStep2.vue'
import OnboardingStep3 from '~/components/onboarding/OnboardingStep3.vue'
import { ANALYTICS_EVENTS, type OnboardingStep } from '~/utils/analytics'
import { markOnboardingDone } from '~/utils/onboarding'

const { track } = useAnalytics()
const ionRouter = useIonRouter()
const STEP_COUNT = 3

const shellRef = ref<HTMLElement | null>(null)
const activeStep = ref(0)

const { reveal: revealAppTabBar } = useAppTabBar('hide')

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const goTo = (index: number) => {
  const track = shellRef.value
  if (!track) return

  const next = Math.max(0, Math.min(STEP_COUNT - 1, index))
  activeStep.value = next
  track.scrollTo({
    left: next * track.clientWidth,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth',
  })
}

const onScroll = () => {
  const track = shellRef.value
  if (!track || track.clientWidth === 0) return

  const index = Math.round(track.scrollLeft / track.clientWidth)
  if (index !== activeStep.value) {
    activeStep.value = Math.max(0, Math.min(STEP_COUNT - 1, index))
  }
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    goTo(activeStep.value + 1)
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    goTo(activeStep.value - 1)
  }
}

const leave = async () => {
  const page = shellRef.value?.closest('.ion-page')
  if (page) {
    page.classList.add('ion-page-hidden')
    page.setAttribute('aria-hidden', 'true')
  }
  revealAppTabBar('/app')
  await navigateTo('/app', { replace: true })
  ionRouter.navigate('/app', 'root', 'replace')
}

const finish = async () => {
  track(ANALYTICS_EVENTS.ONBOARDING_COMPLETED, { step_reached: 3 })
  await markOnboardingDone()
  await leave()
}

const skip = async () => {
  const step = Math.min(3, Math.max(1, activeStep.value + 1)) as OnboardingStep
  track(ANALYTICS_EVENTS.ONBOARDING_SKIPPED, { step_reached: step })
  await markOnboardingDone()
  await leave()
}
</script>

<style scoped>
.onboarding-content {
  --background: #f2f2f2;
  --overflow: hidden;
}

.onboarding-content :deep(.inner-scroll),
.onboarding-content :deep(.scroll-y),
.onboarding-content :deep(.overscroll) {
  position: absolute;
  inset: 0;
  height: 100%;
  overflow: hidden;
}

.onboarding {
  height: 100%;
  min-height: 100%;
  background: #f2f2f2;
  color: var(--kd-ink);
}

.onboarding__frame {
  position: relative;
  width: min(100%, var(--kd-readable-max));
  margin-inline: auto;
  height: 100%;
  min-height: 100%;
  overflow: hidden;
}

.onboarding__skip {
  position: absolute;
  z-index: 2;
  top: max(2.75rem, calc(env(safe-area-inset-top) + 16px));
  right: 8px;
  min-width: 44px;
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  background: transparent;
  color: var(--kd-primary);
  font-size: 0.75rem;
  font-weight: 700;
  font-family: inherit;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
  cursor: pointer;
}

.onboarding__skip:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.onboarding__track {
  display: flex;
  height: 100%;
  min-height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  outline: none;
}

.onboarding__track:focus-visible {
  box-shadow: inset 0 0 0 2px var(--kd-primary);
}

.onboarding__track::-webkit-scrollbar {
  display: none;
}

.onboarding__slide {
  flex: 0 0 100%;
  width: 100%;
  height: 100%;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}

@media (prefers-reduced-motion: reduce) {
  .onboarding__track {
    scroll-behavior: auto;
  }
}

::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}
</style>
