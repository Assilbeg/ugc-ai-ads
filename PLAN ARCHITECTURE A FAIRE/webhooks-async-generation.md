# Plan Architecture : Webhooks Async pour Génération Vidéo

---

## ⚠️ AVANT DE COMMENCER - Instructions pour le LLM

> **IMPORTANT** : Avant d'implémenter quoi que ce soit de ce plan, le LLM (Claude, GPT, etc.) **DOIT** :
> 
> 1. **Lire et comprendre** tous les fichiers existants listés ci-dessous
> 2. **Analyser** les patterns, conventions et abstractions déjà en place
> 3. **Ne pas inventer** de code qui pourrait dupliquer ou casser l'existant
> 4. **Poser des questions** si quelque chose n'est pas clair
> 
> Le code de ce plan est un **guide**, pas du copier-coller. Il doit être adapté aux patterns existants du projet.

### 📖 Fichiers à lire et comprendre OBLIGATOIREMENT

| Fichier | Pourquoi le lire | Points clés à comprendre |
|---------|------------------|--------------------------|
| `lib/api/falai.ts` | C'est ici qu'on interagit avec Fal.ai | - Comment `falRequest` fonctionne<br>- Le pattern `pollUntilCompleteWithUrls`<br>- Les types `FalQueueResponse`, `VideoQuality`<br>- Comment sont gérés les `request_id` |
| `app/api/generate/video/route.ts` | Route actuelle de génération vidéo | - Flow complet actuel<br>- Gestion des crédits (`getUserCredits`, `deductCredits`)<br>- Logging (`createGenerationLog`, `markGenerationCompleted`)<br>- Pattern de gestion d'erreurs |
| `hooks/use-video-generation.ts` | Hook React qui orchestre la génération | - Comment `generateAllClips` et `regenerateSingleClip` fonctionnent<br>- Gestion du state `progress`<br>- Pattern d'abort avec `AbortController`<br>- Comment les clips sont mis à jour |
| `components/steps/step6-generate.tsx` | UI de génération | - Comment l'UI affiche le progress<br>- Pattern de régénération<br>- Système de versioning des clips |
| `lib/generation-logger.ts` | Logging des générations | - Pattern de logging existant<br>- Relation avec la table `generation_logs`<br>- Ne pas dupliquer cette logique |
| `lib/credits.ts` | Système de crédits | - `checkCredits`, `deductCredits`<br>- Gestion des admins (`isAdminEmail`)<br>- Pattern de facturation |
| `lib/supabase/server.ts` | Client Supabase côté serveur | - Comment créer un client<br>- Pattern d'authentification |

### 🔍 Questions à se poser avant d'implémenter

1. **Table `generation_jobs` vs `generation_logs`** : Est-ce qu'on doit fusionner avec la table existante `generation_logs` ou créer une nouvelle table ? → **Lire `lib/generation-logger.ts` et regarder le schéma de `generation_logs`**

2. **Gestion des crédits** : Quand déduire les crédits avec l'architecture async ? Avant la soumission ? Après le webhook ? → **Lire le flow actuel dans `app/api/generate/video/route.ts`**

3. **AbortController** : Comment gérer l'annulation avec les webhooks ? L'utilisateur peut-il annuler un job en cours ? → **Lire `hooks/use-video-generation.ts`**

4. **Versioning des clips** : Comment le système de versions interagit avec les jobs async ? → **Lire `archiveClipVersion` dans `step6-generate.tsx`**

5. **Service Role Key** : Est-ce qu'on a déjà un client admin Supabase quelque part ? → **Chercher `SUPABASE_SERVICE_ROLE_KEY` dans le projet**

### 🚫 Erreurs à éviter

- **NE PAS** créer un nouveau système de logging si `generation_logs` existe déjà
- **NE PAS** dupliquer la logique de crédits
- **NE PAS** ignorer le pattern `maxDuration` déjà en place
- **NE PAS** oublier les types TypeScript existants (`CampaignClip`, `VideoQuality`, etc.)
- **NE PAS** créer de nouveaux fichiers si on peut modifier les existants

---

## 📋 Résumé

### Contexte du projet

Cette app génère des vidéos UGC (User Generated Content) pour TikTok/Instagram en utilisant :
- **Fal.ai** pour la génération IA (Veo 3.1 pour vidéo, NanoBanana pour images, Whisper pour transcription, etc.)
- **Supabase** pour la base de données et l'authentification
- **Next.js** en App Router pour le frontend et les API routes
- **Vercel** pour l'hébergement

### Problème actuel

L'architecture actuelle utilise du **polling synchrone** :

```
[Browser] ──HTTP POST──► [Vercel API Route] ──poll loop──► [Fal.ai]
              │                   │                            │
              │                   │   (boucle toutes les 10s)  │
              │                   │◄────────────────────────────┤
              │                   │   pendant 5-30 minutes      │
              │◄──────────────────┤                            │
              │   (connexion HTTP ouverte tout ce temps)       │
```

**Problèmes** :
1. **Timeout Vercel Pro = 300s max (5 min)** - Si Veo 3.1 met plus de 5 min → échec
2. **Connexion HTTP fragile** - Proxy, WiFi instable, navigateur fermé → génération perdue
3. **Workers bloqués** - 1 worker Vercel monopolisé par requête pendant 5-30 min
4. **Pas de reprise** - Si ça échoue, il faut tout recommencer

