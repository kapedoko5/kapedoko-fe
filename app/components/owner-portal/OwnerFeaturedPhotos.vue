<template>
  <section class="featured" aria-labelledby="featured-title">
    <div class="featured__intro">
      <h2 id="featured-title">Featured photos</h2>
      <p class="featured__lede">
        Up to {{ max }} photos. Visitors see these on the cafe page.
      </p>
    </div>

    <input
      ref="picker"
      class="featured__file"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      aria-labelledby="featured-title"
      @change="onPick"
    />

    <ul v-if="items.length" class="featured__grid">
      <li v-for="item in items" :key="item.key">
        <img :src="item.src" alt="" width="120" height="120" />
        <button type="button" class="featured__remove" @click="remove(item.key)">
          Remove
        </button>
      </li>
    </ul>

    <div class="featured__actions">
      <button type="button" class="featured__add" :disabled="items.length >= max" @click="pick">
        {{ items.length ? 'Add photos' : 'Choose photos' }}
      </button>
      <p class="featured__count">{{ items.length }} of {{ max }}</p>
    </div>
    <p v-if="issue" class="featured__error" role="alert">{{ issue }}</p>
  </section>
</template>

<script lang="ts" setup>
import { featuredPhotoCountError, featuredPhotoFileError, SHOP_GALLERY_MAX } from '~/utils/owner-ads'
import { publicObjectUrl } from '~/utils/shop-mapper'

export type FeaturedPhotoItem = {
  key: string
  src: string
  objectKey?: string
  file?: File
}

const props = withDefaults(defineProps<{
  objectKeys?: string[]
  issue?: string | null
  max?: number
}>(), {
  objectKeys: () => [],
  issue: null,
  max: SHOP_GALLERY_MAX,
})

const emit = defineEmits<{
  change: [payload: { files: File[]; objectKeys: string[] }]
  issue: [message: string | null]
}>()

const config = useRuntimeConfig()
const publicBase = String(config.public.r2PublicBaseUrl || '')
const picker = ref<HTMLInputElement | null>(null)
const items = ref<FeaturedPhotoItem[]>([])

const syncFromKeys = () => {
  items.value.forEach((item) => {
    if (item.file && item.src.startsWith('blob:')) URL.revokeObjectURL(item.src)
  })
  items.value = (props.objectKeys ?? []).flatMap((key) => {
    const src = publicObjectUrl(key, publicBase)
    return src ? [{ key, src, objectKey: key }] : []
  })
}

watch(() => props.objectKeys.slice().join('|'), syncFromKeys, { immediate: true })

const emitChange = () => {
  emit('change', {
    files: items.value.flatMap((item) => item.file ? [item.file] : []),
    objectKeys: items.value.flatMap((item) => item.file ? [] : (item.objectKey ? [item.objectKey] : [])),
  })
}

const pick = () => {
  picker.value?.click()
}

const onPick = (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (!files.length) return
  const room = props.max - items.value.length
  if (room <= 0) {
    emit('issue', featuredPhotoCountError(props.max + 1))
    return
  }
  const next = files.slice(0, room)
  for (const file of next) {
    const issue = featuredPhotoFileError(file)
    if (issue) {
      emit('issue', issue)
      return
    }
  }
  emit('issue', featuredPhotoCountError(items.value.length + next.length))
  items.value = [
    ...items.value,
    ...next.map((file) => ({
      key: `file:${file.name}:${file.size}:${file.lastModified}`,
      src: URL.createObjectURL(file),
      file,
    })),
  ]
  emitChange()
}

const remove = (key: string) => {
  const item = items.value.find((entry) => entry.key === key)
  if (item?.file && item.src.startsWith('blob:')) URL.revokeObjectURL(item.src)
  items.value = items.value.filter((entry) => entry.key !== key)
  emit('issue', null)
  emitChange()
}

onBeforeUnmount(() => {
  items.value.forEach((item) => {
    if (item.file && item.src.startsWith('blob:')) URL.revokeObjectURL(item.src)
  })
})
</script>

<style scoped>
.featured {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: #faf8f5;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 34%, transparent);
  border-radius: 16px;
}

.featured__intro {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.featured h2 {
  margin: 0;
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.featured__lede,
.featured__count,
.featured__error {
  margin: 0;
  font-size: 0.7875rem;
  line-height: 1.3;
}

.featured__lede,
.featured__count {
  color: color-mix(in srgb, var(--kd-ink) 72%, #faf8f5);
}

.featured__file {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.featured__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.featured__grid li {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.featured__grid img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 8px;
  background: #faf8f5;
}

.featured__remove,
.featured__add {
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-primary);
  font: inherit;
  font-size: 0.7875rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.featured__add:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.featured__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.featured__error {
  color: var(--kd-destructive);
  font-weight: 700;
}

.featured__add:focus-visible,
.featured__remove:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
  border-radius: 8px;
}

:root.is-android .featured__remove,
:root.is-android .featured__add {
  min-height: 48px;
}

::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}
</style>
