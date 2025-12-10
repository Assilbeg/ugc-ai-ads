# 📦 Features - Documentation Fonctionnelle

> Description des fonctionnalités principales et de leur comportement attendu.

---

## Table des matières

1. [Flow de Création de Campagne](#1-flow-de-création-de-campagne)
2. [Génération de Plan (Claude)](#2-génération-de-plan-claude)
3. [Génération de First Frames](#3-génération-de-first-frames)
4. [Génération de Vidéos (Veo 3.1)](#4-génération-de-vidéos-veo-31)
5. [Voice Cloning (ChatterboxHD)](#5-voice-cloning-chatterboxhd)
6. [Audio Ambiant (ElevenLabs)](#6-audio-ambiant-elevenlabs)
7. [Ajustements Trim/Speed](#7-ajustements-trimspeed)
8. [Édition du Prompt Vidéo (Step 6)](#8-édition-du-prompt-vidéo-step-6)
9. [Versioning des Clips](#9-versioning-des-clips)
10. [Assemblage Final](#10-assemblage-final)
11. [Système de Crédits](#11-système-de-crédits)

---

## 1. Flow de Création de Campagne

### Les 6 étapes

| Step | Nom | Description | Persistance |
|------|-----|-------------|-------------|
| 1 | **Acteur** | Sélection de l'acteur IA parmi les presets ou custom | `actor_id` en state |
| 2 | **Produit** | Upload image produit (optionnel) | `product` en state |
| 3 | **Preset** | Choix du template (intention : Testimonial, Problem-Solution...) | `preset_id` en state |
| 4 | **Brief** | Infos produit, pain point, audience cible | `brief` en state, campagne créée en BDD |
| 5 | **Plan** | Génération du plan par Claude + First Frames | Clips sauvés en BDD |
| 6 | **Generate** | Génération vidéos + assemblage | Vidéos, audio, transcription en BDD |

### Navigation

- **Retour en arrière** : Possible jusqu'à step 5, préserve les données
- **Step 4 → Step 5** : Crée la campagne en BDD si elle n'existe pas
- **Step 5 avec clips existants** : NE PAS régénérer le plan (commit `2deb19b`, `1c7450b`)

### URL de campagne

```
/new/[campaign_id]?step=N
```

L'ID de campagne est dans l'URL dès step 4 pour permettre le refresh sans perte de données.

---

## 2. Génération de Plan (Claude)

### Endpoint

```
POST /api/generate/plan
```

### Ce que Claude génère

Pour chaque clip du preset (structure définie dans `lib/presets.ts`) :

| Champ | Description |
|-------|-------------|
| `script.text` | Le texte que l'acteur va dire |
| `script.word_count` | Nombre de mots |
| `first_frame.prompt` | Prompt pour la première frame |
| `first_frame.expression` | Expression faciale |
| `first_frame.gesture` | Geste de la main |
| `first_frame.location` | Lieu de la scène |
| `video.prompt` | Prompt pour Veo (description du mouvement) |
| `ambient_prompt` | Prompt pour le son d'ambiance |

### Prompts système

Fichier : `lib/api/claude.ts`

- Prompts en français pour scripts français
- Structure dictée par le preset (hook, problem, solution, proof, cta)
- Durées suggérées par clip dans le preset
- Filming type (`filming_type` sur le preset) combiné avec `camera_style` pour les mots-clés UGC :
  - handheld : selfie bras tendu (avant-bras possiblement visible)
  - filmed_by_other : quelqu’un filme, cadrage plus large, acteur libre de marcher
  - setup_phone : téléphone posé/trépied, cadrage stable, mains libres
  - camera_style ajuste le niveau de mouvement (handheld_shaky / handheld_subtle / stable)

### Régénération de clip individuel

```
POST /api/generate/regenerate-clip
```

Permet de régénérer uniquement le script d'un clip avec du feedback utilisateur.

---

## 3. Génération de First Frames

### Endpoint

```
POST /api/generate/first-frame
```

### Modèle

**NanoBanana Pro Edit** (`fal-ai/nano-banana-pro/edit`)

### Inputs

| Param | Description |
|-------|-------------|
| `soulImageUrl` | Image de référence de l'acteur (obligatoire) |
| `prompt` | Description de la pose/expression |
| `intentionImageUrl` | Image pré-générée pour cette intention (optionnel, cache) |
| `previousFrameUrl` | Frame précédente pour continuité (optionnel) |

### Cache par intention

Les acteurs peuvent avoir des images pré-générées par preset (`intention_media`).
Si disponible, utilisée comme base pour la first frame → meilleure cohérence.

### Templates par filming_type

Les prompts de first frame s'adaptent au `filming_type` du preset :

| filming_type | Style de prompt | Cadrage |
|--------------|-----------------|---------|
| `handheld` | 🤳 Selfie avec bras tendu visible | Portrait rapproché |
| `filmed_by_other` | 🎬 Filmé par quelqu'un d'autre | Demi-corps / corps entier |
| `setup_phone` | 📱 Téléphone sur trépied, mains libres | Demi-corps avec bureau |

> Fichiers : `app/api/generate/intention-media/route.ts`, `app/(admin)/admin/actors/page.tsx`

### Coût

~25 crédits par first frame

---

## 4. Génération de Vidéos (Veo 3.1)

### Endpoint

```
POST /api/generate/video
```

### Modèle

**Google Veo 3.1** via fal.ai (`fal-ai/veo3.1/image-to-video`)

### Qualités disponibles

| Qualité | Coût/seconde | Temps de génération | Usage |
|---------|--------------|---------------------|-------|
| **Fast** | 25 crédits | ~30-60s | Par défaut, recommandé |
| **Standard** | 60 crédits | ~2-3min | Meilleure qualité |

### Durées disponibles

- 4 secondes
- 6 secondes (défaut)
- 8 secondes (max)

### Ce que Veo génère

- Vidéo avec mouvement réaliste basé sur la first frame
- **Audio lip-sync inclus** : L'acteur "parle" le prompt
- Format portrait 9:16

### Important

L'audio généré par Veo est utilisé comme **source** pour le voice cloning.
On ne génère PAS de TTS séparé.

---

## 5. Voice Cloning (ChatterboxHD)

### Endpoint

```
POST /api/generate/voice
```

### Modèle

**ChatterboxHD Speech-to-Speech** (`resemble-ai/chatterboxhd/speech-to-speech`)

### Principe

```
Audio de la vidéo Veo (source)
          +
Échantillon de voix de l'acteur (target)
          ↓
Audio avec la voix de l'acteur
    (synchronisé avec les lèvres)
```

### Pourquoi Speech-to-Speech ?

- Veo génère de l'audio lip-sync
- On veut garder la synchronisation labiale
- On change juste le timbre de voix

### Coût

~20 crédits par conversion

---

## 6. Audio Ambiant (ElevenLabs)

### Endpoint

```
POST /api/generate/ambient
```

### Modèle

**ElevenLabs Sound Effects v2** (`fal-ai/elevenlabs/sound-effects/v2`)

### Usage

- Généré à partir du `ambient_prompt` du plan
- Durée = durée de la vidéo (pas du speech)
- Mixé à ~20% du volume

### Exemples de prompts

- "Cozy cafe ambiance, soft chatter, coffee machine"
- "Modern office background, keyboard typing, subtle HVAC"
- "Outdoor park, birds chirping, gentle wind"

### Coût

~15 crédits par génération

---

## 7. Ajustements Trim/Speed

### Fonctionnement

1. **Auto-ajustements** (après transcription Whisper)
   - `trim_start` = `speech_start` (début de la parole)
   - `trim_end` = `speech_end` (fin de la parole)
   - `speed` = basé sur `syllables_per_second` (< 5 s/s → 1.2x, 5-6 → 1.1x, ≥ 6 → 1.0x)

2. **User-ajustements** (slider dans l'UI)
   - L'utilisateur peut modifier trim et vitesse
   - Priorité sur auto si plus récent (`updated_at`)

### UI

- **Slider trim** : Barre avec handles début/fin
- **Boutons vitesse** : 1x, 1.1x, 1.2x
- **Bouton reset** : Revient aux valeurs auto
- **Indicateur de débit** : Pastille dynamique syllabes/seconde (voir section 7.1)

### Application

Les ajustements sont appliqués via Transloadit au moment de :
- La preview individuelle
- L'assemblage final

---

## 7.1 Indicateur de Débit (Syllabes/Seconde)

### Concept

L'indicateur de débit affiche le **rythme de parole en syllabes par seconde (s/s)** de chaque clip. Il se recalcule **en temps réel** à chaque modification du trim ou de la vitesse.

> **Pourquoi les syllabes ?** Le comptage par syllabes est plus précis que par mots pour mesurer le rythme de parole perçu, et fonctionne de manière cohérente dans toutes les langues.

### Seuils UGC TikTok Dynamique

| Débit | Icône | Label | Couleur | Signification |
|-------|-------|-------|---------|---------------|
| < 5 s/s | 🐢 | **Lent** | 🟠 Orange | Risque d'ennuyer, augmenter la vitesse |
| 5-7 s/s | ✓ | **Bon** | 🟢 Vert | Rythme idéal UGC TikTok |
| > 7 s/s | ⚡ | **Dynamique** | 🔵 Bleu | Très énergique, excellent pour TikTok |

### Calcul

```typescript
// Formule dans lib/api/video-utils.ts
syllablesPerSecond = (countSyllables(scriptText) / adjustedDuration) * speed

// où adjustedDuration = (trimEnd - trimStart) / speed
```

### Caractéristiques

- **Dynamique** : Se met à jour instantanément quand l'utilisateur modifie trim ou vitesse
- **Multilingue** : Algorithme de comptage de syllabes universel (FR, EN, ES, DE, IT, PT...)
- **Visuel** : Pastille colorée avec icône + valeur + label compréhensible en un coup d'œil

### Algorithme de comptage des syllabes

L'algorithme `countSyllables()` dans `lib/api/video-utils.ts` utilise une approche basée sur les groupes vocaliques :

1. Nettoie le texte (ponctuation, minuscules)
2. Détecte les diphtongues courantes (eau, ai, ou, ea, ee, oo, etc.) → comptées comme 1 syllabe
3. Compte les voyelles restantes
4. Applique les règles de "e" muet (français, anglais) et "-ed/-es" final (anglais)
5. Minimum 1 syllabe par mot

### Fichiers concernés

- `lib/api/video-utils.ts` - Fonctions `countSyllables()` et `calculateSyllablesPerSecond()`
- `components/steps/step6-generate.tsx` - Affichage de la pastille dans l'UI

---

## 8. Édition du Script (Step 6)

### Concept

À l'étape 6 (génération), l'utilisateur peut modifier le **script** (ce que dit l'acteur) de chaque clip et régénérer la vidéo avec ce nouveau texte. Cela permet d'ajuster le discours sans avoir à retourner à l'étape 5.

### UI

Le script est affiché pour chaque clip complété :
- **Affichage** : Le script entre guillemets, avec bouton "Modifier" au survol
- **Mode édition** : Textarea avec compteur de mots
- **Actions disponibles** :
  - "Annuler" - ferme sans sauvegarder
  - "Sauvegarder" - sauvegarde le script sans régénérer
  - "Sauvegarder & Régénérer" - sauvegarde ET lance la régénération vidéo

### Flux technique

1. L'utilisateur modifie le script dans la textarea
2. Au clic sur "Sauvegarder" ou "Sauvegarder & Régénérer" :
   - Le state local est mis à jour (`generatedClips` et `clips`)
   - Le script est sauvegardé en BDD (`campaign_clips.script.text` + `word_count`)
   - Le `video.prompt` est aussi mis à jour (le texte du script y est remplacé)
3. Si "Sauvegarder & Régénérer" :
   - La modale de confirmation de régénération s'ouvre
   - La régénération utilise le nouveau script dans `video.prompt`

### Différence avec Step 5

| Step 5 (Plan) | Step 6 (Generate) |
|---------------|-------------------|
| Édition du **script** (texte parlé) | Édition du **script** (texte parlé) |
| Édition du **prompt visuel** (first frame) | - |
| Régénère le **first frame** | Régénère la **vidéo** |
| Avant génération | Après génération (ajustement) |

### Fichiers concernés

- `components/steps/step6-generate.tsx` - UI et logique d'édition
- `hooks/use-video-generation.ts` - Régénération (utilise `clip.video.prompt`)

---

## 9. Versioning des Clips

### Concept

Quand on régénère un clip, l'ancien n'est pas supprimé :
- Nouvelle version créée avec `is_selected = true`
- Ancienne version mise à `is_selected = false`
- Archivée dans `clip_versions`

### Navigation UI

- Flèches gauche/droite pour naviguer entre versions
- Indicateur "1/3" (version actuelle / total)
- Bouton "Utiliser" pour sélectionner une version
- Badge "Sélectionnée" sur la version active

### Pour l'assemblage

Seuls les clips avec `is_selected = true` sont utilisés.
Fallback : le plus récent si aucun sélectionné.

---

## 10. Assemblage Final

### Endpoint

```
POST /api/assemble
```

### Process

1. **Validation** : Vérifie que toutes les URLs sont accessibles
2. **Import** : Télécharge chaque clip sur Transloadit
3. **Concat** : Fusionne les vidéos dans l'ordre des beats
4. **Resize** : Force le format 9:16 (1080x1920)
5. **Thumbnail** : Génère une miniature
6. **Sauvegarde** : URL finale en BDD

### Durée

L'assemblage peut prendre 30s à 2min selon le nombre de clips.

### Format final

- **Résolution** : 1080x1920 (portrait 9:16)
- **Codec** : H.264
- **Audio** : AAC 128k, 48kHz, Stéréo
- **Thumbnail** : 720x1280 JPG

---

## 11. Système de Crédits

### Principe

- 1 crédit = 0.01€ (1 centime)
- Chaque génération coûte des crédits
- Vérification AVANT génération
- **Affichage user-facing en "crédits"** (pas en euros)

### Coûts par génération (dynamiques)

Les coûts sont configurés dans la table `generation_costs` et modifiables via Admin > Billing.

| Type | ID | Coût par défaut |
|------|-----|-----------------|
| First Frame | `first_frame` | 25 crédits |
| Vidéo Veo 3.1 Fast | `video_veo31_fast` | 25 crédits/seconde |
| Vidéo Veo 3.1 Standard | `video_veo31_standard` | 60 crédits/seconde |
| Voice Conversion | `voice_chatterbox` | 20 crédits |
| Ambient Audio | `ambient_elevenlabs` | 15 crédits |

**Coût d'une vidéo complète (5 clips × 6s)** :
```
= 5 × (25 + 25×6 + 20 + 15) = 5 × 210 = 1050 crédits ≈ 10.50€
```

### Fonctions de formatage

| Fonction | Usage | Exemple |
|----------|-------|---------|
| `formatAsCredits(credits)` | Affichage user-facing | `"1 500 crédits"` |
| `formatCredits(cents)` | Affichage en euros (legacy) | `"15,00 €"` |
| `estimateVideosFromCredits(credits)` | Calcul dynamique | `10000 → ~9 vidéos` |

**Règle** : Utiliser `formatAsCredits()` pour tout affichage destiné aux utilisateurs.

### Obtention de crédits

1. **Crédits de bienvenue** : 100 crédits (1€) à l'inscription
2. **Early Bird** : Offre limitée 24h après inscription
3. **Abonnements** : Starter, Pro, Business (crédits mensuels)
4. **Paiement custom** : Admin peut attribuer des crédits

### Affichage

- Header : Badge avec solde actuel en crédits
- Refresh automatique après génération
- Alerte visuelle si solde faible/négatif
- Page Facturation : coûts par génération + historique

### Estimation du nombre de vidéos

Le nombre de vidéos estimées est calculé dynamiquement :
- Récupère les coûts depuis `generation_costs`
- Calcule le coût par vidéo complète (5 clips × coûts)
- Divise le solde par ce coût

```typescript
// Côté serveur
const videos = await estimateVideosFromCredits(balance, clipCount)

// Côté client (avec coûts pré-chargés)
const videos = estimateVideosFromCreditsSync(balance, costs, clipCount)
```

### Admin

Les admins (vérifiés par email dans `lib/admin.ts`) :
- Crédits illimités (affichage ∞)
- Pas de déduction
- Accès au dashboard admin

---

## 12. Système Produit

- Objectif : afficher un produit physique dans certains beats seulement.
- Types de tenue (`holding_type`) :
  - `holding_box` → geste `holding_product`
  - `holding_bottle` → geste `holding_product`
  - `showing_phone_screen` → geste `showing_phone`
  - `pointing_at` → geste `pointing_camera` (produit hors champ)
- Beats autorisés :
  - `solution` (order=3) : obligatoire si `has_product=true`
  - `proof` (order=4) : recommandé
  - `cta` (order=5) : optionnel
  - `hook` (order=1) et `problem` (order=2) : jamais de produit visible
- Stockage :
  - Bucket Supabase public `products`
  - Nom de fichier : `{user_id}/{uuid}.{ext}`
  - Compatibilité base64 : les anciennes `image_url` en data URL restent supportées
- Champs (`ProductConfig`) : `has_product`, `holding_type`, `name`, `description`, `image_url` (URL publique ou base64 legacy)

---

## 📁 Fichiers clés par feature

| Feature | Fichiers principaux |
|---------|---------------------|
| Flow création | `app/(dashboard)/new/[id]/page.tsx`, `components/steps/step*.tsx` |
| Plan Claude | `lib/api/claude.ts`, `app/api/generate/plan/route.ts` |
| First Frame | `app/api/generate/first-frame/route.ts` |
| Vidéo | `app/api/generate/video/route.ts`, `lib/api/falai.ts` |
| Voice | `app/api/generate/voice/route.ts` |
| Ambient | `app/api/generate/ambient/route.ts` |
| Mix | `app/api/generate/mix-video/route.ts` |
| Trim/Speed | `app/api/generate/process-clip/route.ts` |
| Assemblage | `app/api/assemble/route.ts` |
| Crédits | `lib/credits.ts`, `lib/credits-client.ts`, `app/api/credits/route.ts` |
| Presets/Intentions | `lib/presets.ts`, `app/(admin)/admin/presets/page.tsx` (filming_type), `components/steps/step3-preset.tsx` (badge filming_type) |

---

*Dernière mise à jour : 9 décembre 2024*

