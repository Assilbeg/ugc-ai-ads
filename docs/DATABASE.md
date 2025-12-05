# 🗄️ Base de Données - Schéma Supabase

> Project ID : `xresijptcptdilwecklf`

## Tables Principales

### `campaigns`
Projets utilisateur.

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → auth.users |
| actor_id | UUID | FK → actors |
| preset_id | VARCHAR | ID du preset (code, pas FK) |
| product | JSONB | Config produit |
| brief | JSONB | Brief utilisateur |
| status | VARCHAR | draft, generating, completed, failed |
| final_video_url | TEXT | URL vidéo assemblée |
| thumbnail_url | TEXT | URL miniature (générée lors de l'assemblage) |
| created_at | TIMESTAMPTZ | Date de création |
| updated_at | TIMESTAMPTZ | Date de modification |

### `campaign_clips`
Clips individuels d'une campagne.

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| campaign_id | UUID | FK → campaigns |
| order | INTEGER | Numéro du beat (1-5) - **NON UNIQUE** |
| beat | VARCHAR | hook, problem, solution, proof, cta |
| is_selected | BOOLEAN | Version utilisée pour assemblage (défaut: false) |
| first_frame | JSONB | Prompt, image_url, expression, gesture, location |
| script | JSONB | text, word_count |
| video | JSONB | raw_url, final_url, duration, engine, prompt |
| audio | JSONB | voice_url, ambient_url, volumes |
| transcription | JSONB | Whisper data avec timestamps |
| auto_adjustments | JSONB | Trim/speed auto calculés par Whisper |
| user_adjustments | JSONB | Trim/speed modifiés par user |
| adjustments | JSONB | LEGACY - Pour compatibilité |
| current_version | INTEGER | Numéro de version (défaut: 1) |
| status | VARCHAR | pending, generating_*, completed, failed |
| created_at | TIMESTAMPTZ | Date de création |
| updated_at | TIMESTAMPTZ | Date de modification |

⚠️ **CRITIQUE** : `order` n'est PAS unique. Plusieurs clips peuvent avoir le même order (versioning).

#### Mapping Beat → Order

| Order | Beat | Description |
|-------|------|-------------|
| 1 | hook | Accroche initiale |
| 2 | problem | Présentation du problème |
| 3 | solution | Présentation de la solution |
| 4 | proof | Preuve sociale / résultats |
| 5 | cta | Call-to-action |

> Note: Le beat "agitation" peut remplacer "problem" selon le preset.

### `clip_versions`
Historique des régénérations.

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| clip_id | UUID | FK → campaign_clips |
| version_number | INTEGER | 1, 2, 3... |
| first_frame | JSONB | Snapshot du first_frame |
| script | JSONB | Snapshot du script |
| video | JSONB | Snapshot de la vidéo |
| audio | JSONB | Snapshot de l'audio |
| transcription | JSONB | Snapshot de la transcription |
| auto_adjustments | JSONB | Snapshot des ajustements auto |
| user_adjustments | JSONB | Snapshot des ajustements user |
| adjustments | JSONB | LEGACY |
| created_by_action | VARCHAR | Action ayant créé cette version |
| created_at | TIMESTAMPTZ | Date de création |

#### Actions possibles (`created_by_action`)

| Action | Description |
|--------|-------------|
| initial | Première génération |
| regenerate_video | Régénération de la vidéo |
| regenerate_voice | Régénération de la voix |
| regenerate_ambient | Régénération de l'ambiance |
| regenerate_frame | Régénération du first frame |
| regenerate_all | Régénération complète |

### `intention_presets`
Templates d'intentions (presets) utilisés pour les campagnes.

| Colonne | Type | Description |
|---------|------|-------------|
| id | VARCHAR | PK (slug/id du preset) |
| name | VARCHAR | Nom du preset |
| slug | VARCHAR | Slug unique |
| description | TEXT | Description marketing |
| thumbnail_url | TEXT | Illustration |
| filming_type | VARCHAR | `handheld` (défaut), `filmed_by_other`, `setup_phone` |
| first_frame | JSONB | location, posture, lighting, base_expression, camera_angle, extra_prompt, scene_mode, location_by_beat?, camera_style, camera_style_by_beat? |
| script | JSONB | tone, structure, hook_templates, cta_templates |
| ambient_audio | JSONB | prompt, intensity |
| suggested_total_duration | INTEGER | Durée suggérée (s) |
| suggested_clip_count | INTEGER | Nombre de clips suggéré |

> `filming_type` pilote le prompt vidéo (selfie vs filmé vs téléphone posé) en combinaison avec `camera_style`.

### `campaign_assemblies`
Historique des assemblages vidéo.

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| campaign_id | UUID | FK → campaigns |
| version | INTEGER | Numéro de version (défaut: 1) |
| final_video_url | TEXT | URL de la vidéo assemblée |
| thumbnail_url | TEXT | URL de la miniature |
| duration_seconds | NUMERIC | Durée totale en secondes |
| clip_adjustments | JSONB | Ajustements appliqués par clip |
| created_at | TIMESTAMPTZ | Date de création |

---

## Tables Acteurs

### `actors`
Acteurs IA disponibles.

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → auth.users (nullable pour presets) |
| name | VARCHAR | Nom de l'acteur |
| thumbnail_video_url | TEXT | Vidéo preview |
| soul_image_url | TEXT | Image de référence (obligatoire) |
| voice | JSONB | reference_audio_url, voice_style |
| appearance | JSONB | gender, age_range, ethnicity, hair, features |
| intention_media | JSONB | Médias pré-générés par preset |
| is_custom | BOOLEAN | true = créé par user, false = preset public |
| created_at | TIMESTAMPTZ | Date de création |

#### Structure `intention_media`
```json
{
  "preset-id": {
    "image_url": "https://...",
    "video_url": "https://...",
    "custom_frame_prompt": "..."
  }
}
```

---

## Tables Billing

### `user_credits`
Solde et informations d'abonnement.

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → auth.users (UNIQUE) |
| balance | INTEGER | Solde en crédits (peut être négatif) |
| stripe_customer_id | VARCHAR | ID client Stripe |
| subscription_tier | VARCHAR | free, starter, pro, business |
| subscription_stripe_id | VARCHAR | ID abonnement Stripe |
| subscription_status | VARCHAR | none, active, canceled, past_due |
| subscription_current_period_end | TIMESTAMPTZ | Fin de période |
| early_bird_eligible_until | TIMESTAMPTZ | Deadline offre Early Bird |
| early_bird_used | BOOLEAN | Offre utilisée (défaut: false) |
| created_at | TIMESTAMPTZ | Date de création |
| updated_at | TIMESTAMPTZ | Date de modification |

⚠️ **IMPORTANT** : 1 crédit = 1 centime d'euro. Le `balance` est en crédits, pas en centimes.

### `credit_transactions`
Historique des transactions de crédits.

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → auth.users |
| amount | INTEGER | Montant (positif = ajout, négatif = usage) |
| balance_after | INTEGER | Solde après transaction |
| type | VARCHAR | purchase, usage, bonus, refund, subscription_credit |
| description | TEXT | Description de la transaction |
| generation_type | VARCHAR | Type de génération (si usage) |
| campaign_id | UUID | FK → campaigns (nullable) |
| clip_id | UUID | FK (nullable) |
| stripe_payment_intent_id | VARCHAR | ID paiement Stripe (si achat) |
| stripe_invoice_id | VARCHAR | ID facture Stripe (si abo) |
| created_at | TIMESTAMPTZ | Date de création |

### `subscription_plans`
Plans d'abonnement disponibles.

| Colonne | Type | Description |
|---------|------|-------------|
| id | VARCHAR | PK (ex: starter, pro, business) |
| name | VARCHAR | Nom affiché |
| description | TEXT | Description du plan |
| price_cents | INTEGER | Prix en centimes EUR |
| monthly_credits | INTEGER | Crédits mensuels inclus |
| stripe_price_id | VARCHAR | ID du prix Stripe |
| is_early_bird | BOOLEAN | Plan Early Bird (défaut: false) |
| is_one_time | BOOLEAN | Paiement unique (défaut: false) |
| is_active | BOOLEAN | Plan actif (défaut: true) |
| display_order | INTEGER | Ordre d'affichage |
| features | JSONB | Liste des features du plan |
| created_at | TIMESTAMPTZ | Date de création |
| updated_at | TIMESTAMPTZ | Date de modification |

### `generation_costs`
Coûts par type de génération (configurable admin).

| ID | Name | Description | Coût (crédits) |
|----|------|-------------|----------------|
| first_frame | First Frame | Image NanoBanana (par image) | 25 |
| video_veo31_fast | Vidéo Fast | Veo 3.1 Fast (par seconde) | 25/s |
| video_veo31_standard | Vidéo Standard | Veo 3.1 Standard (par seconde) | 60/s |
| voice_chatterbox | Voice Conversion | ChatterboxHD S2S (par conversion) | 20 |
| ambient_elevenlabs | Ambient Audio | ElevenLabs SFX (par génération) | 15 |

#### Structure de la table

| Colonne | Type | Description |
|---------|------|-------------|
| id | VARCHAR | PK (identifiant du type) |
| name | VARCHAR | Nom affiché |
| description | TEXT | Description |
| cost_cents | INTEGER | Coût facturé en crédits |
| real_cost_cents | INTEGER | Coût réel fal.ai en centimes |
| is_active | BOOLEAN | Actif (défaut: true) |
| created_at | TIMESTAMPTZ | Date de création |
| updated_at | TIMESTAMPTZ | Date de modification |

---

## Tables Système

### `generated_assets`
Cache des assets générés pour réutilisation.

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| asset_type | VARCHAR | first_frame, video, audio, ambient |
| actor_id | UUID | FK → actors (nullable) |
| preset_id | VARCHAR | ID du preset (nullable) |
| campaign_id | UUID | FK → campaigns (nullable) |
| prompt | TEXT | Prompt utilisé |
| prompt_hash | VARCHAR | Hash du prompt (pour lookup) |
| url | TEXT | URL de l'asset |
| generation_cost | NUMERIC | Coût de génération |
| generation_time_ms | INTEGER | Temps de génération en ms |
| model_used | VARCHAR | Modèle IA utilisé |
| use_count | INTEGER | Nombre de réutilisations (défaut: 1) |
| last_used_at | TIMESTAMPTZ | Dernière utilisation |
| created_at | TIMESTAMPTZ | Date de création |

### `generation_logs`
Logs de toutes les générations IA.

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK → auth.users |
| generation_type | VARCHAR | Type de génération |
| model_path | VARCHAR | Path du modèle fal.ai |
| fal_request_id | VARCHAR | ID de requête fal.ai |
| input_params | JSONB | Paramètres d'entrée |
| output_url | TEXT | URL du résultat |
| output_metadata | JSONB | Métadonnées du résultat |
| started_at | TIMESTAMPTZ | Début de génération |
| completed_at | TIMESTAMPTZ | Fin de génération |
| duration_ms | INTEGER | Durée en ms |
| estimated_cost_cents | INTEGER | Coût estimé |
| actual_cost_cents | INTEGER | Coût réel fal.ai |
| billed_cost_cents | INTEGER | Coût facturé |
| status | VARCHAR | pending, processing, completed, failed |
| error_message | TEXT | Message d'erreur si échec |
| campaign_id | UUID | FK → campaigns (nullable) |
| clip_id | UUID | FK (nullable) |
| credit_transaction_id | UUID | FK → credit_transactions |
| created_at | TIMESTAMPTZ | Date de création |

### `system_prompts`
Prompts système configurables.

| Colonne | Type | Description |
|---------|------|-------------|
| id | VARCHAR | PK (identifiant du prompt) |
| name | VARCHAR | Nom affiché |
| description | TEXT | Description |
| prompt | TEXT | Contenu du prompt |
| updated_at | TIMESTAMPTZ | Dernière modification |

---

## Relations

```
auth.users (1) ─────┬──── campaigns (N)
                    │            │
                    │            ├──── campaign_clips (N)
                    │            │            │
                    │            │            └──── clip_versions (N)
                    │            │
                    │            └──── campaign_assemblies (N)
                    │
                    ├──── user_credits (1)
                    │            │
                    │            └──── credit_transactions (N)
                    │
                    ├──── generation_logs (N)
                    │
                    └──── actors (N) ← is_custom=true
                                     ← is_custom=false (presets, user_id=null)
```

---

## RLS (Row Level Security)

Toutes les tables ont RLS activé :
- Users voient uniquement leurs propres données
- Les clips héritent de la propriété de la campagne
- Les presets (actors avec is_custom=false) sont publics en lecture
- `generation_costs` et `subscription_plans` sont publics en lecture

### Policy spéciale : Acteurs

Les acteurs preset ont `user_id = null`, ce qui posait problème pour les modifications admin.

**Solution** : La policy UPDATE sur `actors` autorise les admins à modifier les acteurs preset :

```sql
-- Policy UPDATE sur actors
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

> Voir `CRITICAL_BEHAVIORS.md` section 14 pour plus de détails.

---

## Fonctions SQL

### `deduct_credits()`
Déduit des crédits avec lock pour éviter les race conditions.

```sql
deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_generation_type VARCHAR DEFAULT NULL,
  p_campaign_id UUID DEFAULT NULL,
  p_clip_id UUID DEFAULT NULL
) RETURNS TABLE(success BOOLEAN, new_balance INTEGER, error_message TEXT)
```

⚠️ **IMPORTANT** : Autorise les balances négatives (voir CRITICAL_BEHAVIORS.md)

### `add_credits()`
Ajoute des crédits (achats, bonus, remboursements).

```sql
add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_type VARCHAR DEFAULT 'purchase',
  p_stripe_payment_intent_id VARCHAR DEFAULT NULL,
  p_stripe_invoice_id VARCHAR DEFAULT NULL
) RETURNS TABLE(success BOOLEAN, new_balance INTEGER, error_message TEXT)
```

---

## 📝 Requêtes SQL Utiles

### Clips et Versioning

```sql
-- Obtenir le clip sélectionné pour un beat
-- (is_selected prioritaire, sinon le plus récent)
SELECT * FROM campaign_clips 
WHERE campaign_id = 'CAMPAIGN_UUID' 
  AND "order" = 1  -- hook
