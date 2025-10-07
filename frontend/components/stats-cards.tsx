"use client"

import type { ComponentType } from "react"

import { DollarSign, Leaf, TrendingUp, Zap } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { useLanguage } from "@/context/language-context"
import { formatCurrency, formatNumber } from "@/lib/format"
import type { StatCardData } from "@/types/analytics"

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  "Total Consumption": Zap,
  "Total Cost": DollarSign,
  "CO₂ Emission": Leaf,
  "Peak Usage Day": TrendingUp,
}

const changeTone: Record<StatCardData["change_type"], string> = {
  increase: "bg-warning/10 text-warning",
  decrease: "bg-success/10 text-success",
  neutral: "bg-muted text-muted-foreground",
}

interface StatsCardsProps {
  stats: StatCardData[]
}

export function StatsCards({ stats }: StatsCardsProps) {
  const { language, t } = useLanguage()
  const labels = (t<Record<string, string>>("statsTitles") as Record<string, string>) ?? {}

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = iconMap[stat.title] ?? Zap
        const translatedTitle = labels[stat.title] ?? stat.title

        let numericValue: number | null = null
        if (typeof stat.value === "number") {
          numericValue = stat.value
        } else if (typeof stat.value === "string") {
          const cleaned = Number(stat.value.replace(/[^\d.-]/g, ""))
          if (!Number.isNaN(cleaned)) {
            numericValue = cleaned
          }
        }

        const isCost = stat.title.toLowerCase().includes("cost")
        let displayValue: string | number = stat.value
        if (numericValue !== null) {
          displayValue = isCost
            ? formatCurrency(numericValue, language)
            : formatNumber(numericValue, language, { maximumFractionDigits: numericValue % 1 === 0 ? 0 : 1 })
        }

        return (
          <Card
            key={stat.title}
            className="relative overflow-hidden border-border hover:border-primary/50 transition-all"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{translatedTitle}</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-foreground tracking-tight">{displayValue}</p>
                  {stat.unit && <span className="text-sm font-medium text-muted-foreground">{stat.unit}</span>}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded ${changeTone[stat.change_type]}`}
                  >
                    {stat.change}
                  </span>
                  <span className="text-xs text-muted-foreground">{stat.trend}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
