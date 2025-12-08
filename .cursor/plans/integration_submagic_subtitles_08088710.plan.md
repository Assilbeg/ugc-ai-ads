---
name: Integration Submagic Subtitles
overview: Ajouter une fonctionnalité pour générer des sous-titres via l'API Submagic après l'assemblage d'une vidéo, avec une modal de configuration complète et facturation à 25 crédits par vidéo.
todos:
  - id: migration-db
    content: Créer migration SQL pour colonnes submagic_* dans campaigns
    status: pending
  - id: migration-costs
    content: Ajouter le coût submagic_subtitles dans generation_costs
    status: pending
  - id: types
    content: Ajouter types SubmagicConfig et champs Campaign
    status: pending
  - id: api-templates
    content: Créer /api/submagic/templates avec cache
    status: pending
  - id: api-hook-templates
    content: Créer /api/submagic/hook-templates avec cache
    status: pending
  - id: api-create-project
    content: Créer /api/submagic/create-project avec déduction crédits
    status: pending
  - id: api-webhook
    content: Créer /api/webhooks/submagic pour recevoir les notifications
    status: pending
  - id: modal-component
    content: Créer composant SubmagicModal avec tous les paramètres
    status: pending
  - id: page-campaign
    content: Modifier page campagne avec bouton et affichage statut
    status: pending
  - id: docs
    content: Mettre à jour CRITICAL_BEHAVIORS.md avec le flow Submagic
    status: pending
---

# Intégration Submagic - Sous-titres automatiques

## RÈGLES CRITIQUES DU PROJET (À RESPECTER IMPÉRATIVEMENT)

### Pattern Supabase TypeScript

```typescript
// TOUJOURS utiliser ce pattern pour éviter les erreurs TypeScript au build
const { data, error } = await (supabase.from('campaigns') as any)
  .update({ submagic_status: 'processing' })
  .eq('id', campaignId)
```

### Règles générales

- Toujours répondre en français
- Ne JAMAIS créer de nouveaux fichiers sans justification - modifier l'existant d'abord
- Supabase Project ID : `xresijptcptdilwecklf`
- 1 crédit = 1 centime d'euro

### Documentation interne

- Consulter `/docs/SUBMAGIC.md` pour la doc complète de l'API Submagic
- Consulter `/docs/CRITICAL_BEHAVIORS.md` pour les invariants du projet

---

## Architecture du flow

```
1. User clique "Ajouter sous-titres" sur page campagne (à côté de "Télécharger")
        ↓
2. Modal SubmagicModal s'ouvre avec configuration complète
        ↓
3. User configure et clique "Lancer" (25 crédits)
        ↓
4. POST /api/submagic/create-project
   - Check crédits
   - Déduit 25 crédits
   - Envoie vers Submagic API
   - Stocke submagic_project_id
   - Met submagic_status = 'processing'
        ↓
5. Submagic traite en async (1-5 min)
        ↓
6. POST /api/webhooks/submagic (callback Submagic)
   - Met à jour submagic_video_url
   - Met submagic_status = 'completed'
        ↓
7. Page campagne affiche bouton "Télécharger (sous-titres)"
```

---

## API Submagic - Documentation complète

### Base URL & Auth

```
Base URL: https://api.submagic.co/v1
Header: x-api-key: sk-your-api-key
```

### GET /templates

```json
// Response
{ "templates": ["Sara", "Daniel", "Hormozi 2", "Beast", "Ali", ...] }
```

### GET /hook-title/templates

```json
// Response
{ "templates": ["tiktok", "hormozi", "ali", "laura", "steph", ...] }
```

### POST /projects

