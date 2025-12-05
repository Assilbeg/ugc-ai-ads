# Plan Architecture : Webhooks Async pour Génération Vidéo

## 📋 Résumé

Migrer de l'architecture **polling synchrone** vers une architecture **webhooks asynchrone** pour la génération vidéo (Veo 3.1) et audio (Chatterbox, ElevenLabs).

### Problème actuel
- Les API routes font du polling synchrone (connexion HTTP ouverte 5-30 min)
- Timeout Vercel Pro = 300s max (5 min)
- Si connexion coupée → génération perdue
- 1 worker Vercel bloqué par requête

### Solution
- Submit le job à Fal.ai → retour immédiat avec `request_id`
- Fal.ai appelle notre webhook quand c'est terminé
- L'UI poll le status toutes les 2-5 secondes

---

## 🏗️ Architecture Cible

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ARCHITECTURE WEBHOOKS                          │
└─────────────────────────────────────────────────────────────────────────────┘

[FRONTEND - React]
      │
      │ 1. POST /api/generate/video {prompt, firstFrameUrl, ...}
      ▼
┌─────────────────────┐
│  API Route          │ 2. Submit job à Fal.ai (pas de polling)
│  /api/generate/*    │ 3. Créer record dans `generation_jobs`
└─────────────────────┘ 4. Retourner {jobId, status: 'pending'}
      │                     ↓ (1-2 secondes)
      │                     
      ▼                     
[FRONTEND]                  
      │ 5. Poll /api/jobs/{id} toutes les 3s
      │    (ou SSE/WebSocket pour temps réel)
      ▼
┌─────────────────────┐
│  API Route          │ 6. SELECT * FROM generation_jobs WHERE id = ?
│  /api/jobs/[id]     │ 7. Retourner {status, progress, result_url}
└─────────────────────┘
      ▲
      │
      │ Pendant ce temps, Fal.ai génère...
      │ (2-10 minutes)
      │
      ▼
┌─────────────────────┐
│  Fal.ai             │ 8. Génération terminée
│  (Veo 3.1)          │ 9. POST webhook vers notre serveur
└─────────────────────┘
      │
      │ POST /api/webhooks/fal
      ▼
┌─────────────────────┐
│  Webhook Handler    │ 10. Valider signature Fal.ai
│  /api/webhooks/fal  │ 11. UPDATE generation_jobs SET status='completed'
└─────────────────────┘ 12. Mettre à jour campaign_clips si clipId
      │
      │
      ▼
[FRONTEND poll détecte status='completed']
      │
      │ 13. Afficher la vidéo 🎉
      ▼
```

---

## 📁 Fichiers à Créer/Modifier

### 1. Nouvelle table Supabase

**Fichier:** `supabase/generation_jobs.sql`

```sql
-- ═══════════════════════════════════════════════════════════════════════════
-- TABLE: generation_jobs
-- Track async generation jobs (video, voice, ambient, first_frame)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifiants
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  clip_id UUID REFERENCES campaign_clips(id) ON DELETE SET NULL,
  
  -- Type de génération
  job_type TEXT NOT NULL CHECK (job_type IN (
    'video_veo31',
    'first_frame',
    'voice_chatterbox',
    'ambient_elevenlabs',
    'transcribe_whisper'
  )),
  
  -- Fal.ai identifiers
  fal_request_id TEXT,           -- ID retourné par Fal.ai queue
  fal_status_url TEXT,           -- URL pour checker le status
  fal_response_url TEXT,         -- URL pour récupérer le résultat
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Job créé, pas encore soumis
    'submitted',    -- Soumis à Fal.ai
    'in_progress',  -- Fal.ai traite
    'completed',    -- Terminé avec succès
    'failed'        -- Échec
  )),
  
  -- Input/Output
  input_params JSONB NOT NULL,   -- Paramètres envoyés à Fal.ai
  result_url TEXT,               -- URL du résultat (vidéo, audio, image)
  result_data JSONB,             -- Données supplémentaires du résultat
  error_message TEXT,            -- Message d'erreur si failed
  
  -- Billing
  estimated_cost_cents INTEGER,
  actual_cost_cents INTEGER,
  credits_deducted BOOLEAN DEFAULT FALSE,
  
  -- Progress (optionnel, si Fal.ai le fournit)
  progress_percent INTEGER DEFAULT 0,
  progress_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Indexes
  CONSTRAINT valid_progress CHECK (progress_percent >= 0 AND progress_percent <= 100)
);

-- Indexes pour queries fréquentes
CREATE INDEX idx_generation_jobs_user_id ON generation_jobs(user_id);
CREATE INDEX idx_generation_jobs_status ON generation_jobs(status);
CREATE INDEX idx_generation_jobs_fal_request_id ON generation_jobs(fal_request_id);
CREATE INDEX idx_generation_jobs_campaign_clip ON generation_jobs(campaign_id, clip_id);

-- RLS
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY "Users can view own jobs" ON generation_jobs
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create jobs for themselves
CREATE POLICY "Users can create own jobs" ON generation_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for webhooks)
CREATE POLICY "Service role full access" ON generation_jobs
  FOR ALL USING (auth.role() = 'service_role');
```

---

### 2. Modifier lib/api/falai.ts

**Ajouter mode async (submit sans polling)**

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// MODE ASYNC - Submit job sans attendre (pour webhooks)
// ═══════════════════════════════════════════════════════════════════════════

export interface FalJobSubmission {
  requestId: string
  statusUrl: string
  responseUrl: string
}

/**
 * Submit un job vidéo Veo 3.1 SANS attendre le résultat
 * Utilisé avec les webhooks pour architecture async
 */
