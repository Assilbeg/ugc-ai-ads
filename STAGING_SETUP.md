# 🚀 Setup Staging Environment

## Étape 1 : Supabase Staging (5 min)

1. **Créer le projet** : [supabase.com/dashboard](https://supabase.com/dashboard) → New Project
   - Nom : `ugc-ai-staging`
   - Région : même que prod (Paris)

2. **Appliquer les migrations** :
   - SQL Editor → New Query
   - Copier/coller le contenu de `supabase/FULL_MIGRATION.sql`
   - Run

3. **Récupérer les credentials** (Settings → API) :
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY = eyJhbGc...
   ```

---

## Étape 2 : Vercel Staging (5 min)

1. Va sur [vercel.com/dashboard](https://vercel.com/dashboard) → ton projet

2. **Settings → Domains** :
   - Add : `staging.ugc-ai.com` (ou `staging-ugc-ai.vercel.app`)
   - Git Branch : `staging`

3. **Settings → Environment Variables** :

   Pour chaque variable, sélectionne **Preview** uniquement :

   | Variable | Valeur (STAGING) |
   |----------|------------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx-staging.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...staging` |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...staging` |
   | `STRIPE_SECRET_KEY` | `sk_test_...` |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_...` (nouveau pour staging) |
   | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` |

   > Les autres variables (FAL_KEY, ANTHROPIC_API_KEY, etc.) peuvent être les mêmes que prod.

---

## Étape 3 : Stripe Webhook Staging (5 min)

1. [dashboard.stripe.com/test/webhooks](https://dashboard.stripe.com/test/webhooks)
2. **Add endpoint** :
   - URL : `https://staging.ugc-ai.com/api/stripe/webhook`
   - Events : `checkout.session.completed`, `customer.subscription.*`
3. Copier le `Signing secret` → `STRIPE_WEBHOOK_SECRET` dans Vercel (Preview)

---

## 🎉 C'est tout !

### Workflow quotidien

```bash
# Développer sur staging
git checkout staging
# ... code ...
git add -A && git commit -m "feat: xxx"
git push  # → déploie sur staging.ugc-ai.com

# Quand c'est validé → merge vers prod
git checkout main
git merge staging
git push  # → déploie sur ugc-ai.com
```

### URLs

| Environnement | URL | Branche |
|---------------|-----|---------|
| **Production** | ugc-ai.com | `main` |
| **Staging** | staging.ugc-ai.com | `staging` |


