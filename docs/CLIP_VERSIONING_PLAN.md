# Plan d'implémentation : Versioning des clips

> ⚠️ **DOCUMENT HISTORIQUE** : Ce fichier documente le plan d'implémentation tel qu'il a été conçu.
> L'implémentation réelle peut différer légèrement. Pour le comportement actuel, référez-vous à 
> `CRITICAL_BEHAVIORS.md` et au code dans `step6-generate.tsx`.

## Contexte du projet

Application UGC AI qui génère des vidéos publicitaires avec des acteurs IA. Une campagne contient plusieurs "beats" (hook, problem, solution, proof, cta) et chaque beat a un clip vidéo.

**Problème actuel** : Le code suppose un clip unique par `order` (beat), mais on veut pouvoir avoir plusieurs versions d'un même beat pour que l'utilisateur puisse régénérer et choisir la meilleure.

**Objectif** : Permettre plusieurs versions par beat avec sélection utilisateur pour l'assemblage final.

---

## Architecture cible

```
campaign_clips
├── id (UUID unique)
├── campaign_id (FK vers campaigns)
├── order (1-5 = numéro du beat, PAS unique)
├── beat (hook, problem, solution, proof, cta)
├── is_selected (boolean) ← NOUVEAU - marque la version à utiliser pour l'assemblage
├── video (JSONB avec raw_url, final_url, duration)
├── audio, script, first_frame, etc.
├── created_at
```

