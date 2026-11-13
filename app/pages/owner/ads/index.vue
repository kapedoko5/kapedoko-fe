<template>
  <IonPage>
    <OwnerShell
      title="Ads"
      :lede="ownerAdsLede()"
      :status="pageStatus"
      :error="pageError"
      :claim-count="waitingClaims.length"
    >
      <div class="owner-ads">
        <form class="owner-ads__form" @submit.prevent="onPost">
          <h2>Hang a poster</h2>
          <p class="owner-ads__hint">
            One poster at a time on each cafe. Choose one cafe, or several you manage.
          </p>

          <label class="owner-ads__file">
            Poster
            <input
              ref="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              @change="onFile"
            />
          </label>
          <p v-if="preview" class="owner-ads__preview">
            <img :src="preview" alt="Poster preview" width="320" height="200" />
          </p>

          <fieldset v-if="cafes.length > 1" class="owner-ads__scope">
            <legend>Hang this poster at</legend>
            <label class="owner-ads__check">
              <input v-model="scope" type="radio" value="one" />
              One cafe
            </label>
            <label class="owner-ads__check">
              <input v-model="scope" type="radio" value="several" />
              Several cafes
            </label>
          </fieldset>

          <label v-if="cafes.length === 1" class="owner-ads__one">
            Cafe
            <span>{{ cafes[0]?.name }}</span>
          </label>

          <label v-else-if="scope === 'one'" class="owner-ads__select">
            Cafe
            <select v-model="oneId">
              <option disabled value="">Choose a cafe</option>
              <option v-for="shop in cafes" :key="shop.id" :value="shop.id">
                {{ shop.name }}
              </option>
            </select>
          </label>

          <fieldset v-else-if="cafes.length > 1" class="owner-ads__cafes">
            <legend>Cafes</legend>
            <button type="button" class="owner-ads__all" @click="toggleAll">
              {{ allSelected ? 'Clear all' : 'Select all' }}
            </button>
            <label v-for="shop in cafes" :key="shop.id" class="owner-ads__check">
              <input v-model="severalIds" type="checkbox" :value="shop.id" />
              {{ shop.name }}
              <span v-if="liveShopIds.has(shop.id)" class="owner-ads__has">Has a poster</span>
            </label>
          </fieldset>

          <p v-if="hangingNames.length" class="owner-ads__reprint" aria-live="polite">
            Hangs at {{ hangingNames.join(', ') }}.
          </p>
          <p v-if="replaceCopy" class="owner-ads__warn">{{ replaceCopy }}</p>
          <p v-if="formError" class="owner-ads__error" role="alert">{{ formError }}</p>

          <button class="owner-btn" type="submit" :disabled="saving || cafes.length === 0" :aria-busy="saving || undefined">
            <OwnerBusyLabel :busy="saving">
              {{ saving ? 'Posting…' : 'Post poster' }}
            </OwnerBusyLabel>
          </button>
        </form>

        <section class="owner-ads__live" aria-labelledby="owner-ads-live">
          <h2 id="owner-ads-live">Live posters</h2>
          <p v-if="cafes.length === 0" class="owner-ads__empty">{{ ownerAdsNoCafesCopy() }}</p>
          <p v-else-if="posters.length === 0" class="owner-ads__empty">{{ ownerAdsEmptyCopy() }}</p>
          <ul v-else class="owner-ads__list">
            <li v-for="(row, index) in posters" :key="row.id" :style="{ '--enter': String(index) }">
              <article class="owner-ads__bag">
                <img
                  v-if="posterSrc(row)"
                  class="owner-ads__plate"
                  :src="posterSrc(row) || ''"
                  :alt="`${shopName(row.shop_id)} poster`"
                  width="160"
                  height="100"
                />
                <div class="owner-ads__copy">
                  <h3>{{ shopName(row.shop_id) }}</h3>
                  <p>On the cafe page</p>
                </div>
                <button
                  type="button"
                  class="owner-btn owner-btn--ghost"
                  :disabled="endingId === row.id || saving"
                  :aria-busy="endingId === row.id || undefined"
                  @click="onTakeDown(row)"
                >
                  <OwnerBusyLabel :busy="endingId === row.id">
                    {{ endingId === row.id ? 'Taking down…' : 'Take down' }}
                  </OwnerBusyLabel>
                </button>
              </article>
            </li>
          </ul>
        </section>
      </div>
    </OwnerShell>
  </IonPage>
