---
name: i18n multilingue complet
overview: Mise en place d'une infrastructure i18n complete avec next-intl, routing par segment URL (/fr, /en, /es, /de, /it, /pt, /nl), fichiers de messages par locale, et migration progressive de toutes les chaines UI.
todos:
  - id: phase1-install
    content: Installer next-intl et creer i18n/config.ts + i18n/request.ts
    status: pending
  - id: phase1-messages
    content: Creer messages/fr.json avec toutes les cles (reference)
    status: pending
  - id: phase1-routing
    content: Restructurer app/ avec segment [locale] et layouts
    status: pending
  - id: phase1-middleware
    content: Modifier middleware.ts pour combiner intl + Supabase auth
    status: pending
  - id: phase2-switcher
    content: Creer LocaleSwitcher et l'integrer dans les layouts
    status: pending
  - id: phase2-sync
    content: Creer useLocaleSync et l'integrer dans step4-brief
    status: pending
  - id: phase3-auth
    content: Migrer login/register vers t()
    status: pending
  - id: phase3-dashboard
    content: Migrer dashboard et campaign card vers t()
    status: pending
  - id: phase3-steps1-4
    content: Migrer step1 a step4 vers t()
    status: pending
  - id: phase3-steps5-6
    content: Migrer step5 et step6 vers t() (PRUDENCE - logique sensible)
    status: pending
  - id: phase3-translate
    content: Traduire messages/en.json, es.json, de.json, it.json, pt.json, nl.json
    status: pending
  - id: phase4-seo
    content: Ajouter metadata localisees et hreflang
    status: pending
  - id: phase5-docs
    content: Creer docs/I18N.md et mettre a jour .cursorrules
    status: pending
---

# Plan i18n Multilingue Complet

## Configuration choisie

- **Langues UI** : fr (defaut), en, es, de, it, pt, nl (7 locales)
- **Routing** : Segment URL (`/fr/dashboard`, `/en/dashboard`, etc.)
- **Sync brief.language** : Auto-sync intelligent (suit l'UI par defaut, modifiable manuellement)

---

## Phase 1 : Infrastructure next-intl

### 1.1 Installation et configuration de base

**Installer next-intl** :

```bash
npm install next-intl
```

**Creer `i18n/config.ts`** :

```typescript
export const locales = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'fr'

// Mapping UI locale -> ScriptLanguage (pour auto-sync brief)
export const localeToScriptLanguage: Record<Locale, string> = {
  fr: 'fr',
  en: 'en-us',  // defaut US pour l'anglais
  es: 'es',
  de: 'de',
  it: 'it',
  pt: 'pt-br',  // defaut BR pour le portugais
  nl: 'nl',
}
```

**Creer `i18n/request.ts`** (pour next-intl App Router) :

```typescript
import { getRequestConfig } from 'next-intl/server'
import { locales, defaultLocale } from './config'

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !locales.includes(locale as any)) {
    locale = defaultLocale
  }
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  }
})
```

**Modifier `next.config.ts`** :

```typescript
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  // config existante
}

export default withNextIntl(nextConfig)
```

### 1.2 Structure des messages

**Creer `messages/fr.json`** (langue de reference) :

```json
{
  "common": {
    "loading": "Chargement...",
    "error": "Une erreur est survenue",
    "save": "Enregistrer",
    "cancel": "Annuler",
    "continue": "Continuer",
    "back": "Retour",
    "delete": "Supprimer"
  },
  "auth": {
    "login": "Connexion",
    "register": "Inscription",
    "logout": "Deconnexion",
    "email": "Email",
    "password": "Mot de passe",
    "forgotPassword": "Mot de passe oublie ?",
    "noAccount": "Pas encore de compte ?",
    "hasAccount": "Deja un compte ?"
  },
  "dashboard": {
    "title": "Mes campagnes",
    "newCampaign": "Nouvelle campagne",
    "noCampaigns": "Aucune campagne",
    "credits": "credits"
  },
  "steps": {
    "actor": "Acteur",
    "product": "Produit",
    "preset": "Style",
    "brief": "Brief",
    "plan": "Plan",
    "generate": "Generation"
  },
  "step1": { ... },
  "step2": { ... },
  "step3": { ... },
  "step4": { ... },
  "step5": { ... },
  "step6": { ... },
  "campaign": { ... },
  "billing": { ... },
  "admin": { ... }
}
```

**Dupliquer et traduire pour chaque locale** : `messages/en.json`, `messages/es.json`, etc.

### 1.3 Restructuration du routing (App Router)

**Renommer `app/` en structure localisee** :

```
app/
  [locale]/              <- NOUVEAU segment dynamique
    (admin)/
      admin/...
      layout.tsx
    (auth)/
      login/page.tsx
      register/page.tsx
      layout.tsx
    (dashboard)/
      campaign/[id]/page.tsx
      dashboard/page.tsx
      new/[id]/page.tsx
      layout.tsx
    layout.tsx           <- Layout racine avec NextIntlClientProvider
    page.tsx             <- Redirect vers /[locale]/dashboard ou login
  api/                   <- APIs restent hors du segment locale
    ...
  layout.tsx             <- Layout global minimal (html/body)
  page.tsx               <- Redirect vers /[defaultLocale]
```

**Modifier `app/layout.tsx`** (global, minimal) :

```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children // Le vrai layout est dans [locale]/layout.tsx
}
```

**Creer `app/[locale]/layout.tsx`** :

```typescript
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { locales } from '@/i18n/config'

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!locales.includes(locale as any)) notFound()
  
  setRequestLocale(locale)
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body className="...">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

### 1.4 Middleware de detection/redirection

**Modifier `middleware.ts`** :

```typescript
import createMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from '@/i18n/config'

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always' // Toujours afficher /fr, /en, etc.
})

