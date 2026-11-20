<template>
  <IonPage>
    <AdminShell
      title="Price marks"
      lede="Set which typical menu prices print ₱, ₱₱, or ₱₱₱ on cafe cards and cafe pages. Budget-friendly stamps follow the ₱ cutoff."
      :status="pageStatus"
      :error="pageError"
    >
      <form class="admin-panel admin-form" @submit.prevent="onSave">
        <label class="admin-field admin-span">
          ₱ up to
          <input
            v-model="budgetDraft"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="5"
            required
            placeholder="99"
          />
        </label>
        <p class="admin-meta admin-span">Cafes at this price and below show ₱. They also get the Budget-friendly stamp.</p>

        <label class="admin-field admin-span">
          ₱₱ up to
          <input
            v-model="midDraft"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="5"
            required
            placeholder="184"
          />
        </label>
        <p class="admin-meta admin-span">Cafes above ₱ and through this show ₱₱. ₱₱₱ starts at the next peso.</p>

        <p v-if="issues" class="admin-error admin-span">{{ issues }}</p>

        <div class="admin-span">
          <p class="admin-label">Preview</p>
          <ul class="price-mark-preview">
            <li>
              <span aria-hidden="true">₱</span>
              {{ preview.budget }}
            </li>
            <li>
              <span aria-hidden="true">₱₱</span>
              {{ preview.mid }}
            </li>
            <li>
              <span aria-hidden="true">₱₱₱</span>
              {{ preview.specialty }}
            </li>
          </ul>
        </div>

        <div class="admin-span admin-row-actions">
          <p v-if="formError" class="admin-error" role="alert">{{ formError }}</p>
          <button class="admin-btn" type="submit" :disabled="saving" :aria-busy="saving || undefined">
            <AdminBusyLabel :busy="saving">
              {{ saving ? 'Saving…' : 'Save marks' }}
            </AdminBusyLabel>
          </button>
        </div>
      </form>
    </AdminShell>
  </IonPage>
</template>

<script lang="ts" setup>
import AdminBusyLabel from '~/components/admin/AdminBusyLabel.vue'
import AdminShell from '~/components/admin/AdminShell.vue'
import { adminActionErrorMessage } from '~/utils/admin-feedback'
import { menuPriceError, parseMenuPricePhp } from '~/utils/admin-vibe-tags'
import {
  cafePriceMarksError,
  cafePriceMarksPreview,
  missingCafePriceMarksSqlCopy,
  type CafePriceMarks,
} from '~/utils/cafe-price-marks'

definePageMeta({
  middleware: ['auth', 'admin'],
})

const toast = useAdminToast()
const { marks, status, error, load, save } = useCafePriceMarks()

const budgetDraft = ref('')
const midDraft = ref('')
const saving = ref(false)
const formError = ref('')

const syncDraft = (next: CafePriceMarks) => {
  budgetDraft.value = String(next.budgetMaxPhp)
  midDraft.value = String(next.midMaxPhp)
}

const parsedDraft = computed<CafePriceMarks | null>(() => {
  const budget = parseMenuPricePhp(budgetDraft.value)
  const mid = parseMenuPricePhp(midDraft.value)
  if (budget == null || mid == null) return null
  return { budgetMaxPhp: budget, midMaxPhp: mid }
})

const issues = computed(() => {
  if (!budgetDraft.value.trim() || !midDraft.value.trim()) return null
  if (!parsedDraft.value) {
    return menuPriceError(budgetDraft.value) || menuPriceError(midDraft.value) || 'Enter both cutoffs as whole pesos.'
  }
  return cafePriceMarksError(parsedDraft.value)
})

const preview = computed(() => cafePriceMarksPreview(parsedDraft.value ?? marks.value))

const pageStatus = computed(() => (status.value === 'idle' ? 'loading' : status.value))
const pageError = computed(() => {
  if (!error.value) return ''
  return missingCafePriceMarksSqlCopy(error.value) || error.value
})

watch(marks, (next) => {
  if (saving.value) return
  if (!budgetDraft.value && !midDraft.value) syncDraft(next)
}, { immediate: true })

onMounted(async () => {
  const loaded = await load(true)
  syncDraft(loaded)
})

const onSave = async () => {
  formError.value = ''
  const next = parsedDraft.value
  if (!next) {
    formError.value = menuPriceError(budgetDraft.value) || menuPriceError(midDraft.value) || 'Enter both cutoffs as whole pesos.'
    return
  }
  const invalid = cafePriceMarksError(next)
  if (invalid) {
    formError.value = invalid
    return
  }
  saving.value = true
  try {
    const saved = await save(next)
    syncDraft(saved)
    toast.success('Price marks saved', `₱ through ₱${saved.budgetMaxPhp}. ₱₱ through ₱${saved.midMaxPhp}. Budget-friendly follows ₱.`)
  } catch (err) {
    formError.value = adminActionErrorMessage(err, 'Could not save price marks.')
    toast.error('Could not save price marks', formError.value)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.price-mark-preview {
  display: grid;
  gap: 8px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.price-mark-preview li {
  display: flex;
  align-items: baseline;
  gap: 12px;
  font-size: 14px;
  font-weight: 700;
}

.price-mark-preview span {
  min-width: 2.75rem;
  letter-spacing: 0.04em;
}
</style>