### Solution : Webhooks asynchrones

```
[Browser] ──POST──► [API Route] ──submit──► [Fal.ai]
    │                   │                      │
    │◄──{jobId}─────────┤  (retour en 1-2s)   │
    │                   │                      │
    │──poll /api/jobs───►                      │  (Fal.ai génère pendant 2-10 min)
    │◄──{status}────────┤                      │
    │        ...        │                      │
    │                   │◄─────webhook─────────┤  (Fal.ai a fini)
    │──poll /api/jobs───►                      │
    │◄──{completed}─────┤                      │
    │                   │                      │
    🎉 Vidéo prête !
```

---

## 🏗️ Architecture Cible Détaillée

### Diagramme de séquence complet

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         ARCHITECTURE WEBHOOKS ASYNC                              │
└──────────────────────────────────────────────────────────────────────────────────┘

ÉTAPE 1: SOUMISSION DU JOB
═════════════════════════

[Frontend React]                    [API Route]                    [Fal.ai]
      │                                  │                            │
      │ POST /api/generate/video         │                            │
      │ {prompt, firstFrameUrl, ...}     │                            │
      │─────────────────────────────────►│                            │
      │                                  │                            │
      │                                  │ 1. Vérifier auth           │
      │                                  │ 2. Vérifier crédits        │
      │                                  │ 3. Créer job en BDD        │
      │                                  │    (status: 'pending')     │
      │                                  │                            │
      │                                  │ POST queue.fal.run/...     │
      │                                  │ {prompt, image_url,        │
      │                                  │  webhook_url: notre URL}   │
      │                                  │───────────────────────────►│
      │                                  │                            │
      │                                  │◄───────────────────────────│
      │                                  │ {request_id, status_url,   │
      │                                  │  response_url}             │
      │                                  │                            │
      │                                  │ 4. Update job en BDD       │
      │                                  │    (status: 'submitted',   │
      │                                  │     fal_request_id: ...)   │
      │                                  │                            │
      │◄─────────────────────────────────│                            │
      │ {jobId, status: 'submitted'}     │                            │
      │                                  │                            │
      │ ✅ Retour en 1-2 secondes !      │                            │


ÉTAPE 2: POLLING DU STATUS (pendant que Fal.ai génère)
═════════════════════════════════════════════════════

[Frontend React]                    [API Route]                    [Supabase]
      │                                  │                            │
      │ (toutes les 3 secondes)          │                            │
      │ GET /api/jobs/{jobId}            │                            │
      │─────────────────────────────────►│                            │
      │                                  │ SELECT * FROM              │
      │                                  │ generation_jobs            │
      │                                  │ WHERE id = jobId           │
      │                                  │───────────────────────────►│
      │                                  │◄───────────────────────────│
      │                                  │ {status: 'submitted',      │
      │◄─────────────────────────────────│  progress: 0}              │
      │ {status: 'submitted'}            │                            │
      │                                  │                            │
      │ (3s plus tard...)                │                            │
      │ GET /api/jobs/{jobId}            │                            │
      │─────────────────────────────────►│                            │
      │◄─────────────────────────────────│                            │
      │ {status: 'submitted'}            │                            │
      │                                  │                            │
      │ ... (continue pendant 2-10 min)  │                            │


ÉTAPE 3: WEBHOOK DE FAL.AI (quand la génération est terminée)
════════════════════════════════════════════════════════════

[Fal.ai]                           [Webhook Handler]               [Supabase]
   │                                      │                            │
   │ POST /api/webhooks/fal               │                            │
   │ {request_id: "xxx",                  │                            │
   │  status: "COMPLETED",                │                            │
   │  response: {video: {url: "..."}}}    │                            │
   │─────────────────────────────────────►│                            │
   │                                      │                            │
   │                                      │ 1. Valider signature       │
   │                                      │                            │
   │                                      │ 2. Trouver le job          │
   │                                      │    par fal_request_id      │
   │                                      │───────────────────────────►│
   │                                      │◄───────────────────────────│
   │                                      │                            │
   │                                      │ 3. Update job              │
   │                                      │    status: 'completed'     │
   │                                      │    result_url: "..."       │
   │                                      │───────────────────────────►│
   │                                      │                            │
   │                                      │ 4. Update campaign_clips   │
   │                                      │    si clip_id fourni       │
   │                                      │───────────────────────────►│
   │                                      │                            │
   │◄─────────────────────────────────────│                            │
   │ {success: true}                      │                            │


ÉTAPE 4: FRONTEND DÉTECTE LA COMPLETION
══════════════════════════════════════

[Frontend React]                    [API Route]                    [Supabase]
      │                                  │                            │
      │ GET /api/jobs/{jobId}            │                            │
      │─────────────────────────────────►│                            │
      │                                  │───────────────────────────►│
      │                                  │◄───────────────────────────│
      │◄─────────────────────────────────│                            │
      │ {status: 'completed',            │                            │
      │  resultUrl: 'https://...'}       │                            │
      │                                  │                            │
      │ 🎉 Afficher la vidéo !           │                            │
