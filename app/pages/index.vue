<template>
  <IonPage class="landing-page">
    <div v-if="showLanding" class="landing">
      <LandingHeader />
      <LandingHero />
      <LandingProof />
      <LandingClose />
    </div>
  </IonPage>
</template>

<script setup lang="ts">
import { Capacitor } from '@capacitor/core'
import { IonPage } from '@ionic/vue'
import LandingClose from '~/components/landing/LandingClose.vue'
import LandingHeader from '~/components/landing/LandingHeader.vue'
import LandingHero from '~/components/landing/LandingHero.vue'
import LandingProof from '~/components/landing/LandingProof.vue'

useHead({
  title: 'KapeDoko — Filter your next brew',
  meta: [
    {
      name: 'description',
      content: 'Filter Philippine cafes by WiFi, power outlets, and hours, then open the map. No account needed to browse.',
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