ORDER BY is_selected DESC, created_at DESC 
LIMIT 1;

-- Voir toutes les versions d'un beat
SELECT id, "order", beat, is_selected, 
       video->>'final_url' as video_url,
       created_at 
FROM campaign_clips 
WHERE campaign_id = 'CAMPAIGN_UUID' 
  AND "order" = 1
ORDER BY created_at DESC;

-- Compter les clips par beat pour une campagne
SELECT "order", beat, COUNT(*) as versions
FROM campaign_clips
WHERE campaign_id = 'CAMPAIGN_UUID'
GROUP BY "order", beat
ORDER BY "order";

-- Obtenir tous les clips sélectionnés pour l'assemblage
SELECT * FROM campaign_clips
WHERE campaign_id = 'CAMPAIGN_UUID'
  AND is_selected = true
ORDER BY "order";
```

### Crédits et Facturation

```sql
-- Vérifier la balance d'un user
SELECT balance, subscription_tier, subscription_status
FROM user_credits 
WHERE user_id = 'USER_UUID';

-- Historique des transactions d'un user
SELECT amount, balance_after, type, description, created_at
FROM credit_transactions
WHERE user_id = 'USER_UUID'
ORDER BY created_at DESC
LIMIT 20;

-- Coûts des générations d'une campagne
SELECT generation_type, SUM(billed_cost_cents) as total_cost
FROM generation_logs
WHERE campaign_id = 'CAMPAIGN_UUID'
  AND status = 'completed'