```

---

## 📁 Fichiers à Créer/Modifier

### Vue d'ensemble

```
ugc-ai-app/
├── supabase/
│   └── generation_jobs.sql          ← CRÉER (nouvelle table)
│
├── lib/
│   └── api/
│       └── falai.ts                 ← MODIFIER (ajouter mode async)
│
├── app/api/
│   ├── webhooks/
│   │   └── fal/
│   │       └── route.ts             ← CRÉER (webhook handler)
│   │
│   ├── jobs/
│   │   └── [id]/
│   │       └── route.ts             ← CRÉER (GET job status)
│   │
│   └── generate/
│       ├── video/route.ts           ← MODIFIER (mode async)
│       ├── voice/route.ts           ← MODIFIER (mode async)
│       ├── ambient/route.ts         ← MODIFIER (mode async)
│       └── first-frame/route.ts     ← MODIFIER (mode async)
│
└── hooks/
    └── use-video-generation.ts      ← MODIFIER (polling client)
```

---

### 1. Nouvelle table Supabase : `generation_jobs`

**Fichier à créer :** `supabase/generation_jobs.sql`

**Explication :**
Cette table stocke tous les jobs de génération en cours et terminés. Elle permet :
- De tracker le status de chaque génération
- De faire le lien entre `fal_request_id` (côté Fal.ai) et nos données
- De reprendre une génération si l'utilisateur recharge la page
- D'avoir un historique pour debugging/monitoring

**⚠️ ATTENTION avant d'implémenter :**
- Vérifier si la table `generation_logs` existante pourrait être étendue au lieu de créer une nouvelle table
- Lire `lib/generation-logger.ts` pour comprendre le système de logging actuel

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: generation_jobs
-- Track async generation jobs (video, voice, ambient, first_frame)
-- 
-- DIFFÉRENCE avec generation_logs :
-- - generation_logs = historique pour facturation/analytics (immutable)
-- - generation_jobs = état courant des jobs async (mutable)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- ═══════════════════════════════════════════════════════════════════════
  -- IDENTIFIANTS
  -- ═══════════════════════════════════════════════════════════════════════
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  clip_id UUID REFERENCES campaign_clips(id) ON DELETE SET NULL,
  
  -- Lien avec generation_logs pour éviter duplication
  generation_log_id UUID REFERENCES generation_logs(id) ON DELETE SET NULL,
  
  -- ═══════════════════════════════════════════════════════════════════════
  -- TYPE DE GÉNÉRATION
  -- Doit correspondre aux types dans lib/credits.ts (GenerationType)
  -- ═══════════════════════════════════════════════════════════════════════
  job_type TEXT NOT NULL CHECK (job_type IN (
    'video_veo31_fast',      -- Correspond à generation_types.generation_type
    'video_veo31_standard',
    'first_frame',
    'voice_chatterbox',
    'ambient_elevenlabs',
    'transcribe_whisper'
  )),
  
  -- ═══════════════════════════════════════════════════════════════════════
  -- FAL.AI IDENTIFIERS
  -- Retournés par l'API Fal.ai lors de la soumission du job
  -- ═══════════════════════════════════════════════════════════════════════
  fal_request_id TEXT,           -- ID unique du job côté Fal.ai
  fal_status_url TEXT,           -- URL pour vérifier le status (si besoin de poll)
  fal_response_url TEXT,         -- URL pour récupérer le résultat
  
  -- ═══════════════════════════════════════════════════════════════════════
  -- STATUS DU JOB
  -- ═══════════════════════════════════════════════════════════════════════
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Job créé en BDD, pas encore soumis à Fal.ai
    'submitted',    -- Soumis à Fal.ai, en attente de traitement
    'in_progress',  -- Fal.ai est en train de générer
    'completed',    -- Terminé avec succès
    'failed',       -- Échec (erreur Fal.ai ou autre)
    'cancelled'     -- Annulé par l'utilisateur (si on implémente ça)
  )),
  
  -- ═══════════════════════════════════════════════════════════════════════
  -- INPUT / OUTPUT
  -- ═══════════════════════════════════════════════════════════════════════
  input_params JSONB NOT NULL,   -- Paramètres envoyés à Fal.ai (pour retry/debug)
  result_url TEXT,               -- URL du résultat (vidéo, audio, image)
  result_data JSONB,             -- Données complètes retournées par Fal.ai
  error_message TEXT,            -- Message d'erreur si status = 'failed'
  
  -- ═══════════════════════════════════════════════════════════════════════
  -- BILLING
  -- Cohérent avec le système de crédits existant (lib/credits.ts)
  -- ═══════════════════════════════════════════════════════════════════════
  estimated_cost_cents INTEGER,  -- Coût estimé avant génération
  actual_cost_cents INTEGER,     -- Coût réel après génération
  credits_deducted BOOLEAN DEFAULT FALSE,  -- True si crédits déjà débités
  
  -- ═══════════════════════════════════════════════════════════════════════
  -- PROGRESS (optionnel)
  -- Certaines APIs Fal.ai fournissent un progress, d'autres non
  -- ═══════════════════════════════════════════════════════════════════════
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  progress_message TEXT,         -- Message de status (ex: "Generating video...")
  
  -- ═══════════════════════════════════════════════════════════════════════
  -- TIMESTAMPS
  -- ═══════════════════════════════════════════════════════════════════════
  created_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,      -- Quand soumis à Fal.ai
  completed_at TIMESTAMPTZ,      -- Quand terminé (succès ou échec)
  
  -- ═══════════════════════════════════════════════════════════════════════
  -- METADATA
  -- ═══════════════════════════════════════════════════════════════════════
  retry_count INTEGER DEFAULT 0, -- Nombre de tentatives (si on implémente auto-retry)
  webhook_received_at TIMESTAMPTZ -- Quand le webhook a été reçu
);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- Optimiser les queries fréquentes
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX idx_generation_jobs_user_id ON generation_jobs(user_id);
CREATE INDEX idx_generation_jobs_user_status ON generation_jobs(user_id, status);
CREATE INDEX idx_generation_jobs_fal_request_id ON generation_jobs(fal_request_id);
CREATE INDEX idx_generation_jobs_campaign_clip ON generation_jobs(campaign_id, clip_id);
CREATE INDEX idx_generation_jobs_pending ON generation_jobs(status) WHERE status IN ('pending', 'submitted', 'in_progress');

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs ne voient que leurs propres jobs
CREATE POLICY "Users can view own jobs" ON generation_jobs
  FOR SELECT USING (auth.uid() = user_id);

-- Les utilisateurs peuvent créer des jobs pour eux-mêmes
CREATE POLICY "Users can create own jobs" ON generation_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent annuler leurs propres jobs (update status = 'cancelled')
CREATE POLICY "Users can cancel own jobs" ON generation_jobs
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status IN ('pending', 'submitted', 'in_progress'));

-- Service role peut tout faire (pour les webhooks qui n'ont pas de user auth)
-- Note: Il faut utiliser supabaseAdmin (service role key) dans le webhook handler
```

