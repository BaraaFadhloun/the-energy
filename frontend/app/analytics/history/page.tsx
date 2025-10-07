"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetchAnalyticsHistory } from "@/lib/api-client"
import { formatCurrency, formatDate, formatNumber } from "@/lib/format"
import type { DatasetRecord } from "@/types/analytics"
import { ArrowLeft, ArrowUpRight, Database } from "lucide-react"
import { DeleteDatasetButton } from "@/components/delete-dataset-button"
import { AuthGuard } from "@/components/auth-guard"
import { useAuth } from "@/context/auth-context"
import { useLanguage } from "@/context/language-context"

export default function AnalyticsHistoryPage() {
  const { accessToken } = useAuth()
  const { t, language } = useLanguage()
  const copy = useMemo(() => t<any>("uploadHistory"), [t])
  const [history, setHistory] = useState<DatasetRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) {
      setHistory([])
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    async function load() {
      try {
        const data = await fetchAnalyticsHistory(100, accessToken)
        if (!cancelled) {
          setHistory(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : ""
          setError(message || "Unable to load history.")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [accessToken])

  return (
    <div suppressHydrationWarning className="min-h-screen bg-background">
      <Header />
      <AuthGuard>
        <main className="container mx-auto px-4 py-8 space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Database className="h-3.5 w-3.5" />
                {copy.leadBadge}
              </div>
              <h1 className="text-3xl font-bold text-foreground">{copy.heading}</h1>
              <p className="text-muted-foreground">{copy.description}</p>
            </div>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/analytics">
                <ArrowLeft className="h-4 w-4" />
                {copy.backButton}
              </Link>
            </Button>
          </div>

          {isLoading ? (
            <div className="rounded-3xl border border-dashed border-border/60 bg-muted/30 p-10 text-center text-muted-foreground">
              {copy.loading}
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-10 text-center">
              <h2 className="text-2xl font-semibold text-destructive">{copy.tableTitle}</h2>
              <p className="mt-2 text-sm text-destructive/80">{error}</p>
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/60 bg-muted/30 p-10 text-center">
              <h2 className="text-2xl font-semibold text-foreground">{copy.emptyTitle}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{copy.emptyDescription}</p>
            </div>
          ) : (
            <div className="rounded-3xl border border-border/60 bg-card/80 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">{copy.columns.uploadedAt}</TableHead>
                    <TableHead>{copy.columns.file}</TableHead>
                    <TableHead className="text-right">{copy.columns.totalKwh}</TableHead>
                    <TableHead className="text-right">{copy.columns.totalCost}</TableHead>
                    <TableHead className="text-right">{copy.columns.totalCo2}</TableHead>
                    <TableHead className="text-right">{copy.columns.rows}</TableHead>
                    <TableHead className="text-right">{copy.columns.actions}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.uploaded_at, language)}</TableCell>
                      <TableCell className="font-medium text-foreground">{entry.original_filename}</TableCell>
                      <TableCell className="text-right">{formatNumber(entry.total_kwh, language)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.total_cost, language)}</TableCell>
                      <TableCell className="text-right">{formatNumber(entry.total_co2, language)}</TableCell>
                      <TableCell className="text-right">{formatNumber(entry.row_count, language, { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button asChild size="sm" variant="ghost" className="gap-2 text-primary">
                            <Link href={`/analytics/history/${entry.id}`}>
                              {copy.viewDetail}
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>
                          </Button>
                          <DeleteDatasetButton
                            datasetId={entry.id}
                            onDeleted={() =>
                              setHistory((prev) => prev.filter((item) => item.id !== entry.id))
                            }
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </main>
      </AuthGuard>
    </div>
  )
}
