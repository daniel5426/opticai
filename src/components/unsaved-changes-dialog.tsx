import React from "react"
import { CustomModal } from "@/components/ui/custom-modal"

interface UnsavedChangesDialogProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function UnsavedChangesDialog({ open, onConfirm, onCancel }: UnsavedChangesDialogProps) {
  return (
    <CustomModal
      isOpen={open}
      onClose={onCancel}
      onConfirm={onConfirm}
      confirmText="עזיבה ללא שמירה"
      cancelText="המשך עריכה"
      title="שינויים שלא נשמרו"
      description="אם תעזוב עכשיו השינויים שביצעת יימחקו."
      showCloseButton={false}
    />
  )
}

