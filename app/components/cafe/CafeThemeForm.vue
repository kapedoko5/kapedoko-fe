<template>
  <form class="theme-studio" @submit.prevent="onStamp">
    <div class="theme-studio__bag" aria-label="Cafe details preview">
      <p class="theme-studio__bag-label">Preview</p>
      <div class="theme-studio__bag-frame">
        <CafeDetailContent :cafe="previewCafe" variant="page" preview />
      </div>
    </div>

    <div class="theme-studio__ink">
      <div class="theme-studio__intro">
        <h2>Ink the bag</h2>
        <p>{{ cafeThemeLede() }}</p>
      </div>

      <div class="theme-studio__wells">
        <label class="theme-studio__well">
          <span>Button ink</span>
          <span class="theme-studio__swatch" :style="{ background: buttonSwatch }">
            <input
              :value="buttonSwatch"
              type="color"
              aria-label="Button ink"
              @input="onColorInput('button', $event)"
            />
          </span>
          <input
            v-model="buttonDraft"
            class="theme-studio__hex"
            maxlength="7"
            spellcheck="false"
            placeholder="#D9793B"
            aria-label="Button ink hex"
            @change="buttonDraft = formatOrKeep(buttonDraft)"
          />
        </label>
        <label class="theme-studio__well">
          <span>Page text</span>
          <span class="theme-studio__swatch" :style="{ background: textSwatch }">
            <input
              :value="textSwatch"
              type="color"
              aria-label="Page text"
              @input="onColorInput('text', $event)"
            />
          </span>
          <input
            v-model="textDraft"
            class="theme-studio__hex"
            maxlength="7"
            spellcheck="false"
            placeholder="#1C1917"
            aria-label="Page text hex"
            @change="textDraft = formatOrKeep(textDraft)"
          />
        </label>
        <label class="theme-studio__well">
          <span>Page stock</span>
          <span class="theme-studio__swatch" :style="{ background: backgroundSwatch }">
            <input
              :value="backgroundSwatch"
              type="color"
              aria-label="Page stock"
              @input="onColorInput('background', $event)"
            />
          </span>
          <input
            v-model="backgroundDraft"
            class="theme-studio__hex"
            maxlength="7"
            spellcheck="false"
            placeholder="#F2F2F2"
            aria-label="Page stock hex"
            @change="backgroundDraft = formatOrKeep(backgroundDraft)"
          />
        </label>
      </div>

      <div class="theme-studio__faces" aria-hidden="true" :style="faceStyle">
        <span class="theme-studio__face theme-studio__face--primary">Navigate</span>
        <span
          class="theme-studio__face theme-studio__face--quiet"
          :style="{ color: textSwatch, background: backgroundSwatch }"
        >I’m working here</span>
      </div>

      <div class="theme-studio__presets" role="list">
        <button
          v-for="preset in CAFE_THEME_PRESETS"
          :key="preset.id"
          type="button"
          class="theme-studio__chip"
          :class="{ 'is-active': presetActive(preset) }"
          role="listitem"
          @click="applyPreset(preset)"
        >
          <span
            class="theme-studio__chip-dot"
            :style="{ background: preset.buttonHex || DEFAULT_CAFE_BUTTON_HEX }"
            aria-hidden="true"
          />
          {{ preset.label }}
        </button>
      </div>

      <fieldset v-if="cafes.length > 1" class="theme-studio__scope">
        <legend>Stamp this look at</legend>
        <div class="theme-studio__scope-row">
          <label class="owner-chip admin-chip" :class="{ 'is-active': scope === 'one' }">
            <input v-model="scope" class="sr-only" type="radio" value="one" />
            One cafe
          </label>
          <label class="owner-chip admin-chip" :class="{ 'is-active': scope === 'several' }">
            <input v-model="scope" class="sr-only" type="radio" value="several" />
            Several cafes
          </label>
        </div>
      </fieldset>

      <p v-if="cafes.length === 1" class="theme-studio__one">
        <span class="theme-studio__label">Cafe</span>
        <span class="theme-studio__one-name">{{ cafes[0]?.name }}</span>
      </p>

      <template v-else-if="kind === 'admin'">
        <label v-if="scope === 'one'" class="theme-studio__label">
          Cafe
          <AdminSearchPicker
            v-model="oneId"
            :options="pickerOptions"
            :status="pickerStatus"
            title="Choose an approved cafe"
            placeholder="Choose an approved cafe"
            search-placeholder="Search cafe name or address"
            empty-copy="No approved cafes yet."
            no-match-copy="No cafes match that search."
            loading-copy="Loading cafes…"
            error-copy="Could not load cafes."
            item-label="cafe"
            required
          />
        </label>
        <div v-else class="theme-studio__several">
          <p class="theme-studio__label">Cafes</p>
          <AdminMultiSearchPicker
            v-model="severalIds"
            :options="pickerOptions"
            :status="pickerStatus"
            title="Choose approved cafes"
            placeholder="Choose approved cafes"
            search-placeholder="Search cafe name or address"
            empty-copy="No approved cafes yet."
            no-match-copy="No cafes match that search."
            loading-copy="Loading cafes…"
            error-copy="Could not load cafes."
            item-label="cafe"
            required
          />
        </div>
      </template>

      <label v-else-if="scope === 'one'" class="theme-studio__select">
        Cafe
        <select v-model="oneId">
          <option disabled value="">Choose a cafe</option>
          <option v-for="shop in cafes" :key="shop.id" :value="shop.id">
            {{ shop.name }}
          </option>
        </select>
      </label>

      <fieldset v-else class="theme-studio__cafes">
        <legend>Cafes</legend>
        <button type="button" :class="ghostButtonClass" @click="toggleAll">
          {{ allSelected ? 'Clear all' : 'Select all' }}
        </button>
        <label v-for="shop in cafes" :key="shop.id" class="theme-studio__check">
          <input v-model="severalIds" type="checkbox" :value="shop.id" />
          {{ shop.name }}
        </label>
      </fieldset>

      <p v-if="issues" class="theme-studio__error" role="alert">{{ issues }}</p>
      <p v-if="formError" class="theme-studio__error" role="alert">{{ formError }}</p>

      <div class="theme-studio__actions">
        <button :class="primaryButtonClass" type="submit" :disabled="saving || cafes.length === 0" :aria-busy="saving || undefined">
          <slot name="busy" :busy="saving">
            {{ saving ? 'Stamping…' : 'Stamp this look' }}
          </slot>
        </button>
        <button type="button" :class="ghostButtonClass" :disabled="saving" @click="resetKapé">
          Back to KapéDoko
        </button>
      </div>
    </div>
  </form>