---

### 2. Modifier `lib/api/falai.ts`

**Explication :**
On ajoute des fonctions pour le mode async (soumission sans attente). 
Le code existant de polling reste en place pour le fallback.

**⚠️ AVANT D'IMPLÉMENTER :**
- Lire tout le fichier `falai.ts` actuel
- Comprendre `falRequest`, `pollUntilCompleteWithUrls`
- Vérifier le format exact des réponses Fal.ai
- Regarder la doc Fal.ai pour les webhooks : https://fal.ai/docs/webhooks

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// AJOUTER À LA FIN DE lib/api/falai.ts
// MODE ASYNC - Submit job sans attendre (pour architecture webhooks)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Résultat de la soumission d'un job (sans attendre le résultat)
 */
export interface FalJobSubmission {
  requestId: string      // ID unique du job côté Fal.ai
  statusUrl: string      // URL pour vérifier le status manuellement
  responseUrl: string    // URL pour récupérer le résultat quand terminé
}

/**
 * Submit un job vidéo Veo 3.1 SANS attendre le résultat
 * 
 * La différence avec generateVideoVeo31() :
 * - generateVideoVeo31() fait un polling jusqu'à completion (bloquant)
 * - submitVideoJobAsync() retourne immédiatement après soumission
 * 
 * Fal.ai appellera notre webhook quand la génération sera terminée.
 * 
 * @param prompt - Prompt pour la vidéo
 * @param firstFrameUrl - URL de la première frame
 * @param duration - Durée en secondes (4, 6, ou 8)
 * @param quality - 'standard' ou 'fast'
 * @param webhookUrl - URL de notre webhook (optionnel, peut être configuré sur Fal.ai dashboard)
 * @returns Infos de soumission (requestId, statusUrl, responseUrl)
 */
export async function submitVideoJobAsync(
  prompt: string,
  firstFrameUrl: string,
  duration: 4 | 6 | 8 = 6,
  quality: VideoQuality = 'standard',
  webhookUrl?: string
): Promise<FalJobSubmission> {
  const path = getVeo31Endpoint(quality)
  
  // Note: Vérifier dans la doc Fal.ai le nom exact du paramètre webhook
  // Ça peut être "webhook_url", "webhook", ou configuré via headers
  const input: Veo31Input & { webhook_url?: string } = {
    prompt,
    image_url: firstFrameUrl,
    duration: `${duration}s`,
    aspect_ratio: '9:16',
  }
  
  if (webhookUrl) {
    input.webhook_url = webhookUrl
  }

  console.log(`[Veo3.1 ASYNC] Submitting job:`, { 
    duration, 
    quality,
    endpoint: path,
    hasWebhook: !!webhookUrl,
    promptPreview: prompt.slice(0, 50) + '...'
  })

  // falRequest retourne immédiatement avec les infos de queue
  // On ne fait PAS de polling ici
  const queue = await falRequest<FalQueueResponse>({ path, input })
  
  console.log(`[Veo3.1 ASYNC] ✓ Job submitted:`, {
    requestId: queue.request_id,
    status: queue.status
  })
  
  return {
    requestId: queue.request_id,
    statusUrl: queue.status_url,
    responseUrl: queue.response_url,
  }
}

/**
 * Submit un job first frame SANS attendre le résultat
 */
export async function submitFirstFrameJobAsync(
  soulImageUrl: string,
  prompt: string,
  webhookUrl?: string
): Promise<FalJobSubmission> {
  // Note: NanoBanana Pro utilise l'endpoint synchrone (fal.run, pas queue.fal.run)
  // Il faudra vérifier si Fal.ai supporte les webhooks pour ce modèle
  // Sinon, garder le mode synchrone car c'est rapide (~10s)
  
  throw new Error('TODO: Vérifier si NanoBanana Pro supporte les webhooks')
}

/**
 * Submit un job voice conversion SANS attendre le résultat
 */
