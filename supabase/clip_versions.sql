-- ═══════════════════════════════════════════════════════════════
-- MIGRATION: Historique des versions de clips
-- ═══════════════════════════════════════════════════════════════
-- 
-- Permet de garder l'historique des régénérations de chaque clip.
-- Chaque fois qu'on régénère un clip (vidéo, voix, ambiance),
-- on archive l'ancienne version avant d'écraser.
--
-- Structure:
--   Campaign (1) → Clips (N) → Versions (N)
--
-- ═══════════════════════════════════════════════════════════════

-- Table d'historique des versions de clips
CREATE TABLE IF NOT EXISTS clip_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clip_id UUID NOT NULL REFERENCES campaign_clips(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  
  -- Données de la version (snapshot complet)
  first_frame JSONB NOT NULL DEFAULT '{}',
  script JSONB NOT NULL DEFAULT '{}',
  video JSONB NOT NULL DEFAULT '{}',
  audio JSONB NOT NULL DEFAULT '{}',
  transcription JSONB DEFAULT NULL,
  adjustments JSONB DEFAULT NULL,
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by_action VARCHAR(50), -- 'initial', 'regenerate_video', 'regenerate_voice', etc.
  
  -- Contrainte: une seule version avec le même numéro par clip
  CONSTRAINT unique_clip_version UNIQUE (clip_id, version_number)
);

-- Index pour récupérer rapidement les versions d'un clip
CREATE INDEX IF NOT EXISTS idx_clip_versions_clip_id ON clip_versions(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_versions_created_at ON clip_versions(clip_id, created_at DESC);

-- Ajouter un champ current_version dans campaign_clips
ALTER TABLE campaign_clips 
ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1;

-- Commentaires pour documentation
COMMENT ON TABLE clip_versions IS 'Historique des versions de chaque clip (vidéo, voix, ambiance)';
COMMENT ON COLUMN clip_versions.version_number IS 'Numéro de version (1, 2, 3...)';
COMMENT ON COLUMN clip_versions.created_by_action IS 'Action qui a créé cette version: initial, regenerate_video, regenerate_voice, regenerate_ambient, regenerate_all';
COMMENT ON COLUMN campaign_clips.current_version IS 'Numéro de la version actuellement active';

-- ─────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE clip_versions ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir les versions de leurs clips
CREATE POLICY "Users can view versions of their clips" ON clip_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaign_clips 
      JOIN campaigns ON campaigns.id = campaign_clips.campaign_id
      WHERE campaign_clips.id = clip_versions.clip_id 
      AND campaigns.user_id = auth.uid()
    )
  );

-- Les utilisateurs peuvent créer des versions pour leurs clips
CREATE POLICY "Users can create versions for their clips" ON clip_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaign_clips 
      JOIN campaigns ON campaigns.id = campaign_clips.campaign_id
      WHERE campaign_clips.id = clip_versions.clip_id 
      AND campaigns.user_id = auth.uid()
    )
  );

-- Les utilisateurs peuvent supprimer les versions de leurs clips
CREATE POLICY "Users can delete versions of their clips" ON clip_versions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM campaign_clips 
      JOIN campaigns ON campaigns.id = campaign_clips.campaign_id
      WHERE campaign_clips.id = clip_versions.clip_id 
      AND campaigns.user_id = auth.uid()
    )
  );

