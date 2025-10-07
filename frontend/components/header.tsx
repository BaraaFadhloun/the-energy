"use client"

import { Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useLanguage } from "@/context/language-context"
import { useAuth } from "@/context/auth-context"

export function Header() {
  const pathname = usePathname()
  const { toggleLanguage, t } = useLanguage()
  const { session, signOut } = useAuth()

  const nav = t<{ overview: string; upload: string; analytics: string; chat: string }>("header.nav")
  const brandTagline = t<string>("header.brandTagline")
  const toggleLabel = t<string>("header.toggleLabel")
  const toggleDescription = t<string>("header.toggleDescription")
  const authCopy = t<any>("auth")

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Energy Insight</h1>
              <p className="text-xs text-muted-foreground">{brandTagline}</p>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/"
              className={`text-sm font-medium transition-colors ${
                pathname === "/" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {nav.overview}
            </Link>
            <Link
              href="/upload"
              className={`text-sm font-medium transition-colors ${
                pathname === "/upload" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {nav.upload}
            </Link>
            <Link
              href="/analytics"
              className={`text-sm font-medium transition-colors ${
                pathname === "/analytics" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {nav.analytics}
            </Link>
            <Link
              href="/chat"
              className={`text-sm font-medium transition-colors ${
                pathname === "/chat" ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {nav.chat}
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {session ? (
              <Button variant="ghost" size="sm" onClick={signOut}>
                {authCopy.signOut}
              </Button>
            ) : (
              <>
                <Link href="/sign-up">
                  <Button size="sm" className="hidden sm:inline-flex">
                    {authCopy.createAccountCta}
                  </Button>
                </Link>
                <Link href="/sign-in">
                  <Button variant="ghost" size="sm">
                    {authCopy.signInCta}
                  </Button>
                </Link>
              </>
            )}
            <Button variant="outline" size="sm" onClick={toggleLanguage} aria-label={toggleDescription}>
              {toggleLabel}
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