export async function submitVoiceJobAsync(
  sourceAudioUrl: string,
  targetVoiceUrl: string,
  webhookUrl?: string
): Promise<FalJobSubmission> {
  const path = 'resemble-ai/chatterboxhd/speech-to-speech'
  
  const input = {
    source_audio_url: sourceAudioUrl,
    target_voice_audio_url: targetVoiceUrl,
    high_quality_audio: true,
    ...(webhookUrl && { webhook_url: webhookUrl }),
  }

  console.log(`[Chatterbox ASYNC] Submitting job`)

  const queue = await falRequest<FalQueueResponse>({ path, input })
  
  return {
    requestId: queue.request_id,
    statusUrl: queue.status_url,
    responseUrl: queue.response_url,
  }
}

/**
 * Submit un job ambient audio SANS attendre le résultat
 */
export async function submitAmbientJobAsync(
  description: string,
  durationSeconds: number = 10,
  webhookUrl?: string
): Promise<FalJobSubmission> {
  const path = 'fal-ai/elevenlabs/sound-effects/v2'
  
  const input = {
    text: description,
    duration_seconds: Math.min(durationSeconds, 22),
    prompt_influence: 0.5,
    ...(webhookUrl && { webhook_url: webhookUrl }),
  }

  console.log(`[ElevenLabs ASYNC] Submitting job`)

  const queue = await falRequest<FalQueueResponse>({ path, input })
  
  return {
    requestId: queue.request_id,
    statusUrl: queue.status_url,
    responseUrl: queue.response_url,
  }
}

/**
 * Vérifier le status d'un job manuellement (backup si webhook rate)
 * Utilise les fonctions existantes checkStatusByUrl
 */
export async function checkJobStatusAsync(statusUrl: string): Promise<{
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  logs?: Array<{ message: string; timestamp: string }>
}> {
  return checkStatusByUrl(statusUrl)
}

/**
 * Récupérer le résultat d'un job terminé manuellement
 */
