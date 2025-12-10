-- ═══════════════════════════════════════════════════════════════
-- TABLE: campaign_assemblies
-- Historique des assemblages pour chaque campagne (versioning)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE campaign_assemblies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  final_video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds NUMERIC(6,2),
  -- Ajustements appliqués à chaque clip lors de l'assemblage
  clip_adjustments JSONB NOT NULL DEFAULT '[]',
  -- clip_adjustments: [{ clip_order: 1, trim_start: 0, trim_end: 6, speed: 1.0, cloudinary_id: "..." }, ...]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour récupérer rapidement les assemblages d'une campagne
CREATE INDEX idx_campaign_assemblies_campaign_id ON campaign_assemblies(campaign_id);

-- Index pour récupérer le dernier assemblage
CREATE INDEX idx_campaign_assemblies_latest ON campaign_assemblies(campaign_id, created_at DESC);

-- Trigger pour auto-incrémenter la version par campagne
CREATE OR REPLACE FUNCTION set_assembly_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := COALESCE(
    (SELECT MAX(version) + 1 FROM campaign_assemblies WHERE campaign_id = NEW.campaign_id),
    1
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_increment_assembly_version
  BEFORE INSERT ON campaign_assemblies
  FOR EACH ROW
  EXECUTE FUNCTION set_assembly_version();

-- ─────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ─────────────────────────────────────────────────────────────────

ALTER TABLE campaign_assemblies ENABLE ROW LEVEL SECURITY;

-- Users can view assemblies of their campaigns
CREATE POLICY "Users can view assemblies of their campaigns" ON campaign_assemblies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_assemblies.campaign_id 
      AND campaigns.user_id = auth.uid()
    )
  );

-- Users can create assemblies for their campaigns
CREATE POLICY "Users can create assemblies for their campaigns" ON campaign_assemblies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_assemblies.campaign_id 
      AND campaigns.user_id = auth.uid()
    )
  );

-- Users can delete assemblies of their campaigns
CREATE POLICY "Users can delete assemblies of their campaigns" ON campaign_assemblies
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM campaigns 
      WHERE campaigns.id = campaign_assemblies.campaign_id 
      AND campaigns.user_id = auth.uid()
    )
  );










