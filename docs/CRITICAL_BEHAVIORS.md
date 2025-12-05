# 🚨 COMPORTEMENTS CRITIQUES - NE JAMAIS MODIFIER

> Ce document définit les **invariants** du projet - des comportements qui ont été testés,
> validés et qui doivent être préservés. **Toute modification de ces comportements doit être
> discutée et documentée.**

---

## 📋 Table des matières

1. [Système de Versioning des Clips](#1-système-de-versioning-des-clips)
2. [Pipeline de Génération Vidéo](#2-pipeline-de-génération-vidéo)
3. [Système d'Ajustements (Trim/Speed)](#3-système-dajustements-trimspeed)
4. [FFmpeg et Normalisation des Timestamps](#4-ffmpeg-et-normalisation-des-timestamps)
5. [Audio : Mix Voix + Ambiance](#5-audio--mix-voix--ambiance)
6. [Assemblage Final (Concat)](#6-assemblage-final-concat)
7. [Système de Crédits](#7-système-de-crédits)
8. [Persistance des Données](#8-persistance-des-données)
9. [Prompts Claude](#9-prompts-claude)

---

## 1. Système de Versioning des Clips

### Contexte
> Commit `25957ca` - Permet de régénérer un clip sans perdre l'ancien.
> Plusieurs versions peuvent exister pour le même beat.

### Règles CRITIQUES

| Règle | Description | Commit de référence |
|-------|-------------|---------------------|
| **Un clip sélectionné par beat** | `is_selected = true` sur UN SEUL clip par `order` | `25957ca` |
| **Fallback au plus récent** | Si aucun `is_selected`, prendre le clip avec `created_at` le plus récent | `25957ca` |
| **Ne JAMAIS utiliser `.single()`** | Utiliser `.limit(1)` pour les requêtes sur `campaign_clips` par `order` | `91ae571` |
| **Une tuile par beat dans l'UI** | Itérer sur `uniqueBeats`, pas sur `clips` | `91ae571` |
| **Archiver APRÈS succès** | Créer la clip_version APRÈS la régénération réussie, pas avant | `26f5f86` |

### Code de référence

```typescript
// ✅ CORRECT - Sélection pour l'assemblage (step6-generate.tsx)
const getSelectedClipsForAssembly = (clips: CampaignClip[]) => {
  const byBeat = new Map<number, CampaignClip[]>()
  
  clips.filter(c => c?.video?.raw_url || c?.video?.final_url).forEach(c => {
    const list = byBeat.get(c.order) || []
    list.push(c)
    byBeat.set(c.order, list)
  })
  
  return Array.from(byBeat.entries())
    .sort(([a], [b]) => a - b)
    .map(([beat, versions]) => {
      // Priorité : is_selected, sinon le plus récent
      const selected = versions.find(v => v.is_selected)
      if (selected) return selected
      
      return versions.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
    })
    .filter(Boolean)
}
```

```typescript
// ❌ INTERDIT - Va casser si plusieurs clips par beat
const { data: clip } = await supabase
  .from('campaign_clips')
  .select('*')
  .eq('campaign_id', id)
  .eq('order', 1)
  .single()  // 💥 ERREUR si plusieurs clips

// ✅ CORRECT
const { data: clips } = await supabase
  .from('campaign_clips')
  .select('*')
  .eq('campaign_id', id)
  .eq('order', 1)
  .order('is_selected', { ascending: false })
  .limit(1)
const clip = clips?.[0]
```

---

## 2. Pipeline de Génération Vidéo

### Ordre STRICT du pipeline

```
1. First Frame (Nano Banana Pro) ─────────────────────┐
   └── Image de référence pour Veo                    │
                                                      │
2. Vidéo (Veo 3.1 - Fast ou Standard) ←───────────────┘
   └── Génère vidéo AVEC audio (lip-sync)
                    │
3. Transcription (Whisper) ←──────────────────────────┘
   └── Extrait speech_start, speech_end, words_per_second
   └── Calcule auto_adjustments (trim + speed suggérés)
                    │
4. Voice Conversion (ChatterboxHD S2S) ←──────────────┘
   └── Clone la voix depuis l'audio Veo
   └── Garde la synchronisation labiale
                    │
5. Ambient Audio (ElevenLabs SFX) 
   └── Son d'ambiance généré au prompt
                    │
6. Mix Audio (fal.ai ffmpeg-api/compose) ←────────────┘
   └── REMPLACE l'audio original
   └── Voix clonée (100%) + Ambiance (20%)
                    │
7. Process Clip (Transloadit) ←───────────────────────┘
   └── Trim (début/fin)
   └── Speed (1.0x, 1.1x, 1.2x)
   └── Normalisation timestamps
                    │
8. Assemblage (Transloadit /video/concat) ←───────────┘
   └── Concat tous les clips sélectionnés
   └── Resize 9:16 (1080x1920)
```

### Règles CRITIQUES

| Règle | Pourquoi | Commit |
|-------|----------|--------|
| **La voix est clonée depuis l'audio Veo** | Veo génère de l'audio avec lip-sync. On clone cette voix pour garder la synchronisation labiale | - |
| **Le mix REMPLACE l'audio original** | Ne JAMAIS superposer. L'audio Veo contient des sons parasites qu'on veut éliminer | - |
| **Transcription AVANT voice conversion** | On a besoin des speech boundaries pour calculer le trim auto | `cd506c2` |
| **Process-clip APRÈS mix** | Le trim/speed s'applique sur la vidéo finale mixée | - |
| **Régénérer voix quand on régénère vidéo** | L'audio source change → la voix clonée doit être refaite | `99ca0c1` |
| **Re-mixer quand on régénère vidéo** | Préserver voix et ambiance avec la nouvelle vidéo | `c4d90bc` |

---

## 3. Système d'Ajustements (Trim/Speed)

### Structure V2 - Auto vs User (commit `070217a`)

```typescript
// Ajustements calculés automatiquement (Whisper + Claude)
interface AutoAdjustments {
  trim_start: number;   // Basé sur speech_start
  trim_end: number;     // Basé sur speech_end
  speed: number;        // Basé sur words_per_second
  updated_at: string;   // ISO timestamp - CRITIQUE pour la priorité
}

// Ajustements modifiés par l'utilisateur
interface UserAdjustments {
  trim_start: number;
  trim_end: number;
  speed: number;
  updated_at: string;   // ISO timestamp - CRITIQUE pour la priorité
}
```

### Règles CRITIQUES

| Règle | Pourquoi | Commit |
|-------|----------|--------|
| **User > Auto si plus récent** | L'utilisateur a le dernier mot. Mais si on régénère, auto reprend le dessus | `070217a` |
| **Vitesse >= 1.0 UNIQUEMENT** | UGC TikTok = dynamique. Pas de ralentissement, jamais. | `06e35d4`, `30d0bdb` |
| **Ajustements par `clip.id`** | PAS par beat/order. Chaque version a ses propres ajustements | `c3c5549` |
| **Toujours sauvegarder `updated_at`** | C'est ce qui détermine la priorité auto vs user | `070217a` |
| **Précision 0.01s** | Les timestamps de trim sont au centième de seconde | `de0f29c` |

### Vitesses autorisées

```typescript
// step6-generate.tsx ligne ~128
const SPEED_OPTIONS = [
  { value: 1.0, label: '1x' },
  { value: 1.1, label: '1.1x' },
  { value: 1.2, label: '1.2x' },
]

// JAMAIS de 0.8x ou 0.9x - ça tue l'énergie du contenu UGC
const ensureMinSpeed = (speed: number): number => Math.max(1.0, speed)
```

### Fonction getEffectiveAdjustments (types/index.ts)

```typescript
// TOUJOURS utiliser cette fonction pour obtenir les ajustements effectifs
function getEffectiveAdjustments(
  autoAdj?: AutoAdjustments | null,
  userAdj?: UserAdjustments | null,
  videoDuration?: number
): { trimStart: number; trimEnd: number; speed: number; source: 'auto' | 'user' | 'default' } {
  const defaultDuration = videoDuration || 6
  
  // CAS 1: Les deux existent → comparer les timestamps
  if (userAdj?.updated_at && autoAdj?.updated_at) {
    if (new Date(userAdj.updated_at) > new Date(autoAdj.updated_at)) {
      return { trimStart: userAdj.trim_start, trimEnd: userAdj.trim_end, speed: userAdj.speed, source: 'user' }
    }
  }
  
  // CAS 2: Seulement user_adjustments existe
  if (userAdj?.updated_at && !autoAdj?.updated_at) {
    return { trimStart: userAdj.trim_start, trimEnd: userAdj.trim_end, speed: userAdj.speed, source: 'user' }
  }
  
  // CAS 3: auto_adjustments existe (user absent ou moins récent)
  if (autoAdj?.updated_at) {
    return { trimStart: autoAdj.trim_start, trimEnd: autoAdj.trim_end, speed: autoAdj.speed, source: 'auto' }
  }
  
  // CAS 4: Aucun ajustement → valeurs par défaut
  return { trimStart: 0, trimEnd: defaultDuration, speed: 1.0, source: 'default' }
}
```

---

## 4. FFmpeg et Normalisation des Timestamps

### Le problème (commits `698152f`, `a9a0b46`, `f22595b`)

> Les vidéos générées par IA (Veo, etc.) ont des **timestamps qui ne commencent pas à 0**.
> Si on fait `trim=end=5`, FFmpeg peut couper le **début** de la vidéo au lieu de la fin !

### Solution : Normalisation systématique

```typescript
// process-clip/route.ts - ORDRE CRITIQUE DES FILTRES
const videoFilters: string[] = []
const audioFilters: string[] = []

// ÉTAPE 1 : TOUJOURS normaliser les timestamps EN PREMIER
videoFilters.push('setpts=PTS-STARTPTS')
audioFilters.push('asetpts=PTS-STARTPTS')

// ÉTAPE 2 : Trim (maintenant les timestamps sont à 0)
// TOUJOURS ajouter start=0 explicite pour les vidéos Veo
videoFilters.push(`trim=start=0:end=${trimEnd}`)
audioFilters.push(`atrim=start=0:end=${trimEnd}`)

// ÉTAPE 2.5 : Re-normaliser APRÈS le trim
videoFilters.push('setpts=PTS-STARTPTS')
audioFilters.push('asetpts=PTS-STARTPTS')

// ÉTAPE 3 : Speed
if (speed !== 1.0) {
  videoFilters.push(`setpts=${(1/speed).toFixed(4)}*PTS`)
  audioFilters.push(`atempo=${speed}`)
}

// ÉTAPE 4 : Reset final pour l'assemblage
videoFilters.push('setpts=PTS-STARTPTS')
audioFilters.push('asetpts=PTS-STARTPTS')
```

### Paramètres FFmpeg critiques

```typescript
// process-clip/route.ts
ffmpegParams['fflags'] = '+genpts+discardcorrupt'  // Génère PTS si manquants
ffmpegParams['vsync'] = 'cfr'                       // Constant frame rate
ffmpegParams['force_key_frames'] = 'expr:eq(t,0)'  // Keyframe au début (assemblage)
ffmpegParams['ar'] = 48000                          // Audio 48kHz (standard vidéo)
ffmpegParams['ac'] = 2                              // Stéréo
```

---

## 5. Audio : Mix Voix + Ambiance

### Comportement attendu

```
Vidéo Veo (avec audio lip-sync)
            ↓
    Audio extrait
            ↓
ChatterboxHD (Speech-to-Speech)
            ↓
    Voix clonée
            +
ElevenLabs (Sound Effects)
            ↓
    Ambiance
            ↓
    MIX FINAL
    └── Voix : 100%
    └── Ambiance : 20%
            ↓
REMPLACE l'audio original de la vidéo
```

### Règles CRITIQUES

| Règle | Pourquoi |
|-------|----------|
| **L'audio Veo est SUPPRIMÉ** | On le remplace entièrement par voix clonée + ambiance |
| **Volumes : voix 100%, ambiance 20%** | L'ambiance ne doit pas couvrir la voix |
| **L'ambiance dure toute la vidéo** | Elle est générée à la durée de la vidéo, pas du speech |
| **Source audio = vidéo Veo raw** | Jamais depuis TTS, toujours depuis la vidéo générée |

### Volumes par défaut

```typescript
const DEFAULT_VOICE_VOLUME = 100   // Ne JAMAIS descendre sous 80
const DEFAULT_AMBIENT_VOLUME = 20  // Entre 10-30 idéalement
```

---

## 6. Assemblage Final (Concat)

### Format de sortie

| Paramètre | Valeur | Pourquoi |
|-----------|--------|----------|
| **Résolution** | 1080x1920 | Format portrait 9:16 TikTok/Reels |
| **Codec** | H.264 (libx264) | Compatibilité maximale |
| **FPS** | 30 | Standard UGC |
| **Audio** | AAC 128k, 48kHz, Stéréo | Standard vidéo web |

### Architecture de l'assemblage (assemble/route.ts)

```
1. Validation URLs (HEAD request)
        ↓
2. Import clips (Transloadit /http/import)
        ↓
3. Concat avec ré-encodage (/video/concat)
   └── preset: 'ipad-high'
   └── ffmpeg: { fflags, vsync, force_key_frames, r: 30 }
        ↓
4. Resize 9:16 (/video/encode) - SÉPARÉ du concat
   └── vf: 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920'
        ↓
5. Thumbnail (/video/thumbs)
```

### Règles CRITIQUES

| Règle | Pourquoi | Commit |
|-------|----------|--------|
| **Resize 9:16 APRÈS concat** | Si on resize avant, erreurs INTERNAL_COMMAND_ERROR | `08f7d82` |
| **Un seul clip par beat** | L'assemblage prend `is_selected` ou le plus récent | `25957ca` |
| **Ordre par `clip.order`** | Le beat hook (1) est toujours en premier | - |
| **Preset `ipad-high` pour concat** | Testé et validé (commit "comme hier 3h") | `71e9ae7` |
| **Forcer ré-encodage** | Les vidéos IA ont des timestamps bizarres | `04c0851` |
| **Retry automatique (3x)** | Transloadit peut échouer temporairement | `452720f` |

### Ce qu'on a essayé et qui NE MARCHE PAS

| Approche | Problème | Commit de revert |
|----------|----------|------------------|
| fal.ai compose pour concat | Ne trim pas, timestamps cassés | `04c0851` |
| Resize dans concat | INTERNAL_COMMAND_ERROR | `616ee96` |
| igndts flag | Coupe le début des vidéos | `94daeca` |
| Stream copy (pas de ré-encodage) | Timestamps cassés | `0f9e1e6` |

---

## 7. Système de Crédits

### Règles CRITIQUES

| Règle | Pourquoi | Commit |
|-------|----------|--------|
| **Balance peut être négative** | Une génération payée côté Fal.ai DOIT être facturée même si race condition | `f0852cd` |
| **Check AVANT génération** | On vérifie les crédits avant de lancer, pas après | - |
| **Admin = crédits illimités** | Vérifié par email dans `lib/admin.ts` | `6324b8c` |
| **Lock FOR UPDATE sur deduct** | Évite les race conditions sur les déductions concurrentes | `billing.sql` |

### Coûts par seconde pour Veo

```typescript
// Les vidéos Veo sont facturées PAR SECONDE
const videoCost = costPerSecond * videoDuration

// Exemple pour Fast (25 crédits/seconde):
// 6s Fast = 25 × 6 = 150 crédits
// 8s Fast = 25 × 8 = 200 crédits
```

### Prix (décembre 2024)

| Type | Coût interne (crédits) | Coût réel fal.ai |
|------|------------------------|------------------|
| First Frame | 25 | $0.15 |
| Veo 3.1 Fast | 25/seconde | $0.15/seconde |
| Veo 3.1 Standard | 60/seconde | $0.40/seconde |
| Voice Chatterbox | 20 | $0.02/minute |
| Ambient ElevenLabs | 15 | $0.002/seconde |

---

## 8. Persistance des Données

### Sauvegarde des clips par étape

| Étape | Ce qui est sauvegardé | Fichier |
|-------|----------------------|---------|
| **Step 5 (Plan)** | script, first_frame, beat, order | `step5-plan.tsx` |
| **Step 6 (Generate)** | video, audio, transcription, adjustments | `step6-generate.tsx` |

### Règle CRITIQUE : Préserver les vidéos existantes

```typescript
// step5-plan.tsx - saveClipsToDb
// IMPORTANT: Ne sauvegarder video QUE si elle a du contenu
// Cela évite d'écraser les vidéos générées en step 6
if (clip.video?.raw_url || clip.video?.final_url) {
  clipData.video = clip.video
}

// Si un clip existe déjà avec une vidéo, la préserver
if (found.video?.raw_url && !clip.video?.raw_url) {
  clipData.video = found.video
  console.log(`[Step5] ✓ Preserving existing video for clip ${clip.order}`)
}
```

### Commits de référence

| Comportement | Commit |
|--------------|--------|
| Préserver vidéos en step5 | `7390684` |
| Sauver clips en step5 (pas juste step6) | `f859e7b` |
| Empêcher régénération auto du plan | `1c7450b`, `2deb19b` |
| Functional updater pour éviter race conditions | `2df633e`, `ec11682` |

---

## 9. Prompts Claude

### Règle sur les accents

> **Commit `5b7c01b`** : Ne JAMAIS mettre d'instructions négatives sur l'accent dans les prompts.
> "Don't use Canadian accent" → Claude fait l'inverse et génère un accent canadien.

```typescript
// ❌ INTERDIT
const prompt = "Generate a script. Don't use Canadian accent."

// ✅ CORRECT
const prompt = "Generate a script in natural French from France (metropolitan)."
```

---

## 🔄 Historique des comportements critiques

| Date | Commit | Comportement ajouté |
|------|--------|---------------------|
| Dec 2024 | `81785dc` | Fix comptage clips par beats |
| Dec 2024 | `53749b0` | Charger clip_versions pour navigation |
| Dec 2024 | `91ae571` | Une seule tuile par beat (itère sur uniqueBeats) |
| Dec 2024 | `26f5f86` | Archiver version APRÈS succès régénération |
| Dec 2024 | `c3c5549` | Ajustements par clip.id, pas par beat |
| Dec 2024 | `25957ca` | Système de versioning avec `is_selected` |
| Dec 2024 | `070217a` | Auto-adjustments V2 (auto vs user avec timestamps) |
| Dec 2024 | `08f7d82` | Resize 9:16 APRÈS concat |
| Dec 2024 | `71e9ae7` | Restaurer preset ipad-high pour concat |
| Nov 2024 | `cd506c2` | Auto-trim basé sur Whisper speech boundaries |
| Nov 2024 | `698152f` | Normalisation timestamps avant concat |
| Nov 2024 | `f0852cd` | Balance négative autorisée |
| Nov 2024 | `04c0851` | Transloadit au lieu de fal.ai pour concat |
| Nov 2024 | `7390684` | Préservation vidéos existantes en step5 |
| Nov 2024 | `5b7c01b` | Retirer instructions négatives accent |

---

## 📝 Comment mettre à jour ce document

1. **Avant de modifier un comportement listé ici** → Discuter et documenter la raison
2. **Après avoir fixé un bug critique** → L'ajouter ici avec :
   - La règle
   - Le pourquoi
   - Le commit Git
   - Le code de référence si pertinent
3. **Format** : Garder les tableaux concis, le code dans des blocs

---

*Dernière mise à jour : 5 décembre 2024*
