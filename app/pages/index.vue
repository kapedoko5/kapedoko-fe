<template>
  <IonPage class="landing-page">
    <div v-if="showLanding" class="landing">
      <LandingHeader />
      <LandingHero />
      <LandingFilterSpotlight />
      <LandingVibeSpotlight />
      <LandingHowItWorks />
      <LandingProof />
      <LandingClose />
    </div>
  </IonPage>
</template>

<script setup lang="ts">
import { Capacitor } from '@capacitor/core'
import { IonPage } from '@ionic/vue'
import LandingClose from '~/components/landing/LandingClose.vue'
import LandingFilterSpotlight from '~/components/landing/LandingFilterSpotlight.vue'
import LandingHeader from '~/components/landing/LandingHeader.vue'
import LandingHero from '~/components/landing/LandingHero.vue'
import LandingHowItWorks from '~/components/landing/LandingHowItWorks.vue'
import LandingProof from '~/components/landing/LandingProof.vue'
import LandingVibeSpotlight from '~/components/landing/LandingVibeSpotlight.vue'

useHead({
  title: 'KapeDoko — Filter your next brew',
  meta: [
    {
      name: 'description',
      content: 'Filter Philippine cafes by WiFi, power outlets, hours, and vibe, then open the map. No account needed to browse.',
    },
  ],
})

useAppTabBar('hide')

const showLanding = computed(() => !Capacitor.isNativePlatform())

onMounted(() => {
  if (Capacitor.isNativePlatform()) {
    void navigateTo('/app', { replace: true })
  }
})
</script>
