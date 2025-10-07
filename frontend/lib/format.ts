import type { Language } from "@/lib/translations"

export function getLocale(language: Language): string {
  return language === "fr" ? "fr-FR" : "en-GB"
}

export function formatCurrency(value: number, language: Language, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(getLocale(language), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
    ...options,
  }).format(value)
}

export function formatNumber(value: number, language: Language, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(getLocale(language), {
    maximumFractionDigits: 2,
    ...options,
  }).format(value)
}

export function formatDate(value: string | number | Date, language: Language, options?: Intl.DateTimeFormatOptions) {
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat(getLocale(language), {
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  }).format(date)
}
