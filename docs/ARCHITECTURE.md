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

## 🎬 Pipeline de Génération (Step 6)

Pipeline complet de génération d'un clip vidéo UGC :

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PIPELINE DE GÉNÉRATION                             │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌────────────────┐
    │  1. FIRST FRAME │
    │  ─────────────  │
    │  fal-ai/       │
    │  nano-banana-  │──────────────────┐
    │  pro/edit      │                  │
    │                │                  │
    │  💰 25 crédits │                  │
    │  💾 first_frame│                  │
    └────────────────┘                  ▼
                               ┌────────────────┐
                               │   2. VIDÉO     │
                               │   ──────────   │
                               │   fal-ai/      │
                               │   veo3.1/      │
                               │   image-to-    │───────────────────┐
                               │   video        │                   │
                               │                │                   │
                               │   💰 25 ou 60  │                   │
                               │      créd/sec  │                   │
                               │   💾 video.    │                   │
                               │      raw_url   │                   │
                               └────────────────┘                   │
                                                                    ▼
                                                           ┌────────────────┐
                                                           │ 3. TRANSCRIPTN │
                                                           │ ────────────── │
                                                           │ fal-ai/whisper │
                                                           │       +        │
                                                           │ Claude analyse │
                                                           │                │
                                                           │ 💰 0 crédits   │
                                                           │ 💾 transcriptn │
                                                           │    + auto_adj  │
                                                           └───────┬────────┘
                                                                   │
                              ┌─────────────────────────────────────┤
                              ▼                                     ▼
                     ┌────────────────┐                    ┌────────────────┐
                     │   4. VOICE     │                    │  5. AMBIENT    │
                     │   ─────────    │                    │  ───────────   │
                     │   resemble-ai/ │                    │  fal-ai/       │
                     │   chatterboxhd/│                    │  elevenlabs/   │
                     │   speech-to-   │                    │  sound-effects │
                     │   speech       │                    │  /v2           │
                     │                │                    │                │
                     │   💰 20 crédits│                    │  💰 15 crédits │
                     │   💾 audio.    │                    │  💾 audio.     │
                     │      voice_url │                    │     ambient_url│
                     └───────┬────────┘                    └───────┬────────┘
                             │                                     │
                             └──────────────┬──────────────────────┘
                                            ▼
                                   ┌────────────────┐
                                   │   6. MIX AUDIO │
                                   │   ──────────── │
                                   │   fal-ai/      │
                                   │   ffmpeg-api/  │
                                   │   compose      │
                                   │                │
                                   │   Voix: 100%   │
                                   │   Ambient: 20% │
                                   │                │
                                   │   💰 0 crédits │
                                   │   💾 video.    │
                                   │      raw_url   │
                                   │      (mixé)    │
                                   └───────┬────────┘
                                           │
                                           ▼
                                   ┌────────────────┐
                                   │  7. PROCESS    │
                                   │  ────────────  │
                                   │  Transloadit   │
                                   │                │
                                   │  • Trim        │
                                   │  • Speed       │
                                   │  • Normalize   │
                                   │    timestamps  │
                                   │                │
                                   │  💰 0 crédits │
                                   │  💾 video.    │
                                   │     final_url  │
                                   └───────┬────────┘
                                           │
           (pour chaque clip × 5 beats)    │
                                           ▼
                                   ┌────────────────┐
                                   │  8. ASSEMBLAGE │
                                   │  ──────────── │
                                   │  Transloadit   │
                                   │  /video/concat │
                                   │       +        │
                                   │  /video/encode │
                                   │  (resize 9:16) │
                                   │                │
                                   │  💰 0 crédits │
                                   │  💾 campaign.  │
                                   │     final_     │
                                   │     video_url  │
                                   └────────────────┘
```

### Récapitulatif des coûts par beat

| Étape | Service | Coût (crédits) | Sauvegardé en BDD |
|-------|---------|----------------|-------------------|
| First Frame | fal.ai NanoBanana Pro | 25 | `clip.first_frame.image_url` |
| Vidéo Fast | fal.ai Veo 3.1 Fast | 25 × durée(s) | `clip.video.raw_url` |
| Vidéo Standard | fal.ai Veo 3.1 Standard | 60 × durée(s) | `clip.video.raw_url` |
| Transcription | fal.ai Whisper + Claude | 0 | `clip.transcription`, `clip.auto_adjustments` |
| Voice | fal.ai ChatterboxHD | 20 | `clip.audio.voice_url` |
| Ambient | fal.ai ElevenLabs | 15 | `clip.audio.ambient_url` |
| Mix | fal.ai FFmpeg | 0 | `clip.video.raw_url` (remplacé) |
| Process | Transloadit | 0 | `clip.video.final_url` |
| Assemblage | Transloadit | 0 | `campaign.final_video_url` |

### Coût total estimé (5 beats, Veo Fast, 6s/clip)

```
First Frames : 5 × 25 = 125 crédits
Vidéos      : 5 × 25 × 6 = 750 crédits
Voix        : 5 × 20 = 100 crédits
Ambiances   : 5 × 15 = 75 crédits
─────────────────────────────────
TOTAL       : ~1050 crédits = 10.50€
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
- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) - Erreurs courantes et solutions
- [`DATABASE.md`](./DATABASE.md) - Schéma BDD et requêtes utiles
- [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md) - Documentation des endpoints
- [`DOCS_DES_APIS.md`](./DOCS_DES_APIS.md) - Documentation des APIs externes

---

## 🚧 Architecture Future : Webhooks Async

> **Status** : Planifié, pas encore implémenté  
> **Fichier de référence** : `PLAN ARCHITECTURE A FAIRE/webhooks-async-generation.md`

### Problème actuel

L'architecture actuelle utilise du **polling synchrone** :

```
[Browser] ──HTTP POST──► [Vercel API] ──poll loop──► [Fal.ai]
              │                │                        │
              │                │ (boucle 5-30 min)      │
              │◄───────────────┤                        │
              │ (connexion ouverte tout ce temps)       │
```

**Limitations** :
- Timeout Vercel Pro = 300s max (5 min)
- Connexion HTTP fragile (WiFi, navigateur fermé)
- Workers Vercel bloqués pendant la génération

### Solution planifiée : Webhooks

```
[Browser] ──POST──► [API Route] ──submit──► [Fal.ai]
    │                   │                      │
    │◄──{jobId}─────────┤  (retour 1-2s)      │
    │                   │                      │
    │──poll /api/jobs───►                      │  (génère 2-10 min)
    │◄──{status}────────┤                      │
    │                   │◄─────webhook─────────┤
    │◄──{completed}─────┤                      │
```

### Fichiers à créer (quand on implémentera)

| Fichier | Description |
|---------|-------------|
| `supabase/generation_jobs.sql` | Nouvelle table pour tracker les jobs async |
| `app/api/webhooks/fal/route.ts` | Handler webhook Fal.ai |
| `app/api/jobs/[id]/route.ts` | GET status d'un job |

### Checklist avant implémentation

Avant d'implémenter cette architecture, le développeur/LLM **DOIT** :

1. ✅ Lire `lib/api/falai.ts` - comprendre `falRequest`, `pollUntilCompleteWithUrls`
2. ✅ Lire `hooks/use-video-generation.ts` - comprendre le flow actuel
3. ✅ Lire `lib/generation-logger.ts` - ne pas dupliquer le système de logging
4. ✅ Lire `lib/credits.ts` - comprendre quand déduire les crédits
5. ✅ Vérifier doc Fal.ai webhooks : https://fal.ai/docs/webhooks

---

*Dernière mise à jour : 5 décembre 2024*