</template>

<script lang="ts" setup>
import AdminMultiSearchPicker from '~/components/admin/AdminMultiSearchPicker.vue'
import AdminSearchPicker from '~/components/admin/AdminSearchPicker.vue'
import CafeDetailContent from '~/components/cafe/CafeDetailContent.vue'
import type { AdminPickerOption } from '~/utils/admin-picker'
import type { Cafe } from '~/types/cafe'
import type { ShopRow } from '~/types/shop'
import { KAPEDOKO_APP_LOGO_SRC } from '~/utils/logo'
import { mapShopToCafe, UNKNOWN_WORK } from '~/utils/shop-mapper'
import {
  CAFE_THEME_PRESETS,
  DEFAULT_CAFE_BACKGROUND_HEX,
  DEFAULT_CAFE_BUTTON_HEX,
  DEFAULT_CAFE_TEXT_HEX,
  cafeThemeCafeError,
  cafeThemeDraftError,
  cafeThemeLede,
  cafeThemeShopIds,
  cafeThemeStyle,
  formatCafeThemeHex,
  parseCafeThemeHex,
  type CafeThemePreset,
  type CafeThemeScope,
} from '~/utils/cafe-theme'

const props = withDefaults(
  defineProps<{
    cafes: ShopRow[]
    kind?: 'owner' | 'admin'
    saving?: boolean
    formError?: string
    pickerOptions?: AdminPickerOption[]
    pickerStatus?: 'idle' | 'loading' | 'ready' | 'error'
    publicBase?: string
  }>(),
  {
    kind: 'owner',
    saving: false,
    formError: '',
    pickerOptions: () => [],
    pickerStatus: 'ready',
    publicBase: '',
  },
)

const emit = defineEmits<{
  stamp: [payload: {
    shopIds: string[]
    buttonHex: string | null
    textHex: string | null
    backgroundHex: string | null
  }]
}>()

const buttonDraft = ref('')
const textDraft = ref('')
const backgroundDraft = ref('')
const scope = ref<CafeThemeScope>('one')
const oneId = ref('')
const severalIds = ref<string[]>([])
const issues = ref('')

