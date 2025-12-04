-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Ajustements v2 - Auto vs User
-- ═══════════════════════════════════════════════════════════════
-- 
-- Nouvelle structure pour séparer :
--   - auto_adjustments : calculés par Whisper/Claude (IA)
--   - user_adjustments : modifiés manuellement par l'utilisateur
-- 
-- LOGIQUE DE PRIORITÉ :
--   Si user_adjustments.updated_at > auto_adjustments.updated_at
--   → Utiliser user_adjustments
--   Sinon → Utiliser auto_adjustments
-- 
-- Cela permet :
--   - De garder les valeurs IA comme référence
--   - De savoir si l'utilisateur a personnalisé
--   - De "reset aux valeurs IA" facilement
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- NOUVEAUX CHAMPS
-- ─────────────────────────────────────────────────────────────────

-- Ajustements calculés automatiquement par Whisper/Claude
-- Structure : { trim_start, trim_end, speed, updated_at }
ALTER TABLE campaign_clips 
ADD COLUMN IF NOT EXISTS auto_adjustments JSONB DEFAULT NULL;

COMMENT ON COLUMN campaign_clips.auto_adjustments IS 
'Ajustements automatiques (Whisper/Claude): { trim_start, trim_end, speed, updated_at }';

-- Ajustements modifiés par l'utilisateur
-- Structure : { trim_start, trim_end, speed, updated_at }
ALTER TABLE campaign_clips 
ADD COLUMN IF NOT EXISTS user_adjustments JSONB DEFAULT NULL;

COMMENT ON COLUMN campaign_clips.user_adjustments IS 
'Ajustements utilisateur (personnalisés): { trim_start, trim_end, speed, updated_at }';

-- ─────────────────────────────────────────────────────────────────
-- MIGRATION DES DONNÉES EXISTANTES
-- ─────────────────────────────────────────────────────────────────
-- On migre les anciennes données vers auto_adjustments (car elles
-- ont été calculées par Whisper), sauf si transcription manquante

UPDATE campaign_clips 
SET auto_adjustments = jsonb_build_object(
  'trim_start', COALESCE((adjustments->>'trimStart')::float, 0),
  'trim_end', COALESCE((adjustments->>'trimEnd')::float, (video->>'duration')::float),
  'speed', COALESCE((adjustments->>'speed')::float, 1.0),
  'updated_at', COALESCE(updated_at, created_at, NOW())
)
WHERE adjustments IS NOT NULL 
  AND auto_adjustments IS NULL;

-- ─────────────────────────────────────────────────────────────────
-- INDEX pour requêtes rapides
-- ─────────────────────────────────────────────────────────────────

-- Index pour trouver les clips avec ajustements utilisateur
CREATE INDEX IF NOT EXISTS idx_campaign_clips_has_user_adjustments 
ON campaign_clips ((user_adjustments IS NOT NULL));

-- ─────────────────────────────────────────────────────────────────
-- NOTE: On garde l'ancien champ 'adjustments' pour compatibilité
-- descendante mais il sera progressivement remplacé
-- ─────────────────────────────────────────────────────────────────

-- Ajouter aussi ces champs à clip_versions pour l'historique
ALTER TABLE clip_versions 
ADD COLUMN IF NOT EXISTS auto_adjustments JSONB DEFAULT NULL;

ALTER TABLE clip_versions 
ADD COLUMN IF NOT EXISTS user_adjustments JSONB DEFAULT NULL;

COMMENT ON COLUMN clip_versions.auto_adjustments IS 
'Snapshot des ajustements automatiques au moment de la version';

COMMENT ON COLUMN clip_versions.user_adjustments IS 
'Snapshot des ajustements utilisateur au moment de la version';

