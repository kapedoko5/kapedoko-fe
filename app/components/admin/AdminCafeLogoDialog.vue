<template>
  <section
    v-if="shop"
    :id="dialogId"
    class="logo-pad"
    role="region"
    :aria-labelledby="titleId"
    :aria-busy="saving || undefined"
  >
    <div class="logo-pad__mast">
      <div class="logo-pad__copy">
        <h2 :id="titleId" class="logo-pad__title">Stamp a logo</h2>
        <p class="logo-pad__lede">
          <AdminBusyLabel :busy="saving">{{ currentCopy }}</AdminBusyLabel>
        </p>
        <p class="logo-pad__stamp" role="status">{{ stampCopy }}</p>
      </div>
      <button type="button" class="logo-pad__done" :disabled="saving" @click="emit('close')">
        Done
      </button>
    </div>

    <div class="logo-pad__current">
      <img
        class="logo-pad__preview"
        :class="{ 'is-app': usingAppLogo }"
        :src="previewSrc"
        alt=""
        width="56"
        height="56"
        @error="onPreviewError"
      />
      <div class="logo-pad__actions">
        <button type="button" class="logo-pad__text" :disabled="saving" @click="pickFile">
          Upload image
        </button>
        <p v-if="fileIssue" class="logo-pad__error" role="alert">{{ fileIssue }}</p>
      </div>
    </div>

    <div v-if="$slots.ticks" class="logo-pad__ticks">
      <slot name="ticks" />
    </div>

    <label class="logo-pad__search">
      <span class="sr-only">Search cafes with logos</span>
      <input
        v-model="query"
        type="search"
        placeholder="Search cafes with logos"
        autocomplete="off"
        :disabled="saving"
      />
    </label>

    <p v-if="status === 'loading'" class="logo-pad__status" role="status">Loading cafe logos…</p>
    <p v-else-if="status === 'error'" class="logo-pad__error" role="alert">
      Could not load existing logos.
    </p>
    <p v-else-if="sources.length === 0" class="logo-pad__status">No saved cafe logos yet. Upload one above.</p>
    <p v-else-if="filtered.length === 0" class="logo-pad__status">No cafes match that search.</p>
    <ul
      v-else
      class="logo-pad__marks"
      role="listbox"
      aria-label="Uploaded cafe logos"
    >
      <li v-for="source in filtered" :key="source.logoObjectKey">
        <button
          type="button"
          class="logo-pad__mark"
          role="option"
          :aria-selected="source.logoObjectKey === currentKey"
          :disabled="saving"
          :title="uniqueLogoSourceLabel(source)"
          @click="choose(source)"
        >
          <img
            v-if="source.logoUrl && !broken[source.logoObjectKey]"
            :src="source.logoUrl"
            alt=""
            width="48"
            height="48"
            @error="broken[source.logoObjectKey] = true"
          />
          <span v-else class="logo-pad__fallback" aria-hidden="true">
            <img :src="appLogo" alt="" width="32" height="32" />
          </span>
          <span class="logo-pad__mark-name">{{ source.name }}</span>
          <span v-if="source.cafeCount && source.cafeCount > 1" class="logo-pad__mark-count">
            {{ source.cafeCount }} cafes
          </span>
        </button>
      </li>
    </ul>

    <input
      ref="fileRef"
      class="sr-only"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      @change="onFile"
    />
  </section>
</template>

<script lang="ts" setup>
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import type { ShopRow } from '~/types/shop'
import {
  searchCafeLogoSources,
  shopCafeLogoSrc,
  stampLogoCopy,
  uniqueCafeLogoSources,
  uniqueLogoSourceLabel,
  type CafeLogoSource,
} from '~/utils/admin-logos'
import { isKapedokoMark, KAPEDOKO_APP_LOGO_SRC, logoFileError } from '~/utils/logo'

const props = withDefaults(defineProps<{
  shop: Pick<ShopRow, 'id' | 'name' | 'logo_object_key'> | null
  sources: CafeLogoSource[]
  status?: 'idle' | 'loading' | 'ready' | 'error'
  publicBase?: string
  saving?: boolean
  selectedCount?: number
}>(), {
  status: 'ready',
  publicBase: '',
  saving: false,
  selectedCount: 1,
})

const emit = defineEmits<{
  close: []
  assign: [payload: { logoFile: File | null; logoObjectKey: string | null }]
}>()

const uid = useId()
const dialogId = `${uid}-pad`
const titleId = `${uid}-title`
const fileRef = ref<HTMLInputElement | null>(null)
const query = ref('')
const fileIssue = ref<string | null>(null)
const previewBroken = ref(false)
const broken = reactive<Record<string, boolean>>({})
const appLogo = KAPEDOKO_APP_LOGO_SRC
const uniqueSources = computed(() => uniqueCafeLogoSources(props.sources))
const filtered = computed(() => searchCafeLogoSources(uniqueSources.value, query.value))
const currentKey = computed(() => props.shop?.logo_object_key ?? null)
const previewSrc = computed(() => {
  if (previewBroken.value) return KAPEDOKO_APP_LOGO_SRC
  return shopCafeLogoSrc(currentKey.value, props.publicBase)
})
const usingAppLogo = computed(() => previewBroken.value || isKapedokoMark(previewSrc.value))
const stampCopy = computed(() => stampLogoCopy(Math.max(1, props.selectedCount)))
const currentCopy = computed(() => {
  if (props.saving) return stampCopy.value.replace('Stamp onto', 'Stamping')
  return 'Tick cafes in the list, then upload a mark or pick one already in use.'
})

