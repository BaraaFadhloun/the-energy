"use client"

import type React from "react"

import { useState } from "react"
import { Upload, CheckCircle2, Loader2 } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { uploadDataset } from "@/lib/api-client"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { useLanguage } from "@/context/language-context"
import { useAuth } from "@/context/auth-context"

export function DataUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const router = useRouter()
  const { t } = useLanguage()
  const copy = t<any>("dataUpload")
  const { accessToken } = useAuth()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setIsUploading(true)
    let succeeded = false
    try {
      await uploadDataset(file, accessToken ?? undefined)
      setFile(null)
      router.prefetch("/analytics")
      router.push("/analytics")
      succeeded = true
      toast({
        title: copy.toastSuccessTitle,
        description: copy.toastSuccessDescription,
      })
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : ""
      let message = rawMessage
      if (rawMessage.trim().startsWith("{") || rawMessage.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(rawMessage)
          if (parsed && typeof parsed === "object") {
            message =
              ("detail" in parsed && typeof parsed.detail === "string" && parsed.detail) ||
              ("message" in parsed && typeof parsed.message === "string" && parsed.message) ||
              ("error" in parsed && typeof parsed.error === "string" && parsed.error) ||
              copy.toastGenericDescription
          }
        } catch {
          message = copy.toastGenericDescription
        }
      }

      if (message.toLowerCase().includes("duplicate")) {
        message = copy.toastDuplicateDescription
      }

      if (!message) {
        message = copy.toastGenericDescription
      }

      toast({
        title: copy.toastErrorTitle,
        description: message,
        variant: "destructive",
      })
    } finally {
      if (!succeeded) {
        setIsUploading(false)
      }
    }

    if (succeeded) {
      setIsUploading(false)
    }
  }

  return (
    <>
      <Card className="border-border">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold text-foreground">{copy.cardTitle}</CardTitle>
          <CardDescription className="text-muted-foreground">{copy.cardDescription}</CardDescription>
        </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="group relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border bg-muted/30 p-10 text-center transition-all hover:border-primary/50 hover:bg-muted/50">
            <div className="rounded-full bg-primary/10 p-4 transition-colors group-hover:bg-primary/20">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{copy.dropLabel}</p>
              <p className="text-xs text-muted-foreground">{copy.dropHelper}</p>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            {file && (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-1.5 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {copy.readyLabel}: {file.name}
                </span>
              </div>
            )}
          </div>
          <Button className="relative h-11 w-full font-medium" disabled={!file || isUploading} onClick={handleUpload}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {copy.uploadButtonBusy}
              </>
            ) : (
              copy.uploadButtonIdle
            )}
          </Button>
          <div className="rounded-xl border border-border bg-muted/50 p-4">
            <p className="mb-2.5 text-xs font-semibold text-foreground">{copy.formatTitle}</p>
            <code className="block font-mono text-xs leading-relaxed text-muted-foreground">
              date,time,kwh,cost
              <br />
              2025-03-01,07:00,18.5,500
              <br />
              2025-03-01,19:00,22.1,597
            </code>
          </div>
        </div>
        </CardContent>
      </Card>
      {isUploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-6 py-4 shadow-lg">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div className="space-y-1 text-left">
              <p className="text-sm font-semibold text-foreground">{copy.modalTitle}</p>
              <p className="text-xs text-muted-foreground">{copy.modalDescription}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