export async function getJobResultAsync<T>(responseUrl: string): Promise<T> {
  return getResultByUrl<T>(responseUrl)
}
```

---

### 3. Créer le webhook handler

**Fichier à créer :** `app/api/webhooks/fal/route.ts`

**Explication :**
Ce endpoint reçoit les notifications de Fal.ai quand une génération est terminée.
Il doit être **public** (pas d'auth) mais **sécurisé** (validation de signature).

**⚠️ AVANT D'IMPLÉMENTER :**
- Vérifier la doc Fal.ai sur le format exact du payload webhook
- Vérifier si Fal.ai signe les webhooks et comment
- S'assurer qu'on a `SUPABASE_SERVICE_ROLE_KEY` dans les env vars
- Tester avec ngrok en local avant de déployer

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK HANDLER POUR FAL.AI
// 
// Ce endpoint est appelé par Fal.ai quand une génération est terminée.
// Il n'y a PAS d'authentification utilisateur (c'est Fal.ai qui appelle).
// On utilise le service role pour accéder à Supabase.
// ═══════════════════════════════════════════════════════════════════════════

// Client Supabase avec service role (bypasse RLS)
// IMPORTANT: Ne jamais exposer cette clé côté client !
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Secret pour valider les webhooks (à configurer sur Fal.ai dashboard)
const FAL_WEBHOOK_SECRET = process.env.FAL_WEBHOOK_SECRET

/**
 * Format du payload envoyé par Fal.ai
 * ⚠️ VÉRIFIER DANS LA DOC FAL.AI - ce format peut changer
 */
interface FalWebhookPayload {
  request_id: string
  status: 'COMPLETED' | 'FAILED'
  // Le format de response dépend du modèle utilisé
  response?: {
    video?: { url: string }           // Veo 3.1
    audio?: { url: string }           // Chatterbox, ElevenLabs
    images?: Array<{ url: string }>   // NanoBanana
    // ... autres champs possibles
  }
  error?: string
  // Fal.ai peut envoyer d'autres champs (logs, metrics, etc.)
}

/**
 * Valider la signature du webhook (si Fal.ai le supporte)
 * ⚠️ TODO: Implémenter selon la doc Fal.ai
 */
function validateWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    // Si pas de signature ou secret, on skip la validation
    // C'est moins sécurisé mais permet de tester
    console.warn('[Webhook Fal] No signature validation - not recommended for production')
    return true
  }
  
  // TODO: Implémenter HMAC validation selon la doc Fal.ai
  // const crypto = require('crypto')
  // const hmac = crypto.createHmac('sha256', secret)
  // const expected = hmac.update(payload).digest('hex')
  // return signature === expected
  
  return true // Placeholder - à implémenter
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // ═════════════════════════════════════════════════════════════════════
    // 1. LIRE ET VALIDER LE PAYLOAD
    // ═════════════════════════════════════════════════════════════════════
    const rawBody = await request.text()
    const signature = request.headers.get('x-fal-signature') // Nom du header à vérifier
    
    if (FAL_WEBHOOK_SECRET && !validateWebhookSignature(rawBody, signature, FAL_WEBHOOK_SECRET)) {
      console.error('[Webhook Fal] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    
    const payload = JSON.parse(rawBody) as FalWebhookPayload
    
    console.log('[Webhook Fal] Received:', {
      request_id: payload.request_id,
      status: payload.status,
      hasResponse: !!payload.response,
      hasError: !!payload.error,
    })

    // ═════════════════════════════════════════════════════════════════════
    // 2. TROUVER LE JOB CORRESPONDANT
    // ═════════════════════════════════════════════════════════════════════
    const { data: job, error: findError } = await supabaseAdmin
      .from('generation_jobs')
      .select('*')
      .eq('fal_request_id', payload.request_id)
      .single()

    if (findError || !job) {
      // Job pas trouvé - peut arriver si:
      // - Le job a été supprimé
      // - Le request_id ne correspond pas
      // - C'est un webhook de test
      console.error('[Webhook Fal] Job not found:', payload.request_id, findError?.message)
      
      // On retourne 200 quand même pour que Fal.ai ne retry pas
      return NextResponse.json({ 
        warning: 'Job not found',
        request_id: payload.request_id 
      }, { status: 200 })
    }

    // ═════════════════════════════════════════════════════════════════════
    // 3. TRAITER SELON LE STATUS
    // ═════════════════════════════════════════════════════════════════════
    if (payload.status === 'COMPLETED') {
      await handleJobCompleted(job, payload)
    } else if (payload.status === 'FAILED') {
      await handleJobFailed(job, payload)
    } else {
      console.warn('[Webhook Fal] Unknown status:', payload.status)
    }

    const duration = Date.now() - startTime
    console.log(`[Webhook Fal] ✓ Processed in ${duration}ms`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[Webhook Fal] Error:', error)
    
    // Retourner 500 pour que Fal.ai retry (si configuré)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Traiter un job terminé avec succès
 */
async function handleJobCompleted(job: any, payload: FalWebhookPayload) {
  // Extraire l'URL du résultat selon le type de job
  let resultUrl: string | null = null
  
  if (payload.response?.video?.url) {
    resultUrl = payload.response.video.url
  } else if (payload.response?.audio?.url) {
    resultUrl = payload.response.audio.url
  } else if (payload.response?.images?.[0]?.url) {
    resultUrl = payload.response.images[0].url
  }

  // Mettre à jour le job
  const { error: updateError } = await supabaseAdmin
    .from('generation_jobs')
    .update({
      status: 'completed',
      result_url: resultUrl,
      result_data: payload.response,
      completed_at: new Date().toISOString(),
      webhook_received_at: new Date().toISOString(),
      progress_percent: 100,
    })
    .eq('id', job.id)

  if (updateError) {
    console.error('[Webhook Fal] Error updating job:', updateError)
    throw updateError
  }

  // Si le job est lié à un clip, mettre à jour le clip aussi
  if (job.clip_id && resultUrl) {
    await updateClipWithResult(job, resultUrl)
  }

  // Déduire les crédits si pas déjà fait
  if (!job.credits_deducted && job.actual_cost_cents) {
    await deductCreditsForJob(job)
  }

  console.log('[Webhook Fal] ✓ Job completed:', job.id, {
    resultUrl: resultUrl?.slice(0, 50) + '...',
    clipId: job.clip_id
  })
}

/**
 * Traiter un job en échec
 */
async function handleJobFailed(job: any, payload: FalWebhookPayload) {
  const { error: updateError } = await supabaseAdmin
    .from('generation_jobs')
    .update({
      status: 'failed',
      error_message: payload.error || 'Unknown error from Fal.ai',
      completed_at: new Date().toISOString(),
      webhook_received_at: new Date().toISOString(),
    })
    .eq('id', job.id)

  if (updateError) {
    console.error('[Webhook Fal] Error updating failed job:', updateError)
    throw updateError
  }

  console.error('[Webhook Fal] ✗ Job failed:', job.id, payload.error)
  
  // TODO: Envoyer une notification à l'utilisateur ?
  // TODO: Auto-retry si c'est une erreur temporaire ?
}

/**
 * Mettre à jour le clip avec le résultat de la génération
 */
async function updateClipWithResult(job: any, resultUrl: string) {
  const { clip_id, job_type } = job
  
  // Récupérer le clip actuel
  const { data: clip, error: fetchError } = await supabaseAdmin
    .from('campaign_clips')
    .select('*')
    .eq('id', clip_id)
    .single()

  if (fetchError || !clip) {
    console.error('[Webhook Fal] Clip not found:', clip_id)
    return
  }

  // Construire l'update selon le type de job
  const updatedClip = { ...clip }
  
  switch (job_type) {
    case 'video_veo31_fast':
    case 'video_veo31_standard':
      updatedClip.video = { 
        ...updatedClip.video, 
        raw_url: resultUrl,
        generated_at: new Date().toISOString()
      }
      updatedClip.status = 'video_ready'
      break
      
    case 'first_frame':
      updatedClip.first_frame = { 
        ...updatedClip.first_frame, 
        image_url: resultUrl,
        generated_at: new Date().toISOString()
      }
      break
      
    case 'voice_chatterbox':
      updatedClip.audio = { 
        ...updatedClip.audio, 
        voice_url: resultUrl 
      }
      break
      
    case 'ambient_elevenlabs':
      updatedClip.audio = { 
        ...updatedClip.audio, 
        ambient_url: resultUrl 
      }
      break
  }

  const { error: updateError } = await supabaseAdmin
    .from('campaign_clips')
    .update(updatedClip)
    .eq('id', clip_id)

  if (updateError) {
    console.error('[Webhook Fal] Error updating clip:', updateError)
  } else {
    console.log('[Webhook Fal] ✓ Clip updated:', clip_id)
  }
}

/**
 * Déduire les crédits après génération réussie
 * ⚠️ TODO: Adapter selon le système de crédits existant (lib/credits.ts)
 */
async function deductCreditsForJob(job: any) {
  try {
    // Utiliser la RPC existante si elle existe
    const { error } = await supabaseAdmin.rpc('deduct_credits', {
      p_user_id: job.user_id,
      p_amount: job.actual_cost_cents || job.estimated_cost_cents,
      p_description: `Génération ${job.job_type}`,
      p_generation_type: job.job_type,
      p_campaign_id: job.campaign_id,
      p_clip_id: job.clip_id,
    })

    if (error) {
      console.error('[Webhook Fal] Error deducting credits:', error)
      return
    }

    // Marquer les crédits comme débités
    await supabaseAdmin
      .from('generation_jobs')
      .update({ credits_deducted: true })
      .eq('id', job.id)

    console.log('[Webhook Fal] ✓ Credits deducted for job:', job.id)
  } catch (err) {
    console.error('[Webhook Fal] Error in deductCreditsForJob:', err)
  }
}
```

