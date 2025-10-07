"use client"

import { useTransition } from "react"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { deleteDataset } from "@/lib/api-client"
import { useLanguage } from "@/context/language-context"
import { useAuth } from "@/context/auth-context"

interface DeleteDatasetButtonProps {
  datasetId: number
  onDeleted?: () => void
}

export function DeleteDatasetButton({ datasetId, onDeleted }: DeleteDatasetButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { t } = useLanguage()
  const [isPending, startTransition] = useTransition()
  const { accessToken } = useAuth()

  const label = (t("uploadHistory.deleteLabel") as string) ?? "Delete"
  const confirmMessage = (t("uploadHistory.deleteConfirm") as string) ?? "Delete this dataset?"
  const successMessage = (t("uploadHistory.deleteSuccess") as string) ?? "Dataset deleted."
  const errorMessage = (t("uploadHistory.deleteError") as string) ?? "Unable to delete dataset."

  const onDelete = () => {
    if (!window.confirm(confirmMessage)) {
      return
    }

    startTransition(async () => {
      try {
        await deleteDataset(datasetId, accessToken ?? undefined)
        toast({
          title: successMessage,
        })
        onDeleted?.()
        router.refresh()
      } catch (error) {
        toast({
          title: errorMessage,
          description: error instanceof Error ? error.message : undefined,
          variant: "destructive",
        })
      }
    })
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-2 text-destructive"
      disabled={isPending}
      onClick={onDelete}
    >
      <Trash2 className="h-4 w-4" />
      {label}
    </Button>
  )
}