const primaryButtonClass = computed(() => (props.kind === 'admin' ? 'admin-btn' : 'owner-btn'))
const ghostButtonClass = computed(() => (props.kind === 'admin' ? 'admin-btn admin-btn--ghost' : 'owner-btn owner-btn--ghost'))

const availableIds = computed(() => props.cafes.map((shop) => shop.id))
const selectedIds = computed(() => cafeThemeShopIds({
  availableIds: availableIds.value,
  scope: props.cafes.length > 1 ? scope.value : 'one',
  oneId: props.cafes.length === 1 ? (props.cafes[0]?.id ?? '') : oneId.value,
  severalIds: severalIds.value,
}))
const selectedCafes = computed(() => props.cafes.filter((shop) => selectedIds.value.includes(shop.id)))
const allSelected = computed(() => props.cafes.length > 0 && severalIds.value.length === props.cafes.length)

const parsedButton = computed(() => parseCafeThemeHex(buttonDraft.value))
const parsedText = computed(() => parseCafeThemeHex(textDraft.value))
const parsedBackground = computed(() => parseCafeThemeHex(backgroundDraft.value))
const buttonSwatch = computed(() => parsedButton.value || DEFAULT_CAFE_BUTTON_HEX)
const textSwatch = computed(() => parsedText.value || DEFAULT_CAFE_TEXT_HEX)
const backgroundSwatch = computed(() => parsedBackground.value || DEFAULT_CAFE_BACKGROUND_HEX)
const faceStyle = computed(() => cafeThemeStyle(parsedButton.value, parsedText.value, parsedBackground.value))

const previewCafe = computed<Cafe>(() => {
  const shop = selectedCafes.value[0] ?? props.cafes[0] ?? null
  const cafe = shop
    ? mapShopToCafe(shop, null, props.publicBase)
    : ghostCafe()
  return {
    ...cafe,
    themeButtonHex: parsedButton.value,
    themeTextHex: parsedText.value,
    themeBackgroundHex: parsedBackground.value,
  }
})

function ghostCafe(): Cafe {
  return {
    id: 'theme-preview',
    name: 'Your cafe',
    address: 'Pick a cafe to preview its page.',
    image: KAPEDOKO_APP_LOGO_SRC,
    photos: [KAPEDOKO_APP_LOGO_SRC],
    open: true,
    status: 'Open',
    hoursHint: 'Open now',
    amenities: 'none',
    work: { ...UNKNOWN_WORK },
    popular: false,
    rating: 0,
    ratingLabel: '—',
    busyness: null,
    checkIns30d: 0,
    reviews: [],
    lat: 14.6,
    lng: 121,
    markerTier: 'standard',
    badges: [],
    vibeTags: [],
  }
}

function formatOrKeep(value: string): string {
  return formatCafeThemeHex(value) || value.trim()
}

const onColorInput = (well: 'button' | 'text' | 'background', event: Event) => {
  const value = formatCafeThemeHex((event.target as HTMLInputElement).value)
  if (well === 'button') buttonDraft.value = value || buttonDraft.value
  else if (well === 'text') textDraft.value = value || textDraft.value
  else backgroundDraft.value = value || backgroundDraft.value
}

function applyPreset(preset: CafeThemePreset) {
  buttonDraft.value = preset.buttonHex ?? ''
  textDraft.value = preset.textHex ?? ''
  backgroundDraft.value = preset.backgroundHex ?? ''
  issues.value = ''
}

function presetActive(preset: CafeThemePreset): boolean {
  return (parsedButton.value ?? null) === (preset.buttonHex ? parseCafeThemeHex(preset.buttonHex) : null)
    && (parsedText.value ?? null) === (preset.textHex ? parseCafeThemeHex(preset.textHex) : null)
    && (parsedBackground.value ?? null) === (preset.backgroundHex ? parseCafeThemeHex(preset.backgroundHex) : null)
}

function resetKapé() {
  applyPreset(CAFE_THEME_PRESETS[0]!)
}

function toggleAll() {
  severalIds.value = allSelected.value ? [] : props.cafes.map((shop) => shop.id)
}

watch(
  () => selectedIds.value.join(','),
  () => {
    if (selectedCafes.value.length !== 1) return
    const shop = selectedCafes.value[0]
    if (!shop) return
    buttonDraft.value = formatCafeThemeHex(shop.theme_button_hex)
    textDraft.value = formatCafeThemeHex(shop.theme_text_hex)
    backgroundDraft.value = formatCafeThemeHex(shop.theme_background_hex)
  },
  { immediate: true },
)