const onEscape = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !props.shop || props.saving) return
  event.preventDefault()
  emit('close')
}

const choose = (source: CafeLogoSource) => {
  if (props.saving) return
  emit('assign', { logoFile: null, logoObjectKey: source.logoObjectKey })
}

const pickFile = () => {
  if (props.saving) return
  fileRef.value?.click()
}

const onFile = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  if (!file) return
  const issue = logoFileError(file)
  if (issue) {
    fileIssue.value = issue
    return
  }
  fileIssue.value = null
  emit('assign', { logoFile: file, logoObjectKey: null })
}

const onPreviewError = () => {
  previewBroken.value = true
}

watch(
  () => props.shop?.id ?? null,
  (id) => {
    query.value = ''
    fileIssue.value = null
    previewBroken.value = false
    window.removeEventListener('keydown', onEscape)
    if (id) window.addEventListener('keydown', onEscape)
  },
  { immediate: true },
)

watch(
  () => props.shop?.logo_object_key,
  () => {
    previewBroken.value = false
  },
)

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEscape)
})
</script>

<style scoped>
.logo-pad {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0 0 16px;
  padding: 12px 16px 14px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  caret-color: var(--kd-primary);
  animation: logo-pad-in 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.logo-pad ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}

.logo-pad__mast {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.logo-pad__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.logo-pad__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.2;
}

.logo-pad__lede,
.logo-pad__status {
  margin: 0;
  color: color-mix(in srgb, var(--kd-ink) 78%, #faf8f5);
  font-size: 0.7875rem;
  font-weight: 400;
  line-height: 1.35;
}

.logo-pad__stamp {
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.35;
}

.logo-pad__current {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo-pad__preview {
  width: 56px;
  height: 56px;
  object-fit: contain;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 8px;
  background: #faf8f5;
  flex: 0 0 auto;
}

.logo-pad__preview.is-app {
  padding: 6px;
  box-sizing: border-box;
}

.logo-pad__actions,
.logo-pad__ticks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.logo-pad__search input {
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  border: 1px solid var(--kd-ink-10);
  border-radius: 8px;
  background: var(--kd-white);
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.95rem;
  caret-color: var(--kd-primary);
}

.logo-pad__search input::placeholder {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
}

.logo-pad__marks {
  display: flex;
  gap: 8px;
  margin: 0;
  padding: 0 0 4px;
  overflow-x: auto;
  list-style: none;
  scrollbar-color: color-mix(in srgb, var(--kd-ink) 28%, transparent) #faf8f5;
}

.logo-pad__mark {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 88px;
  min-height: 88px;
  padding: 8px 6px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--kd-ink);
  font: inherit;
  text-align: center;
  cursor: pointer;
}

.logo-pad__mark img,
.logo-pad__fallback {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: contain;
  background: #f2f2f2;
}

.logo-pad__fallback {
  display: grid;
  place-items: center;
}

.logo-pad__mark-name,
.logo-pad__mark-count {
  overflow: hidden;
  width: 100%;
  font-size: 0.75rem;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logo-pad__mark-name {
  font-weight: 700;
}

.logo-pad__mark-count {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
}

.logo-pad__mark[aria-selected='true'] {
  border-color: var(--kd-accent);
  background: color-mix(in srgb, var(--kd-accent) 16%, #faf8f5);
}

.logo-pad__text,
.logo-pad__done {
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  font-size: 0.7875rem;
  cursor: pointer;
}

.logo-pad__text {
  color: var(--kd-primary);
  font-weight: 700;
}

.logo-pad__done {
  flex: 0 0 auto;
  color: var(--kd-ink);
}

.logo-pad__error {
  margin: 0;
  color: var(--kd-destructive);
  font-size: 0.7875rem;
  font-weight: 700;
  line-height: 1.35;
}

.logo-pad__mark:focus-visible,
.logo-pad__text:focus-visible,
.logo-pad__done:focus-visible,
.logo-pad__search input:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.logo-pad__mark:disabled,
.logo-pad__text:disabled,
.logo-pad__done:disabled,
.logo-pad__search input:disabled {
  opacity: 0.55;
  cursor: wait;
}

@media (hover: hover) and (pointer: fine) {
  .logo-pad__mark:hover:not([aria-selected='true']):not(:disabled) {
    background: color-mix(in srgb, var(--kd-ink) 4%, #faf8f5);
  }

  .logo-pad__text:hover:not(:disabled),
  .logo-pad__done:hover:not(:disabled) {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

@keyframes logo-pad-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .logo-pad {
    animation: none;
  }
}

:root.is-android .logo-pad__search input,
:root.is-android .logo-pad__text,
:root.is-android .logo-pad__done {
  min-height: 48px;
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