---

### 4. API pour checker le status d'un job

**Fichier à créer :** `app/api/jobs/[id]/route.ts`

**Explication :**
L'UI utilise cette API pour vérifier périodiquement le status d'un job.
RLS garantit qu'un user ne peut voir que ses propres jobs.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/jobs/[id]
 * Récupérer le status d'un job de génération
 * 
 * Utilisé par le frontend pour polling pendant la génération async
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Récupérer le job
    // RLS garantit que l'utilisateur ne peut voir que ses propres jobs
    const { data: job, error } = await supabase
      .from('generation_jobs')
      .select(`
        id,
        job_type,
        status,
        progress_percent,
        progress_message,
        result_url,
        result_data,
        error_message,
        estimated_cost_cents,
        actual_cost_cents,
        created_at,
        submitted_at,
        completed_at,
        campaign_id,
        clip_id
      `)
      .eq('id', params.id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      }
      throw error
    }

    // Formater la réponse pour le frontend
    return NextResponse.json({
      id: job.id,
      type: job.job_type,
      status: job.status,
      progress: job.progress_percent,
      progressMessage: job.progress_message,
      resultUrl: job.result_url,
      errorMessage: job.error_message,
      campaignId: job.campaign_id,
      clipId: job.clip_id,
      createdAt: job.created_at,
      submittedAt: job.submitted_at,
      completedAt: job.completed_at,
      // Durée estimée pour l'UI (si on veut afficher "~2 min restantes")
      estimatedDurationMs: getEstimatedDuration(job.job_type),
    })

  } catch (error) {
    console.error('[Jobs API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Durée estimée par type de job (pour l'UI)
 */
function getEstimatedDuration(jobType: string): number {
  const estimates: Record<string, number> = {
    'video_veo31_fast': 2 * 60 * 1000,      // 2 min
    'video_veo31_standard': 5 * 60 * 1000,  // 5 min
    'first_frame': 15 * 1000,                // 15 sec
    'voice_chatterbox': 60 * 1000,           // 1 min
    'ambient_elevenlabs': 30 * 1000,         // 30 sec
    'transcribe_whisper': 30 * 1000,         // 30 sec
  }
  return estimates[jobType] || 60 * 1000
}
```

---

### 5. Modifier les API routes de génération

**Fichier à modifier :** `app/api/generate/video/route.ts`

**⚠️ AVANT D'IMPLÉMENTER :**
- Lire le fichier actuel en entier
- Comprendre le flow existant (auth, crédits, logging)
- Garder la compatibilité avec le mode synchrone (flag)

Le code est trop long pour ce document. Voir la section "Migration" ci-dessous.

---

### 6. Modifier le hook frontend

**Fichier à modifier :** `hooks/use-video-generation.ts`

**⚠️ AVANT D'IMPLÉMENTER :**
- Lire le hook actuel en entier (c'est un gros fichier)
- Comprendre comment `generateAllClips` et `regenerateSingleClip` fonctionnent
- Comprendre le système de `progress` et comment l'UI l'utilise
- Garder la compatibilité avec le mode synchrone

Le code est trop long pour ce document. L'idée principale :

```typescript
// Pseudo-code du changement

// AVANT (mode synchrone)
const response = await fetch('/api/generate/video', { ... })
const { videoUrl } = await response.json()
// → Bloqué pendant 5-30 min

// APRÈS (mode async)
const response = await fetch('/api/generate/video', { ... })
const { jobId } = await response.json()
// → Retour immédiat

// Puis polling
while (status !== 'completed' && status !== 'failed') {
  await sleep(3000)
  const { status, resultUrl } = await fetch(`/api/jobs/${jobId}`).then(r => r.json())
  updateProgress(status)
}

if (status === 'completed') {
  clip.video.raw_url = resultUrl
}
```

---

## 🔒 Configuration

### Variables d'environnement à ajouter

```env
# ═══════════════════════════════════════════════════════════════════════════
# WEBHOOKS FAL.AI
# ═══════════════════════════════════════════════════════════════════════════

# Secret pour valider les webhooks (générer avec: openssl rand -hex 32)
FAL_WEBHOOK_SECRET=your_webhook_secret_here

# URL publique de l'app (Vercel génère automatiquement VERCEL_URL)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# ═══════════════════════════════════════════════════════════════════════════
# SUPABASE SERVICE ROLE (pour le webhook handler)
# ⚠️ NE JAMAIS exposer côté client !
# ═══════════════════════════════════════════════════════════════════════════
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Configuration Fal.ai Dashboard

1. Aller sur https://fal.ai/dashboard/settings
2. Section "Webhooks" (si disponible)
3. Ajouter l'URL: `https://your-app.vercel.app/api/webhooks/fal`
4. Configurer le secret pour signature HMAC
5. Sélectionner les événements: `COMPLETED`, `FAILED`

---

## 📊 Plan de Migration

### Phase 1 : Préparer (sans impact prod)

```bash
# 1. Créer la table
# Exécuter supabase/generation_jobs.sql sur Supabase

# 2. Créer les nouveaux fichiers (inactifs)
# - app/api/webhooks/fal/route.ts
# - app/api/jobs/[id]/route.ts

# 3. Ajouter les fonctions async dans falai.ts
# (sans les utiliser encore)

# 4. Déployer
git add .
git commit -m "feat: prepare async generation infrastructure"
git push
```

### Phase 2 : Mode hybride

```typescript
// Dans .env.local et Vercel
USE_ASYNC_GENERATION=false  // Commencer avec false

// Dans les API routes, ajouter un switch:
const useAsync = process.env.USE_ASYNC_GENERATION === 'true'

if (useAsync) {
  // Nouvelle architecture
  const { jobId } = await submitJobAsync(...)
  return NextResponse.json({ jobId, mode: 'async' })
} else {
  // Ancienne architecture (fallback)
  const { videoUrl } = await generateVideo(...)
  return NextResponse.json({ videoUrl, mode: 'sync' })
}
```

### Phase 3 : Test et activation

```bash
# 1. Tester en local avec ngrok
ngrok http 3000
# Configurer le webhook URL sur Fal.ai avec l'URL ngrok

# 2. Tester la génération complète
# - Soumettre un job
# - Vérifier que le webhook est reçu
# - Vérifier que le clip est mis à jour

# 3. Activer en prod
# Sur Vercel: USE_ASYNC_GENERATION=true

# 4. Monitor les logs
# Vérifier les webhooks dans Vercel logs
```

### Phase 4 : Cleanup

Une fois stable pendant 1-2 semaines :
- Supprimer le flag `USE_ASYNC_GENERATION`
- Supprimer le code de polling synchrone
- Supprimer `maxDuration` des routes (plus nécessaire)

---

## ✅ Checklist d'implémentation

### Infrastructure
- [ ] Créer `supabase/generation_jobs.sql`
- [ ] Exécuter la migration SQL sur Supabase
- [ ] Ajouter `SUPABASE_SERVICE_ROLE_KEY` dans Vercel
- [ ] Ajouter `FAL_WEBHOOK_SECRET` dans Vercel
- [ ] Configurer webhook URL sur Fal.ai dashboard

### Code Backend
- [ ] Ajouter fonctions async dans `lib/api/falai.ts`
- [ ] Créer `app/api/webhooks/fal/route.ts`
- [ ] Créer `app/api/jobs/[id]/route.ts`
- [ ] Modifier `app/api/generate/video/route.ts` (mode hybride)
- [ ] Modifier `app/api/generate/voice/route.ts`
- [ ] Modifier `app/api/generate/ambient/route.ts`
- [ ] (Optionnel) Modifier `app/api/generate/first-frame/route.ts`

### Code Frontend
- [ ] Modifier `hooks/use-video-generation.ts`
- [ ] Ajouter polling du status
- [ ] Gérer les états de loading/error
- [ ] Tester l'UX de régénération

### Tests
- [ ] Tester webhook en local avec ngrok
- [ ] Tester génération vidéo complète
- [ ] Tester génération voice
- [ ] Tester génération ambient
- [ ] Tester erreurs (job failed)
- [ ] Tester reprise (user recharge la page)
- [ ] Tester fermer/rouvrir la page pendant génération

### Déploiement
- [ ] Déployer en mode hybride (async=false)
- [ ] Vérifier que prod fonctionne toujours
- [ ] Activer async (async=true)
- [ ] Monitor les logs pendant 24-48h
- [ ] Cleanup code ancien

---

## 🎯 Bénéfices attendus

| Métrique | Avant (Polling) | Après (Webhooks) |
|----------|-----------------|------------------|
| Timeout max | 5 min (Vercel Pro) | **Illimité** |
| Connexion HTTP | 5-30 min ouverte | **1-2 sec** |
| User ferme page | ❌ Génération perdue | ✅ Continue en background |
| Workers Vercel | 1 bloqué/requête | ✅ Libérés immédiatement |
| Reprise après erreur | ❌ Tout recommencer | ✅ Job sauvegardé en BDD |
| Monitoring | ❌ Logs dispersés | ✅ Table `generation_jobs` |
| Coût Vercel | ⚠️ Function duration élevée | ✅ Minimal |

---

## 🔗 Ressources

- [Documentation Fal.ai Webhooks](https://fal.ai/docs/webhooks)
- [Vercel Serverless Functions Limits](https://vercel.com/docs/functions/limitations)
- [Supabase Service Role Key](https://supabase.com/docs/guides/api#service-key)
- [ngrok pour tester les webhooks](https://ngrok.com/)

---

*Dernière mise à jour: Décembre 2024*
*Auteur: Claude (Anthropic)*