export async function submitVideoJob(
  prompt: string,
  firstFrameUrl: string,
  duration: 4 | 6 | 8 = 6,
  quality: VideoQuality = 'standard',
  webhookUrl?: string
): Promise<FalJobSubmission> {
  const path = getVeo31Endpoint(quality)
  
  const input: Veo31Input & { webhook_url?: string } = {
    prompt,
    image_url: firstFrameUrl,
    duration: `${duration}s`,
    aspect_ratio: '9:16',
  }
  
  // Ajouter webhook si fourni
  if (webhookUrl) {
    input.webhook_url = webhookUrl
  }

  console.log(`[Veo3.1 ASYNC] Submitting job:`, { 
    duration, 
    quality,
    endpoint: path,
    hasWebhook: !!webhookUrl
  })

  const queue = await falRequest<FalQueueResponse>({ path, input })
  
  return {
    requestId: queue.request_id,
    statusUrl: queue.status_url,
    responseUrl: queue.response_url,
  }
}

/**
 * Vérifier le status d'un job (pour polling côté serveur si besoin)
 */
export async function checkJobStatus(statusUrl: string): Promise<{
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  logs?: Array<{ message: string; timestamp: string }>
}> {
  return checkStatusByUrl(statusUrl)
}

/**
 * Récupérer le résultat d'un job terminé
 */
export async function getJobResult<T>(responseUrl: string): Promise<T> {
  return getResultByUrl<T>(responseUrl)
}
```

---

### 3. Nouveau endpoint webhook

**Fichier:** `app/api/webhooks/fal/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Utiliser service role pour bypasser RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Secret pour valider les webhooks Fal.ai (à configurer dans Fal.ai dashboard)
const FAL_WEBHOOK_SECRET = process.env.FAL_WEBHOOK_SECRET

interface FalWebhookPayload {
  request_id: string
  status: 'COMPLETED' | 'FAILED'
  response?: {
    video?: { url: string }
    audio?: { url: string }
    images?: Array<{ url: string }>
  }
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    // 1. Valider la signature (si Fal.ai le supporte)
    const signature = request.headers.get('x-fal-signature')
    if (FAL_WEBHOOK_SECRET && signature) {
      // TODO: Implémenter validation HMAC
      // const isValid = validateSignature(body, signature, FAL_WEBHOOK_SECRET)
    }

    const payload = await request.json() as FalWebhookPayload
    console.log('[Webhook Fal] Received:', {
      request_id: payload.request_id,
      status: payload.status,
      hasResponse: !!payload.response,
    })

    // 2. Trouver le job correspondant
    const { data: job, error: findError } = await supabaseAdmin
      .from('generation_jobs')
      .select('*')
      .eq('fal_request_id', payload.request_id)
      .single()

