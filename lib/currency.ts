// ═══════════════════════════════════════════════════════════════
// CURRENCY MANAGEMENT SYSTEM
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@/lib/supabase/server'

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface CurrencyConfig {
  id: string
  language_code: string // fr, en, es, de, etc.
  currency_code: string // EUR, USD, GBP, etc.
  currency_symbol: string // €, $, £, etc.
  exchange_rate: number // Taux par rapport à EUR (base = 1.0)
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CurrencyInfo {
  code: string
  symbol: string
  rate: number
  locale: string
}

// ─────────────────────────────────────────────────────────────────
// DEFAULT CURRENCIES
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
// GET CURRENCY CONFIG FROM DATABASE
// ─────────────────────────────────────────────────────────────────

export async function getCurrencyConfig(languageCode: string): Promise<CurrencyInfo> {
  try {
    const supabase = await createClient()
    
    const { data, error } = await (supabase
      .from('currency_config') as any)
      .select('*')
      .eq('language_code', languageCode)
      .eq('is_active', true)
      .single()
    
    if (error || !data) {
      // Fallback to default currencies
      return DEFAULT_CURRENCIES[languageCode] || DEFAULT_CURRENCY
    }
    
    const config = data as CurrencyConfig
    return {
      code: config.currency_code,
      symbol: config.currency_symbol,
      rate: config.exchange_rate,
      locale: getLocaleForLanguage(languageCode),
    }
  } catch {
    return DEFAULT_CURRENCIES[languageCode] || DEFAULT_CURRENCY
  }
}

export async function getAllCurrencyConfigs(): Promise<CurrencyConfig[]> {
  try {
    const supabase = await createClient()
    
    const { data, error } = await (supabase
      .from('currency_config') as any)
      .select('*')
      .order('language_code')
    
    if (error || !data) {
      return []
    }
    
    return data as CurrencyConfig[]
  } catch {
    return []
  }
}

export async function getDefaultCurrency(): Promise<CurrencyInfo> {
  try {
    const supabase = await createClient()
    
    const { data, error } = await (supabase
      .from('currency_config') as any)
      .select('*')
      .eq('is_default', true)
      .eq('is_active', true)
      .single()
    
    if (error || !data) {
      return DEFAULT_CURRENCY
    }
    
    const config = data as CurrencyConfig
    return {
      code: config.currency_code,
      symbol: config.currency_symbol,
      rate: config.exchange_rate,
      locale: getLocaleForLanguage(config.language_code),
    }
  } catch {
    return DEFAULT_CURRENCY
  }
}

// ─────────────────────────────────────────────────────────────────
// CONVERSION FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Convertit un montant en centimes EUR vers une autre devise
 * @param centsEur - Montant en centimes EUR
 * @param exchangeRate - Taux de change (ex: 1.10 pour USD)
 * @returns Montant en centimes dans la devise cible
 */
export function convertFromEur(centsEur: number, exchangeRate: number): number {
  // On arrondit pour garder des centimes entiers
  return Math.round(centsEur * exchangeRate)
}

/**
 * Convertit un montant d'une devise vers EUR
 * @param centsTarget - Montant en centimes dans la devise source
 * @param exchangeRate - Taux de change de la devise source
 * @returns Montant en centimes EUR
 */
export function convertToEur(centsTarget: number, exchangeRate: number): number {
  return Math.round(centsTarget / exchangeRate)
}

// ─────────────────────────────────────────────────────────────────
// FORMATTING FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Formate un montant en centimes dans la devise spécifiée
 * @param cents - Montant en centimes (dans la devise spécifiée, pas EUR)
 * @param currency - Configuration de la devise
 */
export function formatCurrency(cents: number, currency: CurrencyInfo): string {
  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
  }).format(cents / 100)
}

/**
 * Formate un montant en centimes EUR dans une devise cible
 * (Convertit puis formate)
 * @param centsEur - Montant en centimes EUR
 * @param currency - Configuration de la devise cible
 */
export function formatFromEur(centsEur: number, currency: CurrencyInfo): string {
  const convertedCents = convertFromEur(centsEur, currency.rate)
  return formatCurrency(convertedCents, currency)
}

/**
 * Formate un prix simplifié (ex: "1.55€" ou "$1.70")
 */
export function formatPriceSimple(centsEur: number, currency: CurrencyInfo): string {
  const convertedCents = convertFromEur(centsEur, currency.rate)
  const amount = (convertedCents / 100).toFixed(2)
  
  // USD/GBP: symbole avant, EUR: symbole après
  if (currency.code === 'USD' || currency.code === 'GBP') {
    return `${currency.symbol}${amount}`
  }
  return `${amount}${currency.symbol}`
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

function getLocaleForLanguage(languageCode: string): string {
  const locales: Record<string, string> = {
    fr: 'fr-FR',
    en: 'en-US',
    es: 'es-ES',
    de: 'de-DE',
    it: 'it-IT',
    pt: 'pt-PT',
    nl: 'nl-NL',
  }
  return locales[languageCode] || 'fr-FR'
}

/**
 * Détecte la langue préférée depuis l'en-tête Accept-Language
 */
export function detectLanguageFromHeader(acceptLanguage: string | null): string {
  if (!acceptLanguage) return 'fr'
  
  // Parse Accept-Language header
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [code, qValue] = lang.trim().split(';q=')
      return {
        code: code.split('-')[0].toLowerCase(), // Prendre juste 'en' de 'en-US'
        quality: qValue ? parseFloat(qValue) : 1.0,
      }
    })
    .sort((a, b) => b.quality - a.quality)
  
  // Retourner la première langue supportée
  for (const lang of languages) {
    if (DEFAULT_CURRENCIES[lang.code]) {
      return lang.code
    }
  }
  
  return 'fr' // Default
}

// ─────────────────────────────────────────────────────────────────
// CLIENT-SIDE UTILITIES (exported for client components)
// ─────────────────────────────────────────────────────────────────

/**
 * Version synchrone pour le client (utilise les valeurs par défaut)
 */
export function getCurrencyForLanguageSync(languageCode: string): CurrencyInfo {
  return DEFAULT_CURRENCIES[languageCode] || DEFAULT_CURRENCY
}
