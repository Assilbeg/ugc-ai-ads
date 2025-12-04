# 📚 DOCS DES APIS - Pipeline Vidéo UGC AI

Ce document centralise toutes les documentations officielles des APIs utilisées dans le pipeline vidéo (trim, compose, assembly).

---

## 1️⃣ Transloadit (Trim + Assembly)

Utilisé pour : **Processing des clips (trim/speed)** et **Concaténation finale**

### Documentation Générale
- **Page d'accueil docs** : https://transloadit.com/docs/
- **Référence API REST** : https://transloadit.com/docs/api/
- **Liste des Robots** : https://transloadit.com/docs/robots/

### Robots Vidéo (utilisés dans le projet)

| Robot | Description | Lien Documentation |
|-------|-------------|-------------------|
| `/video/encode` | Transcode, resize, watermark, **trim** vidéos | https://transloadit.com/docs/robots/video-encode/ |
| `/video/concat` | Concaténer plusieurs vidéos en une seule | https://transloadit.com/docs/robots/video-concat/ |
| `/video/thumbs` | Extraire des thumbnails | https://transloadit.com/docs/robots/video-thumbs/ |
| `/http/import` | Importer un fichier depuis une URL | https://transloadit.com/docs/robots/http-import/ |

### Paramètres FFmpeg Clés
- **Presets vidéo** : https://transloadit.com/docs/presets/video/
- **Stack FFmpeg** : `ffmpeg_stack: 'v6.0.0'` (version recommandée)
- **Paramètres custom** : Utiliser `preset: 'empty'` + `ffmpeg: {...}` pour FFmpeg brut

### SDK Node.js
- **npm** : `transloadit` 
- **GitHub** : https://github.com/transloadit/node-sdk
- **Doc SDK** : https://transloadit.com/docs/sdks/node-sdk/

---

## 2️⃣ fal.ai (Génération IA + Mix Audio)

Utilisé pour : **Génération vidéo (Veo 3.1)**, **Voice cloning**, **Ambiance audio**, **FFmpeg compose**

### Documentation Générale
- **Docs fal.ai** : https://docs.fal.ai/
- **Authentification** : https://docs.fal.ai/platform-apis/authentication
- **Model Endpoints** : https://docs.fal.ai/model-endpoints
- **Clients (JS/Python)** : https://docs.fal.ai/clients

### Modèles Utilisés

| Modèle | Endpoint | Lien Playground/API |
|--------|----------|---------------------|
| **Veo 3.1** (vidéo) | `fal-ai/veo3.1/image-to-video` | https://fal.ai/models/fal-ai/veo3-1 |
| **Nano Banana Pro** (first frame) | `fal-ai/nano-banana-pro/edit` | https://fal.ai/models/fal-ai/nano-banana-pro |
| **Chatterbox HD** (voice clone) | `resemble-ai/chatterboxhd/speech-to-speech` | https://fal.ai/models/resemble-ai/chatterboxhd/speech-to-speech |
| **ElevenLabs SFX v2** (ambiance) | `fal-ai/elevenlabs/sound-effects/v2` | https://fal.ai/models/fal-ai/elevenlabs/sound-effects/v2 |
| **FFmpeg API Compose** (mix audio) | `fal-ai/ffmpeg-api/compose` | ⚠️ **Pas de doc publique trouvée** |

### ⚠️ Note sur FFmpeg API Compose
L'endpoint `fal-ai/ffmpeg-api/compose` utilisé dans `/api/generate/mix-video` **n'a pas de documentation publique** sur fal.ai. Le modèle semble avoir été retiré ou renommé.

**Alternative recommandée** : Utiliser Transloadit `/video/merge` ou les filtres FFmpeg via `/video/encode` pour le mixage audio.

### API Reference (Schema OpenAPI)
- **Chatterbox HD** : https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=resemble-ai/chatterboxhd/speech-to-speech
- **ElevenLabs SFX** : https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=fal-ai/elevenlabs/sound-effects/v2

---

## 3️⃣ Cloudinary (Stockage + Transformations)

Utilisé pour : **Stockage des assets** (potentiel pour trim à la volée)

