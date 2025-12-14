// ═══════════════════════════════════════════════════════════════
// CURRENCY CLIENT - Client-side utilities for currency management
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface CurrencyInfo {
  code: string
  symbol: string
  rate: number
  locale: string
}

// ─────────────────────────────────────────────────────────────────
// DEFAULT CURRENCIES (synchronous for client)
// ─────────────────────────────────────────────────────────────────

export const DEFAULT_CURRENCIES: Record<string, CurrencyInfo> = {
  fr: { code: 'EUR', symbol: '€', rate: 1.0, locale: 'fr-FR' },
  en: { code: 'USD', symbol: '$', rate: 1.10, locale: 'en-US' }, // 1 EUR = 1.10 USD
  es: { code: 'EUR', symbol: '€', rate: 1.0, locale: 'es-ES' },
  de: { code: 'EUR', symbol: '€', rate: 1.0, locale: 'de-DE' },
  it: { code: 'EUR', symbol: '€', rate: 1.0, locale: 'it-IT' },
  pt: { code: 'EUR', symbol: '€', rate: 1.0, locale: 'pt-PT' },
  nl: { code: 'EUR', symbol: '€', rate: 1.0, locale: 'nl-NL' },
}

export const DEFAULT_CURRENCY: CurrencyInfo = {
  code: 'EUR',
  symbol: '€',
  rate: 1.0,
  locale: 'fr-FR',
}

// ─────────────────────────────────────────────────────────────────
// CURRENCY DETECTION
// ─────────────────────────────────────────────────────────────────

/**
 * Détecte la langue depuis le navigateur
 */
export function detectBrowserLanguage(): string {
  if (typeof window === 'undefined') return 'fr'
  
  const lang = navigator.language || (navigator as any).userLanguage || 'fr'
  const langCode = lang.split('-')[0].toLowerCase()
  
  return DEFAULT_CURRENCIES[langCode] ? langCode : 'fr'
}

/**
 * Obtient la configuration de devise pour une langue
 */
export function getCurrencyForLanguage(languageCode: string): CurrencyInfo {
  return DEFAULT_CURRENCIES[languageCode] || DEFAULT_CURRENCY
}

/**
 * Obtient la devise actuelle basée sur la langue du navigateur
 */
export function getCurrentCurrency(): CurrencyInfo {
  const lang = detectBrowserLanguage()
  return getCurrencyForLanguage(lang)
}

// ─────────────────────────────────────────────────────────────────
// CONVERSION FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Convertit un montant en centimes EUR vers une autre devise
 */
export function convertFromEur(centsEur: number, exchangeRate: number): number {
  return Math.round(centsEur * exchangeRate)
}

/**
 * Convertit un montant d'une devise vers EUR
 */
export function convertToEur(centsTarget: number, exchangeRate: number): number {
  return Math.round(centsTarget / exchangeRate)
}

// ─────────────────────────────────────────────────────────────────
// FORMATTING FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Formate un montant en centimes dans la devise spécifiée
 */
export function formatCurrency(cents: number, currency: CurrencyInfo): string {
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
  }).format(cents / 100)
}

/**
 * Formate un montant en centimes EUR dans la devise de l'utilisateur
 * (Détecte automatiquement la langue et convertit)
 */
export function formatCredits(centsEur: number): string {
  const currency = getCurrentCurrency()
  const convertedCents = convertFromEur(centsEur, currency.rate)
  return formatCurrency(convertedCents, currency)
}

/**
 * Formate un montant en centimes EUR dans une devise spécifique
 */
export function formatCreditsWithCurrency(centsEur: number, currency: CurrencyInfo): string {
  const convertedCents = convertFromEur(centsEur, currency.rate)
  return formatCurrency(convertedCents, currency)
}

/**
 * Formate un prix simplifié (ex: "1.55€" ou "$1.70")
 */
export function formatPriceSimple(centsEur: number, currency?: CurrencyInfo): string {
  const curr = currency || getCurrentCurrency()
  const convertedCents = convertFromEur(centsEur, curr.rate)
  const amount = (convertedCents / 100).toFixed(2)
  
  // USD/GBP: symbole avant, EUR: symbole après
  if (curr.code === 'USD' || curr.code === 'GBP') {
    return `${curr.symbol}${amount}`
  }
  return `${amount}${curr.symbol}`
}

/**
 * Formate un prix avec juste le montant et le symbole de devise
 * Version compacte pour les badges, etc.
 */
export function formatPriceCompact(centsEur: number, currency?: CurrencyInfo): string {
  const curr = currency || getCurrentCurrency()
  const convertedCents = convertFromEur(centsEur, curr.rate)
  const amount = (convertedCents / 100).toFixed(2)
  
  if (curr.code === 'USD' || curr.code === 'GBP') {
    return `${curr.symbol}${amount}`
  }
  return `${amount}${curr.symbol}`
}
