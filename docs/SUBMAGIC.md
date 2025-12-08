# Intégration Submagic - Sous-titres automatiques

> Documentation de l'intégration de l'API Submagic pour ajouter des sous-titres aux vidéos assemblées.

## Vue d'ensemble

Submagic permet d'ajouter des sous-titres animés, des hooks textuels, des zooms automatiques et des B-rolls IA aux vidéos UGC après assemblage.

**Coût** : 25 crédits par vidéo traitée (0.25€)

## Flow utilisateur

```
1. User assemble sa vidéo (step 6)
        ↓
2. Page campagne : bouton "Ajouter sous-titres" à côté de "Télécharger"
        ↓
3. Modal de configuration Submagic s'ouvre
   - Sélection du template de sous-titres
   - Configuration hook textuel
   - Zooms automatiques (on/off)
   - B-rolls IA (on/off + pourcentage)
   - Suppression silences (pace)
   - Suppression mauvaises prises
        ↓
4. User clique "Lancer" (25 crédits déduits)
        ↓
5. API /api/submagic/create-project envoie vers Submagic
        ↓
6. Submagic traite en async (1-5 min)
        ↓
7. Webhook /api/webhooks/submagic reçoit la notification
        ↓
8. campaigns.submagic_video_url mis à jour
        ↓
9. User peut télécharger la version avec sous-titres
```

## Architecture technique

### Endpoints API

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/submagic/templates` | GET | Liste des templates de sous-titres (cache 6h) |
| `/api/submagic/hook-templates` | GET | Liste des templates de hook title (cache 6h) |
| `/api/submagic/create-project` | POST | Crée un projet Submagic et déduit les crédits |
| `/api/webhooks/submagic` | POST | Reçoit les notifications Submagic |

### Base de données

**Colonnes ajoutées à `campaigns`** :

| Colonne | Type | Description |
|---------|------|-------------|
| `submagic_project_id` | VARCHAR | ID du projet Submagic |
| `submagic_video_url` | TEXT | URL de la vidéo avec sous-titres |
| `submagic_status` | VARCHAR | `none`, `processing`, `completed`, `failed` |

**Coût dans `generation_costs`** :

| ID | Nom | Coût (crédits) |
|----|-----|----------------|
| `submagic_subtitles` | Sous-titres Submagic | 25 |

### Variables d'environnement

```bash
SUBMAGIC_API_KEY=sk-...  # Clé API Submagic (créer sur app.submagic.co/account)
```

## API Submagic - Référence

### Base URL
```
https://api.submagic.co/v1
```

### Authentication
Header : `x-api-key: sk-your-api-key`

### Endpoints utilisés

#### GET /templates
Récupère la liste des templates de sous-titres disponibles.

**Réponse** :
```json
{
  "templates": ["Sara", "Hormozi 2", "Beast", "Daniel", ...]
}
```

#### GET /hook-title/templates
Récupère la liste des templates de hook title.

**Réponse** :
```json
{
  "templates": ["tiktok", "hormozi", "ali", "laura", ...]
}
```

#### POST /projects
Crée un nouveau projet de sous-titrage.

**Body** :
```json
{
  "title": "Nom de la campagne",
  "language": "fr",
  "videoUrl": "https://url-video-finale.mp4",
  "templateName": "Hormozi 2",
  "hookTitle": {
    "text": "Arrête de scroller !",
    "template": "tiktok",
    "top": 45,
    "size": 32
  },
  "magicZooms": true,
  "magicBrolls": true,
  "magicBrollsPercentage": 50,
  "removeSilencePace": "fast",
  "removeBadTakes": true,
  "dictionary": ["NomMarque", "MotClé1", "MotClé2"],
  "webhookUrl": "https://domain.com/api/webhooks/submagic"
}
```

**Réponse** :
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing"
}
```

#### GET /projects/{id}
Récupère le statut d'un projet.

**Statuts possibles** : `processing`, `transcribing`, `exporting`, `completed`, `failed`

**Quand completed** :
```json
{
  "status": "completed",
  "downloadUrl": "https://app.submagic.co/api/file/download?...",
  "directUrl": "https://dqu1p08d61fh.cloudfront.net/..."
}
```

