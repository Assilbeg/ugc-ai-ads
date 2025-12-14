// Client-side credits utilities (can be imported in client components)

import { formatCredits as formatCreditsWithCurrency, getCurrentCurrency, CurrencyInfo } from '@/lib/currency-client'

// Re-export currency utilities for convenience
export { getCurrentCurrency, formatCreditsWithCurrency } from '@/lib/currency-client'
export type { CurrencyInfo } from '@/lib/currency-client'
export { formatPriceSimple, formatPriceCompact, convertFromEur } from '@/lib/currency-client'

/**
 * Formate un montant en centimes EUR dans la devise de l'utilisateur
 * (Détecte automatiquement la langue du navigateur)
 */
export function formatCredits(centsEur: number): string {
  return formatCreditsWithCurrency(centsEur)
}




