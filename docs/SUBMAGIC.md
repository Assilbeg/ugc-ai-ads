# Submagic - Intégration Sous-titres

## Vue d'ensemble

Submagic est utilisé pour générer automatiquement des sous-titres stylisés sur les vidéos UGC.
L'intégration gère un **historique complet des versions** de sous-titres.

## Architecture

### Tables

#### `campaigns` (colonnes Submagic)
| Colonne | Type | Description |
|---------|------|-------------|
| `submagic_project_id` | VARCHAR(255) | ID du projet Submagic en cours |
| `submagic_video_url` | TEXT | URL de la dernière vidéo (legacy, voir `submagic_versions`) |
| `submagic_status` | VARCHAR(50) | `none` / `processing` / `completed` / `failed` |
| `submagic_config` | JSONB | Config de la génération en cours |
| `submagic_updated_at` | TIMESTAMPTZ | Date de dernière mise à jour |

#### `submagic_versions` (historique)
| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | ID unique |
| `campaign_id` | UUID | Référence à la campagne |
| `project_id` | VARCHAR(255) | ID projet Submagic |
| `video_url` | TEXT | URL de la vidéo sous-titrée |
| `config` | JSONB | Configuration utilisée |
| `status` | VARCHAR(50) | Statut (completed) |
| `version_number` | INTEGER | Numéro de version (1, 2, 3...) |
| `created_at` | TIMESTAMPTZ | Date de création |

### Format de `config`
```json
{
  "templateName": "Hormozi 2",
  "hasHook": true,
  "hookText": "Le secret que personne ne dit 🤫",
  "magicZooms": false,
  "magicBrolls": true,
  "removeBadTakes": false
}
```

## Endpoints API

### POST `/api/submagic/create-project`
Crée un nouveau projet Submagic pour générer des sous-titres.

**Body:**
```json
{
  "campaignId": "uuid",
  "config": {
    "templateName": "Sara",
    "hookTitle": {
      "enabled": true,
      "text": "Hook text",
      "template": "tiktok",
      "top": 50,
      "size": 30
    },
    "magicZooms": false,
    "magicBrolls": true,
    "magicBrollsPercentage": 50,
    "removeSilencePace": "natural",
    "removeBadTakes": false
  }
}
```

**Coût:** 25 crédits

### POST `/api/submagic/generate-hook`
Génère un hook via Claude AI basé sur le brief et le script.

**Body:**
```json
{
  "campaignId": "uuid"
}
```

**Response:**
```json
{
  "hook": "Le secret que personne ne dit 🤫"
}
```

### GET `/api/submagic/templates`
Récupère la liste des templates de sous-titres disponibles.

### GET `/api/submagic/hook-templates`
Récupère la liste des templates de hook disponibles.

### POST `/api/webhooks/submagic`
Webhook appelé par Submagic quand le traitement est terminé.

**Actions:**
1. Met à jour `submagic_status` et `submagic_video_url`
2. **Crée une entrée dans `submagic_versions`** avec numéro de version incrémenté
3. Stocke la config utilisée dans l'historique

## Flow de génération

```
[User clique "Ajouter sous-titres"]
       ↓
[Modal s'ouvre avec config]
       ↓
[User configure (template, hook, zooms...)]
       ↓
[POST /api/submagic/create-project]
       ↓
[Submagic API crée le projet]
       ↓
[Campaign: submagic_status = "processing"]
       ↓
[Page affiche overlay "En cours..."]
       ↓
[Submagic traite la vidéo (1-5 min)]
       ↓
[Webhook POST /api/webhooks/submagic]
       ↓
[Nouvelle entrée dans submagic_versions]
       ↓
[Campaign: submagic_status = "completed"]
       ↓
[Page affiche nouvelle version]
```

## UI - Page Campagne

### Vidéo principale
- Affiche la **dernière version** (sous-titres si dispo, sinon originale)
- Pendant processing: **overlay de chargement** avec spinner et info

### Boutons de téléchargement (sous la vidéo)
- "Télécharger" → vidéo originale
- "Avec sous-titres" → dernière version sous-titrée (si dispo)

### Boutons d'action (à droite)
- "Modifier la vidéo" → `/new/{id}`
- "Ajouter/Modifier sous-titres" → ouvre le modal

### Historique des versions
Affiche **toutes les versions** de sous-titres avec :
- Numéro de version (v1, v2, v3...)
- Template utilisé
- Options activées (Hook, Zooms, B-rolls)
- Date de création
- Badge "Actuelle" pour la dernière
- Bouton télécharger pour chaque version

## Modal de configuration

### Sections
1. **Hook Title** - Texte d'accroche avec génération IA
2. **Style de sous-titres** - Grille visuelle des templates
3. **Options vidéo** - Magic Zooms, Bad Takes, B-rolls
4. **Options audio** - Suppression des silences

### Templates disponibles
- Trend: Laura, Kelly 2, Lewis, Doug, Mark, Sara, Daniel
- Premium: Hormozi 1-5, Beast, Gstaad, Nema
- Emoji: Sara, Ali, Beast, Maya
- New: Laura, Kelly 2, Caleb, Kendrick, Hormozi 4

### Themes de Hook
tiktok, laura, steph, kevin, kelly, mark, logan, enrico, mike, devin, hormozi, masi, ali

## Comportements critiques

### ⚠️ NE JAMAIS
- Supprimer une version existante de `submagic_versions`
- Écraser `submagic_video_url` sans créer d'entrée dans l'historique
- Lancer une génération si `submagic_status === 'processing'`

### ✅ TOUJOURS
- Créer une entrée dans `submagic_versions` à chaque génération réussie
- Incrémenter `version_number` correctement
- Afficher l'overlay pendant le processing
- Permettre de télécharger n'importe quelle version de l'historique

## Coûts et crédits

| Action | Coût |
|--------|------|
| Génération sous-titres | 25 crédits |
| Génération hook (Claude) | Gratuit (inclus) |

Les admins ne paient pas de crédits.

## Commits de référence

- `1e10f43` - Overlay de chargement pendant génération
- `b9c67a1` - Colonnes submagic_config et submagic_updated_at
- `fcd06ec` - Simplification boutons (Télécharger + Modifier)