GROUP BY generation_type;

-- Voir les coûts configurés
SELECT id, name, cost_cents, real_cost_cents 
FROM generation_costs 
WHERE is_active = true
ORDER BY id;
```

### Campagnes et Assemblages

```sql
-- Statut des campagnes d'un user
SELECT id, status, final_video_url, created_at
FROM campaigns
WHERE user_id = 'USER_UUID'
ORDER BY created_at DESC;

-- Historique des assemblages d'une campagne
SELECT version, final_video_url, duration_seconds, created_at
FROM campaign_assemblies
WHERE campaign_id = 'CAMPAIGN_UUID'
ORDER BY version DESC;

-- Clips avec vidéos générées (pour debug)
SELECT id, "order", beat, 
       video->>'raw_url' as raw,
       video->>'final_url' as final,
       status
FROM campaign_clips
WHERE campaign_id = 'CAMPAIGN_UUID'
ORDER BY "order";
```

### Logs et Debug

```sql
-- Dernières générations (toutes)
SELECT generation_type, model_path, status, 
       duration_ms, billed_cost_cents, created_at
FROM generation_logs
WHERE user_id = 'USER_UUID'
ORDER BY created_at DESC
LIMIT 10;

-- Générations échouées
SELECT generation_type, error_message, input_params, created_at
FROM generation_logs
WHERE status = 'failed'
  AND user_id = 'USER_UUID'