```typescript
// Request body
interface SubmagicCreateProjectRequest {
  title: string;                    // Nom du projet (1-100 chars)
  language: string;                 // "fr", "en", "es", etc.
  videoUrl: string;                 // URL publique de la vidéo
  templateName?: string;            // Template sous-titres (défaut: "Sara")
  hookTitle?: boolean | {           // Hook animé au début
    text?: string;                  // Texte custom (1-100 chars)
    template?: string;              // "tiktok", "hormozi", etc.
    top?: number;                   // Position verticale 0-80 (défaut: 50)
    size?: number;                  // Taille police 0-80 (défaut: 30)
  };
  magicZooms?: boolean;             // Zooms auto (défaut: false)
  magicBrolls?: boolean;            // B-rolls IA (défaut: false)
  magicBrollsPercentage?: number;   // 0-100 (défaut: 50)
  removeSilencePace?: 'natural' | 'fast' | 'extra-fast';
  removeBadTakes?: boolean;         // Supprime mauvaises prises
  dictionary?: string[];            // Mots-clés pour transcription (max 100, 50 chars each)
  webhookUrl?: string;              // URL de callback
}

// Response 201
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing"
}
```

### GET /projects/{id}

```typescript
// Response quand completed
{
  "id": "...",
  "status": "completed",  // ou "processing", "transcribing", "exporting", "failed"
  "downloadUrl": "https://app.submagic.co/api/file/download?...",
  "directUrl": "https://cloudfront.net/..."
}
```

### Webhook Notification (POST vers notre endpoint)

```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "downloadUrl": "https://app.submagic.co/api/file/download?...",
  "directUrl": "https://cloudfront.net/...",
  "timestamp": "2024-01-15T10:45:00.000Z"
}
```

---

## Fichiers à créer

### 1. `app/api/submagic/templates/route.ts`

```typescript
import { NextResponse } from 'next/server'

// Cache en mémoire (6h)
let templatesCache: { data: string[]; timestamp: number } | null = null
const CACHE_DURATION = 6 * 60 * 60 * 1000

export async function GET() {
  // Vérifier cache
  if (templatesCache && Date.now() - templatesCache.timestamp < CACHE_DURATION) {
    return NextResponse.json({ templates: templatesCache.data })
  }

  const response = await fetch('https://api.submagic.co/v1/templates', {
    headers: { 'x-api-key': process.env.SUBMAGIC_API_KEY! }
  })

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: response.status })
  }

  const data = await response.json()
  templatesCache = { data: data.templates, timestamp: Date.now() }
  
  return NextResponse.json(data)
}
```

### 2. `app/api/submagic/hook-templates/route.ts`

(Même structure que templates, URL: `/v1/hook-title/templates`)

### 3. `app/api/submagic/create-project/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkCredits, deductCredits } from '@/lib/credits'

