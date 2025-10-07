"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"

import { Header } from "@/components/header"
import { AIRecommendations } from "@/components/ai-recommendations"
import { ChartsSection } from "@/components/charts-section"
import { StatsCards } from "@/components/stats-cards"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fetchAnalyticsDataset } from "@/lib/api-client"
import { formatCurrency, formatDate, formatNumber } from "@/lib/format"
import type { DatasetDetail } from "@/types/analytics"
import { ArrowLeft, Download, Table as TableIcon } from "lucide-react"
import { AuthGuard } from "@/components/auth-guard"
import { useAuth } from "@/context/auth-context"
import { useLanguage } from "@/context/language-context"

export default function DatasetDetailPage() {
  const params = useParams<{ datasetId: string }>()
  const datasetId = Number(params?.datasetId)
  const invalidId = Number.isNaN(datasetId) || datasetId <= 0
  const { accessToken } = useAuth()
  const { t, language } = useLanguage()
  const copy = useMemo(() => t<any>("datasetDetail"), [t])

  const [detail, setDetail] = useState<DatasetDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (invalidId || !accessToken) {
      setDetail(null)
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    async function load() {
      try {
        const data = await fetchAnalyticsDataset(datasetId, accessToken)
        if (!cancelled) {
          setDetail(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : ""
          setError(message || copy.error)
          setDetail(null)
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
  }, [datasetId, accessToken, copy.error, invalidId])

  return (
    <div suppressHydrationWarning className="min-h-screen bg-background">
      <Header />
      <AuthGuard>
        <main className="container mx-auto px-4 py-8 space-y-8">
          {invalidId && (
            <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-10 text-center">
              <h2 className="text-2xl font-semibold text-destructive">{copy.notFound}</h2>
            </div>
          )}

          {!invalidId && isLoading ? (
            <div className="rounded-3xl border border-dashed border-border/60 bg-muted/30 p-10 text-center text-muted-foreground">
              {copy.loading}
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-10 text-center">
              <h2 className="text-2xl font-semibold text-destructive">{copy.error}</h2>
              <p className="mt-2 text-sm text-destructive/80">{error}</p>
            </div>
          ) : detail ? (
            <>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                    <TableIcon className="h-3.5 w-3.5" />
                    {copy.badgePrefix}
                    {detail.dataset.id}
                  </div>
                  <h1 className="text-3xl font-bold text-foreground">{detail.dataset.original_filename}</h1>
                  <p className="text-muted-foreground">
                    {formatDate(detail.dataset.uploaded_at, language)} ·
                    {" "}
                    {formatNumber(detail.dataset.row_count, language, { maximumFractionDigits: 0 })}
                    {" "}
                    {copy.entriesLabel}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" className="gap-2">
                    <Link href="/analytics/history">
                      <ArrowLeft className="h-4 w-4" />
                      {copy.backButton}
                    </Link>
                  </Button>
                  <Button className="gap-2" disabled>
                    <Download className="h-4 w-4" />
                    {copy.exportLabel}
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm">
                  <p className="text-sm text-muted-foreground">{copy.totalEnergy}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {formatNumber(detail.dataset.total_kwh, language)} kWh
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm">
                  <p className="text-sm text-muted-foreground">{copy.totalCost}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {formatCurrency(detail.dataset.total_cost, language)}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/80 p-6 shadow-sm">
                  <p className="text-sm text-muted-foreground">{copy.totalCo2}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {formatNumber(detail.dataset.total_co2, language)}
                  </p>
                </div>
              </div>

              <StatsCards stats={detail.summary.stats} />

              <div className="space-y-6">
                <AIRecommendations summary={detail.summary} />
                <ChartsSection usage={detail.summary.usage} costSegments={detail.summary.cost_breakdown} />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-foreground">{copy.rowsTitle}</h2>
                  <p className="text-sm text-muted-foreground">
                    {detail.readings.length} {copy.entriesLabel}
                  </p>
                </div>
                <div className="rounded-3xl border border-border/60 bg-card/80 shadow-sm">
                  <Table>
                   <TableHeader>
                     <TableRow>
                        <TableHead>{language === "fr" ? "Date" : "Date"}</TableHead>
                        <TableHead className="text-right">{language === "fr" ? "Heure" : "Time"}</TableHead>
                        <TableHead className="text-right">kWh</TableHead>
                        <TableHead className="text-right">{language === "fr" ? "Coût" : "Cost"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.readings.map((row) => (
                        <TableRow key={`${row.reading_date}-${row.reading_time ?? "no-time"}-${row.kwh}-${row.cost}`}>
                          <TableCell className="font-medium text-foreground">{row.reading_date}</TableCell>
                          <TableCell className="text-right">{row.reading_time ?? "--"}</TableCell>
                          <TableCell className="text-right">{formatNumber(row.kwh, language, { maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.cost, language, { maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          ) : null}
        </main>
      </AuthGuard>
    </div>
  )
}
