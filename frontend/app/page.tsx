"use client"

import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { ArrowRight, BarChart3, Lightbulb, TrendingDown, Zap, Shield, Clock } from "lucide-react"
import Link from "next/link"
import { useLanguage } from "@/context/language-context"

export default function HomePage() {
  const { t } = useLanguage()
  const home = t<any>("home")
  const features = home.features
  const pillars = home.pillars

  return (
    <div suppressHydrationWarning className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto space-y-20">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Zap className="h-3.5 w-3.5" />
              {home.badge}
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground text-balance leading-tight">
              {home.heroTitleLine1},
              <br />
              <span className="text-primary">{home.heroTitleLine2}</span>
            </h1>
            <p className="text-xl text-muted-foreground text-pretty max-w-2xl mx-auto leading-relaxed">
              {home.heroDescription}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-8 hover:border-primary/50 transition-all">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">{features.analytics.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{features.analytics.description}</p>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-8 hover:border-primary/50 transition-all">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Lightbulb className="h-6 w-6 text-accent" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">{features.recommendations.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{features.recommendations.description}</p>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-8 hover:border-primary/50 transition-all">
              <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-success" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">{features.co2.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{features.co2.description}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold text-foreground">{home.ctaSectionTitle}</h2>
              <p className="text-muted-foreground text-lg">{home.ctaSectionDescription}</p>
            </div>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/upload">
                <Button size="lg" className="gap-2 h-12 px-8 text-base font-medium">
                  {home.ctaPrimary}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/analytics">
                <Button variant="outline" size="lg" className="gap-2 h-12 px-8 text-base font-medium bg-transparent">
                  {home.ctaSecondary}
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 pt-8 border-t border-border">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h4 className="font-medium text-foreground">{pillars.secure.title}</h4>
                <p className="text-sm text-muted-foreground">{pillars.secure.description}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h4 className="font-medium text-foreground">{pillars.instant.title}</h4>
                <p className="text-sm text-muted-foreground">{pillars.instant.description}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h4 className="font-medium text-foreground">{pillars.formats.title}</h4>
                <p className="text-sm text-muted-foreground">{pillars.formats.description}</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
