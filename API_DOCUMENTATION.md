# 📚 UGC AI - Documentation API

> Documentation complète des endpoints API pour la génération de vidéos UGC avec intelligence artificielle.

**Version**: 1.0.0  
**Base URL**: `https://your-domain.com/api` (ou `http://localhost:3000/api` en dev)

---

## Table des matières

1. [Authentification](#authentification)
2. [Crédits & Billing](#crédits--billing)
3. [Génération IA](#génération-ia)
4. [Assemblage Vidéo](#assemblage-vidéo)
5. [Administration](#administration)
6. [Stripe & Paiements](#stripe--paiements)
7. [Codes d'erreur](#codes-derreur)
8. [Types & Interfaces](#types--interfaces)

---

## Authentification

L'API utilise **Supabase Auth** pour l'authentification. Toutes les requêtes authentifiées doivent inclure le cookie de session Supabase.

### Niveaux d'accès

| Niveau | Description |
|--------|-------------|
| `Public` | Aucune authentification requise |
| `User` | Utilisateur connecté requis |
| `Admin` | Utilisateur admin requis (vérifié via email) |

### Headers requis

```http
Cookie: sb-<project-ref>-auth-token=<session-token>
Content-Type: application/json
```

---

## Crédits & Billing

### GET `/api/credits`

Récupère le solde et les informations de crédit de l'utilisateur connecté.

**Auth**: `User`

**Response** `200 OK`
```json
{
  "balance": 5000,
  "subscription": {
    "tier": "pro",
    "status": "active",
    "currentPeriodEnd": "2025-02-01T00:00:00.000Z"
  },
  "earlyBird": {
    "eligible": true,
    "used": false,
    "deadline": "2025-01-02T12:00:00.000Z",
    "timeRemaining": 86400000
  },
  "costs": {
    "first_frame": 15,
    "video_veo31_fast": 100,
    "video_veo31_standard": 200,
    "voice_chatterbox": 25,
    "ambient_elevenlabs": 10
  },
  "remaining": {
    "videos_fast": 50,
    "videos_standard": 25,
    "first_frames": 333
  }
}
```

---

### POST `/api/credits/check`

Vérifie si l'utilisateur a suffisamment de crédits pour une ou plusieurs générations.

**Auth**: `User`

**Request Body** (génération unique)
```json
{
  "generationType": "video_veo31_fast"
}
```

**Request Body** (générations multiples)
```json
{
  "generations": [
    { "type": "first_frame", "count": 5 },
    { "type": "video_veo31_fast", "count": 5 },
    { "type": "voice_chatterbox", "count": 5 }
  ]
}
```

**Response** `200 OK`
```json
{
  "hasEnough": true,
  "currentBalance": 5000,
  "requiredAmount": 750,
  "missingAmount": 0,
  "isEarlyBirdEligible": true
}
```

**Response** `402 Payment Required`
```json
{
  "hasEnough": false,
  "currentBalance": 100,
  "requiredAmount": 750,
  "missingAmount": 650,
  "isEarlyBirdEligible": true
}
```

---

### GET `/api/plans`

Liste tous les plans d'abonnement actifs.

**Auth**: `Public` (mais Early Bird filtré selon l'utilisateur connecté)

**Response** `200 OK`
```json
{
  "plans": [
    {
      "id": "starter",
      "name": "Starter",
      "description": "Pour débuter",
      "price_cents": 2900,
      "monthly_credits": 3000,
      "stripe_price_id": "price_xxx",
      "is_early_bird": false,
      "is_one_time": false,
      "is_active": true,
      "display_order": 1,
      "features": ["5 vidéos/mois", "Support email"]
    }
  ],
  "isEarlyBirdEligible": true
}
```

---

## Génération IA

### POST `/api/generate/plan`

Génère un plan de campagne UGC avec Claude AI.

**Auth**: `User`

**Request Body**
```json
{
  "actor": {
    "id": "uuid",
    "name": "Sophie",
    "soul_image_url": "https://...",
    "voice_sample_url": "https://..."
  },
  "preset": {
    "id": "problem_solution",
    "name": "Problem → Solution",
    "clips": [
      {
        "intention": "hook",
        "duration": 3,
        "script_prompt": "Accroche percutante"
      }
    ]
  },
  "brief": {
    "what_selling": "Application de méditation",
    "pain_point": "Stress quotidien",
    "target_audience": "Professionnels 25-45 ans",
    "key_benefits": ["Réduction stress", "Meilleur sommeil"]
  },
  "product": {
    "name": "ZenApp",
    "image_url": "https://..."
  }
}
```

**Response** `200 OK`
```json
{
  "clips": [
    {
      "order": 1,
      "intention": "hook",
      "duration": 3,
      "script": "Tu te sens épuisé après chaque journée de travail ?",
      "visual_prompt": "Close-up face, tired expression, office background",
      "ambient_prompt": "Soft office ambiance, keyboard typing"
    }
  ]
}
```

---

### POST `/api/generate/first-frame`

Génère la première frame d'une vidéo avec NanoBanana Pro.

**Auth**: `User`  
**Coût**: `first_frame` (15 crédits par défaut)

**Request Body**
```json
{
  "soulImageUrl": "https://...",
  "prompt": "Looking excited, holding phone, bright room",
  "presetId": "problem_solution",
  "intentionImageUrl": "https://...",
  "previousFrameUrl": "https://...",
  "actorId": "uuid",
  "skipCache": false,
  "campaignId": "uuid",
  "clipId": "uuid",
  "skipCredits": false
}
```

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `soulImageUrl` | string | ✅ | Image de référence de l'acteur |
| `prompt` | string | ✅ | Description de la pose/expression |
| `presetId` | string | ❌ | ID du preset pour le cache |
| `intentionImageUrl` | string | ❌ | Image pré-générée pour cette intention |
| `previousFrameUrl` | string | ❌ | Frame précédente (continuité) |
| `actorId` | string | ❌ | ID acteur pour le cache |
| `skipCache` | boolean | ❌ | Force régénération |
| `skipCredits` | boolean | ❌ | Skip déduction (test/admin) |

**Response** `200 OK`
```json
{
  "url": "https://fal.media/files/xxx.png",
  "cached": false,
  "usedIntentionImage": true,
  "usedPreviousFrame": false,
  "logId": "uuid"
}
```

---

### POST `/api/generate/video`

Génère une vidéo avec Google Veo 3.1 via fal.ai.

**Auth**: `User`  
**Coût**: `video_veo31_fast` ou `video_veo31_standard` × durée

**Request Body**
```json
{
  "prompt": "Woman talking to camera, excited expression, holding phone",
  "firstFrameUrl": "https://...",
  "engine": "veo3",
  "duration": 6,
  "quality": "fast",
  "campaignId": "uuid",
  "clipId": "uuid",
  "skipCredits": false
}
```

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `prompt` | string | ✅ | Description de la vidéo |
| `firstFrameUrl` | string | ✅ | URL de la première frame |
| `engine` | string | ✅ | Moteur (`veo3`) |
| `duration` | number | ✅ | Durée en secondes (max 8s) |
| `quality` | string | ❌ | `fast` (défaut) ou `standard` |

**Response** `200 OK`
```json
{
  "videoUrl": "https://fal.media/files/xxx.mp4",
  "logId": "uuid",
  "quality": "fast",
  "cost": 600
}
```

---

### POST `/api/generate/voice`

Clone la voix de l'acteur avec ChatterboxHD (Speech-to-Speech).

**Auth**: `User`  
**Coût**: `voice_chatterbox` (25 crédits par défaut)

**Request Body**
```json
{
  "sourceAudioUrl": "https://...",
  "targetVoiceUrl": "https://...",
  "campaignId": "uuid",
  "clipId": "uuid",
  "skipCredits": false
}
```

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `sourceAudioUrl` | string | ✅ | Audio source (extrait de la vidéo Veo) |
| `targetVoiceUrl` | string | ✅ | Échantillon de voix cible (acteur) |

**Response** `200 OK`
```json
{
  "audioUrl": "https://fal.media/files/xxx.wav",
  "logId": "uuid"
}
```

---

### POST `/api/generate/ambient`

Génère un son d'ambiance avec ElevenLabs Sound Effects.

**Auth**: `User`  
**Coût**: `ambient_elevenlabs` (10 crédits par défaut)

**Request Body**
```json
{
  "prompt": "Cozy cafe ambiance, soft chatter, coffee machine",
  "duration": 10,
  "campaignId": "uuid",
  "clipId": "uuid",
  "skipCredits": false
}
```

**Response** `200 OK`
```json
{
  "audioUrl": "https://fal.media/files/xxx.mp3",
  "logId": "uuid"
}
```

---

### POST `/api/generate/mix-video`

Mixe une vidéo avec voix clonée et/ou audio ambiant.

**Auth**: `User`  
**Coût**: Gratuit (post-processing)

**Request Body**
```json
{
  "videoUrl": "https://...",
  "voiceUrl": "https://...",
  "ambientUrl": "https://...",
  "voiceVolume": 100,
  "ambientVolume": 20,
  "duration": 6
}
```

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `videoUrl` | string | ✅ | URL de la vidéo source |
| `voiceUrl` | string | ❌ | URL de la voix clonée |
| `ambientUrl` | string | ❌ | URL de l'audio ambiant |
| `voiceVolume` | number | ❌ | Volume voix 0-100 (défaut: 100) |
| `ambientVolume` | number | ❌ | Volume ambiance 0-100 (défaut: 20) |
| `duration` | number | ✅ | Durée en secondes |

**Comportement**:
- Si `voiceUrl` seul → Remplace l'audio original par la voix clonée
- Si `ambientUrl` seul → Mixe l'audio original avec l'ambiance
- Si les deux → Remplace l'audio par voix clonée + ambiance

**Response** `200 OK`
```json
{
  "videoUrl": "https://transloadit.com/xxx.mp4",
  "mixed": true,
  "method": "transloadit",
  "assemblyId": "xxx"
}
```

---

### POST `/api/generate/process-clip`

Applique trim et/ou changement de vitesse sur un clip.

**Auth**: `User`  
**Coût**: Gratuit (post-processing)

**Request Body**
```json
{
  "videoUrl": "https://...",
  "trimStart": 0.5,
  "trimEnd": 5.5,
  "speed": 1.1,
  "duration": 6
}
```

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `videoUrl` | string | ✅ | URL de la vidéo source |
| `trimStart` | number | ❌ | Début du trim en secondes |
| `trimEnd` | number | ❌ | Fin du trim en secondes |
| `speed` | number | ❌ | Vitesse 0.5-2.0 (défaut: 1.0) |
| `duration` | number | ✅ | Durée originale |

**Response** `200 OK`
```json
{
  "videoUrl": "https://transloadit.com/xxx.mp4",
  "processed": true,
  "originalDuration": 6,
  "newDuration": 4.55,
  "transformations": {
    "trimStart": 0.5,
    "trimEnd": 5.5,
    "speed": 1.1
  }
}
```

---

### POST `/api/generate/transcribe`

Transcrit l'audio d'une vidéo avec timestamps mot par mot.

**Auth**: `User`  
**Coût**: Gratuit

**Request Body**
```json
{
  "audioUrl": "https://...",
  "language": "fr",
  "originalScript": "Tu te sens épuisé après chaque journée ?",
  "videoDuration": 6
}
```

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `audioUrl` | string | ✅ | URL audio/vidéo |
| `language` | string | ❌ | Code langue (auto-détect si absent) |
| `originalScript` | string | ❌ | Script original pour analyse Claude |
| `videoDuration` | number | ❌ | Durée vidéo (défaut: 6) |

**Response** `200 OK`
```json
{
  "text": "Tu te sens épuisé après chaque journée de travail ?",
  "chunks": [
    { "text": "Tu", "timestamp": [0.2, 0.4] },
    { "text": "te", "timestamp": [0.4, 0.5] },
    { "text": "sens", "timestamp": [0.5, 0.8] }
  ],
  "speech_start": 0.2,
  "speech_end": 4.8,
  "confidence": "high",
  "reasoning": "Clear speech boundaries detected...",
  "words_per_second": 3.2,
  "suggested_speed": 1.0
}
```

---

### POST `/api/generate/analyze-clip`

Analyse un clip existant pour extraire les données de transcription.

**Auth**: `User`  
**Coût**: Gratuit

**Request Body**
```json
{
  "clipId": "uuid",
  "videoUrl": "https://...",
  "originalScript": "Tu te sens épuisé ?",
  "videoDuration": 6
}
```

**Response** `200 OK`
```json
{
  "text": "Tu te sens épuisé après chaque journée ?",
  "chunks": [...],
  "speech_start": 0.2,
  "speech_end": 4.8,
  "confidence": "high",
  "words_per_second": 3.2,
  "suggested_speed": 1.0
}
```

---

### POST `/api/generate/regenerate-clip`

Régénère le script d'un clip avec Claude.

**Auth**: `User`  
**Coût**: Gratuit

**Request Body**
```json
{
  "clip": {
    "order": 1,
    "intention": "hook",
    "script": "Ancien script...",
    "duration": 3
  },
  "preset": { ... },
  "brief": { ... },
  "feedback": "Plus punchy, moins formel"
}
```

**Response** `200 OK`
```json
{
  "script": "Nouveau script régénéré..."
}
```

---

### POST `/api/generate/intention-media`

Génère des images par intention pour un acteur (batch).

**Auth**: `User`  
**Coût**: `first_frame` × nombre de presets

**Request Body**
```json
{
  "actorId": "uuid",
  "soulImageUrl": "https://...",
  "presets": [
    {
      "id": "problem_solution",
      "first_frame": {
        "location": "bedroom",
        "lighting": "soft_warm",
        "base_expression": "frustrated",
        "extra_prompt": "holding phone"
      }
    }
  ],
  "customPrompts": {
    "problem_solution": "Custom prompt for this preset"
  }
}
```

**Response** `200 OK`
```json
{
  "success": true,
  "generated": ["problem_solution", "testimonial"],
  "failed": [],
  "intentionMedia": {
    "problem_solution": {
      "image_url": "https://..."
    },
    "testimonial": {
      "image_url": "https://..."
    }
  }
}
```

---

## Assemblage Vidéo

### POST `/api/assemble`

Concatène plusieurs clips en une vidéo finale.

**Auth**: `User`  
**Coût**: Gratuit

**Request Body**
```json
{
  "clips": [
    {
      "rawUrl": "https://...",
      "duration": 5.5,
      "clipOrder": 1
    },
    {
      "rawUrl": "https://...",
      "duration": 4.2,
      "clipOrder": 2
    }
  ],
  "campaignId": "uuid"
}
```

**Response** `200 OK`
```json
{
  "videoUrl": "https://transloadit.com/xxx.mp4",
  "thumbnailUrl": "https://transloadit.com/xxx.jpg",
  "duration": 9.7,
  "clipCount": 2,
  "method": "transloadit-concat",
  "assemblyId": "xxx"
}
```

---

### POST `/api/extract-brief`

Extrait un brief marketing depuis une URL de landing page.

**Auth**: `Public`  
**Coût**: Gratuit

**Request Body**
```json
{
  "url": "https://example.com/product-page"
}
```

**Response** `200 OK`
```json
{
  "success": true,
  "brief": {
    "what_selling": "Application de méditation guidée",
    "pain_point": "Le stress quotidien affecte la santé mentale",
    "target_audience": "Professionnels stressés 25-45 ans",
    "key_benefits": [
      "Réduction du stress en 5 minutes",
      "Meilleur sommeil",
      "Plus de concentration"
    ]
  }
}
```

---

## Administration

### GET `/api/admin/generation-logs`

Récupère les logs de génération avec statistiques.

**Auth**: `Admin`

**Query Parameters**
| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Nombre de résultats (défaut: 50) |
| `offset` | number | Pagination offset |
| `type` | string | Filtrer par type de génération |
| `status` | string | Filtrer par statut |
| `userId` | string | Filtrer par utilisateur |

**Response** `200 OK`
```json
{
  "logs": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "generation_type": "video_veo31_fast",
      "model_path": "fal-ai/veo3/fast",
      "status": "completed",
      "duration_ms": 45000,
      "estimated_cost_cents": 600,
      "actual_cost_cents": 580,
      "billed_cost_cents": 600,
      "created_at": "2025-01-01T12:00:00.000Z"
    }
  ],
  "summary": {
    "total": 1250,
    "completed": 1180,
    "failed": 70,
    "totalEstimatedCost": 125000,
    "totalActualCost": 118000,
    "totalBilled": 125000,
    "avgDurationMs": 42000
  }
}
```

---

### PUT `/api/admin/generation-costs`

Met à jour les coûts de génération.

**Auth**: `Admin`

**Request Body**
```json
{
  "costs": [
    {
      "id": "first_frame",
      "cost_cents": 15,
      "real_cost_cents": 8,
      "is_active": true
    },
    {
      "id": "video_veo31_fast",
      "cost_cents": 100,
      "real_cost_cents": 75,
      "is_active": true
    }
  ]
}
```

**Response** `200 OK`
```json
{
  "success": true
}
```

---

### PUT `/api/admin/subscription-plans`

Met à jour les plans d'abonnement.

**Auth**: `Admin`

**Request Body**
```json
{
  "plans": [
    {
      "id": "pro",
      "name": "Pro",
      "description": "Pour les créateurs sérieux",
      "price_cents": 4900,
      "monthly_credits": 10000,
      "stripe_price_id": "price_xxx",
      "is_active": true,
      "display_order": 2,
      "features": ["15 vidéos/mois", "Support prioritaire"]
    }
  ]
}
```

**Response** `200 OK`
```json
{
  "success": true
}
```

---

## Stripe & Paiements

### POST `/api/stripe/checkout`

Crée une session de checkout Stripe pour un plan.

**Auth**: `User`

**Request Body**
```json
{
  "planId": "pro"
}
```

**Response** `200 OK`
```json
{
  "url": "https://checkout.stripe.com/c/pay/xxx"
}
```

**Erreurs possibles**:
- `404` - Plan non trouvé
- `400` - Plan non configuré sur Stripe
- `400` - Offre Early Bird déjà utilisée/expirée

---

### POST `/api/stripe/custom-checkout`

Crée une session de checkout avec montant personnalisé (admin only).

**Auth**: `Admin`

**Request Body**
```json
{
  "amount": 5000
}
```

**Response** `200 OK`
```json
{
  "url": "https://checkout.stripe.com/c/pay/xxx"
}
```

---

### POST `/api/stripe/portal`

Crée une session vers le portail client Stripe.

**Auth**: `User`

**Response** `200 OK`
```json
{
  "url": "https://billing.stripe.com/p/session/xxx"
}
```

---

### POST `/api/stripe/webhook`

Webhook Stripe pour les événements de paiement.

**Auth**: Signature Stripe (`stripe-signature` header)

**Events traités**:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Ajoute crédits / Active abonnement |
| `invoice.paid` | Renouvellement mensuel (ajoute crédits) |
| `customer.subscription.updated` | Met à jour le statut abonnement |
| `customer.subscription.deleted` | Annule l'abonnement |

---

## Codes d'erreur

| Code | Description |
|------|-------------|
| `400` | Requête invalide (paramètres manquants) |
| `401` | Non authentifié |
| `402` | Crédits insuffisants (`INSUFFICIENT_CREDITS`) |
| `403` | Accès refusé (admin requis) |
| `404` | Ressource non trouvée |
| `500` | Erreur serveur |

### Format d'erreur standard

```json
{
  "error": "Message d'erreur lisible"
}
```

### Format d'erreur crédits insuffisants

```json
{
  "error": "Crédits insuffisants",
  "code": "INSUFFICIENT_CREDITS",
  "required": 600,
  "current": 100,
  "missing": 500,
  "isEarlyBirdEligible": true
}
```

---

## Types & Interfaces

### GenerationType

```typescript
type GenerationType = 
  | 'first_frame'           // Image première frame
  | 'video_veo31_fast'      // Vidéo Veo 3.1 Fast
  | 'video_veo31_standard'  // Vidéo Veo 3.1 Standard
  | 'voice_chatterbox'      // Clone voix
  | 'ambient_elevenlabs'    // Audio ambiant
```

### VideoQuality

```typescript
type VideoQuality = 'fast' | 'standard'
```

### Actor

```typescript
interface Actor {
  id: string
  name: string
  soul_image_url: string
  voice_sample_url?: string
  intention_media?: Record<string, ActorIntentionMedia>
}

interface ActorIntentionMedia {
  image_url?: string
  video_url?: string
}
```

### CampaignBrief

```typescript
interface CampaignBrief {
  what_selling: string
  pain_point: string
  target_audience: string
  key_benefits: string[]
}
```

### CampaignClip

```typescript
interface CampaignClip {
  id: string
  order: number
  intention: string
  duration: number
  script: string
  visual_prompt: string
  ambient_prompt?: string
  first_frame_url?: string
  raw_video_url?: string
  mixed_video_url?: string
  processed_video_url?: string
  voice_audio_url?: string
  ambient_audio_url?: string
  transcription?: ClipTranscription
}

interface ClipTranscription {
  text: string
  chunks: Array<{ text: string; timestamp: [number, number] }>
  speech_start: number
  speech_end: number
  words_per_second: number
  suggested_speed: number
}
```

---

## Services Externes

| Service | Usage | Documentation |
|---------|-------|---------------|
| **Supabase** | Auth, DB, Storage | [supabase.com/docs](https://supabase.com/docs) |
| **fal.ai** | IA (Veo, NanoBanana, Whisper...) | [fal.ai/docs](https://fal.ai/docs) |
| **Anthropic** | Claude Sonnet 4 | [docs.anthropic.com](https://docs.anthropic.com) |
| **Transloadit** | Processing vidéo | [transloadit.com/docs](https://transloadit.com/docs) |
| **Stripe** | Paiements | [stripe.com/docs](https://stripe.com/docs) |
| **Jina Reader** | Extraction contenu URL | [jina.ai](https://jina.ai) |

---

## Pipeline de Génération Typique

```
┌─────────────────────────────────────────────────────────────────┐
│                         PHASE 1: PLANIFICATION                   │
├─────────────────────────────────────────────────────────────────┤
│  1. POST /api/generate/plan                                      │
│     └── Génère le plan de campagne avec Claude                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 2: GÉNÉRATION (par clip)                │
├─────────────────────────────────────────────────────────────────┤
│  2. POST /api/generate/first-frame                               │
│     └── Génère la première frame (NanoBanana Pro)               │
│                              │                                   │
│  3. POST /api/generate/video                                     │
│     └── Génère la vidéo brute (Veo 3.1)                         │
│                              │                                   │
│  4. POST /api/generate/transcribe                                │
│     └── Transcrit + analyse speech boundaries                    │
│                              │                                   │
│  5. POST /api/generate/voice                                     │
│     └── Clone la voix de l'acteur (ChatterboxHD)                │
│                              │                                   │
│  6. POST /api/generate/ambient                                   │
│     └── Génère l'audio ambiant (ElevenLabs)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 3: POST-PRODUCTION                      │
├─────────────────────────────────────────────────────────────────┤
│  7. POST /api/generate/mix-video                                 │
│     └── Mixe vidéo + voix + ambiance (Transloadit)              │
│                              │                                   │
│  8. POST /api/generate/process-clip                              │
│     └── Applique trim + speed (FFmpeg)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PHASE 4: ASSEMBLAGE FINAL                    │
├─────────────────────────────────────────────────────────────────┤
│  9. POST /api/assemble                                           │
│     └── Concatène tous les clips en vidéo finale                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Rate Limiting

Actuellement, aucun rate limiting n'est implémenté au niveau API. Le contrôle se fait via :
- **Crédits** : Chaque génération coûte des crédits
- **Quotas fal.ai** : Limites du provider IA

---

## Changelog

### v1.0.0 (2025-01-04)
- Documentation initiale
- 24 endpoints documentés
- Pipeline de génération complet

---

*Généré pour UGC AI App - Tous droits réservés*

