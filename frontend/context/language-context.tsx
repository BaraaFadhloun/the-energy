"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"

import type { Language } from "@/lib/translations"
import { getTranslation, translations } from "@/lib/translations"

type TranslationValue = string | number | ((...args: any[]) => string | number)

interface LanguageContextValue {
  language: Language
  toggleLanguage: () => void
  setLanguage: (language: Language) => void
  t: <T extends TranslationValue>(path: string) => T
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const LANGUAGE_STORAGE_KEY = "energy-insight-language"

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("fr")

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null
    if (stored && stored in translations) {
      setLanguageState(stored)
    }
  }, [])

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language
    }
  }, [language])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
    }
  }

  const toggleLanguage = () => {
    setLanguage(language === "fr" ? "en" : "fr")
  }

  const value = useMemo<LanguageContextValue>(() => {
    return {
      language,
      toggleLanguage,
      setLanguage,
      t: (path) => getTranslation(language, path) as TranslationValue,
    }
  }, [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider")
  }
  return context
}
