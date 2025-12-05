# 🚨 COMPORTEMENTS CRITIQUES - NE JAMAIS MODIFIER

> Ce document définit les **invariants** du projet - des comportements qui ont été testés,
> validés et qui doivent être préservés. **Toute modification de ces comportements doit être
> discutée et documentée.**

> 🔧 Pour le troubleshooting des erreurs courantes, voir [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)

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
10. [Transcription Intelligente (Whisper + Claude)](#10-transcription-intelligente-whisper--claude)
11. [Structure des Beats](#11-structure-des-beats)
12. [Race Conditions et Patterns](#12-race-conditions-et-patterns)
13. [Génération d'Images d'Acteurs (Higgsfield Soul)](#13-génération-dimages-dacteurs-higgsfield-soul)
14. [RLS et APIs Admin (Service Role)](#14-rls-et-apis-admin-service-role)
15. [Règles de Modifications UI (Tous Composants)](#15-règles-de-modifications-ui-tous-composants)

---

## 1. Système de Versioning des Clips

### Contexte
> Commit `25957ca` - Permet de régénérer un clip sans perdre l'ancien.
> Plusieurs versions peuvent exister pour le même beat.

### Architecture du versioning

```
                    campaign_clips (table principale)
                    ┌─────────────────────────────────────┐
                    │ Clip A (beat 1, is_selected=true)   │ ← Utilisé pour assemblage
                    │ Clip B (beat 1, is_selected=false)  │ ← Ancienne version
                    │ Clip C (beat 2, is_selected=true)   │
                    └─────────────────────────────────────┘
                                     │
                                     ▼
                    clip_versions (snapshots pour restauration)
                    ┌─────────────────────────────────────┐
                    │ Version 1 de Clip A (snapshot)      │
                    │ Version 2 de Clip A (snapshot)      │
                    └─────────────────────────────────────┘
```

**IMPORTANT** : Les versions actives sont des **rows séparés** dans `campaign_clips`, pas des mises à jour d'un même row. La table `clip_versions` ne sert qu'à restaurer des snapshots.

### Règles CRITIQUES

| Règle | Description | Commit de référence |
|-------|-------------|---------------------|
| **Un clip sélectionné par beat** | `is_selected = true` sur UN SEUL clip par `order` | `25957ca` |
| **Fallback au plus récent** | Si aucun `is_selected`, prendre le clip avec `created_at` le plus récent | `25957ca` |
| **Ne JAMAIS utiliser `.single()`** | Utiliser `.limit(1)` pour les requêtes sur `campaign_clips` par `order` | `91ae571` |
| **Une tuile par beat dans l'UI** | Itérer sur `uniqueBeats`, pas sur `clips` | `91ae571` |
| **Archiver APRÈS succès** | Créer la clip_version APRÈS la régénération réussie, pas avant | `26f5f86` |
| **Nouveau row à chaque régénération** | `id: undefined` force un INSERT, pas un UPDATE | `25957ca` |
| **Preview sur nouveau clip après regen** | Reset `displayedVersionIndex[beat]` à 0 + trier `clipsByBeat` par `is_selected` d'abord | Dec 2024 |
| **Script modifié → régénérer** | Passer le clip avec script mis à jour via `confirmRegen.clipToRegenerate` (évite timing React) | Dec 2024 |

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
   └── Modèle: fal-ai/nano-banana-pro/edit            │
                                                      │
2. Vidéo (Veo 3.1 - Fast ou Standard) ←───────────────┘
   └── Génère vidéo AVEC audio (lip-sync)
   └── Modèle: fal-ai/veo3.1/image-to-video
                    │
3. Transcription (Whisper) ←──────────────────────────┘
   └── Extrait speech_start, speech_end, words_per_second
   └── Calcule auto_adjustments (trim + speed suggérés)
                    │
4. Voice Conversion (ChatterboxHD S2S) ←──────────────┘
   └── Clone la voix depuis l'audio Veo
   └── Garde la synchronisation labiale
   └── Modèle: resemble-ai/chatterboxhd/speech-to-speech
                    │
5. Ambient Audio (ElevenLabs SFX) 
   └── Son d'ambiance généré au prompt
   └── Modèle: fal-ai/elevenlabs/sound-effects/v2
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
| **Reset user_adjustments à la régénération** | Quand on régénère, `user_adjustments` est mis à `undefined` | `070217a` |

### Comportement lors de la régénération

Quand on régénère une vidéo :
1. Whisper re-transcrit l'audio
2. Claude recalcule les marqueurs de parole
3. `auto_adjustments` est mis à jour avec un nouveau `updated_at`
4. **`user_adjustments` est SUPPRIMÉ** (mis à `undefined`)
5. L'utilisateur perd ses personnalisations → doit refaire ses ajustements manuels

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

### Les 3 cas de mixage (mix-video/route.ts) - CRITIQUE

> **Fichier de référence** : `app/api/generate/mix-video/route.ts`

| Cas | Voix | Ambiance | Comportement | Audio Original Veo |
|-----|------|----------|--------------|-------------------|
| 1 | ✅ | ❌ | **REMPLACE** l'audio Veo par la voix clonée | ❌ SUPPRIMÉ |
| 2 | ❌ | ✅ | **MIXE** l'audio Veo + ambiance | ✅ GARDÉ |
| 3 | ✅ | ✅ | **REMPLACE** l'audio Veo par voix clonée + ambiance | ❌ SUPPRIMÉ |

### Pourquoi c'est critique

```
              ┌─────────────────────────────────────────────────────────────┐
              │ L'audio original de Veo contient une voix IA "robotique"   │
              │ avec lip-sync. On veut la REMPLACER par une voix humaine   │
              │ clonée, sauf si le clonage échoue.                         │
              └─────────────────────────────────────────────────────────────┘

CAS 1 : Voix ✅, Ambiance ❌
═══════════════════════════
    [Vidéo Veo]───video───►[Output]
                            ▲
    [Voix clonée]──audio────┘   ← L'audio Veo est IGNORÉ (map: ['0:v', '[aout]'])


CAS 2 : Voix ❌, Ambiance ✅ (fallback quand voix échoue)
═══════════════════════════════════════════════════════
    [Vidéo Veo]───video + audio───►[amix]───►[Output]
                                    ▲
    [Ambiance]──────────────────────┘
    
    ⚠️ ATTENTION: L'audio Veo (voix robotique) est GARDÉ !
    → Résultat = voix IA + ambiance. Qualité inférieure.


CAS 3 : Voix ✅, Ambiance ✅ (cas nominal)
═══════════════════════════════════════
    [Vidéo Veo]───video───►[Output]
                            ▲
    [Voix clonée]──┬───────►[amix]
    [Ambiance]─────┘
    
    → Audio Veo IGNORÉ. Output = voix humaine + ambiance.
```

### Code FFmpeg correspondant

```typescript
// CAS 1 : Voix seule - REMPLACE l'audio
'filter_complex': `[1:a]volume=${voiceVol},apad=pad_dur=${duration}[aout]`,
'map': ['0:v', '[aout]'],  // 0:v = vidéo Veo, [aout] = voix clonée

// CAS 2 : Ambiance seule - GARDE l'audio Veo
'filter_complex': `[0:a]volume=1.0[orig];[1:a]volume=${ambientVol},...[aout]`,
'map': ['0:v', '[aout]'],  // [0:a] = audio Veo original (GARDÉ)

// CAS 3 : Les deux - REMPLACE l'audio
'filter_complex': `[1:a]volume=${voiceVol},...[voice];[2:a]volume=${ambientVol},...[ambient];[voice][ambient]amix=...`,
'map': ['0:v', '[aout]'],  // Pas de 0:a = audio Veo IGNORÉ
```

### Règles CRITIQUES

| Règle | Pourquoi |
|-------|----------|
| **L'audio Veo est SUPPRIMÉ (cas 1 et 3)** | On le remplace entièrement par voix clonée + ambiance |
| **L'audio Veo est GARDÉ (cas 2 seulement)** | Si voix échoue, on mixe l'original avec l'ambiance |
| **Volumes : voix 100%, ambiance 20%** | L'ambiance ne doit pas couvrir la voix |
| **L'ambiance dure toute la vidéo** | Elle est générée à la durée de la vidéo, pas du speech |
| **Source audio = vidéo Veo raw** | Jamais depuis TTS, toujours depuis la vidéo générée |
| **`apad=pad_dur=${duration}`** | Assure que l'audio a la bonne durée (évite coupures) |

### Quand les cas se produisent

| Scénario | Cas déclenché | Résultat audio |
|----------|---------------|----------------|
| Génération normale, tout OK | Cas 3 | ✅ Voix humaine + ambiance |
| ChatterboxHD timeout/erreur | Cas 2 | ⚠️ Voix IA robotique + ambiance |
| ElevenLabs timeout/erreur | Cas 1 | ✅ Voix humaine sans ambiance |
| Pas d'acteur avec voix | Cas 2 | ⚠️ Voix IA + ambiance |
| User régénère juste l'ambiance | Cas 3 | ✅ Voix existante + nouvelle ambiance |

### Volumes par défaut

```typescript
// Valeurs utilisées dans le mix audio
const voiceVolume = 100   // Ne JAMAIS descendre sous 80
const ambientVolume = 20  // Entre 10-30 idéalement
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

### Comprendre les unités

> ⚠️ **IMPORTANT** : Dans ce projet, **1 crédit = 1 centime d'euro**.
> Le `balance` dans `user_credits` est en **crédits**, pas en centimes.
> Exemple : balance = 1000 crédits = 10.00€

### Règles CRITIQUES

| Règle | Pourquoi | Commit |
|-------|----------|--------|
| **Balance peut être négative** | Une génération payée côté Fal.ai DOIT être facturée même si race condition | `f0852cd` |
| **Check AVANT génération** | On vérifie les crédits avant de lancer, pas après | - |
| **Admin = crédits illimités** | Vérifié par email dans `lib/admin.ts` | `6324b8c` |
| **Lock FOR UPDATE sur deduct** | Évite les race conditions sur les déductions concurrentes | `billing.sql` |

### Coûts par seconde pour Veo

```typescript
// Les vidéos Veo sont facturées PAR SECONDE de vidéo générée
const videoCost = costPerSecond * videoDuration

// Exemple pour Fast (25 crédits/seconde):
// 6s Fast = 25 × 6 = 150 crédits = 1.50€
// 8s Fast = 25 × 8 = 200 crédits = 2.00€
```

### Prix (décembre 2024)

| Type | Coût facturé (crédits) | Coût réel fal.ai |
|------|------------------------|------------------|
| First Frame | 25 crédits (0.25€) | ~15 centimes |
| Veo 3.1 Fast | 25 crédits/seconde | ~15 centimes/seconde |
| Veo 3.1 Standard | 60 crédits/seconde | ~40 centimes/seconde |
| Voice Chatterbox | 20 crédits | ~1 centime |
| Ambient ElevenLabs | 15 crédits | ~2 centimes |

> **Note** : `cost_cents` dans la table `generation_costs` = crédits facturés au client.
> `real_cost_cents` = coût réel fal.ai en centimes d'euro.

---

## 8. Persistance des Données

### Sauvegarde des clips par étape

| Étape | Ce qui est sauvegardé | Fichier |
|-------|----------------------|---------|
| **Step 5 (Plan)** | script, first_frame, beat, order | `step5-plan.tsx` |
| **Step 6 (Generate)** | video, audio, transcription, adjustments | `step6-generate.tsx` |

### Règle CRITIQUE : Préserver les vidéos existantes en Step 5

> **Commit `7390684`** : Quand l'utilisateur retourne à Step 5 (plan) et re-sauvegarde,
> les vidéos déjà générées en Step 6 ne doivent JAMAIS être écrasées.

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

### Règle CRITIQUE : Ne pas régénérer le plan automatiquement

> **Commits `1c7450b`, `2deb19b`** : Quand l'utilisateur retourne à Step 5 avec des clips
> existants, NE PAS régénérer le plan Claude automatiquement.

```typescript
// ❌ INTERDIT
useEffect(() => {
  if (clips.length === 0) generatePlan()
}, [clips])

// ✅ CORRECT - Seulement si explicitement demandé
const handleRegeneratePlan = () => {
  if (confirm('Régénérer le plan ?')) generatePlan()
}
```

### Règle CRITIQUE : Synchronisation immédiate lors des éditions manuelles

> **Fix Dec 2024** : Quand l'utilisateur édite le script ou le prompt visuel manuellement
> dans step5, les modifications doivent être synchronisées IMMÉDIATEMENT avec le parent
> et sauvegardées en BDD. Ne PAS compter sur les useEffect asynchrones.

**Le problème** : L'utilisateur pouvait cliquer sur "Continuer" avant que le useEffect de
synchronisation ne s'exécute, ce qui causait la perte des modifications.

```typescript
// ❌ PROBLÈME - La synchronisation via useEffect peut ne pas s'exécuter à temps
const saveEdit = () => {
  setClips(updatedClips)  // State local mis à jour
  // ... mais onClipsGenerated() est appelé dans un useEffect, 
  // qui peut ne pas s'exécuter avant la navigation
}

// ✅ CORRECT - Synchronisation immédiate
const saveEdit = async () => {
  const updatedClips = [...]  // Calculer les nouveaux clips
  
  // 1. Mettre à jour le state local
  setClips(updatedClips)
  
  // 2. IMMÉDIATEMENT synchroniser avec le parent
  onClipsGenerated(updatedClips)
  
  // 3. Sauvegarder en BDD immédiatement
  await saveToDb(updatedClips)
}
```

**Fonctions concernées dans step5-plan.tsx** :
- `saveEdit()` - Édition du script
- `saveVisualEdit()` - Édition du prompt visuel

### Commits de référence

| Comportement | Commit |
|--------------|--------|
| Préserver vidéos en step5 | `7390684` |
| Sauver clips en step5 (pas juste step6) | `f859e7b` |
| Empêcher régénération auto du plan | `1c7450b`, `2deb19b` |
| Functional updater pour éviter race conditions | `2df633e`, `ec11682` |
| Synchronisation immédiate des éditions manuelles | Dec 2024 |

---

## 8.1 Remplacement du Script dans video.prompt (CRITIQUE)

### Le problème

Quand l'utilisateur modifie le script à l'étape 6 et clique sur "Sauvegarder & Régénérer", le nouveau texte doit être injecté dans le `video.prompt` pour que Veo génère la vidéo avec les nouvelles paroles.

**Le problème** : Le `String.replace()` direct échoue souvent car :
1. Le `video.prompt` contient le script avec un préfixe d'accent (ex: `"speaks in standard metropolitan French accent... : [script]"`)
2. Des variations de caractères (apostrophes typographiques vs ASCII)
3. Des variations subtiles dans le formatage

### Solution : Fonction `replaceScriptInPrompt`

> **Fix Dec 2024** : Utiliser la fonction helper robuste `replaceScriptInPrompt()` dans `step6-generate.tsx`

```typescript
// ❌ PROBLÈME - Le replace direct peut échouer silencieusement
updatedVideoPrompt = originalPrompt.replace(oldScript, newScript)
// Si oldScript n'est pas trouvé, originalPrompt est retourné tel quel !

// ✅ CORRECT - Utiliser la fonction helper robuste
const updatedVideoPrompt = replaceScriptInPrompt(originalPrompt, oldScript, newScript)
```

### Stratégie de la fonction

1. **Méthode 1** : `replace()` direct (cas simple)
2. **Méthode 2** : Parser le pattern d'accent `speaks in ... : [script]` et remplacer
3. **Méthode 3 (fallback)** : Ajouter `[SCRIPT OVERRIDE]: "nouveau texte"` à la fin

### Fonctions concernées

- `replaceScriptInPrompt()` - Helper en haut de `step6-generate.tsx`
- `saveScript()` - Sauvegarde du script modifié
- Bouton "Sauvegarder & Régénérer" - Construction du clip avec script mis à jour

### Règle CRITIQUE : Fallback sur oldScript

> **Fix 5 Dec 2024** : `oldScript` doit TOUJOURS avoir un fallback vers `clip.script.text`

```typescript
// ❌ BUG - Si generatedClip n'existe pas, oldScript sera vide
// et replaceScriptInPrompt() ne fera rien !
const oldScript = generatedClip?.script?.text || ''

// ✅ CORRECT - Fallback vers clip.script.text
const oldScript = generatedClip?.script?.text || clip.script?.text || ''
```

**Contexte** : Dans le bouton "Sauvegarder & Régénérer", si `generatedClip` est `undefined` (premier clip, pas encore généré), `oldScript` devient une chaîne vide. La fonction `replaceScriptInPrompt()` vérifie `if (!oldScript)` et retourne le prompt original sans modification. Résultat : fal.ai génère avec l'ANCIEN script !

### Règle CRITIQUE : Le script doit TOUJOURS être dans le video.prompt

> **Fix 5 Dec 2024** : `replaceScriptInPrompt()` doit AJOUTER le script même si le prompt original ne le contient pas

**Le problème** : Certains prompts générés par Claude ne contiennent PAS le pattern `speaks in ... accent: [script]`. Quand l'utilisateur clique "Sauvegarder & Régénérer", le script n'est jamais injecté car les méthodes 1 et 2 échouent et l'ancien fallback n'ajoutait rien.

```typescript
// ❌ ANCIEN FALLBACK - N'ajoutait pas le script si oldScript === newScript
if (oldScript === newScript) return originalPrompt  // Short-circuit, prompt inchangé !

// ✅ NOUVEAU COMPORTEMENT - Vérifie si le prompt contient déjà le script
if (originalPrompt.includes(newScript)) {
  return originalPrompt  // OK, le script est déjà là
}
// Sinon, AJOUTER le script avec le format standard
```

**Format d'injection** : Si aucun pattern accent trouvé, le script est ajouté avant les NEGATIVES :
```
Speech/Dialogue: speaks in standard metropolitan French accent, Parisian pronunciation, clear and neutral: "[nouveau script]"
```

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

## 10. Transcription Intelligente (Whisper + Claude)

### Le problème du "gibberish"

Les vidéos générées par Veo ont souvent des **sons parasites** au début et à la fin :
- Onomatopées : "hmm", "euh", "ah", "mhm"
- Bruits de bouche/respiration
- Mots répétés sans sens

Whisper transcrit TOUT, même ces sons. Si on utilise les timestamps bruts, le trim coupe mal.

### Solution : Double analyse

```
1. Whisper (fal-ai/whisper)
   └── Transcrit l'audio COMPLET avec timestamps mot par mot
   └── Output: { text, chunks: [{timestamp: [start, end], text}] }
                    │
2. Claude (analyzeSpeechBoundaries)
   └── Compare transcription vs script ORIGINAL
   └── Identifie où le "vrai" script commence (ignore le gibberish)
   └── Calcule words_per_second sur le SCRIPT, pas la transcription
   └── Output: { speech_start, speech_end, confidence, suggested_speed }
```

### Règles CRITIQUES

| Règle | Pourquoi |
|-------|----------|
| **Gibberish = tout ce qui n'est pas dans le script** | Mots transcrits mais pas attendus |
| **speech_start = début du 1er mot du script** | Pas le 1er mot transcrit |
| **speech_end = fin du dernier mot du script** | Pas le dernier mot transcrit |
| **words_per_second sur le script** | Le débit compte les mots VOULUS, pas le gibberish |
| **Padding de 0.15s** | Ajouter un peu de marge pour ne pas couper serré |
| **Confidence : high/medium/low** | Indique la fiabilité de l'analyse |

### Exemple concret

```
Script original : "Découvre ce produit incroyable"

Whisper transcrit :
  [0.1s] "hmm"
  [0.4s] "euh"
  [0.7s] "Découvre"      ← DÉBUT RÉEL
  [1.0s] "ce"
  [1.2s] "produit"
  [1.5s] "incroyable"    ← FIN RÉELLE
  [1.8s] "voilà"

Claude analyse :
  speech_start = 0.55s (0.7s - 0.15s padding)
  speech_end = 1.65s (1.5s + 0.15s padding)
  → Ignore "hmm", "euh" et "voilà"
```

### Fallback si Claude échoue

Si l'analyse Claude échoue, on utilise les timestamps Whisper bruts avec `confidence = 'low'`.

---

## 11. Structure des Beats

### Mapping Order → Beat

| Order | Beat | Description | Rôle dans la vidéo |
|-------|------|-------------|-------------------|
| 1 | `hook` | Accroche | Capte l'attention dans les 3 premières secondes |
| 2 | `problem` | Problème | Présente le pain point de l'audience |
| 3 | `solution` | Solution | Présente le produit/solution |
| 4 | `proof` | Preuve | Social proof, résultats, témoignage |
| 5 | `cta` | Call-to-Action | Incitation à l'action finale |

> **Note** : Le beat `agitation` peut remplacer `problem` selon le preset choisi.

### Types de beat dans le code

```typescript
// types/index.ts
export type ScriptBeat = "hook" | "problem" | "agitation" | "solution" | "proof" | "cta";
```

### Labels UI

```typescript
// step6-generate.tsx
const BEAT_LABELS: Record<string, string> = {
  hook: 'HOOK',
  problem: 'PROBLÈME',
  agitation: 'AGITATION',
  solution: 'SOLUTION',
  proof: 'PREUVE',
  cta: 'CTA',
}
```

---

## 12. Race Conditions et Patterns

### Functional Updater Pattern

> **Commits `2df633e`, `ec11682`** : Pour éviter les race conditions lors de mises à jour
> concurrentes de state React, toujours utiliser le **functional updater**.

```typescript
// ❌ INTERDIT - Race condition possible
setAdjustments({
  ...adjustments,
  [clipId]: newValue
})

// ✅ CORRECT - Functional updater
setAdjustments(prev => ({
  ...prev,
  [clipId]: newValue
}))
```

### Lock sur les déductions de crédits

> **Commit `f0852cd`** : La fonction SQL `deduct_credits` utilise `FOR UPDATE` pour
> verrouiller la ligne pendant la transaction.

```sql
-- billing.sql
SELECT balance INTO v_current_balance
FROM user_credits
WHERE user_id = p_user_id
FOR UPDATE;  -- CRITIQUE: empêche les déductions concurrentes
```

### Génération en cours

Quand une génération est en cours pour un clip, bloquer les actions suivantes :
- Régénération du même clip
- Modification des ajustements (trim/speed)
- Assemblage

```typescript
// Le state isClipRegenerating() doit être vérifié avant toute action
if (isClipRegenerating(clipId)) {
  return // Bloquer l'action
}
```

### Index uniqueBeats vs Index generatedClips

> **Fix 5 déc 2024** : Le bug "régénère le mauvais clip" était causé par une confusion d'index.

**Le problème** : Dans le rendu de l'UI, on itère sur `uniqueBeats` (trié par order). Quand on régénère un clip, on passait `index` (index dans uniqueBeats) mais on l'utilisait pour indexer `generatedClips` (qui a potentiellement un ordre différent).

```typescript
// ❌ BUG - index est l'index dans uniqueBeats, pas dans generatedClips !
{uniqueBeats.map((clip, index) => {
  // ...
  askRegenerate(index, 'video', clipWithUpdatedScript)
})}

// Plus tard dans handleConfirmRegenerate:
const updatedClips = generatedClips.map((c, idx) => {
  if (idx === clipIndex) {  // ← MAUVAIS clip sélectionné !
    return { ...c, is_selected: false }
  }
  return c
})

// ✅ CORRECT - Utiliser l'ID du clip pour l'identifier
const updatedClips = generatedClips.map((c) => {
  if (c.id === oldClipId) {  // ← Identifie par ID unique
    return { ...c, is_selected: false }
  }
  return c
})
```

**Règle** : Ne JAMAIS utiliser un index de boucle pour identifier un clip dans un autre tableau. Toujours utiliser `clip.id` ou `clip.order` pour identifier les clips de manière fiable.

---

## 13. Patterns "Fix puis Revert" - Leçons apprises

> Ces patterns documentent des tentatives d'optimisation qui ont échoué.
> **À consulter AVANT de réimplémenter des idées similaires.**

### Ne traiter que les clips "avec ajustements réels"

| Commit | Action | Problème |
|--------|--------|----------|
| `825a268` | Fix : ne pré-traiter que les clips avec ajustements réels (évite timeout) | Certains clips non traités avaient des timestamps cassés |
| `f22023c` | **Revert** | Incohérences dans l'assemblage |

**Leçon** : TOUS les clips doivent être normalisés via Transloadit, même sans trim/speed explicite. La normalisation des timestamps (`setpts=PTS-STARTPTS`) est nécessaire pour tous.

---

### Flag igndts pour "ignorer les timestamps"

| Commit | Action | Problème |
|--------|--------|----------|
| (non trouvé) | Ajout `fflags: '+igndts'` | Coupe le début des vidéos |
| `94daeca` | **Revert** : restaurer params originaux sans igndts | |

**Leçon** : `igndts` (ignore DTS) peut causer des problèmes de timing. Utiliser `+genpts+discardcorrupt` à la place.

---

### Resize dans concat

| Commit | Action | Problème |
|--------|--------|----------|
| `5318463` | Resize 9:16 dans process-clip | |
| `616ee96` | Revert : retour process-clip simple | |
| `08f7d82` | Resize 9:16 APRÈS concat (séparé) | ✅ Solution finale |

**Leçon** : Le resize doit être une étape SÉPARÉE après le concat, pas dans la même étape.

---

### fal.ai compose pour concat

| Commit | Action | Problème |
|--------|--------|----------|
| (avant) | Utilisation de fal.ai ffmpeg-api/compose pour concat | Timestamps cassés, pas de trim |
| `04c0851` | **Fix** : Transloadit concat au lieu de fal.ai | ✅ Solution finale |

**Leçon** : fal.ai compose ne gère pas bien les timestamps des vidéos IA. Transloadit avec ré-encodage forcé est plus fiable.

---

## 🔄 Historique des comportements critiques

| Date | Commit | Comportement ajouté |
|------|--------|---------------------|
| 5 Dec 2024 | - | Fix replaceScriptInPrompt : AJOUTE le script même si le prompt original ne le contient pas (pas de pattern `speaks in...`) |
| 5 Dec 2024 | - | Fix oldScript fallback : `generatedClip?.script?.text || clip.script?.text` évite que le prompt reste inchangé quand generatedClip est undefined |
| 5 Dec 2024 | - | Fix régénération mauvais clip : utiliser oldClipId au lieu de clipIndex pour identifier le clip (index uniqueBeats ≠ index generatedClips) |
| Dec 2024 | - | Fix "Sauvegarder & Régénérer" : passer le clip avec script mis à jour directement à askRegenerate pour éviter timing issues |
| Dec 2024 | - | Preview affiche automatiquement le nouveau clip après régénération (reset displayedVersionIndex + tri is_selected) |
| Dec 2024 | - | Fix allCompleted : ne vérifier que les clips avec vidéo (pas les squelettes pending) |
| Dec 2024 | - | Policy RLS actors : admin peut modifier acteurs preset |
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
| Nov 2024 | `2df633e` | Functional updater pattern |

---

## 13. Génération d'Images d'Acteurs (Higgsfield Soul)

### Contexte

Les images "soul" sont les photos de référence des acteurs utilisées pour :
- Afficher dans le sélecteur d'acteurs (step 1)
- Générer les first frames avec consistance de personnage (via NanoBanana Pro)

### API Higgsfield Soul

```
Endpoint: https://platform.higgsfield.ai/higgsfield-ai/soul/standard
Auth: Key {API_KEY_ID}:{API_KEY_SECRET}
Doc: https://docs.higgsfield.ai/guides/images
```

### Style de prompt CRITIQUE

> **Le style des images doit être "selfie UGC authentique"**, pas un portrait studio.

**Caractéristiques du bon style :**
- Pose selfie naturelle (bras tendu visible)
- Décor réel (chambre, salon, cuisine) avec éléments de vie
- Lumière naturelle (golden hour, lumière fenêtre)
- Vêtements casual du quotidien
- Expression naturelle, regard vers la caméra
- Maquillage léger ou naturel

**Exemple de bon prompt :**
```
Young woman taking a selfie in her bedroom, blonde hair with hair clip, 
natural golden hour lighting from window, wearing casual black tank top, 
sitting on bed with white sheets, cozy bedroom background with mirror and plants, 
arm extended holding phone, looking at camera with confident subtle smile, 
authentic UGC TikTok style, photorealistic, natural skin
```

**Ce qu'il NE faut PAS faire :**
```
❌ "Professional photograph... clean neutral background, studio lighting"
❌ "8k quality, highly detailed" (trop "stock photo")
❌ Pas de contexte/décor
```

### Paramètres Higgsfield

| Paramètre | Valeur | Note |
|-----------|--------|------|
| **Preset** | `0.5 selfie` | TOUJOURS utiliser ce preset |
| **Aspect ratio** | `3:4` ou `9:16` | Portrait vertical |
| **Resolution** | `720p` | Suffisant pour la qualité |

### Templates par filming_type (First Frames & Intention Media)

Les images d'intention et first frames utilisent des templates différents selon le `filming_type` du preset :

| filming_type | Description | Prompt clé |
|--------------|-------------|------------|
| `handheld` | Selfie cadrage naturel | "close-up selfie angle, looking directly at camera" (sans montrer le téléphone) |
| `filmed_by_other` | Filmé par quelqu'un | "as if filmed by someone else, half-body or full-body" |
| `setup_phone` | Téléphone sur trépied | "both hands free (as if phone is on tripod)" |

**Fichiers concernés :**
- `app/api/generate/intention-media/route.ts` - Génération des images d'intention
- `app/(admin)/admin/actors/page.tsx` - Preview des prompts dans l'admin

### Référence visuelle

L'image de Luna est la référence du style attendu :
```
https://xresijptcptdilwecklf.supabase.co/storage/v1/object/public/actors/1764348622762-LUNA.jpg
```

Caractéristiques :
- Selfie dans une chambre (lit, miroir, plantes)
- Lumière golden hour naturelle
- Débardeur noir casual
- Cheveux longs bruns avec pince
- Expression confiante et naturelle

---

## 14. RLS et APIs Admin (Service Role)

### Le problème des acteurs preset

Les acteurs "preset" (Luna, Emma, Marco...) ont `user_id = null` car ils n'appartiennent à aucun utilisateur spécifique - ils sont partagés.

L'ancienne politique RLS sur `actors` pour UPDATE était :
```sql
user_id = auth.uid()
```

Problème : `null = auth.uid()` est **toujours false** en SQL → les updates étaient silencieusement ignorés !

### Solution 1 : Policy RLS avec exception admin (recommandé pour l'admin UI)

> **Fix dec 2024** : La policy RLS a été modifiée pour permettre aux admins de modifier les acteurs preset directement depuis l'interface admin, sans avoir besoin du service role.

```sql
-- Nouvelle policy (remplace l'ancienne)
CREATE POLICY "Users can update their own actors or admins can update preset actors" ON actors
FOR UPDATE
USING (
  user_id = auth.uid() 
  OR (
    is_custom = false 
    AND (SELECT email FROM auth.users WHERE id = auth.uid()) = 'alexis.albo.lapro@gmail.com'
  )
);
```

Cette policy autorise :
1. **Utilisateurs normaux** : peuvent modifier leurs propres acteurs (`user_id = auth.uid()`)
2. **Admin** : peut modifier les acteurs preset (`is_custom = false`) identifié par son email

### Solution 2 : Service Role pour les opérations API

Pour les opérations côté serveur (APIs), utiliser le service role qui bypass les RLS :

```typescript
// ❌ PROBLÈME - Les updates sur acteurs preset échouent silencieusement
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()  // Utilise ANON_KEY → soumis aux RLS

// ✅ SOLUTION - Bypass RLS avec service role
import { createServiceClient } from '@/lib/supabase/server'
const supabase = createServiceClient()  // Utilise SERVICE_ROLE_KEY → bypass RLS (non-async)
```

### Quand utiliser quoi ?

| Cas | Solution |
|-----|----------|
| Admin UI (page /admin/actors) | Policy RLS avec exception admin ✅ |
| API génération intention_media | `createServiceClient()` |
| Déduction de crédits | `createServiceClient()` |
| Opérations utilisateur standard | `createClient()` |

### Fichiers concernés

- `app/api/generate/intention-media/route.ts` - Génération images intention (service role)
- `app/(admin)/admin/actors/page.tsx` - Gestion acteurs (bénéficie de la policy RLS admin)

---

## 15. Règles de Modifications UI (Tous Composants)

### Contexte

Ce projet utilise React avec Next.js. Les composants mélangent souvent logique métier et UI. Pour modifier l'apparence **sans casser la logique**, respecter ces règles.

> **Note** : Les composants `step5-plan.tsx` (~1 400 lignes) et `step6-generate.tsx` (~2 900 lignes) sont particulièrement sensibles car très longs avec beaucoup d'états interdépendants.

### ✅ Modifications SAFE (zéro risque)

| Élément | Exemple | Applicable à |
|---------|---------|--------------|
| **Classes Tailwind** | `className="p-4"` → `className="p-6"` | Tous composants |
| **Constantes de style** | `BEAT_COLORS`, `BEAT_LABELS` | Fichiers avec constantes UI |
| **Tailles / paddings / margins** | `w-32` → `w-48`, `gap-4` → `gap-6` | Tous composants |
| **Icônes Lucide** | `<Sparkles />` → `<Wand2 />` | Tous composants |
| **Textes / labels** | `"Générer"` → `"Lancer"` | Tous composants |
| **Animations CSS** | Ajouter `animate-pulse`, modifier keyframes | Tous composants |
| **Layout grid/flex** | `grid-cols-2` → `flex flex-col` | Tous composants |
| **Composants UI isolés** | `LoadingAnimation`, `AssemblyModal` | Composants sans logique métier |
| **Couleurs / thèmes** | `bg-violet-500` → `bg-blue-600` | Tous composants |

### ⚠️ Modifications INTERDITES (casse la logique)

| Élément | Pourquoi | Impact |
|---------|----------|--------|
| **`onClick={...}`** | Déclenche actions métier | Boutons ne fonctionnent plus |
| **`disabled={...}`** | Conditions métier (loading, crédits...) | UX cassée |
| **`value={...}` / `onChange={...}`** | Binding de données | Inputs/sliders cassés |
| **`{condition && ...}`** | Affichage conditionnel | Éléments manquants ou en trop |
| **`{array.map(...)}`** | Itération sur données | Liste cassée |
| **`key={...}`** | React reconciliation | Bugs de rendering |
| **`ref={...}`** | Focus, scroll, animations | Comportements JS cassés |
| **useEffect / useCallback** | Logique réactive | Effets de bord cassés |
| **Ordre des conditions** | `loading → error → content` | Affichage incohérent |

### 🔧 Règles pratiques

**1. Modifier par blocs visuels**
```tsx
{/* Header section */}  // ← Repérer les commentaires
<div className="flex items-center">
  // Modifier UNIQUEMENT les className ici
</div>
```

**2. Ne JAMAIS supprimer d'attributs fonctionnels**
```tsx
// ❌ INTERDIT
<Button onClick={handleSubmit}>  →  <Button>

// ✅ OK
<Button onClick={handleSubmit} className="h-11">  →  
<Button onClick={handleSubmit} className="h-14 rounded-full">
```

**3. Garder les conditions d'affichage intactes**
```tsx
// ❌ INTERDIT - Retirer la condition
{loading && <Spinner />}  →  <Spinner />

// ✅ OK - Modifier le style à l'intérieur
{loading && <Spinner className="w-8" />}  →  
{loading && <Spinner className="w-12 text-blue-500" />}
```

**4. Tester après chaque modification**
- [ ] Le composant s'affiche correctement
- [ ] Les états de loading fonctionnent
- [ ] Les erreurs s'affichent
- [ ] Les boutons/actions fonctionnent
- [ ] La navigation fonctionne

### Exemples concrets

```tsx
// ✅ Changer le style d'une card
<Card className="rounded-2xl border-border">
// →
<Card className="rounded-3xl border-2 border-violet-500/20 shadow-xl">

// ✅ Changer le layout d'une liste (GARDER le map)
<div className="space-y-4">
  {items.map((item) => <Item key={item.id} />)}
</div>
// →
<div className="grid grid-cols-2 gap-6">
  {items.map((item) => <Item key={item.id} />)}  // map intact !
</div>

// ✅ Changer une icône
<Sparkles className="w-4 h-4 mr-2" />
// →
<Wand2 className="w-5 h-5 mr-2" />

// ❌ INTERDIT - Toucher au onClick
<Button onClick={() => generateVideo(clipId)}>
// Ne pas modifier cette ligne !
```

### Composants particulièrement sensibles

| Fichier | Lignes | Risque | Raison |
|---------|--------|--------|--------|
| `step5-plan.tsx` | ~1 400 | **Élevé** | 10+ useEffects interdépendants |
| `step6-generate.tsx` | ~2 900 | **Très élevé** | 15+ useEffects, logique complexe |
| `use-video-generation.ts` | ~900 | **Élevé** | Logique de génération |

Pour ces fichiers, privilégier des modifications très ciblées et tester systématiquement.

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