### Documentation Générale
- **Doc principale** : https://cloudinary.com/documentation
- **API Programmable Media** : https://cloudinary.com/documentation/programmable_media_overview

### Transformations Vidéo
- **Vue d'ensemble** : https://cloudinary.com/documentation/video_manipulation_and_delivery
- **Trim & Concat** : https://cloudinary.com/documentation/video_trimming_and_concatenating
- **Overlays Audio** : https://cloudinary.com/documentation/audio_transformations

### Paramètres de Trim (si on switch vers Cloudinary)
```
so_X   → Start offset (secondes)
eo_Y   → End offset (secondes)
e_accelerate:Z → Vitesse (ex: e_accelerate:150 = 1.5x)
```

### SDK Node.js
- **npm** : `cloudinary`
- **Doc SDK** : https://cloudinary.com/documentation/node_integration

---

## 4️⃣ FFmpeg (Référence générale)

Utilisé via : **Transloadit** et **fal.ai**

### Documentation Officielle
- **Page principale** : https://ffmpeg.org/documentation.html
- **Guide ffmpeg** : https://ffmpeg.org/ffmpeg.html
- **Filtres** : https://ffmpeg.org/ffmpeg-filters.html
- **Wiki communautaire** : https://trac.ffmpeg.org/wiki

### Filtres Utilisés dans le Projet

| Filtre | Usage | Exemple |
|--------|-------|---------|
| `trim` | Couper début/fin vidéo | `trim=start=2:end=8` |
| `atrim` | Couper début/fin audio | `atrim=start=2:end=8` |
| `setpts` | Modifier vitesse vidéo | `setpts=0.5*PTS` (2x speed) |
| `atempo` | Modifier vitesse audio | `atempo=2.0` |
| `setpts=PTS-STARTPTS` | Reset timestamps à 0 | Critique pour concat |
| `volume` | Ajuster volume audio | `volume=0.5` |

---

## 5️⃣ ElevenLabs (Voix + SFX)

Accédé via **fal.ai** (pas directement)

### Documentation Officielle ElevenLabs
- **API Reference** : https://elevenlabs.io/docs/api-reference
- **Sound Effects** : https://elevenlabs.io/docs/api-reference/sound-generation

### Accès via fal.ai
- **Endpoint** : `fal-ai/elevenlabs/sound-effects/v2`
- **Playground** : https://fal.ai/models/fal-ai/elevenlabs/sound-effects/v2

---

## 📊 Résumé de l'Architecture Actuelle

```
┌─────────────────────────────────────────────────────────────────┐
│                     GÉNÉRATION (fal.ai)                         │
├─────────────────────────────────────────────────────────────────┤
│ 1. First Frame     → fal-ai/nano-banana-pro/edit               │
│ 2. Video           → fal-ai/veo3.1/image-to-video              │
│ 3. Voice Clone     → resemble-ai/chatterboxhd/speech-to-speech │
│ 4. Ambient SFX     → fal-ai/elevenlabs/sound-effects/v2        │
│ 5. Mix Audio       → fal-ai/ffmpeg-api/compose ⚠️ SANS DOC     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PROCESSING (Transloadit)                     │
├─────────────────────────────────────────────────────────────────┤
│ 6. Trim/Speed      → /video/encode + FFmpeg filters            │
│ 7. Concat          → /video/concat                              │
│ 8. Thumbnail       → /video/thumbs                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     STOCKAGE (Cloudinary)                       │
├─────────────────────────────────────────────────────────────────┤
│ Assets uploadés mais transformations non utilisées              │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Points d'Attention

1. **`fal-ai/ffmpeg-api/compose`** - Aucune documentation publique trouvée. L'endpoint existe mais pas de référence officielle.

2. **Volumes audio non appliqués** - Le code passe `voiceVolume` et `ambientVolume` mais l'API fal.ai compose ne semble pas les utiliser.

3. **Double processing** - On utilise fal.ai pour le mix PUIS Transloadit pour le trim. Idéalement tout faire dans un seul service.

4. **Cloudinary sous-utilisé** - Les credentials existent mais les transformations vidéo ne sont pas utilisées (pourrait remplacer Transloadit pour le trim simple).

---

*Document généré le 3 décembre 2025*

