export const locales = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'fr'

// Mapping UI locale -> ScriptLanguage (brief.language, prompts, etc.)
export const localeToScriptLanguage: Record<Locale, string> = {
  fr: 'fr',
  en: 'en-us', // défaut US pour l'anglais
  es: 'es',
  de: 'de',
  it: 'it',
  pt: 'pt-br', // défaut BR pour le portugais
  nl: 'nl',
}
