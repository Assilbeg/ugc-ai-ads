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
8. [Versioning des Clips](#8-versioning-des-clips)
9. [Assemblage Final](#9-assemblage-final)
10. [Système de Crédits](#10-système-de-crédits)

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
   - `speed` = basé sur `words_per_second`

2. **User-ajustements** (slider dans l'UI)
   - L'utilisateur peut modifier trim et vitesse
   - Priorité sur auto si plus récent (`updated_at`)

### UI

- **Slider trim** : Barre avec handles début/fin
- **Boutons vitesse** : 1x, 1.1x, 1.2x
- **Bouton reset** : Revient aux valeurs auto

### Application

Les ajustements sont appliqués via Transloadit au moment de :
- La preview individuelle
- L'assemblage final

---

## 8. Versioning des Clips

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

## 9. Assemblage Final

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

## 10. Système de Crédits

### Principe

- 1 crédit = 0.01€
- Chaque génération coûte des crédits
- Vérification AVANT génération

### Obtention de crédits

1. **Crédits de bienvenue** : 100 crédits (1€) à l'inscription
2. **Early Bird** : Offre limitée 24h après inscription
3. **Abonnements** : Starter, Pro, Business (crédits mensuels)
4. **Paiement custom** : Admin peut attribuer des crédits

### Affichage

- Header : Badge avec solde actuel
- Refresh automatique après génération
- Alerte visuelle si solde faible/négatif

### Admin

Les admins (vérifiés par email dans `lib/admin.ts`) :
- Crédits illimités (affichage ∞)
- Pas de déduction
- Accès au dashboard admin

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
| Crédits | `lib/credits.ts`, `app/api/credits/route.ts` |
| Presets/Intentions | `lib/presets.ts`, `app/(admin)/admin/presets/page.tsx` (filming_type), `components/steps/step3-preset.tsx` (badge filming_type) |

---

*Dernière mise à jour : 5 décembre 2024*

