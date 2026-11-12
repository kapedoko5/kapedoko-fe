<template>
  <OwnerConfirmDialog
    :open="Boolean(dialog)"
    :title="dialog?.title || ''"
    :message="dialog?.message || ''"
    :confirm-label="dialog?.confirmLabel || 'Continue'"
    :cancel-label="dialog?.cancelLabel || 'Cancel'"
    :busy-label="dialog?.busyLabel || 'Working…'"
    :variant="dialog?.variant || 'default'"
    :alert="dialog?.alert || false"
    :busy="dialog?.busy || false"
    @confirm="accept"
    @cancel="dismiss"
  />
</template>

<script lang="ts" setup>
import OwnerConfirmDialog from '~/components/owner-portal/OwnerConfirmDialog.vue'

const { dialog, accept, dismiss } = useOwnerConfirm()

onBeforeUnmount(() => {
  dismiss()
})
</script>
