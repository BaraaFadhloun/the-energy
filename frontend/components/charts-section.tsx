"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UsageChart } from "@/components/usage-chart"
import { CostBreakdownChart } from "@/components/cost-breakdown-chart"
import type { CostSegment, UsagePoint } from "@/types/analytics"

interface ChartsSectionProps {
  usage: UsagePoint[]
  costSegments: CostSegment[]
}

export function ChartsSection({ usage, costSegments }: ChartsSectionProps) {
  return (
    <Card className="border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-bold text-foreground">Energy Analytics</CardTitle>
        <CardDescription className="text-muted-foreground">
          Visualize your consumption patterns and cost trends over time
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="usage" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger
              value="usage"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Daily Usage
            </TabsTrigger>
            <TabsTrigger
              value="cost"
              className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              Cost Breakdown
            </TabsTrigger>
          </TabsList>
          <TabsContent value="usage" className="space-y-4 mt-0">
            <UsageChart data={usage} />
          </TabsContent>
          <TabsContent value="cost" className="space-y-4 mt-0">
            <CostBreakdownChart data={costSegments} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