export default async function middleware(request: NextRequest) {
  // Exclure les routes API et assets
  const pathname = request.nextUrl.pathname
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }
  
  // Combiner avec le middleware Supabase existant
  const intlResponse = intlMiddleware(request)
  // ... logique Supabase auth existante ...
  
  return intlResponse
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)']
}
```

---

## Phase 2 : Composants et Hooks i18n

### 2.1 Hook useTranslation

**Usage dans les composants client** :

```typescript
'use client'
import { useTranslations } from 'next-intl'

export default function LoginPage() {
  const t = useTranslations('auth')
  
  return (
    <h2>{t('login')}</h2>
    // ...
  )
}
```

### 2.2 Composant LocaleSwitcher

**Creer `components/locale-switcher.tsx`** :

```typescript
'use client'
import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { locales, type Locale } from '@/i18n/config'

const LOCALE_LABELS: Record<Locale, { flag: string; label: string }> = {
  fr: { flag: '🇫🇷', label: 'Francais' },
  en: { flag: '🇺🇸', label: 'English' },
  es: { flag: '🇪🇸', label: 'Espanol' },
  de: { flag: '🇩🇪', label: 'Deutsch' },
  it: { flag: '🇮🇹', label: 'Italiano' },
  pt: { flag: '🇧🇷', label: 'Portugues' },
  nl: { flag: '🇳🇱', label: 'Nederlands' },
}

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const switchLocale = (newLocale: Locale) => {
    // Remplacer le segment locale dans le pathname
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPath)
  }

  return (
    <select
      value={locale}
      onChange={(e) => switchLocale(e.target.value as Locale)}
      className="..."
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {LOCALE_LABELS[loc].flag} {LOCALE_LABELS[loc].label}
        </option>
      ))}
    </select>
  )
}
```

**Placer dans les layouts** : header du dashboard, page login, etc.

### 2.3 Hook useLocaleSync pour brief.language

**Creer `hooks/use-locale-sync.ts`** :

```typescript
import { useLocale } from 'next-intl'
import { useEffect } from 'react'
import { localeToScriptLanguage } from '@/i18n/config'
import type { CampaignBrief } from '@/types'