const SUBMAGIC_COST = 25 // crédits

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const body = await request.json()
  const { campaignId, config } = body

  // Vérifier crédits
  const hasCredits = await checkCredits(user.id, SUBMAGIC_COST)
  if (!hasCredits) {
    return NextResponse.json({ error: 'Crédits insuffisants' }, { status: 402 })
  }

  // Récupérer la campagne
  const { data: campaign } = await (supabase.from('campaigns') as any)
    .select('*, campaign_clips(*)')
    .eq('id', campaignId)
    .single()

  if (!campaign || !campaign.final_video_url) {
    return NextResponse.json({ error: 'Campagne non trouvée ou vidéo manquante' }, { status: 404 })
  }

  // Extraire le dictionnaire automatiquement
  const dictionary = extractDictionary(campaign)

  // Mapper la langue
  const languageMap: Record<string, string> = {
    'fr': 'fr', 'en-us': 'en', 'en-uk': 'en', 'es': 'es', 
    'es-latam': 'es', 'de': 'de', 'it': 'it', 'pt-br': 'pt', 'pt': 'pt', 'nl': 'nl'
  }

  // Construire le payload Submagic
  const submagicPayload = {
    title: campaign.brief?.what_selling || 'UGC Video',
    language: languageMap[campaign.brief?.language] || 'fr',
    videoUrl: campaign.final_video_url,
    templateName: config.templateName || 'Sara',
    dictionary,
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/submagic`,
    ...(config.hookTitle?.enabled && {
      hookTitle: {
        text: config.hookTitle.text,
        template: config.hookTitle.template || 'tiktok',
        top: config.hookTitle.top || 50,
        size: config.hookTitle.size || 30
      }
    }),
    ...(config.magicZooms !== undefined && { magicZooms: config.magicZooms }),
    ...(config.magicBrolls !== undefined && { 
      magicBrolls: config.magicBrolls,
      magicBrollsPercentage: config.magicBrollsPercentage || 50
    }),
    ...(config.removeSilencePace && { removeSilencePace: config.removeSilencePace }),
    ...(config.removeBadTakes !== undefined && { removeBadTakes: config.removeBadTakes })
  }

  // Appeler Submagic
  const submagicResponse = await fetch('https://api.submagic.co/v1/projects', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.SUBMAGIC_API_KEY!,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(submagicPayload)
  })

  if (!submagicResponse.ok) {
    const error = await submagicResponse.json()
    return NextResponse.json({ error: error.message || 'Erreur Submagic' }, { status: submagicResponse.status })
  }

  const submagicData = await submagicResponse.json()

  // Déduire les crédits
  await deductCredits(user.id, SUBMAGIC_COST, 'Sous-titres Submagic', 'submagic_subtitles', campaignId)

  // Mettre à jour la campagne
  await (supabase.from('campaigns') as any)
    .update({
      submagic_project_id: submagicData.id,
      submagic_status: 'processing'
    })
    .eq('id', campaignId)

  return NextResponse.json({ success: true, projectId: submagicData.id })
}

function extractDictionary(campaign: any): string[] {
  const terms = new Set<string>()
  
  // Nom du produit
  if (campaign.brief?.what_selling) {
    terms.add(campaign.brief.what_selling.slice(0, 50))
  }

  // Mots des scripts (> 5 lettres, pas mots courants)
  const commonWords = new Set(['alors', 'aussi', 'autre', 'avant', 'comme', 'dans', 'depuis', 'encore', 'entre', 'être', 'faire', 'leurs', 'mais', 'même', 'notre', 'nous', 'parce', 'plus', 'pour', 'quand', 'quel', 'cette', 'tout', 'tous', 'très', 'vous', 'avec'])
  
  campaign.campaign_clips?.forEach((clip: any) => {
    const text = clip.script?.text || ''
    const words = text.split(/\s+/)
    words.forEach((word: string) => {
      const clean = word.replace(/[^a-zA-ZÀ-ÿ]/g, '').toLowerCase()
      if (clean.length > 5 && !commonWords.has(clean) && terms.size < 50) {
        terms.add(clean.slice(0, 50))
      }
    })
  })

  return Array.from(terms)
}
```

### 4. `app/api/webhooks/submagic/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const body = await request.json()
  const { projectId, status, downloadUrl, directUrl } = body

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  }

  // Utiliser service client pour bypass RLS
  const supabase = createServiceClient()

  // Trouver la campagne par submagic_project_id
  const { data: campaign } = await (supabase.from('campaigns') as any)
    .select('id')
    .eq('submagic_project_id', projectId)
    .single()

  if (!campaign) {
    console.error('[Submagic Webhook] Campaign not found for projectId:', projectId)
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  // Mettre à jour selon le statut
  const updateData: any = {
    submagic_status: status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'processing'
  }

  if (status === 'completed' && (downloadUrl || directUrl)) {
    updateData.submagic_video_url = directUrl || downloadUrl
  }

  await (supabase.from('campaigns') as any)
    .update(updateData)
    .eq('id', campaign.id)

  console.log(`[Submagic Webhook] Campaign ${campaign.id} updated: ${status}`)

  return NextResponse.json({ success: true })
}
```

### 5. `components/modals/submagic-modal.tsx`

Modal avec les paramètres :

- **Template** : Dropdown chargé depuis `/api/submagic/templates`
- **Hook Title** : Toggle + inputs (text, template dropdown, sliders top/size)
- **Magic Zooms** : Toggle
- **Magic B-rolls** : Toggle + Slider pourcentage
- **Remove Silence** : Select (natural/fast/extra-fast)
- **Remove Bad Takes** : Toggle
- **Dictionnaire** : Affichage lecture seule des termes extraits
- **Bouton Lancer** : Avec coût affiché (25 crédits)

---

## Fichiers à modifier

### 1. `types/index.ts`

Ajouter après les types Campaign existants :

```typescript
// ─────────────────────────────────────────────────────────────────
// SUBMAGIC CONFIGURATION
// ─────────────────────────────────────────────────────────────────
export interface SubmagicHookTitleConfig {
  enabled: boolean;
  text?: string;
  template?: string;
  top?: number;
  size?: number;
}