ORDER BY created_at DESC
LIMIT 5;

-- Vérifier si un asset existe déjà (cache)
SELECT * FROM generated_assets
WHERE prompt_hash = 'HASH_DU_PROMPT'
  AND asset_type = 'first_frame';
```

### Acteurs

```sql
-- Lister les acteurs publics (presets)
SELECT id, name, thumbnail_video_url
FROM actors
WHERE is_custom = false
ORDER BY name;

-- Acteurs custom d'un user
SELECT id, name, soul_image_url, created_at
FROM actors
WHERE user_id = 'USER_UUID'
  AND is_custom = true;
```

#### Acteurs preset disponibles (décembre 2024)

| Nom | Genre | Âge | Ethnicité |
|-----|-------|-----|-----------|
| Luna | Femme | 25-30 | - |
| Emma | Femme | 24-28 | European |
| Sofia | Femme | 22-28 | Latin American |
| Aisha | Femme | 26-32 | African |
| Marco | Homme | 30-35 | Mediterranean |
| Kenji | Homme | 25-30 | East Asian |

> Les images soul sont générées via **Higgsfield Soul** (preset 0.5 selfie).
> Voir `CRITICAL_BEHAVIORS.md` section 13 pour les guidelines de prompt.

---

## 📂 Fichiers de référence

| Fichier | Description |
|---------|-------------|
| `/supabase/*.sql` | Migrations SQL complètes |
| `/types/index.ts` | **Types TypeScript** - Source de vérité pour les structures de données |
| `/lib/credits.ts` | Logique de crédits (check, deduct, add) |
| `/lib/generation-logger.ts` | Logging des générations |

### Types TypeScript importants (types/index.ts)

```typescript
// Clip principal
interface CampaignClip {
  id: string;
  campaign_id: string;
  order: number;              // 1-5
  beat: ScriptBeat;           // hook, problem, solution, proof, cta
  first_frame: ClipFirstFrame;
  script: ClipScript;
  video: ClipVideo;
  audio: ClipAudio;
  transcription?: ClipTranscription;
  auto_adjustments?: AutoAdjustments;  // Calculés par Whisper/Claude
  user_adjustments?: UserAdjustments;  // Modifiés par l'utilisateur
  is_selected?: boolean;               // Pour assemblage
  status: ClipStatus;
}

// Ajustements (la fonction getEffectiveAdjustments() est dans ce fichier)
interface AutoAdjustments {
  trim_start: number;
  trim_end: number;
  speed: number;
  updated_at: string;  // CRITIQUE pour la priorité
}

interface UserAdjustments {
  trim_start: number;
  trim_end: number;
  speed: number;
  updated_at: string;  // CRITIQUE pour la priorité
}

// Types de beat
type ScriptBeat = "hook" | "problem" | "agitation" | "solution" | "proof" | "cta";

// Status possibles
type ClipStatus = "pending" | "generating_frame" | "generating_video" | 
                  "generating_voice" | "generating_ambient" | "completed" | "failed";
```

> **Note** : Toujours utiliser `getEffectiveAdjustments()` de `types/index.ts` pour obtenir les ajustements effectifs (user > auto si plus récent).

---

*Voir `/supabase/*.sql` pour les migrations complètes*

*Dernière mise à jour : 5 décembre 2024*
