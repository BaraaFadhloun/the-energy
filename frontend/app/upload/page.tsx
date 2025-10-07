"use client"

import { Header } from "@/components/header"
import { DataUpload } from "@/components/data-upload"
import { AuthGuard } from "@/components/auth-guard"
import { useLanguage } from "@/context/language-context"

export default function UploadPage() {
  const { t } = useLanguage()
  const content = t<any>("uploadPage")

  return (
    <div suppressHydrationWarning className="min-h-screen bg-background">
      <Header />
      <AuthGuard>
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-bold text-foreground">{content.title}</h1>
              <p className="text-muted-foreground text-lg">{content.description}</p>
            </div>
            <DataUpload />
          </div>
        </main>
      </AuthGuard>
    </div>
  )
}