export interface SubmagicConfig {
  templateName: string;
  hookTitle?: SubmagicHookTitleConfig;
  magicZooms?: boolean;
  magicBrolls?: boolean;
  magicBrollsPercentage?: number;
  removeSilencePace?: 'natural' | 'fast' | 'extra-fast';
  removeBadTakes?: boolean;
}

export type SubmagicStatus = 'none' | 'processing' | 'completed' | 'failed';
```

Et modifier l'interface Campaign pour ajouter :

```typescript
export interface Campaign {
  // ... champs existants ...
  submagic_project_id?: string;
  submagic_video_url?: string;
  submagic_status?: SubmagicStatus;
}
```

### 2. `app/(dashboard)/campaign/[id]/page.tsx`

**Bouton "Télécharger" actuel (lignes 166-178)** - À modifier pour ajouter le bouton Submagic à côté :

```tsx
// AVANT (existant) - Bouton télécharger dans la barre d'action
<a href={finalVideoUrl} download={...}>
  <Button size="sm" className="...">
    <svg>...</svg>
    Télécharger
  </Button>
</a>

// APRÈS - Ajouter bouton Submagic
<div className="flex items-center gap-2">
  {/* Bouton Submagic selon statut */}
  {campaign.submagic_status === 'none' || !campaign.submagic_status ? (
    <Button size="sm" variant="outline" onClick={() => setShowSubmagicModal(true)}>
      <Subtitles className="w-4 h-4 mr-1" />
      Sous-titres
    </Button>
  ) : campaign.submagic_status === 'processing' ? (
    <Button size="sm" variant="outline" disabled>
      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
      Traitement...
    </Button>
  ) : campaign.submagic_status === 'completed' && campaign.submagic_video_url ? (
    <a href={campaign.submagic_video_url} download target="_blank">
      <Button size="sm" variant="outline">
        <Subtitles className="w-4 h-4 mr-1" />
        Avec sous-titres
      </Button>
    </a>
  ) : null}
  
  {/* Bouton télécharger original */}
  <a href={finalVideoUrl} download={...}>
    <Button size="sm" className="...">Télécharger</Button>
  </a>
</div>
```

Note : La page est un Server Component. Pour le state `showSubmagicModal`, il faudra soit :

- Créer un Client Component wrapper pour la section actions
- Ou utiliser un query param `?submagic=1` avec refresh

---

## Migrations SQL (via Supabase MCP)

### Migration 1 : Colonnes campaigns

```sql
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS submagic_project_id VARCHAR;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS submagic_video_url TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS submagic_status VARCHAR DEFAULT 'none';
```

### Migration 2 : Coût generation_costs

```sql
INSERT INTO generation_costs (id, name, description, cost_cents, real_cost_cents, is_active)
VALUES ('submagic_subtitles', 'Sous-titres Submagic', 'Génération de sous-titres via Submagic API', 25, 10, true)
ON CONFLICT (id) DO UPDATE SET cost_cents = 25, real_cost_cents = 10;
```

---

## Variables d'environnement requises

```bash
SUBMAGIC_API_KEY=sk-...  # Clé API Submagic
NEXT_PUBLIC_APP_URL=https://app.ugc-ai.com  # Pour webhook URL
```

---

## Mapping langue brief → Submagic

| brief.language | Submagic |

|----------------|----------|

| fr | fr |

| en-us | en |

| en-uk | en |

| es | es |

| es-latam | es |

| de | de |

| it | it |

| pt-br | pt |

| pt | pt |

| nl | nl |

---

## Documentation interne

Le fichier `/docs/SUBMAGIC.md` contient la documentation complète de l'intégration.

À la fin de l'implémentation, ajouter une section dans `/docs/CRITICAL_BEHAVIORS.md` pour documenter les comportements critiques Submagic.