### Webhook Notification

Submagic envoie un POST à notre webhook quand le traitement est terminé :

```json
{
  "projectId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "downloadUrl": "https://app.submagic.co/api/file/download?...",
  "directUrl": "https://cloudfront.net/...",
  "timestamp": "2024-01-15T10:45:00.000Z"
}
```

## Paramètres de la modal

### Template de sous-titres
- **Type** : Dropdown
- **Source** : `/api/submagic/templates`
- **Défaut** : "Sara"
- **Note** : Case-sensitive !

### Hook Title (optionnel)
- **Toggle** : Activer/désactiver
- **Texte** : Champ texte (1-100 caractères)
- **Template** : Dropdown (tiktok, hormozi, ali...)
- **Position (top)** : Slider 0-80 (défaut: 50)
- **Taille (size)** : Slider 0-80 (défaut: 30)

### Magic Zooms
- **Type** : Toggle on/off
- **Défaut** : off
- **Description** : Zooms automatiques pour dynamiser la vidéo

### Magic B-rolls
- **Type** : Toggle on/off + Slider pourcentage
- **Défaut** : off, 50%
- **Description** : Insère des B-rolls IA générés automatiquement

### Remove Silence Pace
- **Type** : Select
- **Options** : 
  - `natural` (0.6s+ de silence supprimé)
  - `fast` (0.2-0.6s)
  - `extra-fast` (0.1-0.2s)
- **Défaut** : Aucun (ne pas envoyer si non sélectionné)

### Remove Bad Takes
- **Type** : Toggle on/off
- **Défaut** : off
- **Description** : Détecte et supprime les mauvaises prises automatiquement

### Dictionnaire (lecture seule)
- **Auto-extrait depuis** :
  - `brief.what_selling` (nom du produit)
  - Mots significatifs des scripts des clips
- **Max** : 50 termes, 50 caractères chacun
- **Usage** : Améliore la transcription des mots-clés/marques

## Rate Limits Submagic

| Type d'opération | Limite |
|------------------|--------|
| Templates, langues | 1000 req/h |
| Get project | 500 req/h |
| Create project | 500 req/h |
| Export | 50 req/h |

## Gestion des erreurs

### Erreurs Submagic

| Code | Erreur | Action |
|------|--------|--------|
| 400 | VALIDATION_ERROR | Afficher le message d'erreur |
| 401 | UNAUTHORIZED | Vérifier SUBMAGIC_API_KEY |
| 429 | RATE_LIMIT_EXCEEDED | Retry après `retryAfter` secondes |
| 500 | INTERNAL_SERVER_ERROR | Retry ou afficher erreur |

### États possibles

| submagic_status | Description | UI |
|-----------------|-------------|-----|
| `none` | Pas de traitement lancé | Bouton "Ajouter sous-titres" |
| `processing` | En cours | Loader + "Traitement en cours..." |
| `completed` | Terminé | Bouton "Télécharger (sous-titres)" |
| `failed` | Échec | Message d'erreur + bouton "Réessayer" |

## Fichiers de référence

| Fichier | Description |
|---------|-------------|
| `app/api/submagic/create-project/route.ts` | Création projet + déduction crédits |
| `app/api/submagic/templates/route.ts` | Proxy templates avec cache |
| `app/api/submagic/hook-templates/route.ts` | Proxy hook templates avec cache |
| `app/api/webhooks/submagic/route.ts` | Handler webhook |
| `components/modals/submagic-modal.tsx` | Modal de configuration |
| `app/(dashboard)/campaign/[id]/page.tsx` | Page avec bouton |

## Mapping langue UGC → Submagic

| UGC (brief.language) | Submagic |
|----------------------|----------|
| `fr` | `fr` |
| `en-us` | `en` |
| `en-uk` | `en` |
| `es` | `es` |
| `es-latam` | `es` |
| `de` | `de` |
| `it` | `it` |
| `pt-br` | `pt` |
| `pt` | `pt` |
| `nl` | `nl` |

---

*Documentation créée : 8 décembre 2024*

