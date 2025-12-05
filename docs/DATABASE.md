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

### `campaign_clips`
Clips individuels d'une campagne.

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| campaign_id | UUID | FK → campaigns |
| order | INTEGER | Numéro du beat (1-5) - **NON UNIQUE** |
| beat | VARCHAR | hook, problem, solution, proof, cta |
| is_selected | BOOLEAN | Version utilisée pour assemblage |
| first_frame | JSONB | Prompt, image_url, expression |
| script | JSONB | text, word_count |
| video | JSONB | raw_url, final_url, duration |
| audio | JSONB | voice_url, ambient_url |
| transcription | JSONB | Whisper data |
| auto_adjustments | JSONB | Trim/speed auto calculés |
| user_adjustments | JSONB | Trim/speed modifiés par user |
| current_version | INTEGER | Numéro de version |
| status | VARCHAR | pending → completed |

⚠️ **CRITIQUE** : `order` n'est PAS unique. Plusieurs clips peuvent avoir le même order (versioning).

### `clip_versions`
Historique des régénérations.

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID | PK |
| clip_id | UUID | FK → campaign_clips |
| version_number | INTEGER | 1, 2, 3... |
| first_frame, script, video, audio | JSONB | Snapshot complet |
| created_by_action | VARCHAR | initial, regenerate_video, etc. |

### `user_credits`
Solde et billing.

| Colonne | Type | Description |
|---------|------|-------------|
| user_id | UUID | FK → auth.users (UNIQUE) |
| balance | INTEGER | En centimes (peut être négatif) |
| stripe_customer_id | VARCHAR | ID client Stripe |
| subscription_tier | VARCHAR | free, starter, pro, business |
| early_bird_eligible_until | TIMESTAMP | Deadline offre Early Bird |

### `generation_costs`
Coûts par type de génération (configurable admin).

| ID | Description |
|----|-------------|
| first_frame | Image NanoBanana (par image) |
| video_veo31_fast | Vidéo Fast (par seconde) |
| video_veo31_standard | Vidéo Standard (par seconde) |
| voice_chatterbox | Voice cloning (par conversion) |
| ambient_elevenlabs | Sound effects (par génération) |

## Relations

```
auth.users (1) ─────┬──── campaigns (N)
                    │            │
                    │            └──── campaign_clips (N)
                    │                        │
                    │                        └──── clip_versions (N)
                    │
                    └──── user_credits (1)
                    │
                    └──── actors (N) ← is_custom=true
                                     ← is_custom=false (presets, user_id=null)
```

## RLS (Row Level Security)

Toutes les tables ont RLS activé :
- Users voient uniquement leurs propres données
- Les clips héritent de la propriété de la campagne
- Les presets (actors avec is_custom=false) sont publics en lecture

---

*Voir `/supabase/*.sql` pour les migrations complètes*