    if (findError || !job) {
      console.error('[Webhook Fal] Job not found:', payload.request_id)
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // 3. Mettre à jour le job selon le status
    if (payload.status === 'COMPLETED') {
      // Extraire l'URL du résultat selon le type de job
      let resultUrl: string | null = null
      if (payload.response?.video?.url) {
        resultUrl = payload.response.video.url
      } else if (payload.response?.audio?.url) {
        resultUrl = payload.response.audio.url
      } else if (payload.response?.images?.[0]?.url) {
        resultUrl = payload.response.images[0].url
      }

      await supabaseAdmin
        .from('generation_jobs')
        .update({
          status: 'completed',
          result_url: resultUrl,
          result_data: payload.response,
          completed_at: new Date().toISOString(),
          progress_percent: 100,
        })
        .eq('id', job.id)

      // 4. Mettre à jour le clip si associé
      if (job.clip_id && resultUrl) {
        await updateClipWithResult(job, resultUrl)
      }

      console.log('[Webhook Fal] ✓ Job completed:', job.id)

    } else if (payload.status === 'FAILED') {
      await supabaseAdmin
        .from('generation_jobs')
        .update({
          status: 'failed',
          error_message: payload.error || 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id)

      console.error('[Webhook Fal] ✗ Job failed:', job.id, payload.error)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('[Webhook Fal] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Mettre à jour le clip avec le résultat de la génération
 */
async function updateClipWithResult(job: any, resultUrl: string) {
  const { clip_id, job_type } = job
  
  // Construire l'update selon le type de job
  let updateData: Record<string, any> = {}
  
  switch (job_type) {
    case 'video_veo31':
      updateData = {
        'video.raw_url': resultUrl,
        'video.generated_at': new Date().toISOString(),
        status: 'video_ready',
      }
      break
    case 'first_frame':
      updateData = {
        'first_frame.image_url': resultUrl,
        'first_frame.generated_at': new Date().toISOString(),
      }
      break
    case 'voice_chatterbox':
      updateData = {
        'audio.voice_url': resultUrl,
      }
      break
    case 'ambient_elevenlabs':
      updateData = {
        'audio.ambient_url': resultUrl,
      }
      break
  }

  if (Object.keys(updateData).length > 0) {
    // Note: Supabase ne supporte pas la notation dot pour JSONB
    // Il faut récupérer le clip, modifier, et sauvegarder
    const { data: clip } = await supabaseAdmin
      .from('campaign_clips')
      .select('*')
      .eq('id', clip_id)
      .single()

    if (clip) {
      const updatedClip = { ...clip }
      
      if (job_type === 'video_veo31') {
        updatedClip.video = { ...updatedClip.video, raw_url: resultUrl }
        updatedClip.status = 'video_ready'
      } else if (job_type === 'first_frame') {
        updatedClip.first_frame = { ...updatedClip.first_frame, image_url: resultUrl }
      } else if (job_type === 'voice_chatterbox') {
        updatedClip.audio = { ...updatedClip.audio, voice_url: resultUrl }
      } else if (job_type === 'ambient_elevenlabs') {
        updatedClip.audio = { ...updatedClip.audio, ambient_url: resultUrl }
      }

      await supabaseAdmin
        .from('campaign_clips')
        .update(updatedClip)
        .eq('id', clip_id)
    }
  }
}
```

---

### 4. API pour checker le status

**Fichier:** `app/api/jobs/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    
    // Vérifier l'auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Récupérer le job (RLS garantit que c'est le bon user)
    const { data: job, error } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: job.progress_percent,
      progressMessage: job.progress_message,
      resultUrl: job.result_url,
      errorMessage: job.error_message,
      createdAt: job.created_at,
      completedAt: job.completed_at,
    })

  } catch (error) {
    console.error('[Jobs API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

### 5. Modifier les API routes de génération

**Exemple pour `/api/generate/video/route.ts`**

```typescript
// AVANT (polling synchrone)
const { result: videoUrl, requestId } = await generateVideo(...)

// APRÈS (async avec webhook)
const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/fal`

// 1. Créer le job en BDD
const { data: job } = await supabase
  .from('generation_jobs')
  .insert({
    user_id: user.id,
    campaign_id: campaignId,
    clip_id: clipId,
    job_type: 'video_veo31',
    status: 'pending',
    input_params: { prompt, firstFrameUrl, duration, quality },
    estimated_cost_cents: totalCost,
  })
  .select('id')
  .single()

// 2. Submit à Fal.ai (retour immédiat)
const submission = await submitVideoJob(
  prompt, 
  firstFrameUrl, 
  duration, 
  videoQuality,
  webhookUrl
)

// 3. Mettre à jour le job avec les infos Fal.ai
await supabase
  .from('generation_jobs')
  .update({
    fal_request_id: submission.requestId,
    fal_status_url: submission.statusUrl,
    fal_response_url: submission.responseUrl,
    status: 'submitted',
    submitted_at: new Date().toISOString(),
  })
  .eq('id', job.id)

// 4. Retourner immédiatement
return NextResponse.json({ 
  jobId: job.id,
  status: 'submitted',
  message: 'Génération en cours...'
})
```

---

### 6. Modifier le hook frontend

**Fichier:** `hooks/use-video-generation.ts`

```typescript
// Nouvelle fonction pour générer avec polling du status
async function generateVideoAsync(clip: CampaignClip, ...): Promise<CampaignClip | null> {
  // 1. Soumettre le job
  const response = await fetch('/api/generate/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, firstFrameUrl, ... }),
  })
  
  const { jobId, status } = await response.json()
  
  if (status !== 'submitted') {
    throw new Error('Failed to submit job')
  }

  // 2. Poll le status jusqu'à completion
  const result = await pollJobStatus(jobId, {
    interval: 3000,      // Poll toutes les 3s
    timeout: 600000,     // Timeout après 10 min
    onProgress: (progress) => {
      // Mettre à jour la progress bar dans l'UI
      updateClipProgress(clip.id, progress)
    }
  })

  if (result.status === 'failed') {
    throw new Error(result.errorMessage || 'Generation failed')
  }

  // 3. Retourner le clip mis à jour
  return {
    ...clip,
    video: {
      ...clip.video,
      raw_url: result.resultUrl,
    }
  }
}

async function pollJobStatus(
  jobId: string, 
  options: { interval: number; timeout: number; onProgress?: (p: number) => void }
): Promise<JobResult> {
  const startTime = Date.now()
  
  while (Date.now() - startTime < options.timeout) {
    const response = await fetch(`/api/jobs/${jobId}`)
    const job = await response.json()
    
    if (options.onProgress) {
      options.onProgress(job.progress || 0)
    }
    
    if (job.status === 'completed' || job.status === 'failed') {
      return job
    }
    
    await new Promise(resolve => setTimeout(resolve, options.interval))
  }
  
  throw new Error('Timeout waiting for generation')
}
```

---

## 🔒 Configuration Sécurité

### Variables d'environnement à ajouter

```env
# Webhook secret (générer avec: openssl rand -hex 32)
FAL_WEBHOOK_SECRET=your_webhook_secret_here

# URL publique de l'app (pour les webhooks)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

### Configuration Fal.ai

1. Aller sur https://fal.ai/dashboard
2. Configurer le webhook URL: `https://your-app.vercel.app/api/webhooks/fal`
3. (Optionnel) Configurer le secret pour signature HMAC

---

## 📊 Migration

### Étapes de migration

1. **Phase 1 : Préparer** (sans impact prod)
   - Créer la table `generation_jobs`
   - Créer l'endpoint webhook (inactif)
   - Créer l'API `/api/jobs/[id]`

2. **Phase 2 : Mode hybride**
   - Ajouter flag `USE_ASYNC_GENERATION` dans env
   - Si true → nouvelle architecture
   - Si false → ancienne architecture (fallback)

3. **Phase 3 : Basculer**
   - Activer `USE_ASYNC_GENERATION=true`
   - Monitor les logs
   - Rollback si problème

4. **Phase 4 : Cleanup**
   - Supprimer l'ancien code de polling
   - Supprimer le flag

---

## ✅ Checklist d'implémentation

- [ ] Créer `supabase/generation_jobs.sql`
- [ ] Exécuter la migration SQL sur Supabase
- [ ] Ajouter fonctions async dans `lib/api/falai.ts`
- [ ] Créer `app/api/webhooks/fal/route.ts`
- [ ] Créer `app/api/jobs/[id]/route.ts`
- [ ] Modifier `app/api/generate/video/route.ts`
- [ ] Modifier `app/api/generate/voice/route.ts`
- [ ] Modifier `app/api/generate/ambient/route.ts`
- [ ] Modifier `app/api/generate/first-frame/route.ts`
- [ ] Modifier `hooks/use-video-generation.ts`
- [ ] Ajouter variables d'env
- [ ] Configurer webhook sur Fal.ai dashboard
- [ ] Tester en local avec ngrok
- [ ] Déployer et tester en prod
- [ ] Cleanup ancien code

---

## 🎯 Bénéfices attendus

| Métrique | Avant | Après |
|----------|-------|-------|
| Timeout max | 5 min | Illimité |
| Connexion HTTP | 5-30 min | 1-2 sec |
| User peut fermer page | ❌ Perd la génération | ✅ Continue en background |
| Workers Vercel | 1 bloqué/requête | Libérés immédiatement |
| Retry auto | ❌ Manuel | ✅ Possible via webhook |
| Monitoring | ❌ Difficile | ✅ Table `generation_jobs` |

---

*Dernière mise à jour: Décembre 2024*

