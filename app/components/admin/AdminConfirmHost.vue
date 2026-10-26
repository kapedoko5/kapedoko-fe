<template>
  <AdminConfirmDialog
    :open="Boolean(dialog)"
    :title="dialog?.title || ''"
    :message="dialog?.message || ''"
    :confirm-label="dialog?.confirmLabel || 'Continue'"
    :cancel-label="dialog?.cancelLabel || 'Cancel'"
    :busy-label="dialog?.busyLabel || 'Working…'"
    :variant="dialog?.variant || 'default'"
    :alert="dialog?.alert || false"
    :busy="dialog?.busy || false"
    :prompt-label="dialog?.promptLabel || ''"
    :prompt-value="dialog?.promptValue || ''"
    :prompt-error="dialog?.promptError || ''"
    :prompt-max="dialog?.promptMax || 280"
    @confirm="accept"
    @cancel="dismiss"
    @update:prompt-value="setPrompt"
  />
</template>

<script lang="ts" setup>
/**
 * Renders the shared admin confirm / alert dialog.
 * Pages open it with `useAdminConfirm().ask()` or `.alert()`.
 * Mounted once by `AdminShell` so every admin route can use it.
 */
import AdminConfirmDialog from '~/components/admin/AdminConfirmDialog.vue'

const { dialog, accept, dismiss, setPrompt } = useAdminConfirm()

onBeforeUnmount(() => {
  dismiss()
})
</script>
