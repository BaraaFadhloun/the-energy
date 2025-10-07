"use client"

import Link from "next/link"
import { ArrowRight, Leaf, Lightbulb, Sparkles, TrendingDown, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useLanguage } from "@/context/language-context"
import { cn } from "@/lib/utils"
import type { AnalyticsSummary, Recommendation } from "@/types/analytics"

interface AIRecommendationsProps {
  summary: AnalyticsSummary
}

const badgePalette = [
  "text-success bg-success/10",
  "text-primary bg-primary/10",
  "text-accent bg-accent/10",
  "text-muted-foreground bg-muted/20",
]

const recommendationVisualMeta: Record<
  string,
  {
    icon: typeof TrendingDown
    gradient: string
    color: string
  }
> = {
  cost_saving: {
    icon: TrendingDown,
    gradient: "from-success/20 via-success/10 to-success/20",
    color: "text-success",
  },
  co2_reduction: {
    icon: Leaf,
    gradient: "from-emerald-200/30 via-emerald-200/20 to-emerald-300/40",
    color: "text-success",
  },
  efficiency: {
    icon: Zap,
    gradient: "from-primary/15 via-accent/10 to-primary/25",
    color: "text-primary",
  },
}

function getLocalizedContent(rec: Recommendation, language: "fr" | "en") {
  const content = rec.content
  if (content) {
    const localized = language === "fr" ? content.fr ?? content.en : content.en ?? content.fr
    if (localized) {
      return localized
    }
  }
  return {
    title: rec.category,
    impact: rec.impact.value,
    tips: rec.tips.length ? rec.tips : [rec.category],
  }
}

export function AIRecommendations({ summary }: AIRecommendationsProps) {
  const { language, t } = useLanguage()
  const copy = t<any>("aiRecommendationsCopy") ?? {}
  const recommendations = summary.recommendations ?? []

  return (
    <Card className="relative h-full overflow-hidden border border-border/60 bg-gradient-to-b from-background via-background to-muted/40">
      <div className="pointer-events-none absolute -top-24 right-[-4rem] h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
      <CardHeader className="pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-primary/25 to-accent/20 p-2.5 shadow-sm">
              <Lightbulb className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-foreground">{copy?.title ?? "AI Recommendations"}</CardTitle>
              <CardDescription className="text-muted-foreground">
                {copy?.description ?? "Curated improvements driven by your latest usage trends."}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Button
              asChild
              variant="outline"
              className="gap-2 rounded-full border-primary/40 bg-background/70 px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-transform hover:-translate-y-0.5 hover:border-primary/60"
            >
              <Link href="/chat" aria-label={copy?.chatAria ?? "Open the conversational assistant"}>
                <Sparkles className="h-4 w-4" />
                {copy?.chatCta ?? "Chat with your data"}
              </Link>
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {summary.badges.map((badge, index) => (
            <span
              key={badge.label}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
                badgePalette[index % badgePalette.length],
                "backdrop-blur",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {badge.label}: {badge.value}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {recommendations.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            {language === "fr"
              ? "Importer davantage de données pour activer les recommandations."
              : "Upload more data to unlock tailored recommendations."}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {recommendations.map((rec) => {
              const visual = recommendationVisualMeta[rec.category] ?? recommendationVisualMeta.efficiency
              const Icon = visual.icon
              const localized = getLocalizedContent(rec, language)

              return (
                <div
                  key={`${rec.category}-${localized.title}`}
                  className="flex h-full flex-col rounded-2xl border border-border/60 bg-gradient-to-br from-background/85 to-background/60 p-5 shadow-sm transition-transform hover:-translate-y-0.5 hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("rounded-xl bg-gradient-to-br p-2.5 shadow-inner", visual.gradient)}>
                        <Icon className={cn("h-4 w-4", visual.color)} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{localized.title}</h4>
                        <p className="text-xs text-muted-foreground">{localized.impact}</p>
                      </div>
                    </div>
                  </div>
                  <Separator className="my-4 bg-border/60" />
                  <ul className="mt-auto space-y-3">
                    {localized.tips.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-3 rounded-xl bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                        <ArrowRight className="mt-1 h-3.5 w-3.5 text-primary" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
