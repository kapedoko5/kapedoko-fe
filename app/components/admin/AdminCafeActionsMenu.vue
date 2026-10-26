<template>
  <div class="cafe-menu">
    <button
      :id="triggerId"
      ref="triggerEl"
      type="button"
      class="cafe-menu__trigger"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-controls="menuId"
      :aria-label="`Actions for ${shop.name}`"
      :disabled="busy"
      @click.stop="emit('toggle')"
    >
      <Ellipsis :size="20" :stroke-width="2.25" aria-hidden="true" />
    </button>
    <Teleport to="body">
      <div v-if="open && visible" class="cafe-menu__layer" :class="{ 'is-sheet': sheet }">
        <div v-if="sheet" class="cafe-menu__scrim" @click="emit('close')" />
        <div
          :id="menuId"
          ref="menuEl"
          class="cafe-menu__list"
          :class="{ 'is-sheet': sheet }"
          role="menu"
          :aria-labelledby="triggerId"
          :style="sheet ? undefined : menuStyle"
          @keydown="onKeydown"
        >
          <template v-for="(action, index) in actions" :key="action">
            <div v-if="action === 'delete' && index > 0" class="cafe-menu__rule" role="separator" />
            <NuxtLink
              v-if="action === 'edit'"
              :id="itemId(index)"
              role="menuitem"
              class="cafe-menu__item"
              :to="`/admin/cafes/${shop.id}`"
              @click="emit('close')"
            >
              {{ cafeDeskActionLabel(action) }}
            </NuxtLink>
            <button
              v-else
              :id="itemId(index)"
              type="button"
              role="menuitem"
              class="cafe-menu__item"
              :class="{ 'is-danger': cafeDeskActionTone(action) === 'danger' }"
              :disabled="busy"
              @click="emit('select', action)"
            >
              {{ cafeDeskActionLabel(action) }}
            </button>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts" setup>
import { Ellipsis } from 'lucide-vue-next'
import type { ShopRow } from '~/types/shop'
import {
  cafeDeskActionLabel,
  cafeDeskActions,
  cafeDeskActionTone,
  type CafeDeskAction,
} from '~/utils/admin-shop'

const props = defineProps<{
  shop: ShopRow
  open: boolean
  busy?: boolean
}>()

const emit = defineEmits<{
  toggle: []
  close: []
  select: [action: Exclude<CafeDeskAction, 'edit'>]
}>()

const triggerEl = ref<HTMLButtonElement | null>(null)
const menuEl = ref<HTMLElement | null>(null)
const sheet = ref(false)
const visible = ref(false)
const menuStyle = ref<Record<string, string>>({})
const uid = useId()
const triggerId = `kd-cafe-menu-trigger-${uid}`
const menuId = `kd-cafe-menu-${uid}`
const actions = computed(() => cafeDeskActions(props.shop.status))
const itemId = (index: number) => `${menuId}-item-${index}`

const items = () => {
  if (!menuEl.value) return []
  return [...menuEl.value.querySelectorAll<HTMLElement>('[role="menuitem"]')]
}

const place = () => {
  const trigger = triggerEl.value
  const menu = menuEl.value
  if (!trigger || !menu || sheet.value) return
  const rect = trigger.getBoundingClientRect()
  const width = menu.offsetWidth
  const height = menu.offsetHeight
  let top = rect.bottom + 4
  let left = rect.right - width
  if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 4)
  if (left < 8) left = 8
  if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8)
  menuStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
  }
}

const measureSheet = () => {
  sheet.value = window.innerWidth < 768
}

const triggerIsVisible = () => Boolean(triggerEl.value?.getClientRects().length)

let scroller: HTMLElement | null = null

const onReposition = () => {
  measureSheet()
  if (!props.open) return
  if (!triggerIsVisible()) {
    visible.value = false
    emit('close')
    return
  }
  const rect = triggerEl.value?.getBoundingClientRect()
  if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) {
    emit('close')
    return
  }
  void nextTick(place)
}

const onDocumentPointer = (event: PointerEvent) => {
  if (!props.open) return
  const target = event.target as Node | null
  if (triggerEl.value?.contains(target) || menuEl.value?.contains(target)) return
  emit('close')
}