watch(
  () => props.cafes.map((shop) => shop.id).join(','),
  (ids) => {
    if (!oneId.value && props.cafes[0]) oneId.value = props.cafes[0].id
    severalIds.value = severalIds.value.filter((id) => ids.includes(id))
  },
  { immediate: true },
)

const onStamp = () => {
  issues.value = cafeThemeDraftError(buttonDraft.value, textDraft.value, backgroundDraft.value)
    ?? cafeThemeCafeError(selectedIds.value)
    ?? ''
  if (issues.value) return
  emit('stamp', {
    shopIds: selectedIds.value,
    buttonHex: parsedButton.value,
    textHex: parsedText.value,
    backgroundHex: parsedBackground.value,
  })
}
</script>

<style scoped>
.theme-studio {
  display: grid;
  gap: 20px;
}

.theme-studio__bag {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.theme-studio__bag-label,
.theme-studio__label,
.theme-studio__select,
.theme-studio__one {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
}

.theme-studio__bag-frame {
  max-height: min(72vh, 820px);
  overflow: auto;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: var(--kd-stock);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--kd-ink) 8%, transparent);
}

.theme-studio__ink {
  display: grid;
  gap: 16px;
  align-content: start;
  min-width: 0;
}

.theme-studio__intro h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.theme-studio__intro p {
  margin: 6px 0 0;
  color: color-mix(in srgb, var(--kd-ink) 72%, var(--kd-stock));
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1.4;
}

.theme-studio__wells {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
  gap: 12px;
}

.theme-studio__well {
  display: grid;
  justify-items: start;
  gap: 8px;
  font-size: 0.75rem;
  font-weight: 700;
}

.theme-studio__swatch {
  position: relative;
  width: 64px;
  height: 64px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 999px;
  overflow: hidden;
  box-shadow: inset 0 -6px 0 color-mix(in srgb, var(--kd-ink) 8%, transparent);
  transition: background-color 180ms ease;
}

.theme-studio__swatch input[type='color'] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  opacity: 0;
  cursor: pointer;
}

.theme-studio__hex {
  width: 7.5rem;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: var(--kd-shelf);
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.theme-studio__hex:focus-visible,
.theme-studio__select select:focus-visible,
.theme-studio__swatch:focus-within {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.theme-studio__faces {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.theme-studio__face {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 16px;
  font-size: 0.7875rem;
  font-weight: 700;
}

.theme-studio__face--primary {
  border: 1px solid var(--cafe-button, var(--kd-accent));
  background: var(--cafe-button, var(--kd-accent));
  color: var(--cafe-on-button, var(--kd-ink));
  transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease;
}

.theme-studio__face--quiet {
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  background: var(--kd-stock);
}

.theme-studio__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.theme-studio__chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 999px;
  background: var(--kd-stock);
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.theme-studio__chip.is-active {
  border-color: var(--kd-ink);
  background: color-mix(in srgb, var(--kd-accent) 16%, var(--kd-stock));
}

.theme-studio__chip:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.theme-studio__chip-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
}

.theme-studio__scope,
.theme-studio__cafes,
.theme-studio__several {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}

.theme-studio__scope legend,
.theme-studio__cafes legend {
  padding: 0;
  margin-bottom: 4px;
  font-size: 0.75rem;
  font-weight: 700;
}

.theme-studio__scope-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.theme-studio__scope-row .owner-chip {
  cursor: pointer;
}

.theme-studio__one-name {
  min-height: 44px;
  display: flex;
  align-items: center;
  font-size: 0.95rem;
  font-weight: 400;
}

.theme-studio__select select {
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: var(--kd-shelf);
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.95rem;
}

.theme-studio__check {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  font-size: 0.7875rem;
  font-weight: 700;
}

.theme-studio__check input {
  width: 20px;
  height: 20px;
  accent-color: var(--kd-primary);
}

.theme-studio__error {
  margin: 0;
  color: var(--kd-destructive);
  font-size: 0.7875rem;
  font-weight: 700;
}

.theme-studio__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

@media (min-width: 840px) {
  .theme-studio {
    grid-template-columns: minmax(260px, 24rem) minmax(0, 1fr);
    align-items: start;
  }

  .theme-studio__bag {
    order: 2;
    position: sticky;
    top: 12px;
  }

  .theme-studio__ink {
    order: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .theme-studio__swatch,
  .theme-studio__face--primary {
    transition: none;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
