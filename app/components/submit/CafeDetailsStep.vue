<template>
  <section class="details" aria-labelledby="details-title">
    <div class="details__intro">
      <h2 id="details-title">{{ showPrice ? 'Hours, a number, and a peso range' : 'Hours and a number to call' }}</h2>
      <p class="details__lede">
        {{ showPrice
          ? 'Hours are required. A phone number and a typical menu price are optional.'
          : 'Hours are required. A phone number is optional.' }}
      </p>
    </div>

    <label class="details__field">
      <span>Calling number</span>
      <input
        :value="phone"
        type="tel"
        name="phone"
        inputmode="tel"
        autocomplete="tel"
        placeholder="0917 123 4567"
        :aria-invalid="Boolean(phoneIssue)"
        :aria-describedby="phoneIssue ? 'details-phone-error' : undefined"
        @input="emit('update:phone', ($event.target as HTMLInputElement).value)"
      />
    </label>
    <p v-if="phoneIssue" id="details-phone-error" class="details__error" role="alert">
      {{ phoneIssue }}
    </p>

    <label v-if="showPrice" class="details__field">
      <span>Menu price range (₱)</span>
      <span class="details__peso">
        <span class="details__peso-mark" aria-hidden="true">₱</span>
        <input
          :value="price"
          type="text"
          name="menu-price"
          inputmode="numeric"
          autocomplete="off"
          placeholder="200"
          :aria-invalid="Boolean(priceIssue)"
          :aria-describedby="priceIssue ? 'details-price-error' : 'details-price-hint'"
          @input="emit('update:price', ($event.target as HTMLInputElement).value)"
        />
      </span>
    </label>
    <p v-if="showPrice && !priceIssue" id="details-price-hint" class="details__hint">
      Typical drink or plate people order.
    </p>
    <p v-if="showPrice && priceIssue" id="details-price-error" class="details__error" role="alert">
      {{ priceIssue }}
    </p>

    <div class="details__hours">
      <p class="details__hours-label" id="hours-label">Opening hours</p>

      <label class="details__check">
        <input
          type="checkbox"
          :checked="allDay"
          @change="onAllDay(($event.target as HTMLInputElement).checked)"
        />
        Open 24 hours
      </label>

      <div v-if="!allDay && sameEveryDay" class="details__times">
        <label class="details__time">
          <span>Opens</span>
          <input
            :value="openTime"
            type="time"
            @input="emit('update:openTime', ($event.target as HTMLInputElement).value)"
          />
        </label>
        <label class="details__time">
          <span>Closes</span>
          <input
            :value="closeTime"
            type="time"
            @input="emit('update:closeTime', ($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>

      <p v-if="hoursIssue" class="details__error" role="alert">{{ hoursIssue }}</p>

      <button
        type="button"
        class="details__toggle"
        :aria-expanded="!sameEveryDay"
        @click="toggleDays"
      >
        {{ sameEveryDay ? 'Edit days' : 'Use the same hours every day' }}
      </button>

      <div v-if="!sameEveryDay" class="details__days" role="group" aria-labelledby="hours-label">
        <div v-for="day in DAY_KEYS" :key="day" class="details__day">
          <p class="details__day-name">{{ DAY_LABELS[day] }}</p>
          <div class="details__day-controls">
            <select
              :value="weekly[day].kind"
              :aria-label="`${DAY_LABELS[day]} hours`"
              @change="setKind(day, ($event.target as HTMLSelectElement).value)"
            >
              <option value="open">Open</option>
              <option value="all_day">24 hours</option>
              <option value="closed">Closed</option>
            </select>
            <template v-if="weekly[day].kind === 'open'">
              <input
                :value="weekly[day].open"
                type="time"
                :aria-label="`${DAY_LABELS[day]} opening time`"
                @input="setOpen(day, ($event.target as HTMLInputElement).value)"
              />
              <input
                :value="weekly[day].close"
                type="time"
                :aria-label="`${DAY_LABELS[day]} closing time`"
                @input="setClose(day, ($event.target as HTMLInputElement).value)"
              />
            </template>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { DAY_KEYS, DAY_LABELS, type DayHours, type DayKey, type WeeklyHours } from '~/types/shop'
import { allDayEveryDay, sameHoursEveryDay } from '~/utils/hours'

const props = withDefaults(defineProps<{
  phone: string
  sameEveryDay: boolean
  allDay: boolean
  openTime: string
  closeTime: string
  weekly: WeeklyHours
  phoneIssue?: string | null
  hoursIssue?: string | null
  showPrice?: boolean
  price?: string
  priceIssue?: string | null
}>(), {
  phoneIssue: null,
  hoursIssue: null,
  showPrice: false,
  price: '',
  priceIssue: null,
})

const emit = defineEmits<{
  'update:phone': [value: string]
  'update:price': [value: string]
  'update:sameEveryDay': [value: boolean]
  'update:allDay': [value: boolean]
  'update:openTime': [value: string]
  'update:closeTime': [value: string]
  'update:weekly': [value: WeeklyHours]
}>()