export function useLocaleSync(
  brief: CampaignBrief,
  onChange: (brief: CampaignBrief) => void,
  userHasChangedLanguage: boolean
) {
  const locale = useLocale()

  useEffect(() => {
    // Auto-sync seulement si l'utilisateur n'a pas change manuellement
    if (!userHasChangedLanguage && !brief.language) {
      onChange({
        ...brief,
        language: localeToScriptLanguage[locale as keyof typeof localeToScriptLanguage]
      })
    }
  }, [locale, userHasChangedLanguage])
}
```

**Utiliser dans `step4-brief.tsx`** pour pre-selectionner la langue du contenu selon l'UI.

---

## Phase 3 : Migration Progressive des Composants

### 3.1 Ordre de migration (du plus simple au plus complexe)

| Priorite | Fichier | Lignes | Complexite | Notes |

|----------|---------|--------|------------|-------|

| 1 | `app/(auth)/login/page.tsx` | ~170 | Faible | Page statique, bon point de depart |

| 2 | `app/(auth)/register/page.tsx` | ~180 | Faible | Similaire a login |

| 3 | `components/ui/*.tsx` | ~50 chacun | Faible | Composants shadcn, peu de texte |

| 4 | `app/(dashboard)/dashboard/page.tsx` | ~200 | Moyenne | Liste campagnes |

| 5 | `components/credits-display.tsx` | ~80 | Faible | |

| 6 | `components/steps/step-indicator.tsx` | ~60 | Faible | Labels des etapes |

| 7 | `components/steps/step1-actor.tsx` | ~300 | Moyenne | |

| 8 | `components/steps/step2-product.tsx` | ~250 | Moyenne | |

| 9 | `components/steps/step3-preset.tsx` | ~300 | Moyenne | |

| 10 | `components/steps/step4-brief.tsx` | ~750 | Moyenne | Attention au sync langue |

| 11 | `components/steps/step5-plan.tsx` | ~1400 | **Elevee** | **NE PAS TOUCHER LA LOGIQUE** |

| 12 | `components/steps/step6-generate.tsx` | ~2900 | **Tres elevee** | **NE PAS TOUCHER LA LOGIQUE** |

| 13 | `app/(dashboard)/campaign/[id]/page.tsx` | ~800 | Elevee | |

| 14 | Pages admin | ~2000 total | Moyenne | Peut rester en FR si admin FR only |

### 3.2 Regles de migration (CRITIQUE)

**Pour step5 et step6, respecter strictement les regles de CRITICAL_BEHAVIORS.md section 15** :

- **SAFE** : Modifier uniquement les textes/labels passes a `t()`
- **INTERDIT** : Toucher aux `onClick`, `disabled`, `value`, `onChange`, `key`, `.map()`, `useEffect`

**Pattern de migration** :

```typescript
// AVANT
<Button disabled={loading}>
  {loading ? 'Chargement...' : 'Generer'}
</Button>

// APRES - SAFE
<Button disabled={loading}>
  {loading ? t('common.loading') : t('step6.generate')}
</Button>
```

### 3.3 Extraction des constantes traduisibles

**Identifier et extraire** :

- `BEAT_LABELS` dans step6 → `t('beats.hook')`, `t('beats.problem')`, etc.
- `DURATION_OPTIONS` dans step4 → `t('durations.15s')`, etc.
- `LANGUAGE_OPTIONS` dans step4 → garder car deja des labels traduits
- Labels presets dans step3 → `t('presets.confessionIntime')`, etc.

---

## Phase 4 : SEO et Metadata

### 4.1 Metadata localisees

**Modifier chaque `page.tsx`** :

```typescript
import { getTranslations, setRequestLocale } from 'next-intl/server'

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata' })
  
  return {
    title: t('dashboard.title'),
    description: t('dashboard.description'),
  }
}
```

### 4.2 Alternates hreflang

**Dans le layout racine** :

```typescript
export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  return {
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(
        locales.map(loc => [loc, `/${loc}`])
      )
    }
  }
}
```

---

## Phase 5 : Tests et Documentation

### 5.1 Tests a effectuer

- [ ] Navigation entre locales preserve l'etat (campagne en cours, etc.)
- [ ] brief.language se pre-selectionne selon l'UI locale
- [ ] brief.language peut etre change independamment
- [ ] Toutes les pages s'affichent correctement dans chaque locale
- [ ] Les APIs ne sont pas affectees (pas de segment locale)
- [ ] Le middleware Supabase auth fonctionne toujours
- [ ] Les redirects login/dashboard fonctionnent avec les locales

### 5.2 Documentation

**Ajouter `docs/I18N.md`** :

- Architecture i18n choisie
- Comment ajouter une nouvelle locale
- Comment ajouter des traductions
- Regles de migration des composants
- Mapping UI locale <-> ScriptLanguage

**Mettre a jour `.cursorrules`** :

- Ajouter les regles i18n (toujours utiliser `t()`, ne pas hardcoder de texte)

---

## Fichiers crees/modifies

### Nouveaux fichiers

- `i18n/config.ts`
- `i18n/request.ts`
- `messages/fr.json`
- `messages/en.json`
- `messages/es.json`
- `messages/de.json`
- `messages/it.json`
- `messages/pt.json`
- `messages/nl.json`
- `components/locale-switcher.tsx`
- `hooks/use-locale-sync.ts`
- `app/[locale]/layout.tsx`
- `app/[locale]/page.tsx`
- `docs/I18N.md`

### Fichiers modifies

- `next.config.ts` (plugin next-intl)
- `middleware.ts` (intl middleware)
- `app/layout.tsx` (minimal)
- Tous les composants avec du texte UI (migration progressive)
- `components/steps/step4-brief.tsx` (auto-sync langue)
- `.cursorrules` (regles i18n)

---

## Estimation

| Phase | Effort | Dependances |

|-------|--------|-------------|

| Phase 1 (infra) | 2-3h | Aucune |

| Phase 2 (hooks/switcher) | 1-2h | Phase 1 |

| Phase 3 (migration) | 8-12h | Phase 1-2 |

| Phase 4 (SEO) | 1-2h | Phase 1 |

| Phase 5 (tests/docs) | 2-3h | Phase 1-4 |

| **Total** | **14-22h** | |

La migration peut etre faite incrementalement : une fois Phase 1-2 terminee, chaque composant peut etre migre independamment.