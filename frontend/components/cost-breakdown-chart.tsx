"use client"

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import type { CostSegment } from "@/types/analytics"
import { useLanguage } from "@/context/language-context"
import { formatCurrency } from "@/lib/format"

const chartConfig = {
  value: {
    label: "Cost",
  },
}

interface CostBreakdownChartProps {
  data: CostSegment[]
}

const colorPalette = [
  "hsl(var(--chart-3))",
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-4))",
]

export function CostBreakdownChart({ data }: CostBreakdownChartProps) {
  const { language } = useLanguage()
  const chartData = data.map((segment, index) => ({
    name: segment.segment,
    value: segment.value,
    color: colorPalette[index % colorPalette.length],
  }))

  return (
    <div className="space-y-4">
      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </ChartContainer>
      <div className="grid grid-cols-3 gap-4">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            <div>
              <p className="text-xs text-muted-foreground">{item.name}</p>
              <p className="text-sm font-semibold text-foreground">
                {formatCurrency(item.value, language, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
