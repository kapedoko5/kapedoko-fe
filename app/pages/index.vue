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
  title: 'KapeDoko — Find a cafe you can actually work from',
  meta: [
    {
      name: 'description',
      content: 'Find a Philippine cafe you can sit and work from. Check WiFi, power outlets, and hours, then open the map.',
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
