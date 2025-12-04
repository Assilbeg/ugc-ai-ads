-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Ajouter les ajustements (trim/speed) dans campaign_clips
-- ═══════════════════════════════════════════════════════════════
-- 
-- Problème résolu:
-- - Les ajustements auto-calculés (via Whisper) n'étaient pas persistés
-- - L'utilisateur devait refaire les ajustements à chaque fois
-- 
-- Cette migration ajoute un champ JSONB pour stocker:
-- - trim_start: début du trim (secondes)
-- - trim_end: fin du trim (secondes)  
-- - speed: vitesse (1.0, 1.1, 1.2)
-- - processed_url: URL de la vidéo traitée (après Transloadit)
-- ═══════════════════════════════════════════════════════════════

-- Ajouter le champ adjustments à campaign_clips
ALTER TABLE campaign_clips 
ADD COLUMN IF NOT EXISTS adjustments JSONB DEFAULT NULL;

-- Commentaire pour documentation
COMMENT ON COLUMN campaign_clips.adjustments IS 
'Ajustements vidéo (trim + speed): { trim_start, trim_end, speed, processed_url }';