**Règles** :
- Plusieurs clips peuvent avoir le même `order` (= même beat, différentes versions)
- `is_selected = true` sur UN SEUL clip par beat (celui utilisé pour l'assemblage)
- Fallback : si aucun `is_selected`, prendre le plus récent par beat

---

## Supabase Project ID

**IMPORTANT** : `xresijptcptdilwecklf`

---

## Étape 1 : Migration BDD

Appliquer via MCP Supabase (`mcp_supabase_apply_migration`) :

```sql
-- Migration: add_is_selected_to_clips
ALTER TABLE campaign_clips 
ADD COLUMN IF NOT EXISTS is_selected BOOLEAN DEFAULT false;

-- Marquer le plus récent de chaque beat comme selected (données existantes)
WITH latest_per_beat AS (
  SELECT DISTINCT ON (campaign_id, "order") id
  FROM campaign_clips
  ORDER BY campaign_id, "order", created_at DESC
)
UPDATE campaign_clips 
SET is_selected = true 
WHERE id IN (SELECT id FROM latest_per_beat);
```

---

## Étape 2 : Types TypeScript

Fichier : `types/index.ts`

Ajouter `is_selected` à l'interface `CampaignClip` (vers ligne 272) :

```typescript
export interface CampaignClip {
  id: string;
  campaign_id: string;
  order: number;
  beat: ClipBeat;
  first_frame: ClipFirstFrame;
  script: ClipScript;
  video: ClipVideo;
  audio: ClipAudio;
  transcription?: ClipTranscription;
  adjustments?: ClipAdjustments;
  auto_adjustments?: AutoAdjustments;
  user_adjustments?: UserAdjustments;
  current_version?: number;
  is_selected?: boolean;  // ← AJOUTER
  status: ClipStatus;
  created_at: string;
}
```

---

## Étape 3 : Modifier saveClipsToDb (step5-plan.tsx)

Fichier : `components/steps/step5-plan.tsx` (fonction `saveClipsToDb` vers ligne 703)

**Problème actuel** : Le code cherche par `order` avec `.single()` ce qui échoue s'il y a plusieurs clips avec le même order.

**Solution** : Utiliser `.limit(1)` au lieu de `.single()` (déjà partiellement fait, vérifier que c'est complet).

```typescript
// AVANT (problématique)
const { data: found } = await supabase
  .from('campaign_clips')
  .select('id, video')
  .eq('campaign_id', state.campaign_id)
  .eq('order', clip.order)
  .single()  // ← ÉCHOUE si plusieurs clips

// APRÈS
const { data: foundList } = await supabase
  .from('campaign_clips')
  .select('id, video')
  .eq('campaign_id', state.campaign_id)
  .eq('order', clip.order)
  .limit(1)

const found = foundList?.[0]
```

---

## Étape 4 : Modifier saveClipsToDb (step6-generate.tsx)

Fichier : `components/steps/step6-generate.tsx` (fonction `saveClipsToDb` vers ligne 951)

**Même correction** : Utiliser `.limit(1)` au lieu de `.single()`.

**Ajouter** : Sauvegarder `is_selected` dans clipData :

```typescript
const clipData = {
  campaign_id: dbCampaignId,
  order: clip.order,
  beat: clip.beat,
  first_frame: clip.first_frame,
  script: clip.script,
  video: clip.video,
  audio: clip.audio || {},
  transcription: clip.transcription || null,
  adjustments: clip.adjustments || null,
  auto_adjustments: clip.auto_adjustments || null,
  user_adjustments: clip.user_adjustments || null,
  is_selected: clip.is_selected ?? true,  // ← AJOUTER (true par défaut pour nouveaux clips)
  status: clip.status || 'pending',
}
```

**Modifier la recherche** (vers ligne 991) :

```typescript
// AVANT
const { data: existingClip } = await supabase
  .from('campaign_clips')
  .select('id')
  .eq('campaign_id', dbCampaignId)
  .eq('order', clip.order)
  .single()

// APRÈS
const { data: existingList } = await supabase
  .from('campaign_clips')
  .select('id')
  .eq('campaign_id', dbCampaignId)
  .eq('order', clip.order)
  .eq('is_selected', true)  // ← Chercher seulement le clip sélectionné
  .limit(1)

const existingClip = existingList?.[0]
```

---

## Étape 5 : Modifier la régénération

Fichier : `components/steps/step6-generate.tsx`

Quand on régénère un clip, on doit :
1. Créer un NOUVEAU clip (INSERT) avec `is_selected = true`
2. Mettre l'ancien à `is_selected = false`

**Ajouter une fonction** (après `saveClipsToDb`) :

```typescript
// Désélectionner tous les clips d'un beat sauf un
const deselectOtherVersions = useCallback(async (clipId: string, beat: number) => {
  if (!campaignId) return
  
  try {
    // Mettre tous les clips du même beat à is_selected = false
    await (supabase
      .from('campaign_clips') as any)
      .update({ is_selected: false })
      .eq('campaign_id', campaignId)
      .eq('order', beat)
    
    // Mettre le clip choisi à is_selected = true
    await (supabase
      .from('campaign_clips') as any)
      .update({ is_selected: true })
      .eq('id', clipId)
      
    console.log(`[Versioning] ✓ Selected clip ${clipId} for beat ${beat}`)
  } catch (err) {
    console.error('[Versioning] Error selecting version:', err)
  }
}, [campaignId, supabase])
```

**Modifier `handleRegenerate`** (vers ligne 1220) pour créer un nouveau clip au lieu d'écraser :

Après la régénération réussie, au lieu de remplacer le clip dans le tableau :

```typescript
// AVANT
const updatedClips = [...generatedClips]
updatedClips[clipIndex] = result

// APRÈS - Créer nouveau clip, garder l'ancien
const newClip = {
  ...result,
  id: undefined,  // Force INSERT d'un nouveau clip
  is_selected: true,
  created_at: new Date().toISOString(),
}

// Désélectionner l'ancien
const oldClip = generatedClips[clipIndex]
if (oldClip.id) {
  await deselectOtherVersions(newClip.id || '', oldClip.order)
}

// Ajouter le nouveau clip au tableau
const updatedClips = [...generatedClips]
updatedClips[clipIndex] = { ...oldClip, is_selected: false }
updatedClips.push(newClip)
```

---

## Étape 6 : Modifier assembleVideo

Fichier : `components/steps/step6-generate.tsx` (fonction `assembleVideo` vers ligne 657)

**Ajouter une fonction helper** (avant `assembleVideo`) :

```typescript
// Sélectionner UN clip par beat pour l'assemblage
const getSelectedClipsForAssembly = useCallback((clips: CampaignClip[]) => {
  const byBeat = new Map<number, CampaignClip[]>()
  
  // Grouper les clips avec vidéo par beat
  clips.filter(c => c?.video?.raw_url || c?.video?.final_url).forEach(c => {
    const list = byBeat.get(c.order) || []
    list.push(c)
    byBeat.set(c.order, list)
  })
  
  // Pour chaque beat, prendre le clip sélectionné ou le plus récent
  return Array.from(byBeat.entries())
    .sort(([a], [b]) => a - b)
    .map(([beat, versions]) => {
      // Priorité : is_selected, sinon le plus récent
      const selected = versions.find(v => v.is_selected)
      if (selected) return selected
      
      // Fallback : le plus récent
      return versions.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
    })
    .filter(Boolean)
}, [])
```

**Modifier le début de `assembleVideo`** :

```typescript
const assembleVideo = useCallback(async () => {
  // AVANT
  // const clipsData = generatedClips.filter((clip) => clip?.video?.raw_url)
  
  // APRÈS - Utiliser la fonction de sélection
  const selectedClips = getSelectedClipsForAssembly(generatedClips)
  
  console.log('[Assemble] Starting assembly...', {
    campaignId,
    generatedClipsCount: generatedClips.length,
    selectedClipsCount: selectedClips.length,
    selectedClipIds: selectedClips.map(c => ({ id: c.id, order: c.order, is_selected: c.is_selected }))
  })
  
  // ... reste du code utilise selectedClips au lieu de clipsData
```

---

## Étape 7 : UI Navigation entre versions

Fichier : `components/steps/step6-generate.tsx`

**Ajouter les states** (vers ligne 228, après les autres states) :

```typescript
// Navigation entre versions de clips
const [displayedVersionIndex, setDisplayedVersionIndex] = useState<Record<number, number>>({})

// Grouper les clips par beat
const clipsByBeat = useMemo(() => {
  const map = new Map<number, CampaignClip[]>()
  generatedClips.forEach(c => {
    if (!c?.video?.raw_url && !c?.video?.final_url) return // Ignorer clips sans vidéo
    const list = map.get(c.order) || []
    list.push(c)
    map.set(c.order, list.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ))
  })
  return map
}, [generatedClips])
```

**Ajouter les fonctions de navigation** :

```typescript
const navigateVersion = useCallback((beat: number, direction: 'prev' | 'next') => {
  const versions = clipsByBeat.get(beat) || []
  if (versions.length <= 1) return
  
  const currentIndex = displayedVersionIndex[beat] || 0
  let newIndex: number
  
  if (direction === 'prev') {
    newIndex = currentIndex > 0 ? currentIndex - 1 : versions.length - 1
  } else {
    newIndex = currentIndex < versions.length - 1 ? currentIndex + 1 : 0
  }
  
  setDisplayedVersionIndex(prev => ({ ...prev, [beat]: newIndex }))
}, [clipsByBeat, displayedVersionIndex])

const selectVersion = useCallback(async (clipId: string, beat: number) => {
  if (!campaignId) return
  
  try {
    // 1. Mettre tous les clips du même beat à is_selected = false
    await (supabase
      .from('campaign_clips') as any)
      .update({ is_selected: false })
      .eq('campaign_id', campaignId)
      .eq('order', beat)
    
    // 2. Mettre le clip choisi à is_selected = true
    await (supabase
      .from('campaign_clips') as any)
      .update({ is_selected: true })
      .eq('id', clipId)
    
    // 3. Mettre à jour le state local
    setGeneratedClips(prev => prev.map(c => ({
      ...c,
      is_selected: c.id === clipId ? true : (c.order === beat ? false : c.is_selected)
    })))
    
    console.log(`[Versioning] ✓ Selected version ${clipId} for beat ${beat}`)
  } catch (err) {
    console.error('[Versioning] Error selecting version:', err)
  }
}, [campaignId, supabase])
```

**Modifier le rendu des clips** (vers ligne 1546, dans le `clips.map`) :

Le rendu actuel itère sur `clips` (du plan). Il faut modifier pour :
1. Utiliser `clipsByBeat` pour afficher la version courante
2. Ajouter les flèches de navigation

```tsx
{/* Dans le rendu de chaque clip, ajouter après le badge de beat */}
{(() => {
  const versions = clipsByBeat.get(clip.order) || []
  const versionIndex = displayedVersionIndex[clip.order] || 0
  const displayedClip = versions[versionIndex] || generatedClip
  const hasMultipleVersions = versions.length > 1
  
  return hasMultipleVersions ? (
    <div className="flex items-center gap-2 ml-auto">
      <button 
        onClick={() => navigateVersion(clip.order, 'prev')}
        className="p-1 rounded hover:bg-muted"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-xs text-muted-foreground">
        {versionIndex + 1}/{versions.length}
      </span>
      <button 
        onClick={() => navigateVersion(clip.order, 'next')}
        className="p-1 rounded hover:bg-muted"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      {!displayedClip.is_selected && (
        <button
          onClick={() => selectVersion(displayedClip.id, clip.order)}
          className="text-xs px-2 py-1 rounded bg-violet-500 text-white hover:bg-violet-600"
        >
          Utiliser
        </button>
      )}
      {displayedClip.is_selected && (
        <span className="text-xs text-green-500 flex items-center gap-1">
          <Check className="w-3 h-3" /> Sélectionnée
        </span>
      )}
    </div>
  ) : null
})()}
```

**Importer les icônes** (en haut du fichier) :

```typescript
import { ChevronLeft, ChevronRight } from 'lucide-react'
```

---

## Étape 8 : Première génération avec is_selected

Fichier : `hooks/use-video-generation.ts` (fonction `generateClipAssets` vers ligne 43)

S'assurer que les clips générés pour la première fois ont `is_selected: true` :

```typescript
// À la fin de generateClipAssets, avant le return
const updatedClip: CampaignClip = {
  ...clip,
  // ... autres propriétés
  is_selected: true,  // ← AJOUTER - Premier clip d'un beat est sélectionné par défaut
  status: 'completed' as ClipStatus,
}

return updatedClip
```

---

## Résumé des fichiers à modifier

| Fichier | Modifications |
|---------|--------------|
| `types/index.ts` | Ajouter `is_selected?: boolean` à CampaignClip |
| `components/steps/step5-plan.tsx` | `.limit(1)` au lieu de `.single()` |
| `components/steps/step6-generate.tsx` | saveClipsToDb, assembleVideo, UI navigation, selectVersion |
| `hooks/use-video-generation.ts` | Ajouter `is_selected: true` aux nouveaux clips |

---

## Tests à effectuer

1. **Nouvelle campagne** : Générer des clips, vérifier que chacun a `is_selected = true`
2. **Régénération** : Régénérer un clip, vérifier que le nouveau a `is_selected = true` et l'ancien `false`
3. **Navigation** : Vérifier les flèches pour naviguer entre versions
4. **Sélection** : Cliquer "Utiliser" sur une ancienne version, vérifier que ça change `is_selected`
5. **Assemblage** : Assembler, vérifier que seuls les clips `is_selected` sont utilisés

---

## Notes importantes

- **Project ID Supabase** : `xresijptcptdilwecklf`
- **Ne pas casser l'existant** : Les modifications doivent être rétrocompatibles
- **Fallback** : Si aucun `is_selected`, toujours prendre le plus récent
- **Un clip par beat pour l'assemblage** : L'assemblage doit toujours prendre exactement un clip par beat