const syncWeekly = (allDay: boolean, openTime: string, closeTime: string) => {
  emit('update:weekly', allDay ? allDayEveryDay() : sameHoursEveryDay(openTime, closeTime))
}

const onAllDay = (checked: boolean) => {
  emit('update:allDay', checked)
  if (props.sameEveryDay) syncWeekly(checked, props.openTime, props.closeTime)
}

const toggleDays = () => {
  const next = !props.sameEveryDay
  emit('update:sameEveryDay', next)
  if (next) syncWeekly(props.allDay, props.openTime, props.closeTime)
}

const patchDay = (day: DayKey, value: DayHours) => {
  emit('update:weekly', { ...props.weekly, [day]: value })
}

const setKind = (day: DayKey, kind: string) => {
  if (kind === 'closed') {
    patchDay(day, { kind: 'closed' })
    return
  }
  if (kind === 'all_day') {
    patchDay(day, { kind: 'all_day' })
    return
  }
  const current = props.weekly[day]
  patchDay(day, {
    kind: 'open',
    open: current.kind === 'open' ? current.open : props.openTime,
    close: current.kind === 'open' ? current.close : props.closeTime,
  })
}

const setOpen = (day: DayKey, open: string) => {
  const current = props.weekly[day]
  if (current.kind !== 'open') return
  patchDay(day, { ...current, open })
}

const setClose = (day: DayKey, close: string) => {
  const current = props.weekly[day]
  if (current.kind !== 'open') return
  patchDay(day, { ...current, close })
}

watch(
  () => [props.sameEveryDay, props.allDay, props.openTime, props.closeTime] as const,
  ([same, allDay, openTime, closeTime]) => {
    if (same) syncWeekly(allDay, openTime, closeTime)
  },
)
</script>

<style scoped>
.details {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.details__intro {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.details h2 {
  margin: 0;
  color: var(--kd-ink);
  font-size: 1.325rem;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.details__lede {
  margin: 0;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  font-weight: 400;
  line-height: 1.3;
}

.details__field,
.details__time {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
}

.details__field input,
.details__time input,
.details__day select,
.details__day input {
  min-height: 44px;
  height: 44px;
  padding: 0 16px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #f2f2f2;
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 400;
  font-family: inherit;
  caret-color: var(--kd-primary);
}

.details__field input:focus,
.details__time input:focus,
.details__day select:focus,
.details__day input:focus {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.details__field input[aria-invalid='true'] {
  border-color: var(--kd-destructive);
}

.details__error,
.details__hint {
  margin: 0;
  font-size: 0.7875rem;
  line-height: 1.35;
}

.details__error {
  color: var(--kd-destructive);
  font-weight: 700;
}

.details__hint {
  color: color-mix(in srgb, var(--kd-ink) 68%, #faf8f5);
  font-weight: 400;
}

.details__peso {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: stretch;
  min-height: 44px;
  border: 1px solid color-mix(in srgb, var(--kd-ink) 22%, transparent);
  border-radius: 16px;
  background: #f2f2f2;
}

.details__peso:focus-within {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
}

.details__peso-mark {
  display: inline-flex;
  align-items: center;
  padding: 0 0 0 16px;
  color: var(--kd-ink);
  font-size: 0.95rem;
  font-weight: 700;
}

.details__peso input {
  min-height: 44px;
  height: 44px;
  padding: 0 16px 0 8px;
  border: 0;
  border-radius: 16px;
  background: transparent;
}

.details__peso input:focus {
  outline: none;
}

.details__field:has(.details__peso) input[aria-invalid='true'] {
  border: 0;
}

.details__field:has(.details__peso[aria-invalid='true']),
.details__peso:has(input[aria-invalid='true']) {
  border-color: var(--kd-destructive);
}

.details__hours-label {
  margin: 0 0 8px;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
}

.details__check {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  color: var(--kd-ink);
  font-size: 0.7875rem;
  font-weight: 700;
}

.details__check input {
  width: 20px;
  height: 20px;
  accent-color: var(--kd-primary);
}

.details__times {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 10px;
}

.details__toggle {
  margin-top: 8px;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--kd-primary);
  font-size: 0.7875rem;
  font-weight: 700;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.details__days {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 8px;
}

.details__day-name {
  margin: 0 0 6px;
  color: var(--kd-ink);
  font-size: 0.75rem;
  font-weight: 700;
  line-height: 1.3;
}

.details__day-controls {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}

.details__day-controls:has(input) {
  grid-template-columns: minmax(96px, 0.9fr) 1fr 1fr;
}

.details__toggle:focus-visible,
.details__check input:focus-visible {
  outline: 2px solid var(--kd-primary);
  outline-offset: 2px;
  border-radius: 8px;
}

:root.is-android .details__field input,
:root.is-android .details__time input,
:root.is-android .details__day select,
:root.is-android .details__day input,
:root.is-android .details__peso,
:root.is-android .details__peso input {
  min-height: 48px;
  height: 48px;
}

@media (hover: hover) and (pointer: fine) {
  .details__toggle:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

::selection {
  background: var(--kd-accent);
  color: var(--kd-ink);
}
</style>