const onDocumentKey = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !props.open) return
  event.preventDefault()
  emit('close')
  triggerEl.value?.focus()
}

const onKeydown = (event: KeyboardEvent) => {
  const nodes = items()
  if (nodes.length === 0) return
  const index = nodes.findIndex((node) => node === document.activeElement)
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
    triggerEl.value?.focus()
    return
  }
  if (event.key === 'Home' || (event.key === 'ArrowDown' && index < 0)) {
    event.preventDefault()
    nodes[0]?.focus()
    return
  }
  if (event.key === 'End') {
    event.preventDefault()
    nodes[nodes.length - 1]?.focus()
    return
  }
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    nodes[(index + 1) % nodes.length]?.focus()
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    nodes[(index - 1 + nodes.length) % nodes.length]?.focus()
  }
}

watch(() => props.open, async (open) => {
  if (!import.meta.client) return
  if (!open) {
    visible.value = false
    document.removeEventListener('pointerdown', onDocumentPointer, true)
    document.removeEventListener('keydown', onDocumentKey, true)
    window.removeEventListener('resize', onReposition)
    window.removeEventListener('scroll', onReposition, true)
    scroller?.removeEventListener('scroll', onReposition)
    scroller = null
    return
  }
  measureSheet()
  visible.value = triggerIsVisible()
  if (!visible.value) return
  document.addEventListener('pointerdown', onDocumentPointer, true)
  document.addEventListener('keydown', onDocumentKey, true)
  window.addEventListener('resize', onReposition)
  window.addEventListener('scroll', onReposition, true)
  const content = triggerEl.value?.closest('ion-content') as (HTMLElement & { getScrollElement?: () => Promise<HTMLElement> }) | null
  if (content?.getScrollElement) {
    scroller = await content.getScrollElement()
    scroller.addEventListener('scroll', onReposition, { passive: true })
  }
  await nextTick()
  place()
  await nextTick()
  items()[0]?.focus()
})

onMounted(() => {
  if (import.meta.client) measureSheet()
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointer, true)
  document.removeEventListener('keydown', onDocumentKey, true)
  window.removeEventListener('resize', onReposition)
  window.removeEventListener('scroll', onReposition, true)
  scroller?.removeEventListener('scroll', onReposition)
})
</script>

<style scoped>
.cafe-menu {
  display: flex;
  justify-content: flex-end;
}

.cafe-menu__trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 16%, transparent);
  border-radius: 16px;
  background: transparent;
  color: var(--kd-ink);
  cursor: pointer;
}

.cafe-menu__trigger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--kd-ink) 6%, #faf8f5);
}

.cafe-menu__trigger:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.cafe-menu__trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.cafe-menu__layer {
  position: fixed;
  inset: 0;
  z-index: 30;
  pointer-events: none;
}

.cafe-menu__layer.is-sheet {
  pointer-events: auto;
}

.cafe-menu__scrim {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--kd-ink) 46%, transparent);
}

.cafe-menu__list {
  position: fixed;
  z-index: 31;
  display: flex;
  flex-direction: column;
  min-width: 196px;
  padding: 8px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  font-family: 'Kumbh Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  pointer-events: auto;
  caret-color: var(--kd-primary);
}

.cafe-menu__list.is-sheet {
  right: 16px;
  bottom: max(16px, env(safe-area-inset-bottom));
  left: 16px;
  min-width: 0;
  padding: 12px;
}

.cafe-menu__item {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--kd-ink);
  font: inherit;
  font-size: 0.7875rem;
  font-weight: 700;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.cafe-menu__item.is-danger {
  color: var(--kd-destructive);
}

.cafe-menu__item:hover:not(:disabled),
.cafe-menu__item:focus-visible {
  background: color-mix(in srgb, var(--kd-ink) 6%, #faf8f5);
}

.cafe-menu__item.is-danger:hover:not(:disabled),
.cafe-menu__item.is-danger:focus-visible {
  background: color-mix(in srgb, var(--kd-destructive) 10%, #faf8f5);
}

.cafe-menu__item:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: -2px;
}

.cafe-menu__item:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.cafe-menu__rule {
  height: 1px;
  margin: 6px 8px;
  background: color-mix(in srgb, var(--kd-ink) 14%, transparent);
}

.cafe-menu__list ::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}
</style>
