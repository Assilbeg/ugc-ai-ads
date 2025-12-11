'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { locales, type Locale } from '@/i18n/config'
import { cn } from '@/lib/utils'

const LOCALE_LABELS: Record<Locale, { flag: string; label: string }> = {
  fr: { flag: '🇫🇷', label: 'Français' },
  en: { flag: '🇺🇸', label: 'English' },
  es: { flag: '🇪🇸', label: 'Español' },
  de: { flag: '🇩🇪', label: 'Deutsch' },
  it: { flag: '🇮🇹', label: 'Italiano' },
  pt: { flag: '🇧🇷', label: 'Português' },
  nl: { flag: '🇳🇱', label: 'Nederlands' },
}

export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('common')

  const switchLocale = (newLocale: Locale) => {
    if (newLocale === locale) return
    const segments = pathname.split('/').filter(Boolean)
    if (locales.includes(segments[0] as any)) {
      segments[0] = newLocale
    } else {
      segments.unshift(newLocale)
    }
    const newPath = `/${segments.join('/') || ''}`

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/e4231377-2382-45db-b33c-82d9e810facf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H1',
        location: 'components/locale-switcher.tsx:33',
        message: 'locale switch requested',
        data: { from: locale, to: newLocale, pathname, newPath },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    router.push(newPath)
  }

  return (
    <label className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <span className="sr-only">{t('language')}</span>
      <select
        value={locale}
        onChange={e => switchLocale(e.target.value as Locale)}
        className="h-9 rounded-lg border border-border bg-background px-2 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        {locales.map(loc => (
          <option key={loc} value={loc}>
            {LOCALE_LABELS[loc].flag} {LOCALE_LABELS[loc].label}
          </option>
        ))}
      </select>
    </label>
  )
}