</template>

<script lang="ts" setup>
import OwnerBusyLabel from '~/components/owner-portal/OwnerBusyLabel.vue'
import OwnerShell from '~/components/owner-portal/OwnerShell.vue'
import type { ShopPosterRow } from '~/utils/owner-ads'
import {
  approvedOwnedCafes,
  livePosterByShopId,
  ownerAdsEmptyCopy,
  ownerAdsLede,
  ownerAdsNoCafesCopy,
  ownerPosterCafeError,
  ownerPosterReplaceCopy,
  ownerPosterReplaceNames,
  ownerPosterShopIds,
  ownerTakeDownMessage,
  ownerTakeDownTitle,
  posterFileError,
  type OwnerPosterScope,
} from '~/utils/owner-ads'
import { publicObjectUrl } from '~/utils/shop-mapper'

definePageMeta({
  middleware: ['owner'],
})

const desk = useOwnerPortal()
const toast = useOwnerToast()
const confirm = useOwnerConfirm()
const config = useRuntimeConfig()
const publicBase = String(config.public.r2PublicBaseUrl || '')
const {
  ownedShops,
  waitingClaims,
  posters,
  saving,
  status,
  error,
  shopNameForClaim,
  loadDesk,
  loadPosters,
  publishPoster,
  endPoster,
} = desk

const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const preview = ref('')
const previewIsBlob = ref(false)
const formError = ref('')
const endingId = ref('')
const scope = ref<OwnerPosterScope>('one')
const oneId = ref('')
const severalIds = ref<string[]>([])

const cafes = computed(() => approvedOwnedCafes(ownedShops.value))
const liveByShop = computed(() => livePosterByShopId(posters.value))
const liveShopIds = computed(() => new Set(liveByShop.value.keys()))
const selectedIds = computed(() => ownerPosterShopIds({
  ownedIds: cafes.value.map((shop) => shop.id),
  scope: cafes.value.length > 1 ? scope.value : 'one',
  oneId: cafes.value.length === 1 ? (cafes.value[0]?.id ?? '') : oneId.value,
  severalIds: severalIds.value,
}))
const hangingNames = computed(() => selectedIds.value.map((id) => shopName(id)))
const replaceCopy = computed(() => ownerPosterReplaceCopy(
  ownerPosterReplaceNames(selectedIds.value, liveShopIds.value, shopName),
))
const allSelected = computed(() => cafes.value.length > 0 && severalIds.value.length === cafes.value.length)
const pageStatus = computed(() => {
  if (desk.access.value === 'forbidden') return 'forbidden' as const
  return status.value
})
const pageError = computed(() => formError.value || error.value)

function shopName(id: string): string {
  return ownedShops.value.find((shop) => shop.id === id)?.name
    || shopNameForClaim(id)
}

function posterSrc(row: ShopPosterRow): string | null {
  return publicObjectUrl(row.poster_object_key, publicBase)
}

const clearPreview = () => {
  if (previewIsBlob.value && preview.value) URL.revokeObjectURL(preview.value)
  preview.value = ''
  previewIsBlob.value = false
}

const onFile = (event: Event) => {
  const input = event.target as HTMLInputElement
  const next = input.files?.[0] ?? null
  const issue = posterFileError(next)
  if (issue) {
    input.value = ''
    file.value = null
    clearPreview()
    formError.value = issue
    toast.warning('Check the poster', issue)
    return
  }
  formError.value = ''
  file.value = next
  clearPreview()
  if (next) {
    preview.value = URL.createObjectURL(next)
    previewIsBlob.value = true
  }
}

const toggleAll = () => {
  severalIds.value = allSelected.value ? [] : cafes.value.map((shop) => shop.id)
}

const onPost = async () => {
  const ids = selectedIds.value
  formError.value = posterFileError(file.value) ?? ownerPosterCafeError(ids) ?? ''
  if (formError.value) {
    toast.warning('Check the poster', formError.value)
    return
  }
  if (!file.value) return
  try {
    await publishPoster(ids, file.value)
    file.value = null
    clearPreview()
    if (fileInput.value) fileInput.value.value = ''
    toast.success(
      ids.length > 1 ? 'Poster posted' : 'Poster posted',
      hangingNames.value.length === 1
        ? `${hangingNames.value[0]} shows it on the cafe page.`
        : `${hangingNames.value.length} cafes show it on their pages.`,
    )
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Could not post this poster.'
    toast.error('Could not post this poster', formError.value)
  }
}

