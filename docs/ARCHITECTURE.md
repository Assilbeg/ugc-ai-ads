# 🏗️ Architecture UGC AI App

> Vue d'ensemble de l'architecture du projet. Pour les détails d'implémentation, voir les autres docs.

## Stack Technique

| Couche | Technologies |
|--------|--------------|
| **Frontend** | Next.js 14 (App Router), React, TailwindCSS, shadcn/ui |
| **Backend** | Next.js API Routes, Supabase (Auth + DB + Storage) |
| **IA Génération** | fal.ai (Veo 3.1, NanoBanana, ChatterboxHD, ElevenLabs) |
| **Vidéo Processing** | Transloadit (trim, speed, concat) |
| **Paiements** | Stripe (subscriptions + one-time) |
| **Hosting** | Vercel |

## Structure du Projet

```
ugc-ai-app/
├── app/                    # Next.js App Router
│   ├── (admin)/           # Pages admin (layout séparé)
│   ├── (auth)/            # Login/Register
│   ├── (dashboard)/       # Dashboard utilisateur
│   │   ├── campaign/[id]/ # Vue campagne existante
│   │   ├── dashboard/     # Liste des campagnes
│   │   └── new/[id]/      # Création de campagne (steps 1-6)
│   └── api/               # API Routes
│       ├── generate/      # Endpoints de génération IA
│       ├── stripe/        # Webhooks et checkout
│       └── credits/       # Gestion crédits
├── components/
│   ├── steps/             # Step1 à Step6 du flow de création
│   └── ui/                # Composants shadcn/ui
├── hooks/                 # React hooks custom
├── lib/                   # Utilitaires et clients
│   ├── api/               # Clients IA (Claude, fal.ai)
│   └── supabase/          # Clients Supabase
├── types/                 # TypeScript types
├── supabase/              # Migrations SQL
└── docs/                  # 📚 Documentation (vous êtes ici)
```

## Flow de Création de Campagne

```
Step 1: Acteur      → Sélection de l'acteur IA
Step 2: Produit     → Upload image produit (optionnel)
Step 3: Preset      → Choix du template (intention)
Step 4: Brief       → Infos produit + pain point + audience
Step 5: Plan        → Génération du plan (Claude) + First Frames
Step 6: Generate    → Génération vidéos + assemblage
```

## Entités Principales

```
Campaign (1)
    ├── Actor (1)
    ├── Preset (1) - template en code, pas en BDD
    ├── Brief (1)
    └── Clips (N)
            └── ClipVersions (N) - historique des régénérations
```

## Services Externes

| Service | Usage | Fichier principal |
|---------|-------|-------------------|
| **Supabase** | Auth, BDD, Storage | `lib/supabase/` |
| **fal.ai** | Veo 3.1, NanoBanana, ChatterboxHD | `lib/api/falai.ts` |
| **Claude** | Génération de plans et scripts | `lib/api/claude.ts` |
| **Transloadit** | Processing vidéo (trim, concat) | `app/api/generate/process-clip/` |
| **Stripe** | Paiements | `lib/stripe.ts` |

## Voir aussi

- [`CRITICAL_BEHAVIORS.md`](./CRITICAL_BEHAVIORS.md) - Invariants à ne jamais modifier
- [`../API_DOCUMENTATION.md`](../API_DOCUMENTATION.md) - Documentation des endpoints
- [`../DOCS_DES_APIS.md`](../DOCS_DES_APIS.md) - Documentation des APIs externes

---

*Dernière mise à jour : 5 décembre 2024*

