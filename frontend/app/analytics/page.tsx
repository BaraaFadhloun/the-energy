"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Download, List, Loader2 } from "lucide-react"

import { Header } from "@/components/header"
import { StatsCards } from "@/components/stats-cards"
import { ChartsSection } from "@/components/charts-section"
import { AIRecommendations } from "@/components/ai-recommendations"
import { Button } from "@/components/ui/button"
import { AuthGuard } from "@/components/auth-guard"
import { fetchAnalyticsSummary } from "@/lib/api-client"
import type { AnalyticsSummary } from "@/types/analytics"
import { useLanguage } from "@/context/language-context"
import { useAuth } from "@/context/auth-context"
import { useToast } from "@/components/ui/use-toast"
import { formatCurrency, formatDate, formatNumber } from "@/lib/format"
import type { Language } from "@/lib/translations"

export default function AnalyticsPage() {
  const { t, language } = useLanguage()
  const { accessToken } = useAuth()
  const { toast } = useToast()
  const copy = t<any>("analyticsPage")
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!accessToken) {
      setAnalytics(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    async function load() {
      try {
        const data = await fetchAnalyticsSummary(accessToken)
        if (!cancelled) {
          setAnalytics(data)
        }
      } catch {
        if (!cancelled) {
          setAnalytics(null)
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

  const handleExportReport = () => {
    if (!analytics) {
      toast({ title: copy.exportUnavailable, variant: "destructive" })
      return
    }

    setIsExporting(true)
    try {
      const csvContent = buildReportCsv(analytics, language)
      const fileName = `energy-insight-report-${new Date().toISOString().split("T")[0]}.csv`
      downloadCsv(csvContent, fileName)
      toast({ title: copy.exportSuccess })
    } catch (error) {
      const message = error instanceof Error ? error.message : ""
      toast({ title: copy.exportError, description: message, variant: "destructive" })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div suppressHydrationWarning className="min-h-screen bg-background">
      <Header />
      <AuthGuard>
        <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground">{copy.title}</h1>
            <p className="text-muted-foreground">{copy.description}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="gap-2 bg-transparent">
              <Link href="/analytics/history" className="inline-flex items-center gap-2">
                <List className="h-4 w-4" />
                {copy.historyButton}
              </Link>
            </Button>
            <Button
              className="gap-2"
              disabled={!analytics || isExporting}
              onClick={handleExportReport}
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {copy.exportButton}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-dashed border-border/60 bg-muted/30 p-8 text-center text-muted-foreground">
            {copy.loading}
          </div>
        ) : analytics ? (
          <>
            <StatsCards stats={analytics.stats} />
            <div className="space-y-6">
              <AIRecommendations summary={analytics} />
              <ChartsSection usage={analytics.usage} costSegments={analytics.cost_breakdown} />
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-border/60 bg-muted/30 p-8 text-center">
            <h2 className="text-2xl font-semibold text-foreground">{copy.emptyTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{copy.emptyDescription}</p>
          </div>
        )}
        </main>
      </AuthGuard>
    </div>
  )
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function buildReportCsv(summary: AnalyticsSummary, language: Language): string {
  const lines: string[] = []

  lines.push(csvLine("Section", "Metric", "Value"))

  summary.stats.forEach((stat) => {
    const numericValue =
      typeof stat.value === "number"
        ? stat.value
        : typeof stat.value === "string"
        ? Number(stat.value.replace(/[^\d.-]/g, ""))
        : Number.NaN
    const isCost = stat.title.toLowerCase().includes("cost")
    const valueString = Number.isFinite(numericValue)
      ? isCost
        ? formatCurrency(Number(numericValue), language)
        : formatNumber(Number(numericValue), language)
      : String(stat.value)
    const metricValue = stat.unit ? `${valueString} ${stat.unit}`.trim() : valueString
    lines.push(csvLine("Stat", stat.title, metricValue))
    lines.push(csvLine("Stat", `${stat.title} change`, `${stat.change} (${stat.trend})`))
  })

  if (summary.badges.length) {
    lines.push("")
    lines.push(csvLine("Badges", "Label", "Value"))
    summary.badges.forEach((badge) => {
      lines.push(csvLine("Badge", badge.label, badge.value))
    })
  }

  if (summary.cost_breakdown.length) {
    lines.push("")
    lines.push(csvLine("Cost Breakdown", "Segment", "Value"))
    summary.cost_breakdown.forEach((segment) => {
      lines.push(csvLine("Cost Breakdown", segment.segment, formatCurrency(segment.value, language)))
    })
  }

  if (summary.usage.length) {
    lines.push("")
    lines.push(csvLine("Usage", "Date", "kWh"))
    summary.usage.forEach((point) => {
      lines.push(csvLine("Usage", point.date, formatNumber(point.kwh, language)))
    })
  }

  if (summary.recommendations.length) {
    lines.push("")
    lines.push(csvLine("Recommendation", "Title", "Details"))
    summary.recommendations.forEach((rec, index) => {
      const localized = rec.content?.[language] ?? rec.content?.en
      const title = localized?.title ?? `${rec.category} #${index + 1}`
      const impact = localized?.impact ?? rec.impact.value
      const tips = (localized?.tips ?? rec.tips ?? []).join(" | ")
      lines.push(csvLine("Recommendation", title, impact))
      if (tips) {
        lines.push(csvLine("Recommendation", `${title} tips`, tips))
      }
    })
  }

  if (summary.insights) {
    const insights = summary.insights
    lines.push("")
    lines.push(csvLine("Insights", "Metric", "Value"))
    lines.push(
      csvLine(
        "Insight",
        "Peak day",
        `${formatDate(insights.peak_day.date, language, { dateStyle: "medium" })} — ${formatNumber(
          insights.peak_day.kwh,
          language,
        )} kWh / ${formatCurrency(insights.peak_day.cost, language)}`,
      ),
    )
    if (insights.weekend_vs_weekday) {
      const cmp = insights.weekend_vs_weekday
      lines.push(
        csvLine(
          "Insight",
          "Weekend avg cost per kWh",
          formatCurrency(cmp.weekend_avg_cost_per_kwh, language),
        ),
      )
      lines.push(
        csvLine(
          "Insight",
          "Weekday avg cost per kWh",
          formatCurrency(cmp.weekday_avg_cost_per_kwh, language),
        ),
      )
      lines.push(
        csvLine(
          "Insight",
          "Weekend avg daily cost",
          formatCurrency(cmp.weekend_avg_daily_cost, language),
        ),
      )
      lines.push(
        csvLine(
          "Insight",
          "Weekday avg daily cost",
          formatCurrency(cmp.weekday_avg_daily_cost, language),
        ),
      )
    }
    if (insights.quarter_usage) {
      const q = insights.quarter_usage
      lines.push(
        csvLine(
          "Insight",
          "Quarter usage delta",
          `${q.start_label}: ${formatNumber(q.start_kwh, language)} kWh → ${q.end_label}: ${formatNumber(
            q.end_kwh,
            language,
          )} kWh (Δ ${formatNumber(q.delta_kwh, language)} kWh)` +
            (q.delta_percent != null ? ` (${formatNumber(q.delta_percent, language)}%)` : ""),
        ),
      )
    }
    if (insights.top_expensive_days.length) {
      insights.top_expensive_days.forEach((day, idx) => {
        lines.push(
          csvLine(
            "Insight",
            `Top expensive day #${idx + 1}`,
            `${formatDate(day.date, language, { dateStyle: "medium" })} — ${formatCurrency(
              day.cost,
              language,
            )}`,
          ),
        )
      })
    }
    if (insights.peak_window) {
      const window = insights.peak_window
      lines.push(
        csvLine(
          "Insight",
          "Peak window",
          `${window.start_hour}h-${window.end_hour}h — ${formatNumber(window.avg_kwh_per_day, language)} kWh/day`,
        ),
      )
    }
    lines.push(
      csvLine(
        "Insight",
        "Average cost per kWh",
        formatCurrency(insights.average_cost_per_kwh, language),
      ),
    )
    lines.push(csvLine("Insight", "Shift opportunity (kWh)", formatNumber(insights.shift_kwh, language)))
    lines.push(csvLine("Insight", "Days covered", formatNumber(insights.days_covered, language)))
    lines.push(
      csvLine("Insight", "CO₂ factor (kg/kWh)", formatNumber(insights.co2_factor, language, { maximumFractionDigits: 3 })),
    )
  }

  return lines.join("\r\n")
}

function csvLine(...values: Array<string | number>): string {
  return values.map(escapeCsvValue).join(",")
}

function escapeCsvValue(value: string | number): string {
  const text = String(value ?? "").replace(/\r?\n|\r/g, " ").trim()
  if (text === "") return ""
  const escaped = text.replace(/"/g, '""')
  return /[,";]/.test(escaped) ? `"${escaped}"` : escaped
}
