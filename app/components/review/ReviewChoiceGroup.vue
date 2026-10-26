<template>
  <fieldset class="choice" :disabled="disabled">
    <legend v-if="legend" class="choice__legend">{{ legend }}</legend>
    <div
      class="choice__list"
      role="radiogroup"
      :aria-label="legend || ariaLabel"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="choice__option"
        :class="{ 'is-on': option.value === modelValue }"
        role="radio"
        :disabled="disabled"
        :aria-checked="option.value === modelValue ? 'true' : 'false'"
        @click="onPick(option.value)"
      >
        <span v-if="$slots.icon" class="choice__icon" aria-hidden="true">
          <slot name="icon" :option="option" :selected="option.value === modelValue" />
        </span>
        <span class="choice__copy">
          <span class="choice__label">{{ option.label }}</span>
          <span v-if="option.hint" class="choice__hint">{{ option.hint }}</span>
        </span>
      </button>
    </div>
  </fieldset>
</template>

<script lang="ts" setup generic="T extends string">
import type { ReviewChoice } from '~/utils/cafe-review'

const props = defineProps<{
  options: ReviewChoice<T>[]
  modelValue: T | null
  legend?: string
  ariaLabel?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()

const onPick = (value: T) => {
  if (props.disabled) return
  emit('update:modelValue', value)
}
</script>

<style scoped>
.choice {
  margin: 0;
  padding: 0;
  border: 0;
  min-width: 0;
}

.choice__legend {
  margin: 0 0 10px;
  color: var(--kd-ink);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.25;
}

.choice__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.choice__option {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 10px 16px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #faf8f5;
  color: var(--kd-ink);
  font-family: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: color 180ms cubic-bezier(0.16, 1, 0.3, 1);
}

.choice__option::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: var(--kd-accent);
  transform: scaleX(0);
  transform-origin: left center;
  transition: transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
}

.choice__option.is-on {
  border-color: var(--kd-accent);
  color: var(--kd-ink);
}

.choice__option.is-on::before {
  transform: scaleX(1);
}

.choice__icon,
.choice__copy {
  position: relative;
}

.choice__icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
}

.choice__copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.choice__label {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
}

.choice__hint {
  color: inherit;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
}

.choice__option:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.choice__option.is-on:focus-visible {
  outline-color: var(--kd-ink);
  box-shadow: 0 0 0 4px var(--kd-primary);
}

.choice__option:active {
  transform: scale(0.98);
  transition: transform 100ms cubic-bezier(0.16, 1, 0.3, 1);
}

.choice:disabled .choice__option {
  opacity: 0.55;
  cursor: not-allowed;
}

:root.is-android .choice__option {
  min-height: 48px;
}

@media (hover: hover) and (pointer: fine) {
  .choice__option:hover:not(.is-on):not(:disabled) {
    background: color-mix(in srgb, var(--kd-ink) 6%, #faf8f5);
  }
}

@media (prefers-reduced-motion: reduce) {
  .choice__option,
  .choice__option::before {
    transition: none;
  }

  .choice__option:active {
    transform: none;
  }
}
</style>
