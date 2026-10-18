"use client"

import { useTransition } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/**
 * Asks before running a delete action. Opened from a "…" menu, so it has no
 * trigger of its own. The action reports its own outcome as a message.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  action,
  onDeleted,
  confirmLabel = "Delete",
  pendingLabel = "Deleting…",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  action: () => Promise<{ success?: boolean; message: string }>
  onDeleted?: () => void
  /** The button's text, e.g. "Undo" for an action that isn't a delete. */
  confirmLabel?: string
  pendingLabel?: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => !pending && onOpenChange(next)}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Keep</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={(event) => {
              // Stay open until the server answers.
              event.preventDefault()
              startTransition(async () => {
                const result = await action()
                if (result.success) {
                  toast.success(result.message)
                  onDeleted?.()
                } else {
                  toast.error(result.message)
                }
                onOpenChange(false)
              })
            }}
          >
            {pending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