const onTakeDown = async (row: ShopPosterRow) => {
  const name = shopName(row.shop_id)
  const choice = await confirm.ask({
    title: ownerTakeDownTitle(name),
    message: ownerTakeDownMessage(),
    confirmLabel: 'Take down',
    variant: 'destructive',
  })
  if (!choice.confirmed) return
  endingId.value = row.id
  try {
    await endPoster(row.id)
    toast.success('Poster taken down', `${name} no longer shows a poster.`)
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Could not take down this poster.'
    toast.error('Could not take down this poster', formError.value)
  } finally {
    endingId.value = ''
  }
}

watch(cafes, (next) => {
  if (next.length === 1 && next[0]) {
    oneId.value = next[0].id
    severalIds.value = [next[0].id]
    return
  }
  if (!oneId.value && next[0]) oneId.value = next[0].id
}, { immediate: true })

onMounted(async () => {
  await loadDesk()
  try {
    await loadPosters()
  } catch (err) {
    formError.value = err instanceof Error ? err.message : 'Could not load posters.'
  }
})

onBeforeUnmount(() => {
  clearPreview()
})
</script>

<style scoped>
.owner-ads {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.owner-ads__form,
.owner-ads__bag {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: #faf8f5;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 16px;
}

.owner-ads__form h2,
.owner-ads__live h2,
.owner-ads__bag h3,
.owner-ads__hint,
.owner-ads__empty,
.owner-ads__reprint,
.owner-ads__warn,
.owner-ads__error,
.owner-ads__bag p {
  margin: 0;
}

.owner-ads__form h2,
.owner-ads__live h2 {
  margin-bottom: 4px;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.owner-ads__live h2 {
  margin-bottom: 12px;
}

.owner-ads__hint,
.owner-ads__empty,
.owner-ads__bag p,
.owner-ads__reprint {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
  font-size: 0.7875rem;
  line-height: 1.3;
}

.owner-ads__file,
.owner-ads__select,
.owner-ads__one {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}

.owner-ads__one span {
  font-size: 0.95rem;
  font-weight: 400;
}

.owner-ads__file input,
.owner-ads__select select {
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #f2f2f2;
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.95rem;
  font-weight: 400;
}

.owner-ads__preview img,
.owner-ads__plate {
  display: block;
  width: min(100%, 320px);
  height: auto;
  max-height: 200px;
  object-fit: cover;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
}

.owner-ads__scope,
.owner-ads__cafes {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  border: 0;
}

.owner-ads__scope legend,
.owner-ads__cafes legend {
  margin-bottom: 8px;
  font-size: 0.75rem;
  font-weight: 700;
}

.owner-ads__check {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  font-size: 0.7875rem;
  font-weight: 700;
}

.owner-ads__check input {
  width: 20px;
  height: 20px;
  accent-color: var(--kd-primary);
}

.owner-ads__has {
  color: var(--kd-primary);
  font-size: 0.75rem;
  font-weight: 700;
}

.owner-ads__all {
  align-self: flex-start;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-primary);
  font: inherit;
  font-size: 0.7875rem;
  font-weight: 700;
  cursor: pointer;
}

.owner-ads__warn,
.owner-ads__error {
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.3;
}

.owner-ads__error {
  color: var(--kd-destructive);
}

.owner-ads__list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.owner-ads__bag {
  animation: owner-ads-settle 460ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: calc(var(--enter, 0) * 32ms);
}

.owner-ads__bag h3 {
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.owner-ads__bag .owner-btn {
  align-self: flex-start;
}

.owner-ads__file input:focus-visible,
.owner-ads__select select:focus-visible,
.owner-ads__check input:focus-visible,
.owner-ads__all:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

@keyframes owner-ads-settle {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .owner-ads__bag {
    animation: none;
  }
}

:root.is-android .owner-ads__file input,
:root.is-android .owner-ads__select select,
:root.is-android .owner-ads__check,
:root.is-android .owner-ads__all {
  min-height: 48px;
}

::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}
</style>
