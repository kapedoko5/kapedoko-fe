<template>
  <button
    type="button"
    class="cafe-logo"
    :class="{ 'is-busy': saving, 'is-open': expanded }"
    :aria-label="`Change logo for ${shop.name}`"
    :aria-haspopup="expanded === undefined ? undefined : 'dialog'"
    :aria-expanded="expanded"
    :disabled="saving"
    :aria-busy="saving || undefined"
  >
    <img
      class="cafe-logo__mark"
      :class="{ 'is-app': usingAppLogo }"
      :src="src"
      alt=""
      width="40"
      height="40"
      @error="onError"
    />
    <span class="cafe-logo__hint" :class="{ 'is-busy': saving }" aria-hidden="true">
      <AdminSpinner v-if="saving" :size="16" />
      <Pencil v-else :size="14" :stroke-width="2.4" />
    </span>
  </button>
</template>

<script lang="ts" setup>
import { Pencil } from 'lucide-vue-next'
import AdminSpinner from '~/components/admin/AdminSpinner.vue'
import type { ShopRow } from '~/types/shop'
import { shopCafeLogoSrc } from '~/utils/admin-logos'
import { isKapedokoMark } from '~/utils/logo'

const props = defineProps<{
  shop: Pick<ShopRow, 'id' | 'name' | 'logo_object_key'>
  publicBase: string
  saving?: boolean
  expanded?: boolean
}>()

const broken = ref(false)
const src = computed(() => shopCafeLogoSrc(props.shop.logo_object_key, props.publicBase, broken.value))
const usingAppLogo = computed(() => broken.value || isKapedokoMark(src.value))

watch(
  () => props.shop.logo_object_key,
  () => {
    broken.value = false
  },
)

const onError = () => {
  if (usingAppLogo.value) return
  broken.value = true
}
</script>

<style scoped>
.cafe-logo {
  position: relative;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 8px;
  background: #faf8f5;
  color: var(--kd-ink);
  cursor: pointer;
  flex: 0 0 auto;
}

.cafe-logo__mark {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.cafe-logo__mark.is-app {
  padding: 4px;
  box-sizing: border-box;
}

.cafe-logo__hint {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--kd-ink) 55%, transparent);
  color: var(--kd-white);
  opacity: 0;
  transition: opacity 140ms cubic-bezier(0.16, 1, 0.3, 1);
}

.cafe-logo:hover .cafe-logo__hint,
.cafe-logo:focus-visible .cafe-logo__hint,
.cafe-logo.is-open .cafe-logo__hint,
.cafe-logo.is-busy .cafe-logo__hint {
  opacity: 1;
}

.cafe-logo:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.cafe-logo.is-busy {
  opacity: 0.55;
  cursor: wait;
}

.cafe-logo:disabled {
  cursor: wait;
}

@media (hover: hover) and (pointer: fine) {
  .cafe-logo:hover:not(:disabled) {
    border-color: var(--kd-primary);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cafe-logo__hint {
    transition: none;
  }
}

:root.is-android .cafe-logo {
  width: 48px;
  height: 48px;
}
</style>
