# 🎬 UGC AI App

Application de génération de vidéos UGC (User Generated Content) avec intelligence artificielle.

## 🚀 Stack

| Couche | Technologies |
|--------|--------------|
| **Frontend** | Next.js 14 (App Router), React, TailwindCSS, shadcn/ui |
| **Backend** | Next.js API Routes, Supabase (Auth + DB + Storage) |
| **IA Génération** | fal.ai (Veo 3.1, NanoBanana, ChatterboxHD, ElevenLabs) |
| **Vidéo Processing** | Transloadit (trim, speed, concat) |
| **Paiements** | Stripe |
| **Hosting** | Vercel |

## 📚 Documentation

> **⚠️ IMPORTANT** : Consulter la documentation AVANT de modifier le code.

| Document | Description |
|----------|-------------|
| [`docs/CRITICAL_BEHAVIORS.md`](./docs/CRITICAL_BEHAVIORS.md) | 🚨 **Invariants à NE JAMAIS casser** |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Vue d'ensemble de l'architecture |
| [`docs/DATABASE.md`](./docs/DATABASE.md) | Schéma BDD Supabase |
| [`docs/FEATURES.md`](./docs/FEATURES.md) | Documentation fonctionnelle des features |
| [`docs/API_DOCUMENTATION.md`](./docs/API_DOCUMENTATION.md) | Documentation des endpoints API |
| [`docs/DOCS_DES_APIS.md`](./docs/DOCS_DES_APIS.md) | Documentation des APIs externes (fal.ai, Transloadit, etc.) |
| [`docs/CLIP_VERSIONING_PLAN.md`](./docs/CLIP_VERSIONING_PLAN.md) | Plan d'implémentation du versioning |
| [`docs/STAGING_SETUP.md`](./docs/STAGING_SETUP.md) | Guide de setup staging |

## 🏃 Quick Start

```bash
# Installation
npm install

# Variables d'environnement
cp .env.example .env.local
# Remplir les clés API

# Développement
npm run dev

# Build
npm run build
```

## 🔑 Variables d'environnement requises

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# fal.ai
FAL_KEY=

# Anthropic (Claude)
ANTHROPIC_API_KEY=

# Transloadit
TRANSLOADIT_KEY=
TRANSLOADIT_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Cloudinary (optionnel)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

## 📁 Structure du projet

```
ugc-ai-app/
├── app/                    # Next.js App Router
│   ├── (admin)/           # Pages admin
│   ├── (auth)/            # Login/Register
│   ├── (dashboard)/       # Dashboard utilisateur
│   │   ├── campaign/[id]/ # Vue campagne existante
│   │   ├── dashboard/     # Liste des campagnes
│   │   └── new/[id]/      # Création de campagne
│   └── api/               # API Routes
├── components/
│   ├── steps/             # Step1 à Step6 du flow de création
│   └── ui/                # Composants shadcn/ui
├── hooks/                 # React hooks custom
├── lib/                   # Utilitaires et clients
├── types/                 # TypeScript types
├── supabase/              # Migrations SQL
└── docs/                  # 📚 Documentation
```

## 🔒 IDs importants

| Service | ID |
|---------|-----|
| Supabase Project | `xresijptcptdilwecklf` |
| Cloudinary Cloud | `dap13uqjz` |

## 📋 Règles pour les développeurs

Voir [`.cursorrules`](./.cursorrules) pour les règles automatiquement appliquées par Cursor/Claude.

### Résumé des règles critiques

1. **Avant de modifier** → Lire `docs/CRITICAL_BEHAVIORS.md`
2. **Ne jamais** utiliser `.single()` sur `campaign_clips` par `order`
3. **Toujours** utiliser `getEffectiveAdjustments()` pour trim/speed
4. **Jamais** de vitesse < 1.0 (pas de ralentissement)
5. **Préserver** les vidéos existantes en step5
6. **Documenter** les nouveaux comportements critiques

---

*Projet UGC AI - Décembre 2024*
